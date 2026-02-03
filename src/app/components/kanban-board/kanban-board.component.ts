import { Component, Input, OnInit, Output, EventEmitter, signal, computed, inject, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { TaskService } from '../../services/task.service';
import { VisibilityService } from '../../services/visibility.service';
import { Task, TaskStatus } from '../../models/task.model';
import { TaskCardComponent } from '../task-card/task-card.component';
import { TaskModalComponent } from '../task-modal/task-modal.component';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [CommonModule, DragDropModule, TaskCardComponent, TaskModalComponent],
  templateUrl: './kanban-board.component.html',
  styleUrl: './kanban-board.component.scss'
})
export class KanbanBoardComponent implements OnInit, OnDestroy {
  @Input() projectId!: string;
  @Output() addSubtask = new EventEmitter<string>(); // Emit task ID when user wants to add subtask
  
  private taskService = inject(TaskService);
  private visibilityService = inject(VisibilityService);
  private subscriptions: Subscription[] = [];
  private isPaused = false;
  
  // Signals for reactive state management
  todoTasks = signal<Task[]>([]);
  inProgressTasks = signal<Task[]>([]);
  reviewTasks = signal<Task[]>([]);
  doneTasks = signal<Task[]>([]);
  
  loading = signal<boolean>(true);
  showTaskModal = signal<boolean>(false);
  selectedTask = signal<Task | null>(null);
  modalDefaultStatus = signal<TaskStatus>('todo');

  readonly statuses: { key: TaskStatus; label: string; color: string }[] = [
    { key: 'todo', label: 'To Do', color: 'bg-blue-100' },
    { key: 'in_progress', label: 'In Progress', color: 'bg-yellow-100' },
    { key: 'review', label: 'Review', color: 'bg-purple-100' },
    { key: 'done', label: 'Done', color: 'bg-green-100' },
  ];

  constructor() {
    // COST OPTIMIZATION: Pause listeners when tab is hidden for > 5 minutes
    // Effect must be called in constructor (injection context)
    effect(() => {
      const isVisible = this.visibilityService.isVisible();
      
      if (!isVisible) {
        // Tab just became hidden - start timer to check if we should pause
        setTimeout(() => {
          if (!this.visibilityService.visible && !this.isPaused) {
            // Tab has been hidden for 5+ minutes - pause listeners
            console.log('[Kanban] Pausing real-time listeners to save costs');
            this.subscriptions.forEach(sub => sub.unsubscribe());
            this.subscriptions = [];
            this.isPaused = true;
          }
        }, 5 * 60 * 1000); // 5 minutes
      } else if (this.isPaused) {
        // Tab became visible and we had paused - resume listeners
        console.log('[Kanban] Resuming real-time listeners');
        this.isPaused = false;
        this.loadTasks();
      }
    });
  }

  ngOnInit(): void {
    this.loadTasks();
  }

  ngOnDestroy(): void {
    // Clean up all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadTasks(): void {
    this.loading.set(true);
    
    // Clean up existing subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    
    // REAL-TIME: Watch tasks for each status
    const statuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    let initialLoadCount = 0;
    const totalStatuses = statuses.length;
    
    statuses.forEach(status => {
      const subscription = this.taskService.watchTasksByStatus(this.projectId, status, 50).subscribe({
        next: (tasks) => {
          switch (status) {
            case 'todo':
              this.todoTasks.set(tasks);
              break;
            case 'in_progress':
              this.inProgressTasks.set(tasks);
              break;
            case 'review':
              this.reviewTasks.set(tasks);
              break;
            case 'done':
              this.doneTasks.set(tasks);
              break;
          }
          
          // Only increment on initial load
          if (this.loading()) {
            initialLoadCount++;
            if (initialLoadCount === totalStatuses) {
              this.loading.set(false);
            }
          }
        },
        error: (error) => {
          console.error(`Error watching ${status} tasks:`, error);
          if (this.loading()) {
            initialLoadCount++;
            if (initialLoadCount === totalStatuses) {
              this.loading.set(false);
            }
          }
        }
      });
      
      this.subscriptions.push(subscription);
    });
  }

