import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User as AppUser } from '../../models/user.model';
import { updateProfile } from 'firebase/auth';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent implements OnInit {
  authService = inject(AuthService);
  private router = inject(Router);

  loading = signal<boolean>(false);
  loggingOut = signal<boolean>(false);
  editMode = signal<boolean>(false);
  
  // Profile data
  displayName = signal<string>('');
  email = signal<string>('');
  photoURL = signal<string>('');
  role = signal<string>('');

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    const userProfile = this.authService.currentUserProfile();
    if (userProfile) {
      this.displayName.set(userProfile.displayName || '');
      this.email.set(userProfile.email || '');
      this.photoURL.set(userProfile.photoURL || '');
      this.role.set(userProfile.role || 'member');
    } else {
      // Redirect to login if no user
      this.router.navigate(['/login']);
    }
  }

  enableEditMode(): void {
    this.editMode.set(true);
  }

  cancelEdit(): void {
    this.editMode.set(false);
    this.loadProfile(); // Reset to original values
  }

  async saveProfile(): Promise<void> {
    const user = this.authService.getCurrentUser();
    if (!user) {
      alert('No user logged in');
      return;
    }

    if (!this.displayName().trim()) {
      alert('Display name cannot be empty');
      return;
    }

    this.loading.set(true);
    try {
      // Update Firebase Auth profile
      await updateProfile(user, {
        displayName: this.displayName(),
        photoURL: this.photoURL() || null
      });

      // Reload user profile from Firestore (will trigger auth service update)
      await this.authService.loadUserProfile(user.uid);
      
      this.editMode.set(false);
      console.log('[Profile] Profile updated successfully');
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async logout(): Promise<void> {
    if (this.loggingOut()) return;
    
    this.loggingOut.set(true);
    console.log('[Profile] Logging out user...');
    
    try {
      await this.authService.signOut();
      console.log('[Profile] Logout successful, navigating to login');
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('[Profile] Logout error:', error);
      alert('Failed to logout. Please try again.');
    } finally {
      this.loggingOut.set(false);
    }
  }
}
