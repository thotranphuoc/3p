# Fix: Timer Reload Race Condition on Logout/Login

## 🐛 Vấn đề

**Triệu chứng**: Sau khi logout và login lại, timer vẫn tự động load lại mặc dù đã stop.

**Logs cho thấy**:
```
[TimerService] Timer stopped successfully, duration: 62
[GlobalTimer] Timer stopped, clearing task info
[GlobalTimer] Timer changed, loading task info: {...}  ← Timer load lại!
```

---

## 🔍 Root Cause: Race Condition

### Flow gây ra vấn đề:

```
1. User clicks Logout
   ↓
2. AuthService.signOut() calls TimerService.stopTimer()
   ↓
3. stopTimer() starts batch.commit() (ASYNC - chưa xong!)
   ↓
4. User logout complete
   ↓
5. User login lại (nhanh)
   ↓
6. onAuthStateChanged() → loadUserProfile()
   ↓
7. loadUserProfile() đọc Firestore → active_timer VẪN CÒN (vì batch chưa commit!)
   ↓
8. TimerService effect() detects active_timer
   ↓
9. TIMER LOAD LẠI! ❌
```

### Nguyên nhân chính:

1. **Async batch commit**: `batch.commit()` là async, mất vài trăm ms
2. **Fast logout/login**: User có thể logout và login lại trước khi commit xong
3. **No synchronization**: Không có mechanism để prevent reload trong khi đang stop
4. **Effect triggers immediately**: Effect trong TimerService chạy ngay khi detect active_timer

---

## ✅ Giải pháp đã implement

### Fix 1: `isStopping` Flag

**Purpose**: Prevent timer reload during stop operation

```typescript
private isStopping = false; // Flag to prevent reload

constructor() {
  effect(() => {
    const userProfile = this.authService.currentUserProfile();
    
    // Skip if we're in the middle of stopping
    if (this.isStopping) {
      console.log('[TimerService] Skipping timer load - stop in progress');
      return;
    }
    
    if (userProfile?.active_timer) {
      this.loadActiveTimer(userProfile.active_timer);
    }
  });
}
```

**Result**: Effect sẽ skip reload nếu đang có stop operation

---

### Fix 2: Set Flag Before Stop

```typescript
async stopTimer(): Promise<void> {
  // Set flag FIRST - before any async operations
  this.isStopping = true;
  console.log('[TimerService] Starting stop operation...');
  
  try {
    // ... batch write logic
    await batch.commit();
    
    // Add delay to ensure Firestore propagation
    await new Promise(resolve => setTimeout(resolve, 500));
    
  } finally {
    // Clear flag in finally block (always executes)
    this.isStopping = false;
    console.log('[TimerService] Stop operation completed');
  }
}
```

**Benefits**:
- ✅ Flag set trước khi bất kỳ async operation nào
- ✅ `finally` block đảm bảo flag được clear ngay cả khi có error
- ✅ 500ms delay cho Firestore time để propagate changes

---

### Fix 3: Reset Local State BEFORE Commit

**Before**:
```typescript
await batch.commit();
// Reset local state AFTER commit
this.activeTimer.set(null);
this.elapsedSeconds.set(0);
```

**After**:
```typescript
// Reset local state BEFORE commit
this.activeTimer.set(null);
this.elapsedSeconds.set(0);

await batch.commit();
```

**Why**: Nếu user logout ngay sau khi call stopTimer(), local state đã được clear ngay lập tức.

---

### Fix 4: Propagation Delay

```typescript
await batch.commit();
console.log('[TimerService] Batch committed');

// Wait for Firestore to propagate changes
await new Promise(resolve => setTimeout(resolve, 500));
```

**Purpose**: Đảm bảo Firestore có time để sync `active_timer: null` trước khi user có thể login lại.

---

### Fix 5: Same Fix for forceStopTimer()

```typescript
async forceStopTimer(): Promise<void> {
  this.isStopping = true; // Set flag
  
  try {
    await updateDoc(userRef, { active_timer: null });
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay
  } finally {
    this.isStopping = false; // Clear flag
  }
}
```

---

## 🎯 New Flow (Fixed)

```
1. User clicks Logout
   ↓
2. stopTimer() called
   ↓
3. isStopping = true (IMMEDIATELY)
   ↓
4. Local state cleared (activeTimer = null)
   ↓
5. Batch commit starts
   ↓
6. Effect tries to run → SKIPPED (isStopping = true)
   ↓
7. Batch commit completes
   ↓
8. 500ms delay (let Firestore propagate)
   ↓
9. isStopping = false (in finally block)
   ↓
10. User logout complete
   ↓
11. User login lại
    ↓
12. loadUserProfile() → active_timer is null ✅
    ↓
13. Effect runs → No timer to load ✅
```