  drop(event: CdkDragDrop<Task[]>): void {
    const previousContainer = event.previousContainer;
    const currentContainer = event.container;
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;

    if (previousContainer === currentContainer) {
      // Moving within the same column - just reorder
      const status = this.getStatusFromContainerId(currentContainer.id);
      const tasks = [...this.getTasksForStatus(status)];
      moveItemInArray(tasks, previousIndex, currentIndex);
      this.updateTasksForStatus(status, tasks);
    } else {
      // Moving between columns - update task status
      const task = previousContainer.data[previousIndex];
      const oldStatus = this.getStatusFromContainerId(previousContainer.id);
      const newStatus = this.getStatusFromContainerId(currentContainer.id);
      
      // Update task object with new status immediately
      const updatedTask: Task = {
        ...task,
        status: newStatus
      };
      
      // Optimistic UI update - update signals directly
      const oldTasks = [...this.getTasksForStatus(oldStatus)];
      const newTasks = [...this.getTasksForStatus(newStatus)];
      
      // Remove from old status
      oldTasks.splice(previousIndex, 1);
      // Add to new status
      newTasks.splice(currentIndex, 0, updatedTask);
      
      // Update signals immediately
      this.updateTasksForStatus(oldStatus, oldTasks);
      this.updateTasksForStatus(newStatus, newTasks);

      // Update task status in Firestore
      this.taskService.updateTaskStatus(task.id, newStatus).subscribe({
        error: (error) => {
          console.error('Error updating task status:', error);
          // Revert optimistic update on error
          const revertedOldTasks = [...this.getTasksForStatus(oldStatus)];
          const revertedNewTasks = [...this.getTasksForStatus(newStatus)];
          
          // Restore original task
          revertedOldTasks.splice(previousIndex, 0, task);
          revertedNewTasks.splice(currentIndex, 1);
          
          this.updateTasksForStatus(oldStatus, revertedOldTasks);
          this.updateTasksForStatus(newStatus, revertedNewTasks);
        }
      });
    }
  }

  private updateTasksForStatus(status: TaskStatus, tasks: Task[]): void {
    switch (status) {
      case 'todo':
        this.todoTasks.set(tasks);
        break;
      case 'in_progress':
        this.inProgressTasks.set(tasks);
        break;
      case 'review':
        this.reviewTasks.set(tasks);
        break;
      case 'done':
        this.doneTasks.set(tasks);
        break;
    }
  }

  private getStatusFromContainerId(containerId: string): TaskStatus {
    if (containerId.includes('todo')) return 'todo';
    if (containerId.includes('in-progress')) return 'in_progress';
    if (containerId.includes('review')) return 'review';
    if (containerId.includes('done')) return 'done';
    return 'todo';
  }

  getTasksForStatus(status: TaskStatus): Task[] {
    switch (status) {
      case 'todo':
        return this.todoTasks();
      case 'in_progress':
        return this.inProgressTasks();
      case 'review':
        return this.reviewTasks();
      case 'done':
        return this.doneTasks();
      default:
        return [];
    }
  }

  getConnectedLists(): string[] {
    return ['todo', 'in-progress', 'review', 'done'];
  }

  openTaskModal(status: TaskStatus = 'todo'): void {
    this.modalDefaultStatus.set(status);
    this.selectedTask.set(null);
    this.showTaskModal.set(true);
  }

  editTask(task: Task): void {
    this.selectedTask.set(task);
    this.showTaskModal.set(true);
  }

  closeTaskModal(): void {
    this.showTaskModal.set(false);
    this.selectedTask.set(null);
  }

  onTaskSaved(): void {
    // Real-time listeners will automatically update the UI
    // No need to reload manually!
    this.closeTaskModal();
  }

  onTaskUpdated(updatedTask: Task): void {
    // Real-time listeners will automatically update the UI
    // No need to manually update!
  }
}
