import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ProjectService } from '../../services/project.service';
import { AuthService } from '../../services/auth.service';
import { UserService } from '../../services/user.service';
import { Project } from '../../models/project.model';
import { User as AppUser } from '../../models/user.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private projectService = inject(ProjectService);
  private userService = inject(UserService);
  authService = inject(AuthService); // Public for template access
  private router = inject(Router);

  projects = signal<Project[]>([]);
  loading = signal<boolean>(true);
  loggingOut = signal<boolean>(false);
  
  // Create Project Modal
  showCreateModal = signal<boolean>(false);
  newProjectName = signal<string>('');
  
  // Edit Project Modal
  showEditModal = signal<boolean>(false);
  editingProject = signal<Project | null>(null);
  editProjectName = signal<string>('');
  
  // Delete Confirmation Modal
  showDeleteModal = signal<boolean>(false);
  deletingProject = signal<Project | null>(null);
  
  // Manage Members Modal
  showMembersModal = signal<boolean>(false);
  managingProject = signal<Project | null>(null);
  projectMembers = signal<AppUser[]>([]);
  searchEmail = signal<string>('');
  searchResults = signal<AppUser[]>([]);
  addingMember = signal<boolean>(false);

  ngOnInit(): void {
    this.loadProjects();
  }

  loadProjects(): void {
    this.loading.set(true);
    const user = this.authService.getCurrentUser();
    
    if (user) {
      this.projectService.getUserProjects(user.uid, 50).subscribe({
        next: (projects) => {
          this.projects.set(projects);
          this.loading.set(false);
          
          // If no projects, create demo project automatically
          if (projects.length === 0) {
            this.createDemoProject();
          }
        },
        error: (error) => {
          console.error('Error loading projects:', error);
          this.loading.set(false);
          // If error loading, still try to create demo project
          // This handles case where user has no projects yet
          this.createDemoProject();
        }
      });
    } else {
      this.loading.set(false);
      // Redirect to login if not authenticated
      this.router.navigate(['/login']);
    }
  }

  async createDemoProject(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      const projectId = await firstValueFrom(this.projectService.createProject({
        name: 'Demo Project',
        members: [user.uid],
        stats: {
          total_tasks: 0,
          completed_tasks: 0,
        }
      }));

      if (projectId) {
        // Navigate to the new project
        this.router.navigate(['/project', projectId]);
      }
    } catch (error) {
      console.error('Error creating demo project:', error);
    }
  }

  async createProject(): Promise<void> {
    if (!this.newProjectName().trim()) {
      alert('Please enter a project name');
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;

    try {
      const projectId = await firstValueFrom(this.projectService.createProject({
        name: this.newProjectName(),
        members: [user.uid],
        stats: {
          total_tasks: 0,
          completed_tasks: 0,
        }
      }));

      if (projectId) {
        this.newProjectName.set('');
        this.showCreateModal.set(false);
        this.loadProjects();
        // Navigate to the new project
        this.router.navigate(['/project', projectId]);
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    }
  }

  openProject(projectId: string): void {
    this.router.navigate(['/project', projectId]);
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    
    this.loggingOut.set(true);
    console.log('[Dashboard] Logging out user...');
    
    try {
      await this.authService.signOut();
      console.log('[Dashboard] Logout successful, navigating to login');
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('[Dashboard] Logout error:', error);
      alert('Failed to logout. Please try again.');
    } finally {
      this.loggingOut.set(false);
    }
  }

  // ============ EDIT PROJECT ============
  openEditModal(project: Project, event: Event): void {
    event.stopPropagation(); // Prevent opening project
    this.editingProject.set(project);
    this.editProjectName.set(project.name);
    this.showEditModal.set(true);
  }

  async updateProject(): Promise<void> {
    const project = this.editingProject();
    if (!project || !this.editProjectName().trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      await firstValueFrom(this.projectService.updateProject(project.id, {
        name: this.editProjectName()
      }));
      
      this.showEditModal.set(false);
      this.loadProjects();
      console.log('[Dashboard] Project updated successfully');
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Failed to update project. Please try again.');
    }
  }

  // ============ DELETE PROJECT ============
  openDeleteModal(project: Project, event: Event): void {
    event.stopPropagation(); // Prevent opening project
    this.deletingProject.set(project);
    this.showDeleteModal.set(true);
  }

  async deleteProject(): Promise<void> {
    const project = this.deletingProject();
    if (!project) return;

    try {
      await firstValueFrom(this.projectService.deleteProject(project.id));
      
      this.showDeleteModal.set(false);
      this.loadProjects();
      console.log('[Dashboard] Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
    }
  }

  // ============ MANAGE MEMBERS ============
  async openMembersModal(project: Project, event: Event): Promise<void> {
    event.stopPropagation(); // Prevent opening project
    this.managingProject.set(project);
    this.showMembersModal.set(true);
    this.searchEmail.set('');
    this.searchResults.set([]);
    
    // Load current members
    try {
      const members = await firstValueFrom(this.userService.getUsers(project.members));
      this.projectMembers.set(members);
    } catch (error) {
      console.error('Error loading project members:', error);
      this.projectMembers.set([]);
    }
  }

  async searchUsers(): Promise<void> {
    const email = this.searchEmail().trim();
    if (!email || email.length < 3) {
      this.searchResults.set([]);
      return;
    }

    try {
      const users = await firstValueFrom(this.userService.searchUsers(email, 5));
      // Filter out users already in project
      const project = this.managingProject();
      const filtered = users.filter(u => !project?.members.includes(u.uid));
      this.searchResults.set(filtered);
    } catch (error) {
      console.error('Error searching users:', error);
      this.searchResults.set([]);
    }
  }

  async addMember(user: AppUser): Promise<void> {
    const project = this.managingProject();
    if (!project || this.addingMember()) return;

    this.addingMember.set(true);
    try {
      await firstValueFrom(this.projectService.addMember(project.id, user.uid));
      
      // Update local state
      this.projectMembers.update(members => [...members, user]);
      this.searchEmail.set('');
      this.searchResults.set([]);
      
      // Reload projects to update member count
      this.loadProjects();
      
      console.log('[Dashboard] Member added successfully');
    } catch (error) {
      console.error('Error adding member:', error);
      alert('Failed to add member. Please try again.');
    } finally {
      this.addingMember.set(false);
    }
  }

  async removeMember(user: AppUser): Promise<void> {
    const project = this.managingProject();
    const currentUser = this.authService.getCurrentUser();
    if (!project || !currentUser) return;

    // Prevent removing yourself
    if (user.uid === currentUser.uid) {
      alert('You cannot remove yourself from the project');
      return;
    }

    // Prevent removing last member
    if (project.members.length <= 1) {
      alert('Cannot remove the last member from the project');
      return;
    }

    try {
      // Remove member from array
      const updatedMembers = project.members.filter(uid => uid !== user.uid);
      await firstValueFrom(this.projectService.updateProject(project.id, {
        members: updatedMembers
      }));
      
      // Update local state
      this.projectMembers.update(members => members.filter(m => m.uid !== user.uid));
      
      // Reload projects
      this.loadProjects();
      
      console.log('[Dashboard] Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member. Please try again.');
    }
  }
}
