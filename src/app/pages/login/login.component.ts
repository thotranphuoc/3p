import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal<boolean>(false);
  error = signal<string | null>(null);
  isSignUp = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    // Wait for auth state to be restored from persistence
    await this.authService.waitForAuthState();
    
    // If user is already authenticated, redirect to dashboard
    if (this.authService.isAuthenticated()) {
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
      this.router.navigate([returnUrl]);
    }
  }

  formData = {
    email: '',
    password: '',
    displayName: '',
  };

  async signInWithGoogle(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.authService.signInWithGoogle());
      this.redirectAfterLogin();
    } catch (error: any) {
      this.error.set(error.message || 'Failed to sign in with Google');
      this.loading.set(false);
    }
  }

  async signInWithEmail(): Promise<void> {
    if (!this.formData.email || !this.formData.password) {
      this.error.set('Please fill in all fields');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.authService.signInWithEmail(
        this.formData.email,
        this.formData.password
      ));
      this.redirectAfterLogin();
    } catch (error: any) {
      this.error.set(error.message || 'Failed to sign in');
      this.loading.set(false);
    }
  }

  async signUpWithEmail(): Promise<void> {
    if (!this.formData.email || !this.formData.password || !this.formData.displayName) {
      this.error.set('Please fill in all fields');
      return;
    }

    if (this.formData.password.length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    try {
      await firstValueFrom(this.authService.signUpWithEmail(
        this.formData.email,
        this.formData.password,
        this.formData.displayName
      ));
      this.redirectAfterLogin();
    } catch (error: any) {
      this.error.set(error.message || 'Failed to sign up');
      this.loading.set(false);
    }
  }

  toggleSignUp(): void {
    this.isSignUp.set(!this.isSignUp());
    this.error.set(null);
  }

  private redirectAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
    this.router.navigate([returnUrl]);
  }
}
