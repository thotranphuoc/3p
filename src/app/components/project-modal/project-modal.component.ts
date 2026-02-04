import { Component, Input, Output, EventEmitter, OnChanges, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project } from '../../models/project.model';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-project-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-modal.component.html',
  styleUrl: './project-modal.component.scss'
})
export class ProjectModalComponent implements OnChanges {
  @Input() isOpen: boolean = false;
  @Input() project: Project | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Partial<Project>>();

  private userService = inject(UserService);
  private authService = inject(AuthService);

  // Form signals
  name = signal<string>('');
  client_name = signal<string>('');
  client_contact = signal<string>('');
  pm_id = signal<string>('');
  start_date = signal<string>('');
  end_date = signal<string>('');
  status = signal<'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'>('planning');
  budget = signal<number>(0);
  currency = signal<string>('USD');
  description = signal<string>('');
  objectives = signal<string>('');
  scope = signal<string>('');
  deliverables = signal<string>('');
  
  // Team management
  availableUsers = signal<User[]>([]);
  selectedMemberIds = signal<string[]>([]);
  
  // UI
  saving = signal<boolean>(false);
  currentTab = signal<'basic' | 'team' | 'details'>('basic');

  ngOnChanges(): void {
    if (this.isOpen) {
      this.loadUsers();
      
      if (this.project) {
        // Edit mode - populate form
        this.name.set(this.project.name);
        this.client_name.set(this.project.client_name || '');
        this.client_contact.set(this.project.client_contact || '');
        this.pm_id.set(this.project.pm_id || '');
        this.start_date.set(this.project.start_date ? this.formatDate(this.project.start_date) : '');
        this.end_date.set(this.project.end_date ? this.formatDate(this.project.end_date) : '');
        this.status.set(this.project.status || 'planning');
        this.budget.set(this.project.budget || 0);
        this.currency.set(this.project.currency || 'USD');
        this.description.set(this.project.description || '');
        this.objectives.set(this.project.objectives || '');
        this.scope.set(this.project.scope || '');
        this.deliverables.set(this.project.deliverables || '');
        this.selectedMemberIds.set(this.project.members || []);
      } else {
        // Create mode - reset form
        this.resetForm();
      }
    }
  }

  private loadUsers(): void {
    this.userService.getAllUsers().subscribe({
      next: (users) => {
        this.availableUsers.set(users);
      },
      error: (error) => console.error('Error loading users:', error)
    });
  }

  private formatDate(date: Date | any): string {
    if (!date) return '';
    
    // Handle Firestore Timestamp
    let d: Date;
    if (date.toDate && typeof date.toDate === 'function') {
      d = date.toDate(); // Firestore Timestamp
    } else if (date instanceof Date) {
      d = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      d = new Date(date);
    } else {
      return '';
    }
    
    // Check if valid date
    if (isNaN(d.getTime())) {
      return '';
    }
    
    return d.toISOString().split('T')[0];
  }

  resetForm(): void {
    this.name.set('');
    this.client_name.set('');
    this.client_contact.set('');
    this.pm_id.set('');
    this.start_date.set('');
    this.end_date.set('');
    this.status.set('planning');
    this.budget.set(0);
    this.currency.set('USD');
    this.description.set('');
    this.objectives.set('');
    this.scope.set('');
    this.deliverables.set('');
    this.selectedMemberIds.set([]);
    this.currentTab.set('basic');
  }

  toggleMember(userId: string): void {
    const current = this.selectedMemberIds();
    if (current.includes(userId)) {
      this.selectedMemberIds.set(current.filter(id => id !== userId));
    } else {
      this.selectedMemberIds.set([...current, userId]);
    }
  }

  isMemberSelected(userId: string): boolean {
    return this.selectedMemberIds().includes(userId);
  }

  getUserName(userId: string): string {
    const user = this.availableUsers().find(u => u.uid === userId);
    return user?.displayName || user?.email || 'Unknown';
  }

  closeModal(): void {
    this.resetForm();
    this.close.emit();
  }

  onSave(): void {
    if (!this.name().trim()) {
      alert('Please enter project name');
      return;
    }

    this.saving.set(true);

    // Build project data, only include fields that have values
    const projectData: Partial<Project> = {
      name: this.name().trim(),
      status: this.status(),
      currency: this.currency(),
      members: this.selectedMemberIds(),
    };

    // Add optional fields only if they have values
    if (this.client_name().trim()) {
      projectData.client_name = this.client_name().trim();
    }
    if (this.client_contact().trim()) {
      projectData.client_contact = this.client_contact().trim();
    }
    if (this.pm_id()) {
      projectData.pm_id = this.pm_id();
    }
    if (this.start_date()) {
      projectData.start_date = new Date(this.start_date());
    }
    if (this.end_date()) {
      projectData.end_date = new Date(this.end_date());
    }
    if (this.budget() > 0) {
      projectData.budget = this.budget();
    }
    if (this.description().trim()) {
      projectData.description = this.description().trim();
    }
    if (this.objectives().trim()) {
      projectData.objectives = this.objectives().trim();
    }
    if (this.scope().trim()) {
      projectData.scope = this.scope().trim();
    }
    if (this.deliverables().trim()) {
      projectData.deliverables = this.deliverables().trim();
    }

    this.saved.emit(projectData);
    this.saving.set(false);
    this.closeModal();
  }

  getStatusLabel(status: string): string {
    const labels = {
      planning: 'Planning',
      in_progress: 'In Progress',
      on_hold: 'On Hold',
      completed: 'Completed',
      cancelled: 'Cancelled'
    };
    return labels[status as keyof typeof labels] || status;
  }

  getStatusColor(status: string): string {
    const colors = {
      planning: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      on_hold: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  }
}
