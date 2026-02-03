import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { KanbanBoardComponent } from '../../components/kanban-board/kanban-board.component';
import { SubtaskModalComponent } from '../../components/subtask-modal/subtask-modal.component';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project',
  standalone: true,
  imports: [CommonModule, RouterModule, KanbanBoardComponent, SubtaskModalComponent],
  templateUrl: './project.component.html',
  styleUrl: './project.component.scss'
})
export class ProjectComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private projectService = inject(ProjectService);
  authService = inject(AuthService); // Public for template access
  router = inject(Router);

  projectId = signal<string>('');
  project = signal<Project | null>(null);
  loading = signal<boolean>(true);
  loggingOut = signal<boolean>(false);
  showSubtaskModal = signal<boolean>(false);
  selectedTaskId = signal<string>('');

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.projectId.set(id);
        this.loadProject(id);
      }
    });
  }

  loadProject(projectId: string): void {
    this.loading.set(true);
    this.projectService.getProject(projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading project:', error);
        this.loading.set(false);
      }
    });
  }

  openSubtaskModal(taskId: string): void {
    this.selectedTaskId.set(taskId);
    this.showSubtaskModal.set(true);
  }

  closeSubtaskModal(): void {
    this.showSubtaskModal.set(false);
    this.selectedTaskId.set('');
  }

  onSubtaskSaved(): void {
    // Reload kanban board to show updated data
    this.closeSubtaskModal();
    // Note: Kanban board will need to reload tasks
    // For now, user can manually refresh or we can add event emitter
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    
    this.loggingOut.set(true);
    console.log('[Project] Logging out user...');
    
    try {
      await this.authService.signOut();
      console.log('[Project] Logout successful, navigating to login');
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('[Project] Logout error:', error);
      alert('Failed to logout. Please try again.');
    } finally {
      this.loggingOut.set(false);
    }
  }
}
