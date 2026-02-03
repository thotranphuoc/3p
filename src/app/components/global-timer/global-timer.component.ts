import { Component, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TimerService } from '../../services/timer.service';
import { TaskService } from '../../services/task.service';
import { SubtaskService } from '../../services/subtask.service';
import { Task } from '../../models/task.model';
import { Subtask } from '../../models/subtask.model';

@Component({
  selector: 'app-global-timer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './global-timer.component.html',
  styleUrl: './global-timer.component.scss'
})
export class GlobalTimerComponent implements OnDestroy {
  private timerService = inject(TimerService);
  private taskService = inject(TaskService);
  private subtaskService = inject(SubtaskService);
  private router = inject(Router);
  
  private taskSubscription?: Subscription;
  private subtaskSubscription?: Subscription;

  task = signal<Task | null>(null);
  subtask = signal<Subtask | null>(null);
  isExpanded = signal<boolean>(false);
  loading = signal<boolean>(false);
  loadError = signal<string | null>(null);
  isStaleTimer = signal<boolean>(false);

  constructor() {
    // Watch for timer changes and auto-load task/subtask info
    // Effect must be in constructor (injection context)
    effect(() => {
      const timer = this.timerService.activeTimer();
      if (timer) {
        console.log('[GlobalTimer] Timer changed, loading task info:', timer);
        this.loadTaskInfo(timer.taskId, timer.subtaskId);
      } else {
        // Timer stopped - clear task info
        console.log('[GlobalTimer] Timer stopped, clearing task info');
        this.task.set(null);
        this.subtask.set(null);
        this.isExpanded.set(false);
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy(): void {
    // Cleanup subscriptions
    this.taskSubscription?.unsubscribe();
    this.subtaskSubscription?.unsubscribe();
  }

  get activeTimer() {
    return this.timerService.activeTimer();
  }

  get elapsedTime() {
    return this.timerService.formattedTime();
  }

  get isRunning() {
    return this.timerService.isRunning();
  }

  async stopTimer(): Promise<void> {
    try {
      this.loading.set(true);
      await this.timerService.stopTimer();
      this.task.set(null);
      this.subtask.set(null);
      this.loadError.set(null);
      this.isStaleTimer.set(false);
      console.log('[GlobalTimer] Timer stopped successfully');
    } catch (error) {
      console.error('[GlobalTimer] Error stopping timer:', error);
      this.loadError.set('Failed to stop timer. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async forceStopTimer(): Promise<void> {
    try {
      this.loading.set(true);
      await this.timerService.forceStopTimer();
      this.task.set(null);
      this.subtask.set(null);
      this.loadError.set(null);
      this.isStaleTimer.set(false);
      console.log('[GlobalTimer] Timer force stopped');
    } catch (error) {
      console.error('[GlobalTimer] Error force stopping timer:', error);
    } finally {
      this.loading.set(false);
    }
  }

  toggleExpand(): void {
    this.isExpanded.set(!this.isExpanded());
  }

  navigateToTask(): void {
    const timer = this.activeTimer;
    if (!timer) {
      console.error('[GlobalTimer] No active timer');
      return;
    }

    console.log('[GlobalTimer] Navigating to project:', timer.projectId);
    console.log('[GlobalTimer] Current URL:', this.router.url);
    
    // Close expanded view
    this.isExpanded.set(false);
    
    const targetUrl = `/project/${timer.projectId}`;
    
    // Check if already on the same project page
    if (this.router.url === targetUrl) {
      console.log('[GlobalTimer] Already on target project page, scrolling to top');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    // Navigate to project with skipLocationChange: false to ensure proper navigation
    this.router.navigate(['/project', timer.projectId], {
      // Force reload even if on same route with different params
      onSameUrlNavigation: 'reload'
    }).then(
      (success) => {
        if (success) {
          console.log('[GlobalTimer] Navigation successful to:', targetUrl);
        } else {
          console.warn('[GlobalTimer] Navigation returned false (might be same route)');
          // Navigation returned false - might be same route
          // Check if we're on a project page at all
          if (this.router.url.startsWith('/project/')) {
            console.log('[GlobalTimer] Already on a project page');
          }
        }
      },
      (error) => {
        console.error('[GlobalTimer] Navigation error:', error);
      }
    );
  }

  private loadTaskInfo(taskId: string, subtaskId: string): void {
    console.log('[GlobalTimer] loadTaskInfo called with:', { taskId, subtaskId });
    
    if (!taskId || !subtaskId) {
      console.error('[GlobalTimer] Invalid taskId or subtaskId:', { taskId, subtaskId });
      this.loadError.set('Invalid timer data');
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.isStaleTimer.set(false);
    
    // Cleanup previous subscriptions
    this.taskSubscription?.unsubscribe();
    this.subtaskSubscription?.unsubscribe();

    // Check if timer is stale (running for > 24 hours)
    const timer = this.timerService.activeTimer();
    if (timer) {
      const startTime = timer.startTime?.toDate() || new Date(timer.localStartTime);
      const hoursElapsed = (Date.now() - startTime.getTime()) / (1000 * 60 * 60);
      console.log('[GlobalTimer] Timer running for hours:', hoursElapsed);
      if (hoursElapsed > 24) {
        this.isStaleTimer.set(true);
        console.warn('[GlobalTimer] Detected stale timer (>24 hours)');
      }
    }

    let taskLoaded = false;
    let subtaskLoaded = false;

    // Load task
    console.log('[GlobalTimer] Fetching task:', taskId);
    this.taskSubscription = this.taskService.getTask(taskId).subscribe({
      next: (task) => {
        console.log('[GlobalTimer] Task received:', task);
        this.task.set(task);
        taskLoaded = true;
        if (!task) {
          console.warn('[GlobalTimer] Task is null');
          this.loadError.set('Task not found (may have been deleted)');
        } else {
          console.log('[GlobalTimer] Task loaded successfully:', task.title);
        }
      },
      error: (error) => {
        console.error('[GlobalTimer] Error loading task:', error);
        this.task.set(null);
        this.loadError.set('Permission denied or task not found');
        taskLoaded = true;
      },
      complete: () => {
        console.log('[GlobalTimer] Task observable completed');
        if (taskLoaded && subtaskLoaded) {
          this.loading.set(false);
        }
      }
    });

    // Load subtask
    console.log('[GlobalTimer] Fetching subtask:', subtaskId);
    this.subtaskSubscription = this.subtaskService.getSubtask(subtaskId).subscribe({
      next: (subtask) => {
        console.log('[GlobalTimer] Subtask received:', subtask);
        this.subtask.set(subtask);
        subtaskLoaded = true;
        if (!subtask) {
          console.warn('[GlobalTimer] Subtask is null');
          this.loadError.set('Subtask not found (may have been deleted)');
        } else {
          console.log('[GlobalTimer] Subtask loaded successfully:', subtask.title);
        }
      },
      error: (error) => {
        console.error('[GlobalTimer] Error loading subtask:', error);
        this.subtask.set(null);
        if (!this.loadError()) {
          this.loadError.set('Permission denied or subtask not found');
        }
        subtaskLoaded = true;
      },
      complete: () => {
        console.log('[GlobalTimer] Subtask observable completed');
        if (taskLoaded && subtaskLoaded) {
          this.loading.set(false);
        }
      }
    });

    // Timeout to set loading to false
    setTimeout(() => {
      if (this.loading()) {
        console.warn('[GlobalTimer] Load timeout - forcing loading to false');
        this.loading.set(false);
      }
    }, 5000);
  }
}
