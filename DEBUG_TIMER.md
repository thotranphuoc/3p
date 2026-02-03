# Debug Timer Issues

## Vấn đề: "Task not found" & "Subtask not found" trong Global Timer

### 🔍 Cách Debug

#### Bước 1: Kiểm tra Console Logs

Sau khi start timer, mở Chrome DevTools Console và tìm các logs sau:

```
[GlobalTimer] Timer changed, loading task info: {taskId: "...", subtaskId: "..."}
[GlobalTimer] loadTaskInfo called with: {taskId: "xxx", subtaskId: "yyy"}
[GlobalTimer] Fetching task: xxx
[GlobalTimer] Fetching subtask: yyy
[GlobalTimer] Task received: {id: "xxx", title: "...", ...}
[GlobalTimer] Subtask received: {id: "yyy", title: "...", ...}
```

#### Bước 2: Kiểm tra Timer Data

Trong console, gõ:

```javascript
// Check active timer
angular.getComponent(document.querySelector('app-global-timer')).timerService.activeTimer()
```

Kết quả mong đợi:
```javascript
{
  isRunning: true,
  taskId: "xxx",
  subtaskId: "yyy",
  projectId: "zzz",
  startTime: Timestamp {...},
  localStartTime: "2026-02-03T..."
}
```

#### Bước 3: Kiểm tra Firestore Documents

Mở Firebase Console → Firestore Database

1. **Check Task exists:**
   - Collection: `tasks`
   - Document ID: (taskId từ timer)
   - Verify document tồn tại và có field `title`

2. **Check Subtask exists:**
   - Collection: `subtasks`
   - Document ID: (subtaskId từ timer)
   - Verify document tồn tại và có field `title`

3. **Check User's active_timer:**
   - Collection: `users`
   - Document ID: (current user UID)
   - Field: `active_timer` → Should match timer data

#### Bước 4: Kiểm tra Firestore Rules

Trong Firebase Console → Firestore Database → Rules:

```javascript
// Verify these rules allow read
match /tasks/{taskId} {
  allow read, create, update: if true; // Or check your actual rules
}

match /subtasks/{subtaskId} {
  allow read, create, update, delete: if true; // Or check your actual rules
}
```

---

## 🐛 Các Lỗi Thường Gặp

### Lỗi 1: effect() not triggering

**Triệu chứng**: Không thấy logs "[GlobalTimer] Timer changed"

**Nguyên nhân**: Effect không được gọi khi timer thay đổi

**Fix**: Đã fix bằng cách move effect vào constructor ✅

### Lỗi 2: taskId/subtaskId invalid

**Triệu chứng**: Logs show `taskId: undefined` hoặc `subtaskId: undefined`

**Nguyên nhân**: Timer không có đủ data

**Check**:
```javascript
// In console
const timer = angular.getComponent(document.querySelector('app-global-timer')).timerService.activeTimer();
console.log('taskId:', timer.taskId);
console.log('subtaskId:', timer.subtaskId);
```

**Fix**: 
- Xóa và tạo lại timer
- Check `user.active_timer` trong Firestore

### Lỗi 3: Documents not found

**Triệu chứng**: Logs show "Task received: null" hoặc "Subtask received: null"

**Nguyên nhân**: Documents đã bị xóa hoặc không tồn tại

**Check**: Mở Firestore và verify documents tồn tại

**Fix**: 
- Click "Force Stop Timer" để clear timer
- Tạo lại task/subtask

### Lỗi 4: Permission denied

**Triệu chứng**: Logs show "Error loading task: FirebaseError: Missing or insufficient permissions"

**Nguyên nhân**: Firestore rules chặn read

**Check**: Firebase Console → Firestore → Rules

**Fix**: Update rules:
```javascript
match /tasks/{taskId} {
  allow read: if request.auth != null; // Or more permissive
}
```

### Lỗi 5: Stale timer after logout

**Triệu chứng**: Login lại vẫn thấy timer chạy nhưng task not found

**Nguyên nhân**: User logout nhưng active_timer không được clear

**Fix**: 
1. Click "Force Stop Timer"
2. Hoặc manual clear trong Firestore:
   - Collection: `users/{uid}`
   - Delete field: `active_timer`

---

## ✅ Expected Flow

### Khi Start Timer

```
1. User clicks "Start Timer" on subtask
   ↓
2. TimerService.startTimer(taskId, subtaskId, projectId)
   ↓
3. Update users/{uid}.active_timer with timer data
   ↓
4. GlobalTimer effect() detects activeTimer change
   ↓
5. GlobalTimer loads task & subtask from Firestore
   ↓
6. Display task.title & subtask.title in widget
```

### Expected Logs

```
[TimerService] Starting timer for subtask: xxx
[GlobalTimer] Timer changed, loading task info: {taskId: "...", subtaskId: "...", ...}
[GlobalTimer] loadTaskInfo called with: {taskId: "xxx", subtaskId: "yyy"}
[GlobalTimer] Fetching task: xxx
[GlobalTimer] Fetching subtask: yyy
[GlobalTimer] Task received: {id: "xxx", title: "My Task", ...}
[GlobalTimer] Task loaded successfully: My Task
[GlobalTimer] Subtask received: {id: "yyy", title: "My Subtask", ...}
[GlobalTimer] Subtask loaded successfully: My Subtask
[GlobalTimer] Task observable completed
[GlobalTimer] Subtask observable completed
```

---

## 🔧 Manual Testing Steps

### Test 1: Normal Timer Flow

1. Login
2. Navigate to project
3. Create task with subtask
4. Click timer button on subtask
5. **Expected**: Global timer widget appears with task & subtask names
6. Check console logs - should see all loading logs
7. Click timer widget to expand
8. **Expected**: Full task and subtask info displayed

### Test 2: Refresh with Active Timer

1. Start timer (from Test 1)
2. Refresh browser (F5)
3. **Expected**: Timer widget reappears automatically
4. **Expected**: Task & subtask info loads correctly
5. Check logs

### Test 3: Logout with Timer

1. Start timer
2. Logout
3. **Expected**: Timer stops automatically
4. **Expected**: Widget disappears
5. Login again
6. **Expected**: No timer running

### Test 4: Force Stop Orphaned Timer

1. Start timer
2. Manually delete task/subtask in Firestore
3. Refresh page
4. **Expected**: Timer shows "Task not found"
5. Click "Force Stop Timer"
6. **Expected**: Timer cleared successfully

---

## 📞 Next Steps

If still seeing "Task not found":

1. ✅ Check console logs and share screenshot
2. ✅ Check Firestore for task/subtask documents
3. ✅ Check user's active_timer field
4. ✅ Try Force Stop and restart timer
5. ✅ Check Firestore rules

Provide console logs output to get more specific help!
