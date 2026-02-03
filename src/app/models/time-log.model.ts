import { Timestamp } from 'firebase/firestore';

export interface TimeLog {
  id: string;
  userId: string;
  taskId: string;
  subtaskId: string;
  seconds: number; // Duration
  createdAt: Timestamp;
}
