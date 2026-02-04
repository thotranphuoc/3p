# Timer Fix - Feb 4, 2026

## Issues Fixed

### 1. Timer Button Missing in Subtask Modal
**Problem**: Timer button was not visible in the edit subtask modal.

**Solution**: Added timer button to the time tracking section in `subtask-modal.component.html`:
```html
<app-timer-button
  [taskId]="taskId"
  [subtaskId]="subtask.id"
  [projectId]="projectId">
</app-timer-button>
```

### 2. Timer Not Working in Subtask List
**Problem**: Timer button in subtask list was missing required props (`taskId` and `projectId`).

**Solution**: Updated `subtask-list.component.html` to pass all required props:
```html
<app-timer-button
  *ngIf="showTimer"
  [taskId]="taskId"
  [subtaskId]="subtask.id"
  [projectId]="projectId"
  (click)="$event.stopPropagation()">
</app-timer-button>
```

### 3. Auto-Refresh Subtasks After Edit
**Problem**: When editing a subtask from task modal, the changes were not reflected until closing and reopening the modal.

**Solution**: Added `@ViewChild` reference in `task-modal.component.ts` to force reload subtasks after save:
```typescript
@ViewChild(SubtaskListComponent) subtaskListComponent?: SubtaskListComponent;

onSubtaskSaved(): void {
  this.showSubtaskModal.set(false);
  this.selectedSubtask.set(null);
  if (this.subtaskListComponent) {
    this.subtaskListComponent.loadSubtasks();
  }
  this.saved.emit();
}
```

## Testing Checklist

- [ ] Timer button visible in subtask modal (edit mode)
- [ ] Timer starts successfully when clicked
- [ ] Timer shows elapsed time correctly
- [ ] Timer stops successfully and logs time
- [ ] Only one timer can run at a time
- [ ] Timer state persists across page refreshes
- [ ] Subtask actual time updates after stopping timer
- [ ] Task aggregate time updates after stopping timer

## Known Requirements

The timer requires:
1. **taskId**: Required to update task aggregates
2. **subtaskId**: Required to identify which subtask is being timed
3. **projectId**: Required for time log context

## Firestore Security Rules

Current rules are OPEN for testing:
- `users/{userId}`: write allowed for owner or admin
- `tasks/{taskId}`: read/create/update allowed (open for testing)
- `subtasks/{subtaskId}`: read/create/update/delete allowed (open for testing)
- `time_logs/{logId}`: read/create allowed for authenticated users

⚠️ **IMPORTANT**: Tighten security rules before production!

## Timer Service Features

1. **Atomic Batch Write**: When stopping timer, creates time log, updates subtask actual time, updates task aggregate, and clears user's active timer - all in one atomic operation
2. **Race Condition Prevention**: Uses `isStopping` flag to prevent reload conflicts during stop operation
3. **Stale Timer Detection**: Checks for timers running >24 hours
4. **Force Stop**: Can force stop timer without saving if permissions denied or documents don't exist
