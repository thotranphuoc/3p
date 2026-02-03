import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, limit, orderBy, writeBatch, increment, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { Observable, from, map, switchMap } from 'rxjs';
import { Subtask, SubtaskStatus } from '../models/subtask.model';

@Injectable({
  providedIn: 'root'
})
export class SubtaskService {
  private firestore = inject(Firestore);
  private readonly collectionName = 'subtasks';

  /**
   * Get a single subtask by ID
   */
  getSubtask(subtaskId: string): Observable<Subtask | null> {
    const subtaskRef = doc(this.firestore, `${this.collectionName}/${subtaskId}`);
    return from(getDoc(subtaskRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Subtask;
        }
        return null;
      })
    );
  }

  /**
   * Get subtasks for a task with pagination
   * Removed orderBy to avoid index requirement - will sort in memory
   */
  getTaskSubtasks(taskId: string, pageSize: number = 50): Observable<Subtask[]> {
    const subtasksRef = collection(this.firestore, this.collectionName);
    const q = query(
      subtasksRef,
      where('parentId', '==', taskId),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => {
        const subtasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subtask));
        // Sort by title in memory
        return subtasks.sort((a, b) => a.title.localeCompare(b.title));
      })
    );
  }

  /**
   * REAL-TIME: Watch subtasks for a task
   * Returns an Observable that emits whenever subtasks change
   */
  watchTaskSubtasks(taskId: string, pageSize: number = 50): Observable<Subtask[]> {
    const subtasksRef = collection(this.firestore, this.collectionName);
    const q = query(
      subtasksRef,
      where('parentId', '==', taskId),
      limit(pageSize)
    );
    
    return new Observable(observer => {
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const subtasks = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subtask));
          // Sort by title in memory
          const sortedSubtasks = subtasks.sort((a, b) => a.title.localeCompare(b.title));
          observer.next(sortedSubtasks);
        },
        (error) => {
          console.error('Error watching subtasks:', error);
          observer.error(error);
        }
      );
      
      return () => unsubscribe();
    });
  }

  /**
   * Get subtasks for a project (for "My Tasks" view)
   */
  getProjectSubtasks(projectId: string, pageSize: number = 50): Observable<Subtask[]> {
    const subtasksRef = collection(this.firestore, this.collectionName);
    const q = query(
      subtasksRef,
      where('projectId', '==', projectId),
      orderBy('title'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subtask))
      )
    );
  }

  /**
   * Get subtasks assigned to a user across all projects
   */
  getUserSubtasks(userId: string, pageSize: number = 50): Observable<Subtask[]> {
    const subtasksRef = collection(this.firestore, this.collectionName);
    const q = query(
      subtasksRef,
      where('assignees', 'array-contains', userId),
      orderBy('title'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Subtask))
      )
    );
  }

  /**
   * Create a new subtask (SIMPLIFIED - no batch writes for aggregates)
   * UI will calculate aggregates from subtasks list
   */
  createSubtask(subtask: Omit<Subtask, 'id'>): Observable<string> {
    const subtasksRef = collection(this.firestore, this.collectionName);
    const newSubtask = {
      ...subtask,
      actual_seconds: 0,
    };
    
    return from(addDoc(subtasksRef, newSubtask)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Update subtask status (SIMPLIFIED - no batch writes for aggregates)
   * UI will calculate aggregates from subtasks list
   */
  updateSubtaskStatus(subtaskId: string, newStatus: SubtaskStatus, parentId: string, wasCompleted: boolean): Observable<void> {
    return this.updateSubtask(subtaskId, { status: newStatus });
  }

  /**
   * Update subtask (SIMPLIFIED - no batch writes for aggregates)
   * UI will calculate aggregates from subtasks list
   */
  updateSubtask(subtaskId: string, updates: Partial<Subtask>): Observable<void> {
    const subtaskRef = doc(this.firestore, `${this.collectionName}/${subtaskId}`);
    return from(updateDoc(subtaskRef, updates));
  }

  /**
   * Delete subtask (SIMPLIFIED - no batch writes for aggregates)
   * UI will calculate aggregates from subtasks list
   */
  deleteSubtask(subtaskId: string, parentId: string, estimateSeconds: number, wasCompleted: boolean): Observable<void> {
    const subtaskRef = doc(this.firestore, `${this.collectionName}/${subtaskId}`);
    return from(deleteDoc(subtaskRef));
  }

  /**
   * Increment actual_seconds for a subtask (used in time tracking)
   */
  incrementActualSeconds(subtaskId: string, seconds: number): Observable<void> {
    const subtaskRef = doc(this.firestore, `${this.collectionName}/${subtaskId}`);
    return from(updateDoc(subtaskRef, {
      actual_seconds: increment(seconds),
    }));
  }
}
