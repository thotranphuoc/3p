import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubtaskService } from '../../services/subtask.service';
import { ProjectService } from '../../services/project.service';
import { UserService } from '../../services/user.service';
import { Subtask, SubtaskStatus } from '../../models/subtask.model';
import { User as AppUser } from '../../models/user.model';
import { TimerButtonComponent } from '../timer-button/timer-button.component';

@Component({
  selector: 'app-subtask-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, TimerButtonComponent],
  templateUrl: './subtask-modal.component.html',
  styleUrl: './subtask-modal.component.scss'
})
export class SubtaskModalComponent implements OnInit, OnChanges {
  @Input() taskId!: string;
  @Input() projectId!: string;
  @Input() subtask: Subtask | null = null; // If provided, edit mode
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Subtask>();

  private subtaskService = inject(SubtaskService);
  private projectService = inject(ProjectService);
  private userService = inject(UserService);

  formData = signal({
    title: '',
    description: '',
    status: 'todo' as SubtaskStatus,
    estimate_hours: 0,
    estimate_minutes: 0,
  });

  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  
  // Assignees selection
  projectMembers = signal<AppUser[]>([]);
  selectedAssignees = signal<string[]>([]);
  showAssigneeDropdown = signal<boolean>(false);
  assigneeSearchTerm = signal<string>('');
  
  // Computed: Filtered members based on search
  filteredMembers = computed(() => {
    const search = this.assigneeSearchTerm().toLowerCase();
    const members = this.projectMembers();
    if (!search) return members;
    return members.filter(m => 
      m.displayName.toLowerCase().includes(search) || 
      m.email.toLowerCase().includes(search)
    );
  });
  
  // Computed: Selected assignees as User objects
  selectedAssigneesData = computed(() => {
    const selectedIds = this.selectedAssignees();
    return this.projectMembers().filter(u => selectedIds.includes(u.uid));
  });

  ngOnInit(): void {
    this.loadProjectMembers();
    this.populateForm();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // When subtask input changes or modal opens, repopulate form
    if (changes['subtask'] || (changes['isOpen'] && this.isOpen)) {
      this.populateForm();
    }
    if (changes['projectId'] && this.projectId) {
      this.loadProjectMembers();
    }
  }

  private loadProjectMembers(): void {
    if (!this.projectId) return;
    
    this.projectService.getProject(this.projectId).subscribe({
      next: (project) => {
        if (project && project.members && project.members.length > 0) {
          this.userService.getUsers(project.members).subscribe({
            next: (users) => {
              this.projectMembers.set(users);
            },
            error: (error) => {
              console.error('Error loading project members:', error);
            }
          });
        }
      },
      error: (error) => {
        console.error('Error loading project:', error);
      }
    });
  }

  private populateForm(): void {
    if (this.subtask) {
      // Edit mode - populate form with subtask data
      const totalSeconds = this.subtask.estimate_seconds;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      
      this.formData.set({
        title: this.subtask.title,
        description: this.subtask.description || '',
        status: this.subtask.status,
        estimate_hours: hours,
        estimate_minutes: minutes,
      });
      this.selectedAssignees.set([...this.subtask.assignees]);
    } else {
      // Create mode - reset form
      this.formData.set({
        title: '',
        description: '',
        status: 'todo',
        estimate_hours: 0,
        estimate_minutes: 0,
      });
      this.selectedAssignees.set([]);
    }
    this.assigneeSearchTerm.set('');
    this.showAssigneeDropdown.set(false);
    this.error.set(null);
  }

  onSubmit(): void {
    if (!this.formData().title.trim()) {
      this.error.set('Title is required');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    // Get selected assignees
    const assigneesArray = this.selectedAssignees();
    
    // Convert hours and minutes to seconds
    const estimateSeconds = (this.formData().estimate_hours * 3600) + (this.formData().estimate_minutes * 60);

    if (this.subtask) {
      // Update existing subtask
      this.subtaskService.updateSubtask(this.subtask.id, {
        title: this.formData().title,
        description: this.formData().description,
        status: this.formData().status,
        assignees: assigneesArray,
        estimate_seconds: estimateSeconds,
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.saved.emit();
          this.closeModal();
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set('Failed to update subtask. Please try again.');
          console.error('Error updating subtask:', err);
        }
      });
    } else {
      // Create new subtask with batch write
      const newSubtask: Omit<Subtask, 'id'> = {
        parentId: this.taskId,
        projectId: this.projectId,
        title: this.formData().title,
        description: this.formData().description,
        status: this.formData().status,
        assignees: assigneesArray,
        estimate_seconds: estimateSeconds,
        actual_seconds: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.subtaskService.createSubtask(newSubtask).subscribe({
        next: (subtaskId) => {
          this.loading.set(false);
          this.saved.emit();
          this.closeModal();
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set('Failed to create subtask. Please try again.');
          console.error('Error creating subtask:', err);
        }
      });
    }
  }

  closeModal(): void {
    this.isOpen = false;
    this.formData.set({
      title: '',
      description: '',
      status: 'todo',
      estimate_hours: 0,
      estimate_minutes: 0,
    });
    this.selectedAssignees.set([]);
    this.assigneeSearchTerm.set('');
    this.showAssigneeDropdown.set(false);
    this.error.set(null);
    this.close.emit();
  }

  toggleAssignee(userId: string): void {
    const current = this.selectedAssignees();
    if (current.includes(userId)) {
      // Remove assignee
      this.selectedAssignees.set(current.filter(id => id !== userId));
    } else {
      // Add assignee
      this.selectedAssignees.set([...current, userId]);
    }
    // Note: No max limit for subtask assignees, so no auto-close needed
  }

  isAssigneeSelected(userId: string): boolean {
    return this.selectedAssignees().includes(userId);
  }

  removeAssignee(userId: string): void {
    const current = this.selectedAssignees();
    this.selectedAssignees.set(current.filter(id => id !== userId));
  }

  toggleAssigneeDropdown(): void {
    this.showAssigneeDropdown.set(!this.showAssigneeDropdown());
    if (!this.showAssigneeDropdown()) {
      this.assigneeSearchTerm.set('');
    }
  }

  /**
   * Format seconds to readable time
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

  updateTitle(value: string): void {
    this.formData.set({
      ...this.formData(),
      title: value,
    });
  }

  updateDescription(value: string): void {
    this.formData.set({
      ...this.formData(),
      description: value,
    });
  }

  updateStatus(value: string): void {
    this.formData.set({
      ...this.formData(),
      status: value as SubtaskStatus,
    });
  }

  updateEstimateHours(value: number): void {
    this.formData.set({
      ...this.formData(),
      estimate_hours: Math.max(0, value || 0),
    });
  }

  updateEstimateMinutes(value: number): void {
    let minutes = Math.max(0, value || 0);
    // Normalize minutes (0-59)
    if (minutes >= 60) {
      const extraHours = Math.floor(minutes / 60);
      minutes = minutes % 60;
      this.formData.set({
        ...this.formData(),
        estimate_hours: this.formData().estimate_hours + extraHours,
        estimate_minutes: minutes,
      });
    } else {
      this.formData.set({
        ...this.formData(),
        estimate_minutes: minutes,
      });
    }
  }

  /**
   * Get total estimate in seconds for display
   */
  getTotalEstimateSeconds(): number {
    return (this.formData().estimate_hours * 3600) + (this.formData().estimate_minutes * 60);
  }
}
