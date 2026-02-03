import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { collection, doc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, query, where, limit, orderBy, Timestamp } from 'firebase/firestore';
import { Observable, from, map, switchMap } from 'rxjs';
import { Project } from '../models/project.model';

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private firestore = inject(Firestore);
  private readonly collectionName = 'projects';

  /**
   * Get a single project by ID
   */
  getProject(projectId: string): Observable<Project | null> {
    const projectRef = doc(this.firestore, `${this.collectionName}/${projectId}`);
    return from(getDoc(projectRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Project;
        }
        return null;
      })
    );
  }

  /**
   * Get all projects for a user (where user is a member)
   * Uses pagination as per spec requirement
   */
  getUserProjects(userId: string, pageSize: number = 20): Observable<Project[]> {
    const projectsRef = collection(this.firestore, this.collectionName);
    const q = query(
      projectsRef,
      where('members', 'array-contains', userId),
      orderBy('name'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project))
      )
    );
  }

  /**
   * Create a new project
   */
  createProject(project: Omit<Project, 'id'>): Observable<string> {
    const projectsRef = collection(this.firestore, this.collectionName);
    const newProject = {
      ...project,
      stats: {
        total_tasks: 0,
        completed_tasks: 0,
      }
    };
    
    return from(addDoc(projectsRef, newProject)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Update a project
   */
  updateProject(projectId: string, updates: Partial<Project>): Observable<void> {
    const projectRef = doc(this.firestore, `${this.collectionName}/${projectId}`);
    return from(updateDoc(projectRef, updates));
  }

  /**
   * Delete a project
   */
  deleteProject(projectId: string): Observable<void> {
    const projectRef = doc(this.firestore, `${this.collectionName}/${projectId}`);
    return from(deleteDoc(projectRef));
  }

  /**
   * Add a member to a project
   */
  addMember(projectId: string, userId: string): Observable<void> {
    const projectRef = doc(this.firestore, `${this.collectionName}/${projectId}`);
    return from(getDoc(projectRef)).pipe(
      switchMap(docSnap => {
        if (docSnap.exists()) {
          const project = docSnap.data() as Project;
          const members = project.members || [];
          if (!members.includes(userId)) {
            members.push(userId);
            return from(updateDoc(projectRef, { members }));
          }
        }
        return from(Promise.resolve());
      })
    );
  }
}