---

## 📊 Expected Logs (After Fix)

### Normal Logout with Timer:

```
[Dashboard] Logging out user...
[AuthService] User has active timer, clearing before logout
[TimerService] Starting stop timer operation...
[TimerService] Skipping timer load - stop operation in progress  ← Flag working!
[TimerService] Timer stopped successfully, duration: 62
[TimerService] Batch committed, active_timer cleared in Firestore
[TimerService] Stop operation completed, flag cleared
[AuthService] Timer stopped successfully before logout
[Dashboard] Logout successful, navigating to login
```

### Login Again (No Timer):

```
[AuthService] Loading user profile...
[TimerService] No active timer in user profile, clearing local state  ← Correct!
```

---

## 🧪 Test Cases

### Test 1: Normal Logout (Slow)
1. Start timer
2. Wait 5 seconds
3. Click logout
4. Wait 2 seconds
5. Login again
6. **Expected**: No timer running ✅

### Test 2: Fast Logout/Login (Race Condition Test)
1. Start timer
2. Click logout IMMEDIATELY
3. Login lại IMMEDIATELY (fast!)
4. **Expected**: No timer running ✅
5. **Check logs**: Should see "Skipping timer load - stop in progress"

### Test 3: Logout During Timer Stop
1. Start timer
2. Click stop timer button
3. While stopping, click logout
4. **Expected**: Both operations complete successfully
5. Login again → No timer ✅

### Test 4: Force Stop Edge Case
1. Start timer
2. Delete task/subtask in Firestore
3. Click logout
4. **Expected**: Force stop triggered, timer cleared
5. Login again → No timer ✅

---

## 🔍 Debug Checklist

If timer still loads after logout/login:

### Check 1: Verify Flag is Set
Look for log:
```
[TimerService] Starting stop timer operation...
```

### Check 2: Verify Skip Logic Works
Look for log:
```
[TimerService] Skipping timer load - stop operation in progress
```

### Check 3: Verify Batch Commits
Look for log:
```
[TimerService] Batch committed, active_timer cleared in Firestore
```

### Check 4: Verify Flag Cleared
Look for log:
```
[TimerService] Stop operation completed, flag cleared
```

### Check 5: Check Firestore Directly
- Open Firebase Console → Firestore
- Navigate to `users/{uid}`
- Verify `active_timer` field is `null`

---

## 💡 Additional Safeguards

### If timer still appears after login:

**Option 1: Manual clear in Firestore**
```
users/{uid}.active_timer = null
```

**Option 2: Click "Force Stop Timer" in Global Timer**

**Option 3: Increase propagation delay**
```typescript
// Change from 500ms to 1000ms if needed
await new Promise(resolve => setTimeout(resolve, 1000));
```

---

## 🎓 Lessons Learned

1. **Race conditions are subtle**
   - Async operations can complete in unexpected order
   - Need explicit synchronization mechanisms

2. **Flags are effective**
   - Simple boolean flag can prevent many race conditions
   - Always clear in `finally` block

3. **Firestore propagation takes time**
   - `commit()` completes doesn't mean all clients see the change
   - Small delays (500ms) can prevent many issues

4. **Local state vs Remote state**
   - Clear local state immediately for better UX
   - But respect remote state propagation time

5. **Effect timing matters**
   - Effects run synchronously when signals change
   - Need guards to prevent unwanted re-execution

---

## ✅ Success Criteria

Timer logout/login is working correctly when:

1. ✅ Logout stops timer and saves time logs
2. ✅ Login again shows NO timer
3. ✅ Console shows "Skipping timer load" during stop
4. ✅ Firestore `active_timer` is null after logout
5. ✅ No timer widget after login
6. ✅ Works even with fast logout/login
7. ✅ Works with force stop scenarios
8. ✅ No errors in console

---

## 🚀 Next Steps

If issues persist:

1. Check console logs pattern
2. Verify Firestore rules allow write to `users/{uid}.active_timer`
3. Check if `batch.commit()` completes successfully
4. Consider increasing propagation delay to 1000ms
5. Add more defensive checks in effect

---

**Status**: ✅ Implemented and ready for testing
**Priority**: High - Affects logout/login UX
**Impact**: Prevents orphaned timers after logout
