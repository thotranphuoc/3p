import { Component, Input, Output, EventEmitter, signal, inject, OnChanges, SimpleChanges, computed, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { Task } from '../../models/task.model';
import { Subtask } from '../../models/subtask.model';
import { Objective } from '../../models/objective.model';
import { SubtaskListComponent } from '../subtask-list/subtask-list.component';
import { SubtaskModalComponent } from '../subtask-modal/subtask-modal.component';
import { SubtaskService } from '../../services/subtask.service';
import { ObjectiveService } from '../../services/objective.service';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, SubtaskListComponent, SubtaskModalComponent],
  templateUrl: './task-card.component.html',
  styleUrl: './task-card.component.scss'
})
export class TaskCardComponent implements OnChanges, OnDestroy {
  @Input() task!: Task;
  @Input() projectId!: string;
  @Output() addSubtask = new EventEmitter<string>(); // Emit task ID when user wants to add subtask
  @Output() taskUpdated = new EventEmitter<Task>(); // Emit updated task when task needs to be reloaded
  
  private subtaskService = inject(SubtaskService);
  private objectiveService = inject(ObjectiveService);
  private subtasksSubscription?: Subscription;
  
  // Real-time subtasks list
  subtasks = signal<Subtask[]>([]);
  showSubtasks = signal<boolean>(false);
  
  // Subtask modal state
  showSubtaskModal = signal<boolean>(false);
  selectedSubtask = signal<Subtask | null>(null);
  
  // BSC/OKR goal linking
  linkedObjective = signal<Objective | null>(null);
  
  // Computed aggregates from subtasks (CLIENT-SIDE CALCULATION)
  computedAggregates = computed(() => {
    const subs = this.subtasks();
    return {
      total_subtasks: subs.length,
      completed_subtasks: subs.filter(s => s.status === 'done').length,
      total_estimate_seconds: subs.reduce((sum, s) => sum + (s.estimate_seconds || 0), 0),
      total_actual_seconds: subs.reduce((sum, s) => sum + (s.actual_seconds || 0), 0),
    };
  });
  
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task'] && this.task?.id) {
      this.loadSubtasks();
      this.loadObjectiveData();
    }
  }
  
  private loadObjectiveData(): void {
    if (this.task.goal_link) {
      this.objectiveService.getObjective(this.task.goal_link.objectiveId).subscribe({
        next: (objective) => {
          this.linkedObjective.set(objective);
        },
        error: (error) => {
          console.error('Error loading linked objective:', error);
          this.linkedObjective.set(null);
        }
      });
    } else {
      this.linkedObjective.set(null);
    }
  }

  ngOnDestroy(): void {
    this.subtasksSubscription?.unsubscribe();
  }

  private loadSubtasks(): void {
    // Unsubscribe from previous subscription
    this.subtasksSubscription?.unsubscribe();
    
    // OPTIMIZATION: Limit subtasks to reduce initial read cost
    // Subscribe to real-time subtasks (max 50 to control cost)
    this.subtasksSubscription = this.subtaskService.watchTaskSubtasks(this.task.id, 50).subscribe({
      next: (subtasks) => {
        this.subtasks.set(subtasks);
      },
      error: (error) => {
        console.error('Error watching subtasks:', error);
      }
    });
  }

  toggleSubtasks(): void {
    this.showSubtasks.set(!this.showSubtasks());
  }

  // No longer needed - aggregates are computed automatically
  onSubtaskUpdated(): void {
    // Subtasks are automatically updated via real-time listener
    // No need to reload anything!
  }

  /**
   * Handle edit subtask from SubtaskListComponent
   */
  onEditSubtask(subtask: Subtask): void {
    console.log('[TaskCard] Editing subtask:', subtask);
    this.selectedSubtask.set(subtask);
    this.showSubtaskModal.set(true);
  }

  /**
   * Handle add new subtask
   */
  onAddSubtask(): void {
    console.log('[TaskCard] Adding new subtask to task:', this.task.id);
    this.selectedSubtask.set(null);
    this.showSubtaskModal.set(true);
  }

  /**
   * Close subtask modal
   */
  closeSubtaskModal(): void {
    this.showSubtaskModal.set(false);
    this.selectedSubtask.set(null);
  }

  /**
   * Handle subtask saved
   */
  onSubtaskSaved(): void {
    this.closeSubtaskModal();
    // Subtasks will auto-update via real-time listener
  }

  /**
   * Calculate progress percentage from COMPUTED aggregates
   * Per spec: Progress % = (completed_subtasks / total_subtasks) * 100
   */
  get progressPercentage(): number {
    const agg = this.computedAggregates();
    if (agg.total_subtasks === 0) return 0;
    return Math.round((agg.completed_subtasks / agg.total_subtasks) * 100);
  }

  /**
   * Calculate time health percentage from COMPUTED aggregates
   * Per spec: Time Health = (total_actual_seconds / total_estimate_seconds) * 100
   * Red if > 100%
   */
  get timeHealthPercentage(): number {
    const agg = this.computedAggregates();
    if (agg.total_estimate_seconds === 0) return 0;
    return Math.round((agg.total_actual_seconds / agg.total_estimate_seconds) * 100);
  }

  get isTimeOverBudget(): boolean {
    return this.timeHealthPercentage > 100;
  }

  /**
   * Format seconds to readable time (e.g., "2h 30m")
   */
  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    }
    return '0m';
  }
}
