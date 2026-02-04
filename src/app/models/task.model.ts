export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface Task {
  id: string;
  projectId: string; // Indexed
  title: string;
  description?: string; // Optional description/notes
  status: TaskStatus;
  assignees_preview: string[]; // Cache first 3 UIDs for UI
  
  // AGGREGATES (Roll-up from Subtasks)
  aggregates: {
    total_subtasks: number;
    completed_subtasks: number;
    total_actual_seconds: number; // Sum of all logs
    total_estimate_seconds: number;
  };
  
  // Comments
  comments?: TaskComment[];
  createdAt?: Date;
  updatedAt?: Date;
}
