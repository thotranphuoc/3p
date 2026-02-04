import { Timestamp } from 'firebase/firestore';

export interface ActiveTimer {
  isRunning: boolean;
  taskId: string;
  subtaskId: string;
  projectId: string;
  startTime: Timestamp; // Server Timestamp
  localStartTime: string; // ISO String (Backup for UI)
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'director' | 'manager' | 'member';
  active_timer: ActiveTimer | null;
}
