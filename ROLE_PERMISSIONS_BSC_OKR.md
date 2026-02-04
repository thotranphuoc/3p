# Role-Based Permissions for BSC/OKR Strategy Module

## Summary

Phase 4 BSC/OKR implementation now includes role-based access control:

### Permission Matrix

| Action | Admin | Director | Manager | Member |
|--------|-------|----------|---------|--------|
| **View Objectives** | ✅ | ✅ | ✅ | ✅ (Read-only) |
| **Create Objectives** | ✅ | ✅ | ❌ | ❌ |
| **Edit Objectives** | ✅ | ✅ | ❌ | ❌ |
| **Delete Objectives** | ✅ | ✅ | ❌ | ❌ |
| **Recalculate Objectives** | ✅ | ✅ | ❌ | ❌ |
| **View Strategy Dashboard** | ✅ | ✅ | ✅ | ✅ (Read-only) |
| **Link Task to Objective** | ✅ | ✅ | ✅ | ❌ (View only) |
| **Create Tasks** | ✅ | ✅ | ✅ | ✅ |
| **Edit Tasks** | ✅ | ✅ | ✅ | ✅ (Own tasks) |

---

## Implementation Details

### 1. Firestore Security Rules

```javascript
match /objectives/{objId} {
  // Helper: Check if user is admin or director
  function isAdminOrDirector() {
    return userDocExists() && 
           get(/databases/$(database)/documents/users/$(request.auth.uid))
           .data.get('role', '') in ['admin', 'director'];
  }
  
  // READ: All members can read if in project or global
  allow read: if isAuthenticated() && (
    resource.data.projectId == 'global' || 
    isProjectMember(resource.data.projectId)
  );
  
  // WRITE: Only Admin and Director
  allow create, update, delete: if isAdminOrDirector();
}
```

### 2. Frontend Permission Checks

#### Objectives Page (`objectives.component.ts`)
```typescript
// Computed: Check if user can manage objectives
canManageObjectives = computed(() => {
  const user = this.authService.currentUserProfile();
  return user?.role === 'admin' || user?.role === 'director';
});
```

**UI Behavior:**
- **Admin/Director**: See "New Objective" button, Edit/Delete/Recalculate buttons
- **Manager/Member**: See "View Only" badge, no action buttons

#### Task Modal (`task-modal.component.ts`)
```typescript
// Computed: Check if user can link to objectives
canLinkObjectives = computed(() => {
  const user = this.authService.getCurrentUser();
  if (!user) return false;
  const profile = this.authService.currentUserProfile();
  return profile?.role === 'admin' || 
         profile?.role === 'director' || 
         profile?.role === 'manager';
});
```

**UI Behavior:**
- **Admin/Director/Manager**: See full goal linking section with dropdowns
- **Member**: See read-only goal link (if task is already linked)

---

## User Interface Changes

### Objectives Page UI

#### For Admin/Director:
```
┌─────────────────────────────────────┐
│ Strategic Objectives                │
│ [Strategy Dashboard] [+ New Objective] │
└─────────────────────────────────────┘

Objective Card:
┌─────────────────────────────────────┐
│ [Recalculate] [Edit] [Delete]      │
│ Financial: Increase Revenue          │
│ ▓▓▓▓▓▓▓░░░ 65%                      │
└─────────────────────────────────────┘
```

#### For Manager/Member:
```
┌─────────────────────────────────────┐
│ Strategic Objectives                │
│ [Strategy Dashboard] [View Only badge]│
└─────────────────────────────────────┘

Objective Card (read-only):
┌─────────────────────────────────────┐
│ Financial: Increase Revenue          │
│ ▓▓▓▓▓▓▓░░░ 65%                      │
└─────────────────────────────────────┘
```

### Task Modal - Goal Linking Section

#### For Manager/Admin/Director:
```
┌─────────────────────────────────────┐
│ Link to Strategic Objective         │
│ [Select Objective ▼]                │
│ [Select Key Result ▼]               │
│ Weight: [1] (1-10)                  │
│ ⭐ This task will contribute to...  │
└─────────────────────────────────────┘
```

#### For Member:
```
┌─────────────────────────────────────┐
│ Linked to Strategic Objective       │
│ [View Only badge]                   │
│ Objective: Increase Revenue         │
│ Key Result: Launch new product      │
└─────────────────────────────────────┘
```

---

## Navigation Menu

All users can see these menu items:
- Dashboard
- **Objectives** (Read permissions vary by role)
- **Strategy** (Read permissions vary by role)
- Profile
- User Management (Admin only)

But action buttons are role-restricted as shown above.

---

## Role Assignment

### Current Roles in System:
1. **admin** - Full system control
2. **director** - Strategic planning & objectives (NEW)
3. **manager** - Task management & linking
4. **member** - Task execution & viewing

### How to Assign Director Role:
See `HOW_TO_SET_DIRECTOR.md` for detailed instructions.

---

## Updated Files

1. `src/app/models/user.model.ts` - Added 'director' to role type
2. `firestore.rules` - Added objectives permissions for admin/director
3. `src/app/pages/objectives/objectives.component.ts` - Added `canManageObjectives` check
4. `src/app/pages/objectives/objectives.component.html` - Conditional rendering based on role
5. `src/app/components/task-modal/task-modal.component.ts` - Added `canLinkObjectives` check
6. `src/app/components/task-modal/task-modal.component.html` - Role-based UI for goal linking
7. `src/app/pages/admin/users/users.component.ts` - Added director to role filter/stats
8. `src/app/pages/admin/users/users.component.html` - Added director option in UI

---

## Testing Checklist

- [ ] Admin can create/edit/delete objectives ✅
- [ ] Director can create/edit/delete objectives ✅
- [ ] Manager can link tasks but NOT manage objectives ✅
- [ ] Member can only view, no linking or management ✅
- [ ] Firestore rules block unauthorized writes ✅
- [ ] UI shows/hides buttons based on role ✅

---

**Deployed**: February 4, 2026
**Firestore Rules**: ✅ Deployed
**Frontend**: ✅ Updated
