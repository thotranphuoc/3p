import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, limit, orderBy, Timestamp, writeBatch, increment, onSnapshot } from 'firebase/firestore';
import { Observable, from, map, switchMap, tap } from 'rxjs';
import { Task, TaskStatus } from '../models/task.model';
import { ObjectiveCalculationService } from './objective-calculation.service';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private firestore = inject(Firestore);
  private objectiveCalculationService = inject(ObjectiveCalculationService);
  private readonly collectionName = 'tasks';

  /**
   * Get a single task by ID
   */
  getTask(taskId: string): Observable<Task | null> {
    const taskRef = doc(this.firestore, `${this.collectionName}/${taskId}`);
    return from(getDoc(taskRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Task;
        }
        return null;
      })
    );
  }

  /**
   * Get tasks for a project with pagination
   * Per spec: Always use limit() and where clause
   */
  getProjectTasks(projectId: string, pageSize: number = 20): Observable<Task[]> {
    const tasksRef = collection(this.firestore, this.collectionName);
    const q = query(
      tasksRef,
      where('projectId', '==', projectId),
      orderBy('title'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task))
      )
    );
  }

  /**
   * Get tasks by status for a project (for Kanban board)
   * Removed orderBy to avoid index requirement - will sort in memory if needed
   */
  getTasksByStatus(projectId: string, status: TaskStatus, pageSize: number = 50): Observable<Task[]> {
    const tasksRef = collection(this.firestore, this.collectionName);
    const q = query(
      tasksRef,
      where('projectId', '==', projectId),
      where('status', '==', status),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        const tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
        // Sort by title in memory
        return tasks.sort((a, b) => a.title.localeCompare(b.title));
      })
    );
  }

  /**
   * REAL-TIME: Listen to tasks by status for a project (for Kanban board)
   * Returns an Observable that emits whenever tasks change
   */
  watchTasksByStatus(projectId: string, status: TaskStatus, pageSize: number = 50): Observable<Task[]> {
    const tasksRef = collection(this.firestore, this.collectionName);
    const q = query(
      tasksRef,
      where('projectId', '==', projectId),
      where('status', '==', status),
      limit(pageSize)
    );
    
    return new Observable(observer => {
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const tasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
          // Sort by title in memory
          const sortedTasks = tasks.sort((a, b) => a.title.localeCompare(b.title));
          observer.next(sortedTasks);
        },
        (error) => {
          console.error('Error watching tasks:', error);
          observer.error(error);
        }
      );
      
      // Cleanup function
      return () => unsubscribe();
    });
  }

  /**
   * REAL-TIME: Listen to a single task
   */
  watchTask(taskId: string): Observable<Task | null> {
    const taskRef = doc(this.firestore, `${this.collectionName}/${taskId}`);
    
    return new Observable(observer => {
      const unsubscribe = onSnapshot(
        taskRef,
        (docSnap) => {
          if (docSnap.exists()) {
            observer.next({ id: docSnap.id, ...docSnap.data() } as Task);
          } else {
            observer.next(null);
          }
        },
        (error) => {
          console.error('Error watching task:', error);
          observer.error(error);
        }
      );
      
      return () => unsubscribe();
    });
  }

  /**
   * Create a new task
   */
  createTask(task: Omit<Task, 'id'>): Observable<string> {
    const tasksRef = collection(this.firestore, this.collectionName);
    const newTask = {
      ...task,
      aggregates: {
        total_subtasks: 0,
        completed_subtasks: 0,
        total_actual_seconds: 0,
        total_estimate_seconds: 0,
      }
    };
    
    return from(addDoc(tasksRef, newTask)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Update task status (for drag & drop in Kanban)
   * Triggers objective recalculation if task is linked to an objective
   */
  updateTaskStatus(taskId: string, newStatus: TaskStatus): Observable<void> {
    const taskRef = doc(this.firestore, `${this.collectionName}/${taskId}`);
    
    // First get the current task to check old status and goal_link
    return from(getDoc(taskRef)).pipe(
      switchMap(docSnap => {
        const oldTask = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Task : null;
        const oldStatus = oldTask?.status || 'todo';
        
        // Update the task status
        return from(updateDoc(taskRef, { status: newStatus })).pipe(
          tap(() => {
            // After status update, trigger objective recalculation if needed
            // Only if status changed to or from 'done' and task has goal_link
            if ((newStatus === 'done' || oldStatus === 'done') && oldTask?.goal_link) {
              console.log(`Task status changed: ${oldStatus} → ${newStatus}. Triggering objective recalculation.`);
              this.objectiveCalculationService.onTaskStatusChanged(taskId, newStatus, oldStatus).subscribe({
                next: () => console.log('Objective recalculation completed'),
                error: (error) => console.error('Error recalculating objective:', error)
              });
            }
          })
        );
      })
    );
  }

  /**
   * Update task
   * Triggers objective recalculation if status changed to/from 'done' and task has goal_link
   */
  updateTask(taskId: string, updates: Partial<Task>): Observable<void> {
    const taskRef = doc(this.firestore, `${this.collectionName}/${taskId}`);
    
    // If status is being updated, check for objective recalculation
    if (updates.status) {
      const newStatus = updates.status;
      return from(getDoc(taskRef)).pipe(
        switchMap(docSnap => {
          const oldTask = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Task : null;
          const oldStatus = oldTask?.status || 'todo';
          
          return from(updateDoc(taskRef, updates)).pipe(
            tap(() => {
              // Trigger objective recalculation if needed
              if ((newStatus === 'done' || oldStatus === 'done') && oldTask?.goal_link) {
                console.log(`Task updated with status change: ${oldStatus} → ${newStatus}. Triggering objective recalculation.`);
                this.objectiveCalculationService.onTaskStatusChanged(taskId, newStatus, oldStatus).subscribe({
                  next: () => console.log('Objective recalculation completed'),
                  error: (error) => console.error('Error recalculating objective:', error)
                });
              }
            })
          );
        })
      );
    }
    
    // For non-status updates, just update directly
    return from(updateDoc(taskRef, updates));
  }

  /**
   * Delete a task
   */
  deleteTask(taskId: string): Observable<void> {
    const taskRef = doc(this.firestore, `${this.collectionName}/${taskId}`);
    return from(deleteDoc(taskRef));
  }

  /**
   * Increment task aggregates (used in batch writes)
   */
  incrementTaskAggregates(
    taskId: string,
    increments: {
      total_subtasks?: number;
      completed_subtasks?: number;
      total_actual_seconds?: number;
      total_estimate_seconds?: number;
    }
  ): Observable<void> {
    const taskRef = doc(this.firestore, `${this.collectionName}/${taskId}`);
    const updates: any = {};
    
    if (increments.total_subtasks !== undefined) {
      updates['aggregates.total_subtasks'] = increment(increments.total_subtasks);
    }
    if (increments.completed_subtasks !== undefined) {
      updates['aggregates.completed_subtasks'] = increment(increments.completed_subtasks);
    }
    if (increments.total_actual_seconds !== undefined) {
      updates['aggregates.total_actual_seconds'] = increment(increments.total_actual_seconds);
    }
    if (increments.total_estimate_seconds !== undefined) {
      updates['aggregates.total_estimate_seconds'] = increment(increments.total_estimate_seconds);
    }
    
    return from(updateDoc(taskRef, updates));
  }
}
