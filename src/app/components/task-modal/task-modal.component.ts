import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, inject, signal, computed, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';
import { AuthService } from '../../services/auth.service';
import { ProjectService } from '../../services/project.service';
import { UserService } from '../../services/user.service';
import { Task, TaskStatus } from '../../models/task.model';
import { User as AppUser } from '../../models/user.model';
import { SubtaskListComponent } from '../subtask-list/subtask-list.component';
import { SubtaskModalComponent } from '../subtask-modal/subtask-modal.component';
import { Subtask } from '../../models/subtask.model';

@Component({
  selector: 'app-task-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, SubtaskListComponent, SubtaskModalComponent],
  templateUrl: './task-modal.component.html',
  styleUrl: './task-modal.component.scss'
})
export class TaskModalComponent implements OnInit, OnChanges {
  @ViewChild(SubtaskListComponent) subtaskListComponent?: SubtaskListComponent;
  @Input() projectId!: string;
  @Input() task: Task | null = null; // If provided, edit mode
  @Input() defaultStatus: TaskStatus = 'todo';
  @Input() isOpen: boolean = false;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private taskService = inject(TaskService);
  private authService = inject(AuthService);
  private projectService = inject(ProjectService);
  private userService = inject(UserService);

  formData = signal({
    title: '',
    description: '',
    status: 'todo' as TaskStatus,
    assignees_preview: [] as string[],
  });

  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  showSubtaskModal = signal<boolean>(false);
  selectedSubtask = signal<Subtask | null>(null);
  
  // Comments
  newComment = signal<string>('');
  showComments = signal<boolean>(false);
  
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
    // When task input changes or modal opens, repopulate form
    // This ensures form is populated when editing an existing task
    if (changes['task'] || (changes['isOpen'] && this.isOpen)) {
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
    if (this.task) {
      // Edit mode - populate form with task data
      this.formData.set({
        title: this.task.title,
        description: this.task.description || '',
        status: this.task.status,
        assignees_preview: [...this.task.assignees_preview],
      });
      this.selectedAssignees.set([...this.task.assignees_preview]);
    } else {
      // Create mode - use default status
      this.formData.set({
        title: '',
        description: '',
        status: this.defaultStatus,
        assignees_preview: [],
      });
      this.selectedAssignees.set([]);
    }
    this.assigneeSearchTerm.set('');
    this.showAssigneeDropdown.set(false);
    this.newComment.set('');
    // Clear error when form is repopulated
    this.error.set(null);
  }

  onSubmit(): void {
    if (!this.formData().title.trim()) {
      this.error.set('Title is required');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    // Get selected assignees (limit to 3 as per spec)
    const assigneesArray = this.selectedAssignees().slice(0, 3);

    if (this.task) {
      // Update existing task
      this.taskService.updateTask(this.task.id, {
        title: this.formData().title,
        description: this.formData().description,
        status: this.formData().status,
        assignees_preview: assigneesArray,
      }).subscribe({
        next: () => {
          this.loading.set(false);
          this.saved.emit();
          this.closeModal();
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set('Failed to update task. Please try again.');
          console.error('Error updating task:', err);
        }
      });
    } else {
      // Create new task
      const user = this.authService.getCurrentUser();
      const newTask: Omit<Task, 'id'> = {
        projectId: this.projectId,
        title: this.formData().title,
        description: this.formData().description,
        status: this.formData().status,
        assignees_preview: assigneesArray,
        aggregates: {
          total_subtasks: 0,
          completed_subtasks: 0,
          total_actual_seconds: 0,
          total_estimate_seconds: 0,
        },
        comments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.taskService.createTask(newTask).subscribe({
        next: () => {
          this.loading.set(false);
          this.saved.emit();
          this.closeModal();
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set('Failed to create task. Please try again.');
          console.error('Error creating task:', err);
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
      assignees_preview: [],
    });
    this.selectedAssignees.set([]);
    this.assigneeSearchTerm.set('');
    this.showAssigneeDropdown.set(false);
    this.newComment.set('');
    this.showComments.set(false);
    this.error.set(null);
    this.close.emit();
  }

  toggleAssignee(userId: string): void {
    const current = this.selectedAssignees();
    if (current.includes(userId)) {
      // Remove assignee
      this.selectedAssignees.set(current.filter(id => id !== userId));
    } else {
      // Add assignee (max 3)
      if (current.length < 3) {
        this.selectedAssignees.set([...current, userId]);
      }
    }
    
    // Auto-close dropdown if max reached
    if (this.selectedAssignees().length >= 3) {
      this.showAssigneeDropdown.set(false);
    }
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

  updateTitle(value: string): void {
    this.formData.set({
      ...this.formData(),
      title: value,
    });
  }

  updateStatus(value: string): void {
    this.formData.set({
      ...this.formData(),
      status: value as TaskStatus,
    });
  }

  updateDescription(value: string): void {
    this.formData.set({
      ...this.formData(),
      description: value,
    });
  }

  addComment(): void {
    const commentText = this.newComment().trim();
    if (!commentText || !this.task) return;

    const user = this.authService.getCurrentUser();
    if (!user) return;

    const newCommentObj = {
      id: Date.now().toString(),
      userId: user.uid,
      userName: user.displayName || 'Unknown',
      userEmail: user.email || '',
      content: commentText,
      createdAt: new Date(),
    };

    const updatedComments = [...(this.task.comments || []), newCommentObj];

    this.taskService.updateTask(this.task.id, {
      comments: updatedComments,
    }).subscribe({
      next: () => {
        this.newComment.set('');
        this.saved.emit(); // Refresh parent
      },
      error: (err) => {
        console.error('Error adding comment:', err);
        this.error.set('Failed to add comment');
      }
    });
  }

  deleteComment(commentId: string): void {
    if (!this.task) return;

    const updatedComments = (this.task.comments || []).filter(c => c.id !== commentId);

    this.taskService.updateTask(this.task.id, {
      comments: updatedComments,
    }).subscribe({
      next: () => {
        this.saved.emit(); // Refresh parent
      },
      error: (err) => {
        console.error('Error deleting comment:', err);
        this.error.set('Failed to delete comment');
      }
    });
  }

  onSubtaskUpdated(): void {
    // Reload task data if needed
    // For now, just emit saved event to refresh parent
    this.saved.emit();
  }

  onEditSubtask(subtask: Subtask): void {
    this.selectedSubtask.set(subtask);
    this.showSubtaskModal.set(true);
  }

  closeSubtaskModal(): void {
    this.showSubtaskModal.set(false);
    this.selectedSubtask.set(null);
  }

  onSubtaskSaved(): void {
    this.showSubtaskModal.set(false);
    this.selectedSubtask.set(null);
    // Force reload subtasks to show updated data
    if (this.subtaskListComponent) {
      this.subtaskListComponent.loadSubtasks();
    }
    this.saved.emit(); // Also notify parent
  }
}
