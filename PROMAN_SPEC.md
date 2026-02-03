# PRO-MAN PROJECT: TECHNICAL SPECIFICATION DOCUMENT (TSD)

**Version:** 2.0
**Last Updated:** 2024
**Project Type:** Project Management PWA
**Core Philosophy:** "Professional Logic, Cool UX, Cost-Efficient Architecture"

---

## 1. TECH STACK & ARCHITECTURE

### Frontend (Angular PWA)
* **Framework:** Angular v17+ (Standalone Components, Signals required).
* **State Management:** Angular Signals (Local state) + RxJS (Global streams).
* **Styling:** Tailwind CSS (Primary for layout/responsive) + SCSS (Secondary for complex animations/glassmorphism).
* **PWA:** `@angular/service-worker` (Strategy: Performance-first).
* **Icons:** Phosphor Icons or Heroicons (SVG).

### Backend (Serverless)
* **Database:** Firebase Firestore.
* **Auth:** Firebase Authentication (Google & Email).
* **Logic:**
    * **Read:** Client-side Querying + Pagination.
    * **Write/Aggregation:** Client-side Atomic Batch Writes (To save Cloud Function costs).
    * **Time Calculation:** Server Timestamp logic.

---

## 2. DATABASE SCHEMA (FIRESTORE)

**CRITICAL RULE:** Use Root Collections for scalability. Apply Denormalization for read efficiency.

