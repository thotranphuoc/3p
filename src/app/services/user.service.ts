import { Injectable, inject } from '@angular/core';
import { Firestore, doc, getDoc, getDocs, collection, query, where, limit, updateDoc, orderBy } from '@angular/fire/firestore';
import { Observable, from, map, switchMap, forkJoin, of } from 'rxjs';
import { User as AppUser } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private firestore = inject(Firestore);
  private readonly collectionName = 'users';

  /**
   * Get a single user by UID
   */
  getUser(uid: string): Observable<AppUser | null> {
    const userRef = doc(this.firestore, `${this.collectionName}/${uid}`);
    return from(getDoc(userRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          return {
            uid: data['uid'] || docSnap.id,
            email: data['email'] || '',
            displayName: data['displayName'] || '',
            photoURL: data['photoURL'] || '',
            role: data['role'] || 'member',
            active_timer: data['active_timer'] || null,
          } as AppUser;
        }
        return null;
      })
    );
  }

  /**
   * Get multiple users by their UIDs
   * Useful for getting project members or assignees
   */
  getUsers(uids: string[]): Observable<AppUser[]> {
    if (uids.length === 0) {
      return of([]);
    }

    // Firestore doesn't support 'in' queries with more than 10 items
    // So we'll fetch users individually and combine
    const userObservables = uids.map(uid => this.getUser(uid));
    
    return forkJoin(userObservables).pipe(
      map(users => users.filter((user): user is AppUser => user !== null))
    );
  }

  /**
   * Search users by display name or email
   * Note: This requires a composite index if searching by displayName
   */
  searchUsers(searchTerm: string, limitCount: number = 20): Observable<AppUser[]> {
    if (!searchTerm || searchTerm.length < 2) {
      return of([]);
    }

    const usersRef = collection(this.firestore, this.collectionName);
    // Search by email (starts with)
    const q = query(
      usersRef,
      where('email', '>=', searchTerm),
      where('email', '<=', searchTerm + '\uf8ff'),
      limit(limitCount)
    );

    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            uid: data['uid'] || doc.id,
            email: data['email'] || '',
            displayName: data['displayName'] || '',
            photoURL: data['photoURL'] || '',
            role: data['role'] || 'member',
            active_timer: data['active_timer'] || null,
          } as AppUser;
        })
      )
    );
  }

  /**
   * Get all users (Admin only)
   * Uses pagination for performance
   */
  getAllUsers(limitCount: number = 100): Observable<AppUser[]> {
    const usersRef = collection(this.firestore, this.collectionName);
    const q = query(
      usersRef,
      orderBy('email'),
      limit(limitCount)
    );

    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            uid: data['uid'] || doc.id,
            email: data['email'] || '',
            displayName: data['displayName'] || '',
            photoURL: data['photoURL'] || '',
            role: data['role'] || 'member',
            active_timer: data['active_timer'] || null,
          } as AppUser;
        })
      )
    );
  }

  /**
   * Update user role (Admin only)
   */
  updateUserRole(uid: string, role: 'admin' | 'director' | 'manager' | 'member'): Observable<void> {
    const userRef = doc(this.firestore, `${this.collectionName}/${uid}`);
    return from(updateDoc(userRef, { role }));
  }

  /**
   * Get users statistics
   */
  getUserStats(): Observable<{ total: number; admin: number; manager: number; member: number }> {
    return this.getAllUsers(1000).pipe(
      map(users => ({
        total: users.length,
        admin: users.filter(u => u.role === 'admin').length,
        manager: users.filter(u => u.role === 'manager').length,
        member: users.filter(u => u.role === 'member').length,
      }))
    );
  }
}
