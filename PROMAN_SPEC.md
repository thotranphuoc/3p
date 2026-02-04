PRO-MAN PROJECT: MASTER TECHNICAL SPECIFICATION
Project Name: Pro-Man (Professional Project Management PWA)
Version: 4.0 (Added Strategy/BSC Module)
Last Updated: 2024
Tech Stack: Angular (Signals) + Firebase (Firestore) + Tailwind CSS
Core Philosophy: "Offline-first, Cost-Efficient, Gamified Strategy"

1. ARCHITECTURE & TECH STACK
1.1 Frontend (Angular PWA)

Framework: Angular v17+ (Required: Standalone Components, Signals)
State Management: Angular Signals (Local) + RxJS (Global)
Styling: Tailwind CSS (Primary) + SCSS (Secondary)
Charting:ngx-charts or Chart.js (For Radar Charts / Strategy Maps)
PWA:@angular/service-worker (Performance strategy)

1.2 Backend (Serverless Firebase)

Database: Cloud Firestore (NoSQL)
Auth: Firebase Auth
Storage: Firebase Storage (< 200KB images)

1.3 Key Optimization Principles

Frontend Pagination: strict limit(20)
Client-side Aggregation: Use Batch Writes to update counters (total_hours, progress_%)
Offline Persistence:enableIndexedDbPersistence()


2. DATABASE SCHEMA (FIRESTORE)
Strategy: Denormalization. Root Collections: users, projects, tasks, subtasks, objectives, time_logs.
2.1 Collection: users
TypeScriptinterface User {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'manager' | 'member';

  // ACTIVE TIMER (Sync across devices)
  active_timer: {
    isRunning: boolean;
    taskId: string;
    subtaskId: string;
    projectId: string;
    startTime: Timestamp;
  } | null;
}
2.2 Collection: projects
TypeScriptinterface Project {
  id: string;
  name: string;
  members: string[];
  stats: {
    total_tasks: number;
    completed_tasks: number;
  };
}
2.3 Collection: objectives (NEW - Strategy Layer)

Purpose: Store BSC/OKR goals. Linked to Projects or Global.

TypeScriptinterface Objective {
  id: string;
  projectId: string | 'global';
  title: string;
  type: 'financial' | 'customer' | 'internal' | 'learning'; // BSC Quadrants
  status: 'on_track' | 'at_risk' | 'behind';

  // WEIGHTED PROGRESS CALCULATION
  total_weight: number;           // Sum of all Key Results' weights (e.g., 100)
  current_weighted_score: number; // Sum of (KR_Progress * KR_Weight)
  progress_percent: number;       // (current_weighted_score / total_weight) * 100

  // KEY RESULTS (Nested Array for atomic updates)
  key_results: Array<{
    id: string;
    title: string;
    weight: number; // Importance (1-100)

    type: 'metric' | 'task_linked';

    // Type A: Manual Metric (e.g., Revenue)
    target_value?: number;
    current_value?: number;
    unit?: string;

    // Type B: Task Linked (Auto-calculated)
    linked_task_ids?: string[]; // List of Task IDs contributing to this KR

    progress: number; // 0-100%
  }>;
}
2.4 Collection: tasks (Parent Tasks)

Update: Added goal_link for BSC contribution.

TypeScriptinterface Task {
  id: string;
  projectId: string;
  title: string;
  status: 'todo' | 'in_progress' | 'review' | 'done';
  assignees_preview: string[];

  // STRATEGY LINKING (NEW)
  goal_link?: {
    objectiveId: string;
    keyResultId: string;
    contribution_weight: number; // Importance of this task to the KR (default 1)
  };

  // AGGREGATES
  aggregates: {
    total_subtasks: number;
    completed_subtasks: number;
    total_actual_seconds: number;
    total_estimate_seconds: number;
  };
}
2.5 Collection: subtasks (ROOT COLLECTION)
TypeScriptinterface Subtask {
  id: string;
  parentId: string;
  projectId: string;
  title: string;
  status: 'todo' | 'done';
  assignees: string[];
  estimate_seconds: number;
  actual_seconds: number;
}
2.6 Collection: time_logs (History)
TypeScriptinterface TimeLog {
  id: string;
  userId: string;
  taskId: string;
  seconds: number;
  createdAt: Timestamp;
}

3. FEATURE LOGIC & IMPLEMENTATION
3.1 Smart Time Tracking (Batch Write)

Start: Write users/{uid}.active_timer. Client counts locally.
Stop: Batch Write (1 Request):
Create time_logs entry
Increment subtasks actual time
Increment tasks aggregate time
Clear active_timer


3.2 BSC/OKR Calculation Logic (Weighted Average)

Trigger: Task status changes to 'done' OR manual metric update.
Formula:Objective % = Sum(KR_Progress * KR_Weight) / Sum(KR_Weight)

Implementation (Client-side Batch):
When a Task linked to KeyResult X of Objective Y is completed:

Read Objective Y document
Calculate:
Find KeyResult X
Recalculate KeyResult X progress (based on linked tasks or manual input)
Recalculate Objective Y weighted progress

Write updated Objective Y

3.3 Visual Strategy Map (UI)

Radar Chart: Display 4 BSC axes (Financial, Customer, Internal, Learning)
Tree View: Objective → Key Results → Tasks
Gamification: Show "Impact Badge" on Task Detail:
"This task contributes 5% to the goal 'Dominate SE Asia'"


4. IMPLEMENTATION CHECKLIST
Phase 1: Foundation (Done/In-progress)

 Angular Init, Firebase Setup, Auth

Phase 2: Core Task Management

 Projects & Tasks CRUD
 Subtasks (Root collection)
 Kanban Board (Drag & Drop)

Phase 3: Time Tracking (The "Money Saver")

 Timer Service (Signals)
 Batch Write Logic for Time Logs

Phase 4: Strategy Module (BSC/OKR) - NEW

 Objective Service: CRUD Objectives & Key Results
 Goal Linking: UI to select Objective/KR when creating a Task
 Auto-Calculation Logic: Update Objective progress when Task is done
 Dashboard: Radar Chart implementation

Phase 5: Polish & Optimization

 PWA Config
 Dark Mode
 Security Rules Audit


5. SECURITY RULES (UPDATED)
firestorerules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isMember(projectId) {
      return request.auth != null &&
             request.auth.uid in get(/databases/$(database)/documents/projects/$(projectId)).data.members;
    }

    match /projects/{projectId} {
      allow read: if isMember(projectId);
    }

    // Allow reading objectives if member of project OR if global
    match /objectives/{objId} {
      allow read: if resource.data.projectId == 'global' ||
                     isMember(resource.data.projectId);
      allow write: if isMember(resource.data.projectId); // Simplified
    }

    match /tasks/{taskId} {
      allow list: if request.query.limit <= 50;
      allow read, write: if isMember(resource.data.projectId);
    }

    match /subtasks/{subId} {
      allow read, write: if isMember(resource.data.projectId);
    }

    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}