import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, getDoc, getDocs, query, where, limit, orderBy } from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { TimeLog } from '../models/time-log.model';

@Injectable({
  providedIn: 'root'
})
export class TimeLogService {
  private firestore = inject(Firestore);
  private readonly collectionName = 'time_logs';

  /**
   * Get time logs for a user
   */
  getUserTimeLogs(userId: string, pageSize: number = 50): Observable<TimeLog[]> {
    const logsRef = collection(this.firestore, this.collectionName);
    const q = query(
      logsRef,
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog))
      )
    );
  }

  /**
   * Get time logs for a subtask
   */
  getSubtaskTimeLogs(subtaskId: string, pageSize: number = 50): Observable<TimeLog[]> {
    const logsRef = collection(this.firestore, this.collectionName);
    const q = query(
      logsRef,
      where('subtaskId', '==', subtaskId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog))
      )
    );
  }

  /**
   * Get time logs for a task
   */
  getTaskTimeLogs(taskId: string, pageSize: number = 50): Observable<TimeLog[]> {
    const logsRef = collection(this.firestore, this.collectionName);
    const q = query(
      logsRef,
      where('taskId', '==', taskId),
      orderBy('createdAt', 'desc'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimeLog))
      )
    );
  }
}
