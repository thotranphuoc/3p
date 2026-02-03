export type SubtaskStatus = 'todo' | 'done';

export interface Subtask {
  id: string;
  parentId: string; // Reference to Task
  projectId: string; // Reference to Project
  title: string;
  status: SubtaskStatus;
  assignees: string[]; // Array of UIDs
  
  estimate_seconds: number;
  actual_seconds: number; // Sum of logs for this subtask
}