### Collection: `users`
```typescript
interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'manager' | 'member';
  // ACTIVE TIMER: Stores current running task state
  active_timer: {
    isRunning: boolean;
    taskId: string;
    subtaskId: string;
    projectId: string;
    startTime: Timestamp; // Server Timestamp
    localStartTime: string; // ISO String (Backup for UI)
  } | null;
}


Collection: projects
TypeScript


interface Project {
  id: string;
  name: string;
  members: string[]; // List of UIDs for security rules
  // AGGREGATES (Updated via Batch Write)
  stats: {
    total_tasks: number;
    completed_tasks: number;
  };
}


Collection: tasks (Parent Tasks)
TypeScript


interface Task {
  id: string;
  projectId: string; // Indexed
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  assignees_preview: string[]; // Cache first 3 UIDs for UI
  
  // AGGREGATES (Roll-up from Subtasks)
  aggregates: {
    total_subtasks: number;
    completed_subtasks: number;
    total_actual_seconds: number; // Sum of all logs
    total_estimate_seconds: number;
  };
}


Collection: subtasks (ROOT COLLECTION)
Reason: Allows "My Tasks" query across all projects without Collection Group queries.
TypeScript


interface Subtask {
  id: string;
  parentId: string; // Reference to Task
  projectId: string; // Reference to Project
  title: string;
  status: 'todo' | 'done';
  assignees: string[]; // Array of UIDs
  
  estimate_seconds: number;
  actual_seconds: number; // Sum of logs for this subtask
}


Collection: time_logs (Immutable History)
TypeScript


interface TimeLog {
  id: string;
  userId: string;
  taskId: string;
  subtaskId: string;
  seconds: number; // Duration
  createdAt: Timestamp;
}



3. CORE FEATURES & LOGIC SPECIFICATIONS
3.1. Smart Time Tracking (The "Money Saver" Logic)
Objective: Track time accurately without continuous server writes.
Action: Start Timer
Check if user.active_timer is not null. If exists, stop it first.
Write to users/{uid} -> Update active_timer field with serverTimestamp().
UI: Start local setInterval counting from now - startTime.
Action: Stop Timer (Atomic Batch Write)
Input: activeTimer object, currentTime.
Calculation: duration = currentTime - activeTimer.startTime.
Firestore Batch Operations (All in one request):
time_logs: Create new doc (Log history).
subtasks/{subId}: Increment actual_seconds by duration.
tasks/{taskId}: Increment aggregates.total_actual_seconds by duration.
users/{uid}: Set active_timer to null.
3.2. Task Management & Aggregation
Logic: When a Subtask is created/deleted or status changes.
Batch Write:
Create subtasks/{newId}.
Update tasks/{parentId}: Increment aggregates.total_subtasks.
Progress Calculation (Frontend):
Progress % = (completed_subtasks / total_subtasks) * 100.
Time Health = (total_actual_seconds / total_estimate_seconds) * 100. (Red if > 100%).
3.3. Optimization & Caching Rules
Offline: Must enable enableIndexedDbPersistence() in app.config.ts.
Reads:
Strict Pagination: Always use limit(20) or limit(50) for lists.
No "Select All": Never query generic .collection('tasks') without where clause.
Subscriptions: Use takeUntilDestroyed or AsyncPipe.

4. IMPLEMENTATION CHECKLIST (PRIORITY ORDER)
Phase 1: Core Foundation (Estimated: 2 days)
[ ] Setup Angular: Init project, configure Tailwind CSS.
[ ] Setup Firebase: Config Firestore, Auth, Hosting.
[ ] Security: Implement app.config.ts with Offline Persistence enabled.
[ ] Auth: Build Login/Logout with Google Auth. Guard routes.
Phase 2: Task Structure (Estimated: 3-4 days)
[ ] DB Services: Create ProjectService, TaskService (Abstract Firestore logic).
[ ] UI - Kanban Board:
[ ] Setup Drag & Drop (Angular CDK).
[ ] Display Task Cards with Aggregated Stats (read from Task doc).
[ ] UI - Subtasks:
[ ] Create/Edit Subtask modal.
[ ] Implement Batch Write when creating subtask (Update Parent stats).
Phase 3: The "Cool" Time Tracking (Estimated: 3 days)
[ ] Timer Service: Implement startTimer and stopTimer logic using Signals.
[ ] Batch Write Logic: Implement the complex aggregation logic (Section 3.1) strictly.
[ ] Global Timer UI: Floating widget showing current running task (even when navigating).
[ ] Edge Cases: Handle "Forgot to stop" (Basic UI prompt on next login).
Phase 4: Polish & PWA (Estimated: 2 days)
[ ] Optimistic UI: Ensure UI updates immediately before Server response.
[ ] Dark Mode: Configure Tailwind Dark Mode class strategy.
[ ] Manifest: Configure manifest.webmanifest (Icons, Theme color).
[ ] Service Worker: Build prod and test Offline mode.

5. CODE GUIDELINES (FOR AI GENERATION)
Guideline 1: Batch Write Template
Use this pattern for Time Tracking to ensure data consistency.
TypeScript


// Example: Stop Timer Logic
async stopTimer(timer: ActiveTimer, durationSeconds: number) {
  const batch = writeBatch(this.firestore);
  
  // 1. Create Log
  const logRef = doc(collection(this.firestore, 'time_logs'));
  batch.set(logRef, {
    userId: this.auth.uid,
    subtaskId: timer.subtaskId,
    seconds: durationSeconds,
    createdAt: serverTimestamp()
  });

  // 2. Aggregate Subtask
  const subRef = doc(this.firestore, `subtasks/${timer.subtaskId}`);
  batch.update(subRef, {
    actual_seconds: increment(durationSeconds)
  });

  // 3. Aggregate Parent Task
  const taskRef = doc(this.firestore, `tasks/${timer.taskId}`);
  batch.update(taskRef, {
    'aggregates.total_actual_seconds': increment(durationSeconds)
  });

  // 4. Reset User Timer
  const userRef = doc(this.firestore, `users/${this.auth.uid}`);
  batch.update(userRef, { active_timer: null });

  await batch.commit();
}


Guideline 2: Security Rules (Cost Control)
Include these rules to prevent accidental massive reads.
Plaintext


rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Prevent fetching all tasks without limit
    match /tasks/{taskId} {
      allow list: if request.query.limit <= 50;
    }
    match /subtasks/{subId} {
      allow read: if resource.data.projectId in request.auth.token.project_access;
    }
  }
}



END OF SPECIFICATION



### Hướng dẫn sử dụng file này với AI (Copilot/ChatGPT):

1.  **Bước 1:** Copy toàn bộ nội dung trên vào file `PROMAN_SPEC.md` trong thư mục gốc project.
2.  **Bước 2:** Khi chat với AI để nhờ code, hãy luôn tham chiếu đến file này.
    * *Ví dụ:* "@PROMAN_SPEC.md Hãy viết cho tôi `TimerService` của Angular, chú ý tuân thủ logic Batch Write ở mục 3.1 và Guideline 1."
3.  **Bước 3:** Yêu cầu AI kiểm tra lại "Cost Optimization" trước khi finalize code.

Bạn có thể bắt đầu bằng việc tạo file này. Sau đó, chúng ta sẽ bắt đầu code **Phase 1: Setup Core** nhé?



