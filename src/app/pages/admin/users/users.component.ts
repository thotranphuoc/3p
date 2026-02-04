import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserService } from '../../../services/user.service';
import { AuthService } from '../../../services/auth.service';
import { User as AppUser } from '../../../models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  private userService = inject(UserService);
  authService = inject(AuthService);
  private router = inject(Router);

  // Data signals
  allUsers = signal<AppUser[]>([]);
  loading = signal<boolean>(true);
  loggingOut = signal<boolean>(false);
  
  // Search & Filter
  searchTerm = signal<string>('');
  roleFilter = signal<'all' | 'admin' | 'director' | 'manager' | 'member'>('all');
  
  // Edit Role Modal
  showEditRoleModal = signal<boolean>(false);
  editingUser = signal<AppUser | null>(null);
  newRole = signal<'admin' | 'director' | 'manager' | 'member'>('member');
  savingRole = signal<boolean>(false);

  // Computed filtered users
  filteredUsers = computed(() => {
    let users = this.allUsers();
    
    // Filter by search term
    const search = this.searchTerm().toLowerCase();
    if (search) {
      users = users.filter(u => 
        u.email.toLowerCase().includes(search) ||
        (u.displayName || '').toLowerCase().includes(search)
      );
    }
    
    // Filter by role
    const role = this.roleFilter();
    if (role !== 'all') {
      users = users.filter(u => u.role === role);
    }
    
    return users;
  });

  // Statistics
  stats = computed(() => {
    const users = this.allUsers();
    return {
      total: users.length,
      admin: users.filter(u => u.role === 'admin').length,
      director: users.filter(u => u.role === 'director').length,
      manager: users.filter(u => u.role === 'manager').length,
      member: users.filter(u => u.role === 'member').length,
    };
  });

  goToObjectives(): void {
    this.router.navigate(['/objectives']);
  }

  goToStrategy(): void {
    this.router.navigate(['/strategy']);
  }

  ngOnInit(): void {
    this.checkAdminAccess();
    this.loadUsers();
  }

  checkAdminAccess(): void {
    const userProfile = this.authService.currentUserProfile();
    if (!userProfile || userProfile.role !== 'admin') {
      console.warn('[UsersComponent] Access denied - redirecting to dashboard');
      this.router.navigate(['/dashboard']);
    }
  }

  async loadUsers(): Promise<void> {
    this.loading.set(true);
    try {
      const users = await firstValueFrom(this.userService.getAllUsers(1000));
      this.allUsers.set(users);
      console.log('[UsersComponent] Loaded users:', users.length);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  openEditRoleModal(user: AppUser): void {
    this.editingUser.set(user);
    this.newRole.set(user.role);
    this.showEditRoleModal.set(true);
  }

  async saveUserRole(): Promise<void> {
    const user = this.editingUser();
    if (!user || this.savingRole()) return;

    const currentUser = this.authService.currentUserProfile();
    if (!currentUser || currentUser.role !== 'admin') {
      alert('Only admins can change user roles');
      return;
    }

    // Prevent changing own role
    if (user.uid === currentUser.uid) {
      alert('You cannot change your own role');
      return;
    }

    this.savingRole.set(true);
    try {
      await firstValueFrom(this.userService.updateUserRole(user.uid, this.newRole()));
      
      // Update local state
      this.allUsers.update(users => 
        users.map(u => u.uid === user.uid ? { ...u, role: this.newRole() } : u)
      );
      
      this.showEditRoleModal.set(false);
      console.log(`[UsersComponent] Updated role for ${user.email} to ${this.newRole()}`);
    } catch (error) {
      console.error('Error updating user role:', error);
      alert('Failed to update user role. Please try again.');
    } finally {
      this.savingRole.set(false);
    }
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-700';
      case 'director':
        return 'bg-orange-100 text-orange-700';
      case 'manager':
        return 'bg-purple-100 text-purple-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    
    this.loggingOut.set(true);
    console.log('[UsersComponent] Logging out user...');
    
    try {
      await this.authService.signOut();
      console.log('[UsersComponent] Logout successful, navigating to login');
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('[UsersComponent] Logout error:', error);
      alert('Failed to logout. Please try again.');
    } finally {
      this.loggingOut.set(false);
    }
  }
}
