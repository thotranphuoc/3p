import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  limit, 
  orderBy, 
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { Observable, from, map } from 'rxjs';
import { Objective, KeyResult } from '../models/objective.model';

@Injectable({
  providedIn: 'root'
})
export class ObjectiveService {
  private firestore = inject(Firestore);
  private readonly collectionName = 'objectives';

  /**
   * Get a single objective by ID
   */
  getObjective(objectiveId: string): Observable<Objective | null> {
    const objectiveRef = doc(this.firestore, `${this.collectionName}/${objectiveId}`);
    return from(getDoc(objectiveRef)).pipe(
      map(docSnap => {
        if (docSnap.exists()) {
          return { id: docSnap.id, ...docSnap.data() } as Objective;
        }
        return null;
      })
    );
  }

  /**
   * Get objectives for a project with pagination
   * Per spec: Always use limit() and where clause
   */
  getProjectObjectives(projectId: string, pageSize: number = 20): Observable<Objective[]> {
    const objectivesRef = collection(this.firestore, this.collectionName);
    const q = query(
      objectivesRef,
      where('projectId', '==', projectId),
      orderBy('title'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective))
      )
    );
  }

  /**
   * Get global objectives (not tied to a specific project)
   */
  getGlobalObjectives(pageSize: number = 20): Observable<Objective[]> {
    const objectivesRef = collection(this.firestore, this.collectionName);
    const q = query(
      objectivesRef,
      where('projectId', '==', 'global'),
      orderBy('title'),
      limit(pageSize)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective))
      )
    );
  }

  /**
   * Get all objectives for a project (including global)
   * Useful for dropdowns and linking
   */
  getAllAvailableObjectives(projectId: string): Observable<Objective[]> {
    const objectivesRef = collection(this.firestore, this.collectionName);
    const q = query(
      objectivesRef,
      where('projectId', 'in', [projectId, 'global']),
      limit(50)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective))
      )
    );
  }

  /**
   * Get objectives by BSC quadrant type
   */
  getObjectivesByType(projectId: string, type: 'financial' | 'customer' | 'internal' | 'learning'): Observable<Objective[]> {
    const objectivesRef = collection(this.firestore, this.collectionName);
    const q = query(
      objectivesRef,
      where('projectId', '==', projectId),
      where('type', '==', type),
      limit(20)
    );
    
    return from(getDocs(q)).pipe(
      map(querySnapshot => 
        querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective))
      )
    );
  }

  /**
   * REAL-TIME: Listen to a single objective
   */
  watchObjective(objectiveId: string): Observable<Objective | null> {
    const objectiveRef = doc(this.firestore, `${this.collectionName}/${objectiveId}`);
    
    return new Observable(observer => {
      const unsubscribe = onSnapshot(
        objectiveRef,
        (docSnap) => {
          if (docSnap.exists()) {
            observer.next({ id: docSnap.id, ...docSnap.data() } as Objective);
          } else {
            observer.next(null);
          }
        },
        (error) => {
          console.error('Error watching objective:', error);
          observer.error(error);
        }
      );
      
      return () => unsubscribe();
    });
  }

  /**
   * REAL-TIME: Listen to project objectives
   */
  watchProjectObjectives(projectId: string, pageSize: number = 50): Observable<Objective[]> {
    const objectivesRef = collection(this.firestore, this.collectionName);
    const q = query(
      objectivesRef,
      where('projectId', '==', projectId),
      limit(pageSize)
    );
    
    return new Observable(observer => {
      const unsubscribe = onSnapshot(
        q,
        (querySnapshot) => {
          const objectives = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective));
          // Sort by title in memory
          const sortedObjectives = objectives.sort((a, b) => a.title.localeCompare(b.title));
          observer.next(sortedObjectives);
        },
        (error) => {
          console.error('Error watching objectives:', error);
          observer.error(error);
        }
      );
      
      return () => unsubscribe();
    });
  }

  /**
   * Create a new objective
   */
  createObjective(objective: Omit<Objective, 'id'>): Observable<string> {
    const objectivesRef = collection(this.firestore, this.collectionName);
    
    // Initialize weighted calculation fields
    const newObjective = {
      ...objective,
      total_weight: objective.key_results.reduce((sum, kr) => sum + kr.weight, 0),
      current_weighted_score: 0,
      progress_percent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    return from(addDoc(objectivesRef, newObjective)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Update an objective (partial update)
   */
  updateObjective(objectiveId: string, updates: Partial<Objective>): Observable<void> {
    const objectiveRef = doc(this.firestore, `${this.collectionName}/${objectiveId}`);
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };
    return from(updateDoc(objectiveRef, updateData));
  }

  /**
   * Delete an objective
   */
  deleteObjective(objectiveId: string): Observable<void> {
    const objectiveRef = doc(this.firestore, `${this.collectionName}/${objectiveId}`);
    return from(deleteDoc(objectiveRef));
  }

  /**
   * Add a key result to an objective
   */
  addKeyResult(objectiveId: string, keyResult: KeyResult): Observable<void> {
    return new Observable(observer => {
      const objectiveRef = doc(this.firestore, `${this.collectionName}/${objectiveId}`);
      
      getDoc(objectiveRef).then(docSnap => {
        if (!docSnap.exists()) {
          observer.error(new Error('Objective not found'));
          return;
        }
        
        const objective = docSnap.data() as Objective;
        const updatedKeyResults = [...objective.key_results, keyResult];
        const newTotalWeight = updatedKeyResults.reduce((sum, kr) => sum + kr.weight, 0);
        
        return updateDoc(objectiveRef, {
          key_results: updatedKeyResults,
          total_weight: newTotalWeight,
          updatedAt: new Date(),
        });
      }).then(() => {
        observer.next();
        observer.complete();
      }).catch(error => {
        console.error('Error adding key result:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Update a specific key result within an objective
   */
  updateKeyResult(objectiveId: string, keyResultId: string, updates: Partial<KeyResult>): Observable<void> {
    return new Observable(observer => {
      const objectiveRef = doc(this.firestore, `${this.collectionName}/${objectiveId}`);
      
      getDoc(objectiveRef).then(docSnap => {
        if (!docSnap.exists()) {
          observer.error(new Error('Objective not found'));
          return;
        }
        
        const objective = docSnap.data() as Objective;
        const updatedKeyResults = objective.key_results.map(kr => 
          kr.id === keyResultId ? { ...kr, ...updates } : kr
        );
        
        const newTotalWeight = updatedKeyResults.reduce((sum, kr) => sum + kr.weight, 0);
        
        return updateDoc(objectiveRef, {
          key_results: updatedKeyResults,
          total_weight: newTotalWeight,
          updatedAt: new Date(),
        });
      }).then(() => {
        observer.next();
        observer.complete();
      }).catch(error => {
        console.error('Error updating key result:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Delete a key result from an objective
   */
  deleteKeyResult(objectiveId: string, keyResultId: string): Observable<void> {
    return new Observable(observer => {
      const objectiveRef = doc(this.firestore, `${this.collectionName}/${objectiveId}`);
      
      getDoc(objectiveRef).then(docSnap => {
        if (!docSnap.exists()) {
          observer.error(new Error('Objective not found'));
          return;
        }
        
        const objective = docSnap.data() as Objective;
        const updatedKeyResults = objective.key_results.filter(kr => kr.id !== keyResultId);
        const newTotalWeight = updatedKeyResults.reduce((sum, kr) => sum + kr.weight, 0);
        
        return updateDoc(objectiveRef, {
          key_results: updatedKeyResults,
          total_weight: newTotalWeight,
          updatedAt: new Date(),
        });
      }).then(() => {
        observer.next();
        observer.complete();
      }).catch(error => {
        console.error('Error deleting key result:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Recalculate objective progress based on key results
   * Formula: Objective_Progress = Sum(KR_Progress * KR_Weight) / Sum(KR_Weight)
   */
  recalculateObjectiveProgress(objectiveId: string): Observable<void> {
    return new Observable(observer => {
      const objectiveRef = doc(this.firestore, `${this.collectionName}/${objectiveId}`);
      
      getDoc(objectiveRef).then(docSnap => {
        if (!docSnap.exists()) {
          observer.error(new Error('Objective not found'));
          return;
        }
        
        const objective = docSnap.data() as Objective;
        
        // Calculate weighted score
        const currentWeightedScore = objective.key_results.reduce((sum, kr) => {
          return sum + (kr.progress * kr.weight);
        }, 0);
        
        const totalWeight = objective.key_results.reduce((sum, kr) => sum + kr.weight, 0);
        
        const progressPercent = totalWeight > 0 ? (currentWeightedScore / totalWeight) : 0;
        
        // Determine status based on progress
        let status: 'on_track' | 'at_risk' | 'behind' = 'on_track';
        if (progressPercent < 50) {
          status = 'behind';
        } else if (progressPercent < 75) {
          status = 'at_risk';
        }
        
        return updateDoc(objectiveRef, {
          current_weighted_score: currentWeightedScore,
          progress_percent: progressPercent,
          status: status,
          updatedAt: new Date(),
        });
      }).then(() => {
        observer.next();
        observer.complete();
      }).catch(error => {
        console.error('Error recalculating objective progress:', error);
        observer.error(error);
      });
    });
  }
}
