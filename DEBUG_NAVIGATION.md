# Debug Navigation Issues

## Vấn đề: "Navigation failed" trong Global Timer

### 🔍 Nguyên nhân có thể

#### 1. **Same URL Navigation**
Angular returns `false` khi navigate đến cùng URL hiện tại.

**Ví dụ:**
```
Current URL: /project/abc123
Navigate to: /project/abc123
Result: Navigation returns false (not an error!)
```

**Fix**: Check current URL trước khi navigate

#### 2. **AuthGuard blocking**
Route `/project/:id` có `canActivate: [authGuard]`

Nếu auth state chưa ready → Guard chặn navigation

**Check**: Verify user đã login

#### 3. **Invalid projectId**
projectId từ timer không tồn tại trong Firestore

**Check**: Console logs sẽ hiển thị projectId

---

## ✅ Fixes đã implement

### 1. **Smart Same-URL Detection**
```typescript
const targetUrl = `/project/${timer.projectId}`;

if (this.router.url === targetUrl) {
  console.log('Already on target project, scrolling to top');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  return; // Don't navigate
}
```

### 2. **Force Reload on Same Route**
```typescript
this.router.navigate(['/project', timer.projectId], {
  onSameUrlNavigation: 'reload' // Force reload component
});
```

### 3. **Better Logging**
```typescript
console.log('[GlobalTimer] Navigating to project:', timer.projectId);
console.log('[GlobalTimer] Current URL:', this.router.url);
console.log('[GlobalTimer] Navigation successful to:', targetUrl);
```

---

## 🧪 Testing Scenarios

### Scenario 1: Navigate to Different Project
**Setup**:
- Current page: Dashboard or Project A
- Timer running for: Project B

**Steps**:
1. Click "View Task" in Global Timer
2. Check console logs

**Expected Logs**:
```
[GlobalTimer] Navigating to project: projectB-id
[GlobalTimer] Current URL: /dashboard (or /project/projectA-id)
[GlobalTimer] Navigation successful to: /project/projectB-id
```

**Expected Result**: Navigate to Project B page ✅

---

### Scenario 2: Already on Same Project
**Setup**:
- Current page: Project A
- Timer running for: Project A (same)

**Steps**:
1. Click "View Task" in Global Timer
2. Check console logs

**Expected Logs**:
```
[GlobalTimer] Navigating to project: projectA-id
[GlobalTimer] Current URL: /project/projectA-id
[GlobalTimer] Already on target project page, scrolling to top
```

**Expected Result**: Scroll to top (no navigation) ✅

---

### Scenario 3: Navigate from Different Project
**Setup**:
- Current page: Project A
- Timer running for: Project B

**Steps**:
1. Click "View Task" in Global Timer

**Expected Logs**:
```
[GlobalTimer] Navigating to project: projectB-id
[GlobalTimer] Current URL: /project/projectA-id
[GlobalTimer] Navigation successful to: /project/projectB-id
```

**Expected Result**: Navigate to Project B ✅

---

## 🐛 Debug Steps

### If navigation still fails:

#### Step 1: Check Console Logs
Look for these patterns:

**Success**:
```
[GlobalTimer] Navigation successful to: /project/xxx
```

**Same URL (not an error)**:
```
[GlobalTimer] Already on target project page, scrolling to top
```

**Real Failure**:
```
[GlobalTimer] Navigation error: [error message]
```

#### Step 2: Check Timer Data
In console:
```javascript
const timer = angular.getComponent(document.querySelector('app-global-timer')).timerService.activeTimer();
console.log('Timer projectId:', timer.projectId);
```

#### Step 3: Check Current Route
In console:
```javascript
const router = angular.getComponent(document.querySelector('app-root')).router;
console.log('Current URL:', router.url);
```

#### Step 4: Check Auth State
In console:
```javascript
const auth = angular.getComponent(document.querySelector('app-root')).authService;
console.log('Is authenticated:', auth.isAuthenticated());
```

---

## 📋 Troubleshooting Checklist

### ✅ Navigation "failed" but works
- Check: Are you already on the target page?
- **This is normal** - Angular returns `false` for same-URL navigation
- **Fix**: App now scrolls to top instead

### ✅ Navigation actually fails
- Check: Is user logged in?
- Check: Does project exist in Firestore?
- Check: Console for detailed error messages

### ✅ Page loads but shows "Project not found"
- Check: projectId is valid
- Check: User has permission to view project
- Check: Firestore rules allow read

---

## 🎯 Expected Behavior

### When clicking "View Task":

1. **If on different page**: Navigate to project page
2. **If on same project**: Scroll to top (no navigation)
3. **If auth required**: Wait for auth then navigate
4. **If error**: Log detailed error message

### Console Logs Pattern:

**Normal navigation**:
```
[GlobalTimer] Navigating to project: abc123
[GlobalTimer] Current URL: /dashboard
[GlobalTimer] Navigation successful to: /project/abc123
```

**Same page (not an error)**:
```
[GlobalTimer] Navigating to project: abc123
[GlobalTimer] Current URL: /project/abc123
[GlobalTimer] Already on target project page, scrolling to top
```

---

## 💡 Tips

1. **"Navigation failed" ≠ Error**
   - Angular returns `false` for same-URL navigation
   - This is expected behavior

2. **Check Console Logs**
   - Detailed logging will show exact issue
   - Look for `[GlobalTimer]` prefix

3. **Verify projectId**
   - Ensure projectId in timer is valid
   - Check if project exists in Firestore

4. **Auth State**
   - Navigation requires login
   - Check if authGuard is blocking

---

## 🔧 Manual Fix

If navigation doesn't work:

### Option 1: Reload Page
```
Just refresh browser (F5)
```

### Option 2: Manual Navigation
```
Type in address bar: http://localhost:4200/project/{projectId}
```

### Option 3: Navigate from Dashboard
```
1. Go to Dashboard
2. Click on project card
```

---

## 📞 Report Issue

If still having problems, provide:

1. ✅ Console logs (screenshot)
2. ✅ Timer projectId (from console)
3. ✅ Current URL (from console)
4. ✅ Does project exist in Firestore?
5. ✅ Is user logged in?
