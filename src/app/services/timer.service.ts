import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, doc, updateDoc, writeBatch, collection, serverTimestamp, increment, Timestamp } from '@angular/fire/firestore';
import { Observable, from, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ActiveTimer } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class TimerService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  // Signals for timer state
  activeTimer = signal<ActiveTimer | null>(null);
  elapsedSeconds = signal<number>(0);
  isRunning = signal<boolean>(false);
  
  // Computed values
  formattedTime = computed(() => this.formatTime(this.elapsedSeconds()));
  
  private intervalId: any = null;
  private startTime: Date | null = null;
  private isStopping = false; // Flag to prevent reload during stop operation

  constructor() {
    // Load active timer from user profile when auth state changes
    // Use allowSignalWrites to allow writing signals in effect
    effect(() => {
      const userProfile = this.authService.currentUserProfile();
      
      // Skip if we're in the middle of stopping a timer
      if (this.isStopping) {
        console.log('[TimerService] Skipping timer load - stop operation in progress');
        return;
      }
      
      if (userProfile?.active_timer) {
        console.log('[TimerService] User profile has active timer, loading...');
        this.loadActiveTimer(userProfile.active_timer);
      } else {
        // Stop timer and clear state
        console.log('[TimerService] No active timer in user profile, clearing local state');
        if (this.intervalId) {
          clearInterval(this.intervalId);
          this.intervalId = null;
        }
        this.isRunning.set(false);
        this.startTime = null;
        this.activeTimer.set(null);
        this.elapsedSeconds.set(0);
      }
    }, { allowSignalWrites: true });
  }

  /**
   * Start timer for a subtask
   * Per spec Section 3.1: Check if user.active_timer exists, stop it first
   */
  async startTimer(taskId: string, subtaskId: string, projectId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to start timer');
    }

    // Check if there's an active timer and stop it first
    if (this.activeTimer()) {
      await this.stopTimer();
    }

    const timerData: ActiveTimer = {
      isRunning: true,
      taskId,
      subtaskId,
      projectId,
      startTime: Timestamp.now(), // Will be replaced by serverTimestamp
      localStartTime: new Date().toISOString(),
    };

    // Update user.active_timer with serverTimestamp
    const userRef = doc(this.firestore, `users/${user.uid}`);
    await updateDoc(userRef, {
      active_timer: {
        ...timerData,
        startTime: serverTimestamp(),
      }
    });

    // Start local timer
    this.activeTimer.set(timerData);
    this.startLocalTimer();
  }

  /**
   * Stop timer and perform batch write
   * Per spec Section 3.1: Atomic Batch Write
   */
  async stopTimer(): Promise<void> {
    const user = this.auth.currentUser;
    const timer = this.activeTimer();
    
    if (!user || !timer) {
      console.warn('[TimerService] Cannot stop timer: no user or timer');
      return;
    }

    // Set flag to prevent reload during stop operation
    this.isStopping = true;
    console.log('[TimerService] Starting stop timer operation...');

    // Calculate duration
    const startTime = timer.startTime?.toDate() || new Date(timer.localStartTime);
    const currentTime = new Date();
    const durationSeconds = Math.floor((currentTime.getTime() - startTime.getTime()) / 1000);

    if (durationSeconds <= 0) {
      // Invalid duration, just reset timer
      console.warn('[TimerService] Invalid duration, resetting timer');
      this.isStopping = false;
      await this.resetTimer();
      return;
    }

    // Stop local timer first
    this.stopLocalTimer();

    try {
      // Per spec: Atomic Batch Write
      const batch = writeBatch(this.firestore);

      // 1. Create time_logs doc
      const timeLogsRef = doc(collection(this.firestore, 'time_logs'));
      batch.set(timeLogsRef, {
        userId: user.uid,
        taskId: timer.taskId,
        subtaskId: timer.subtaskId,
        seconds: durationSeconds,
        createdAt: serverTimestamp(),
      });

      // 2. Increment subtasks/{subId}.actual_seconds
      const subtaskRef = doc(this.firestore, `subtasks/${timer.subtaskId}`);
      batch.update(subtaskRef, {
        actual_seconds: increment(durationSeconds),
      });

      // 3. Increment tasks/{taskId}.aggregates.total_actual_seconds
      const taskRef = doc(this.firestore, `tasks/${timer.taskId}`);
      batch.update(taskRef, {
        'aggregates.total_actual_seconds': increment(durationSeconds),
      });

      // 4. Reset users/{uid}.active_timer to null
      const userRef = doc(this.firestore, `users/${user.uid}`);
      batch.update(userRef, {
        active_timer: null,
      });

      // IMPORTANT: Reset local state BEFORE committing
      // This prevents race condition where auth state changes before batch commits
      this.activeTimer.set(null);
      this.elapsedSeconds.set(0);

      // Commit batch - MUST wait for completion
      await batch.commit();
      
      console.log('[TimerService] Timer stopped successfully, duration:', durationSeconds);
      console.log('[TimerService] Batch committed, active_timer cleared in Firestore');
      
      // Add small delay to ensure Firestore update propagates
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error('[TimerService] Error stopping timer:', error);
      
      // If batch write fails (e.g., permission denied or documents don't exist),
      // force stop the timer locally and clear user's active_timer
      await this.forceStopTimer();
      throw error;
    } finally {
      // Clear stopping flag
      this.isStopping = false;
      console.log('[TimerService] Stop operation completed, flag cleared');
    }
  }

  /**
   * Force stop timer without saving time logs
   * Used when:
   * - User logged out (no permissions)
   * - Documents don't exist
   * - Stale timer needs cleanup
   */
  async forceStopTimer(): Promise<void> {
    const user = this.auth.currentUser;
    
    this.isStopping = true;
    console.warn('[TimerService] Force stopping timer');
    
    // Stop local timer
    this.stopLocalTimer();

    // Clear user's active_timer if user is logged in
    if (user) {
      try {
        const userRef = doc(this.firestore, `users/${user.uid}`);
        await updateDoc(userRef, {
          active_timer: null,
        });
        console.log('[TimerService] Cleared active_timer from user profile');
        
        // Add delay to ensure propagation
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error('[TimerService] Error clearing active_timer:', error);
      }
    }

    // Reset local state
    this.activeTimer.set(null);
    this.elapsedSeconds.set(0);
    this.isStopping = false;
  }

  /**
   * Reset timer without saving (for edge cases)
   */
  private async resetTimer(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    this.stopLocalTimer();
    
    const userRef = doc(this.firestore, `users/${user.uid}`);
    await updateDoc(userRef, {
      active_timer: null,
    });

    this.activeTimer.set(null);
    this.elapsedSeconds.set(0);
  }

  /**
   * Load active timer from user profile
   */
  private loadActiveTimer(timer: ActiveTimer): void {
    // Stop any existing timer first
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.activeTimer.set(timer);
    
    // Calculate elapsed time from startTime
    const startTime = timer.startTime?.toDate() || new Date(timer.localStartTime);
    const now = new Date();
    const elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    
    this.elapsedSeconds.set(Math.max(0, elapsed));
    this.startLocalTimer();
  }

  /**
   * Start local setInterval to count time
   */
  private startLocalTimer(): void {
    this.stopLocalTimer(); // Clear any existing interval
    
    if (!this.activeTimer()) return;

    this.isRunning.set(true);
    const startTime = this.activeTimer()!.startTime?.toDate() || new Date(this.activeTimer()!.localStartTime);
    this.startTime = startTime;

    this.intervalId = setInterval(() => {
      if (this.startTime) {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - this.startTime.getTime()) / 1000);
        this.elapsedSeconds.set(Math.max(0, elapsed));
      }
    }, 1000); // Update every second
  }

  /**
   * Stop local timer interval
   */
  private stopLocalTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning.set(false);
    this.startTime = null;
  }

  /**
   * Format seconds to HH:MM:SS
   */
  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Check if user forgot to stop timer (edge case handling)
   * Called on login to detect stale timers
   */
  async checkStaleTimer(): Promise<boolean> {
    const timer = this.activeTimer();
    if (!timer) return false;

    const startTime = timer.startTime?.toDate() || new Date(timer.localStartTime);
    const now = new Date();
    const hoursElapsed = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    // Consider timer stale if running for more than 24 hours
    return hoursElapsed > 24;
  }
}
