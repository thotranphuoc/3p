# How to Set Director Role

## Overview
Director role has been added to support BSC/OKR Strategy Module permissions.

## Role Hierarchy & Permissions

### Admin
- Full system access
- Can manage all objectives and strategy
- Can change user roles
- Can access User Management page

### Director
- Can manage objectives and strategy
- Can create/edit/delete objectives
- Can view all projects
- **CANNOT** change user roles (only Admin can)

### Manager
- Can create tasks and link them to objectives
- Can view objectives and strategy
- **CANNOT** create/edit/delete objectives

### Member
- Can view objectives (read-only)
- Can view linked objectives in tasks
- **CANNOT** link tasks to objectives
- **CANNOT** manage objectives

---

## How to Set a User as Director

### Method 1: Via Admin UI (Recommended)
1. Login as Admin
2. Go to **User Management** (admin/users)
3. Find the user you want to promote
4. Click **Change Role** button
5. Select **Director** from dropdown
6. Click **Save**

### Method 2: Via Firestore Console (Manual)
1. Go to Firebase Console → Firestore Database
2. Navigate to `users` collection
3. Find the user document by email
4. Edit the `role` field
5. Change value to: `director`
6. Save

### Method 3: Via Firebase CLI (For bulk operations)
```javascript
// Run in Firebase Console or Cloud Functions
const admin = require('firebase-admin');
const db = admin.firestore();

async function setDirectorRole(email) {
  const usersRef = db.collection('users');
  const snapshot = await usersRef.where('email', '==', email).get();
  
  if (snapshot.empty) {
    console.log('User not found');
    return;
  }
  
  const userDoc = snapshot.docs[0];
  await userDoc.ref.update({ role: 'director' });
  console.log(`Updated ${email} to director role`);
}

// Usage
setDirectorRole('user@example.com');
```

---

## Firestore Security Rules

The following security rules have been deployed:

```javascript
// OBJECTIVES COLLECTION (BSC/OKR Strategy Module)
match /objectives/{objId} {
  // READ: All authenticated users can read if member of project or global
  allow read: if isAuthenticated() && (
    resource.data.projectId == 'global' || 
    isProjectMember(resource.data.projectId)
  );
  
  // WRITE: Only Admin and Director
  allow create, update, delete: if isAdminOrDirector();
}
```

---

## Testing Director Role

1. **Set a user as Director** using one of the methods above
2. **Login as that Director**
3. **Test permissions:**
   - ✅ Can access `/objectives` page
   - ✅ Can see "New Objective" button
   - ✅ Can create new objectives
   - ✅ Can edit existing objectives
   - ✅ Can delete objectives
   - ✅ Can access `/strategy` dashboard
   - ❌ Cannot access `/admin/users` (Admin only)

4. **Test Manager permissions:**
   - ✅ Can view objectives
   - ✅ Can link tasks to objectives
   - ❌ Cannot create/edit/delete objectives

5. **Test Member permissions:**
   - ✅ Can view objectives (read-only)
   - ✅ Can see linked objectives in tasks
   - ❌ Cannot link tasks to objectives
   - ❌ Cannot create/edit/delete objectives

---

## Default Role for New Users

When a new user signs up via Firebase Auth:
- Default role: `member`
- Admin needs to promote them to Manager or Director as needed

---

## Quick Reference

| Feature | Admin | Director | Manager | Member |
|---------|-------|----------|---------|--------|
| View Objectives | ✅ | ✅ | ✅ | ✅ |
| Create/Edit/Delete Objectives | ✅ | ✅ | ❌ | ❌ |
| Link Tasks to Objectives | ✅ | ✅ | ✅ | ❌ |
| View Strategy Dashboard | ✅ | ✅ | ✅ | ✅ |
| User Management | ✅ | ❌ | ❌ | ❌ |
| Change User Roles | ✅ | ❌ | ❌ | ❌ |

---

## Notes

- Firestore rules have been deployed with new objective permissions
- All existing users will remain as their current role
- You need to manually promote users to Director role if needed
