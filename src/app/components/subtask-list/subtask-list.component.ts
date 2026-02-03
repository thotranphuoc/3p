import { Component, Input, OnInit, Output, EventEmitter, signal, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SubtaskService } from '../../services/subtask.service';
import { Subtask, SubtaskStatus } from '../../models/subtask.model';
import { TimerButtonComponent } from '../timer-button/timer-button.component';

@Component({
  selector: 'app-subtask-list',
  standalone: true,
  imports: [CommonModule, TimerButtonComponent],
  templateUrl: './subtask-list.component.html',
  styleUrl: './subtask-list.component.scss'
})
export class SubtaskListComponent implements OnInit, OnChanges {
  @Input() taskId!: string;
  @Input() projectId!: string;
  @Input() subtasks: Subtask[] = []; // NEW: Receive subtasks from parent
  @Input() showTimer: boolean = true;
  @Output() subtaskUpdated = new EventEmitter<void>();
  @Output() editSubtask = new EventEmitter<Subtask>();

  private subtaskService = inject(SubtaskService);

  displaySubtasks = signal<Subtask[]>([]);
  loading = signal<boolean>(false);

  ngOnInit(): void {
    // If subtasks not provided, load them (backward compatibility)
    if (!this.subtasks || this.subtasks.length === 0) {
      this.loadSubtasks();
    } else {
      this.displaySubtasks.set(this.subtasks);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Update display when subtasks input changes
    if (changes['subtasks'] && this.subtasks) {
      this.displaySubtasks.set(this.subtasks);
    }
  }

  loadSubtasks(): void {
    this.loading.set(true);
    this.subtaskService.getTaskSubtasks(this.taskId, 50).subscribe({
      next: (subtasks) => {
        this.displaySubtasks.set(subtasks);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading subtasks:', error);
        this.loading.set(false);
      }
    });
  }

  toggleSubtaskStatus(subtask: Subtask): void {
    const newStatus: SubtaskStatus = subtask.status === 'done' ? 'todo' : 'done';
    const wasCompleted = subtask.status === 'done';
    
    // Optimistic UI update
    const currentSubtasks = this.displaySubtasks();
    const index = currentSubtasks.findIndex(s => s.id === subtask.id);
    if (index !== -1) {
      const updatedSubtasks = [...currentSubtasks];
      updatedSubtasks[index] = { ...updatedSubtasks[index], status: newStatus };
      this.displaySubtasks.set(updatedSubtasks);
    }
    
    this.subtaskService.updateSubtaskStatus(subtask.id, newStatus, subtask.parentId, wasCompleted).subscribe({
      next: () => {
        // Real-time listener in parent will update automatically
        // No need to reload!
        this.subtaskUpdated.emit();
      },
      error: (error) => {
        console.error('Error updating subtask status:', error);
        // Revert optimistic update on error
        this.displaySubtasks.set(currentSubtasks);
      }
    });
  }

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
