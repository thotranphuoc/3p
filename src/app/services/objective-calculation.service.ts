import { Injectable, inject } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import { doc, getDoc, getDocs, updateDoc, query, collection, where } from 'firebase/firestore';
import { Observable, from, forkJoin, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { Objective, KeyResult } from '../models/objective.model';
import { Task } from '../models/task.model';

/**
 * ObjectiveCalculationService
 * 
 * Handles automatic calculation of objective progress based on linked tasks.
 * Implements Section 3.2 of PROMAN_SPEC.md: BSC/OKR Calculation Logic (Weighted Average)
 * 
 * Formula:
 * - For task_linked Key Results: KR_Progress = (completed_linked_tasks / total_linked_tasks) * 100
 * - For Objectives: Objective_Progress = Sum(KR_Progress * KR_Weight) / Sum(KR_Weight)
 */
@Injectable({
  providedIn: 'root'
})
export class ObjectiveCalculationService {
  private firestore = inject(Firestore);

  /**
   * Recalculate progress for a specific key result
   * Only applies to task_linked type key results
   */
  recalculateKeyResultProgress(objectiveId: string, keyResultId: string): Observable<void> {
    return new Observable(observer => {
      const objectiveRef = doc(this.firestore, `objectives/${objectiveId}`);
      
      getDoc(objectiveRef).then(async docSnap => {
        if (!docSnap.exists()) {
          console.error('Objective not found:', objectiveId);
          observer.error(new Error('Objective not found'));
          return;
        }
        
        const objective = { id: docSnap.id, ...docSnap.data() } as Objective;
        const keyResult = objective.key_results.find(kr => kr.id === keyResultId);
        
        if (!keyResult) {
          console.error('Key result not found:', keyResultId);
          observer.error(new Error('Key result not found'));
          return;
        }
        
        // Only recalculate for task_linked type
        if (keyResult.type !== 'task_linked' || !keyResult.linked_task_ids || keyResult.linked_task_ids.length === 0) {
          console.log('Key result is not task_linked or has no linked tasks, skipping calculation');
          observer.next();
          observer.complete();
          return;
        }
        
        // Get all linked tasks
        const tasksRef = collection(this.firestore, 'tasks');
        const q = query(tasksRef, where('__name__', 'in', keyResult.linked_task_ids));
        
        try {
          const tasksSnapshot = await getDocs(q);
          const tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
          
          const totalTasks = tasks.length;
          const completedTasks = tasks.filter(t => t.status === 'done').length;
          
          // Calculate progress percentage
          const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
          
          console.log(`KR Progress Calculation: ${completedTasks}/${totalTasks} tasks done = ${progress}%`);
          
          // Update the key result progress in the objective
          const updatedKeyResults = objective.key_results.map(kr => 
            kr.id === keyResultId ? { ...kr, progress } : kr
          );
          
          await updateDoc(objectiveRef, {
            key_results: updatedKeyResults,
            updatedAt: new Date(),
          });
          
          observer.next();
          observer.complete();
        } catch (error) {
          console.error('Error calculating key result progress:', error);
          observer.error(error);
        }
      }).catch(error => {
        console.error('Error reading objective:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Recalculate weighted progress for an objective
   * Formula: Objective_Progress = Sum(KR_Progress * KR_Weight) / Sum(KR_Weight)
   */
  recalculateObjectiveProgress(objectiveId: string): Observable<void> {
    return new Observable(observer => {
      const objectiveRef = doc(this.firestore, `objectives/${objectiveId}`);
      
      getDoc(objectiveRef).then(docSnap => {
        if (!docSnap.exists()) {
          console.error('Objective not found:', objectiveId);
          observer.error(new Error('Objective not found'));
          return;
        }
        
        const objective = { id: docSnap.id, ...docSnap.data() } as Objective;
        
        if (!objective.key_results || objective.key_results.length === 0) {
          console.log('No key results to calculate progress for');
          observer.next();
          observer.complete();
          return;
        }
        
        // Calculate weighted score: Sum(KR_Progress * KR_Weight)
        const currentWeightedScore = objective.key_results.reduce((sum, kr) => {
          return sum + (kr.progress * kr.weight);
        }, 0);
        
        // Calculate total weight: Sum(KR_Weight)
        const totalWeight = objective.key_results.reduce((sum, kr) => sum + kr.weight, 0);
        
        // Calculate progress percentage
        const progressPercent = totalWeight > 0 ? (currentWeightedScore / totalWeight) : 0;
        
        // Determine status based on progress
        let status: 'on_track' | 'at_risk' | 'behind' = 'on_track';
        if (progressPercent < 50) {
          status = 'behind';
        } else if (progressPercent < 75) {
          status = 'at_risk';
        }
        
        console.log(`Objective Progress Calculation: ${progressPercent}% (${currentWeightedScore}/${totalWeight}) - Status: ${status}`);
        
        // Update objective with new progress
        return updateDoc(objectiveRef, {
          current_weighted_score: currentWeightedScore,
          total_weight: totalWeight,
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

  /**
   * Triggered when a task is completed
   * Recalculates all linked objectives
   */
  onTaskCompleted(taskId: string): Observable<void> {
    return new Observable(observer => {
      const taskRef = doc(this.firestore, `tasks/${taskId}`);
      
      getDoc(taskRef).then(async docSnap => {
        if (!docSnap.exists()) {
          console.error('Task not found:', taskId);
          observer.error(new Error('Task not found'));
          return;
        }
        
        const task = { id: docSnap.id, ...docSnap.data() } as Task;
        
        // Check if task has a goal link
        if (!task.goal_link) {
          console.log('Task has no goal link, skipping objective recalculation');
          observer.next();
          observer.complete();
          return;
        }
        
        const { objectiveId, keyResultId } = task.goal_link;
        
        console.log(`Task ${taskId} completed. Recalculating Objective ${objectiveId} / KR ${keyResultId}`);
        
        try {
          // Step 1: Recalculate the specific key result progress
          await this.recalculateKeyResultProgress(objectiveId, keyResultId).toPromise();
          
          // Step 2: Recalculate the overall objective progress
          await this.recalculateObjectiveProgress(objectiveId).toPromise();
          
          console.log('Objective recalculation completed successfully');
          observer.next();
          observer.complete();
        } catch (error) {
          console.error('Error in onTaskCompleted:', error);
          observer.error(error);
        }
      }).catch(error => {
        console.error('Error reading task:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Triggered when a task status changes
   * If changed to 'done', trigger objective recalculation
   */
  onTaskStatusChanged(taskId: string, newStatus: string, oldStatus: string): Observable<void> {
    // Only trigger recalculation if status changed to or from 'done'
    if (newStatus === 'done' || oldStatus === 'done') {
      console.log(`Task ${taskId} status changed: ${oldStatus} → ${newStatus}. Triggering recalculation.`);
      return this.onTaskCompleted(taskId);
    }
    
    console.log(`Task ${taskId} status changed: ${oldStatus} → ${newStatus}. No recalculation needed.`);
    return of(void 0);
  }

  /**
   * Update manual metric key result
   * For key results of type 'metric' (not task_linked)
   */
  updateManualMetric(objectiveId: string, keyResultId: string, currentValue: number): Observable<void> {
    return new Observable(observer => {
      const objectiveRef = doc(this.firestore, `objectives/${objectiveId}`);
      
      getDoc(objectiveRef).then(docSnap => {
        if (!docSnap.exists()) {
          console.error('Objective not found:', objectiveId);
          observer.error(new Error('Objective not found'));
          return;
        }
        
        const objective = { id: docSnap.id, ...docSnap.data() } as Objective;
        const keyResult = objective.key_results.find(kr => kr.id === keyResultId);
        
        if (!keyResult) {
          console.error('Key result not found:', keyResultId);
          observer.error(new Error('Key result not found'));
          return;
        }
        
        if (keyResult.type !== 'metric') {
          console.error('Key result is not of type metric');
          observer.error(new Error('Key result is not of type metric'));
          return;
        }
        
        // Calculate progress based on current vs target value
        const targetValue = keyResult.target_value || 0;
        const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;
        
        console.log(`Manual Metric Update: ${currentValue}/${targetValue} = ${progress}%`);
        
        // Update the key result
        const updatedKeyResults = objective.key_results.map(kr => 
          kr.id === keyResultId ? { ...kr, current_value: currentValue, progress } : kr
        );
        
        return updateDoc(objectiveRef, {
          key_results: updatedKeyResults,
          updatedAt: new Date(),
        });
      }).then(() => {
        // After updating the metric, recalculate objective progress
        return this.recalculateObjectiveProgress(objectiveId).toPromise();
      }).then(() => {
        observer.next();
        observer.complete();
      }).catch(error => {
        console.error('Error updating manual metric:', error);
        observer.error(error);
      });
    });
  }

  /**
   * Recalculate all objectives for a project
   * Useful for batch updates or data migration
   */
  recalculateProjectObjectives(projectId: string): Observable<void> {
    return new Observable(observer => {
      const objectivesRef = collection(this.firestore, 'objectives');
      const q = query(objectivesRef, where('projectId', '==', projectId));
      
      getDocs(q).then(async snapshot => {
        const objectives = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Objective));
        
        console.log(`Recalculating ${objectives.length} objectives for project ${projectId}`);
        
        try {
          // Process each objective sequentially to avoid race conditions
          for (const objective of objectives) {
            // Recalculate all task_linked key results
            for (const kr of objective.key_results) {
              if (kr.type === 'task_linked') {
                await this.recalculateKeyResultProgress(objective.id, kr.id).toPromise();
              }
            }
            
            // Then recalculate objective progress
            await this.recalculateObjectiveProgress(objective.id).toPromise();
          }
          
          console.log('Project objectives recalculation completed');
          observer.next();
          observer.complete();
        } catch (error) {
          console.error('Error recalculating project objectives:', error);
          observer.error(error);
        }
      }).catch(error => {
        console.error('Error fetching project objectives:', error);
        observer.error(error);
      });
    });
  }
}
