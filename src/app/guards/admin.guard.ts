import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Admin Guard - Protects routes that require admin role
 * Only users with role 'admin' can access
 */
export const adminGuard = async (): Promise<boolean> => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Wait for auth state to be restored from persistence
  await authService.waitForAuthState();

  const userProfile = authService.currentUserProfile();
  
  // Check if user is authenticated and has admin role
  if (userProfile && userProfile.role === 'admin') {
    return true;
  }

  // Redirect to dashboard if not admin
  console.warn('[AdminGuard] Access denied - user is not admin');
  router.navigate(['/dashboard']);
  return false;
};
