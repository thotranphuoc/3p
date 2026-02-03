import { Injectable, inject, signal, Injector } from '@angular/core';
import { Auth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, User, onAuthStateChanged } from '@angular/fire/auth';
import { updateProfile } from 'firebase/auth';
import { Firestore, doc, setDoc, getDoc, updateDoc } from '@angular/fire/firestore';
import { Observable, from, of, firstValueFrom, BehaviorSubject } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { User as AppUser } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private injector = inject(Injector);
  
  // Signal for current user
  currentUser = signal<User | null>(null);
  currentUserProfile = signal<AppUser | null>(null);
  
  // Observable to track when auth state has been initialized
  // This helps guards wait for Firebase to restore auth state from persistence
  private authStateInitialized = new BehaviorSubject<boolean>(false);
  authStateReady$ = this.authStateInitialized.asObservable();

  constructor() {
    // Listen to auth state changes
    // Firebase automatically restores auth state from persistence on app start
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUser.set(user);
      if (user) {
        await this.loadUserProfile(user.uid);
      } else {
        this.currentUserProfile.set(null);
      }
      // Mark auth state as initialized after first callback
      if (!this.authStateInitialized.value) {
        this.authStateInitialized.next(true);
      }
    });
  }

  /**
   * Sign in with Google
   */
  signInWithGoogle(): Observable<User> {
    const provider = new GoogleAuthProvider();
    return from(signInWithPopup(this.auth, provider)).pipe(
      map(result => result.user),
      switchMap(user => {
        // Create or update user profile in Firestore
        return this.createOrUpdateUserProfile(user).pipe(
          map(() => user)
        );
      })
    );
  }

  /**
   * Sign in with Email and Password
   */
  signInWithEmail(email: string, password: string): Observable<User> {
    return from(signInWithEmailAndPassword(this.auth, email, password)).pipe(
      map(result => result.user),
      switchMap(user => {
        return this.createOrUpdateUserProfile(user).pipe(
          map(() => user)
        );
      })
    );
  }

  /**
   * Sign up with Email and Password
   */
  signUpWithEmail(email: string, password: string, displayName: string): Observable<User> {
    return from(createUserWithEmailAndPassword(this.auth, email, password)).pipe(
      map(result => result.user),
      switchMap(async (user) => {
        // Update display name
        if (displayName) {
          await updateProfile(user, { displayName });
        }
        return user;
      }),
      switchMap(user => {
        return this.createOrUpdateUserProfile(user, displayName).pipe(
          map(() => user)
        );
      })
    );
  }

  /**
   * Sign out
   * IMPORTANT: Stop timer before logout to prevent stale timer issues
   */
  async signOut(): Promise<void> {
    const user = this.auth.currentUser;
    const userProfile = this.currentUserProfile();
    
    // Check if there's an active timer and clear it before logout
    if (user && userProfile?.active_timer) {
      console.warn('[AuthService] User has active timer, clearing before logout');
      
      try {
        // Get TimerService (avoid circular dependency by lazy loading)
        const { TimerService } = await import('./timer.service');
        const timerService = this.injector.get(TimerService);
        
        // Try to stop timer properly (save time logs)
        await timerService.stopTimer();
        console.log('[AuthService] Timer stopped successfully before logout');
      } catch (error) {
        console.error('[AuthService] Error stopping timer:', error);
        
        // If normal stop fails, just clear the active_timer field
        try {
          const userRef = doc(this.firestore, `users/${user.uid}`);
          await updateDoc(userRef, { active_timer: null });
          console.log('[AuthService] Cleared active_timer field');
        } catch (clearError) {
          console.error('[AuthService] Error clearing active_timer:', clearError);
        }
      }
    }
    
    // Now sign out
    await signOut(this.auth);
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.auth.currentUser;
  }

  /**
   * Check if user is authenticated
   * Use currentUser signal instead of auth.currentUser for better reactivity
   */
  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  /**
   * Wait for auth state to be initialized (restored from persistence)
   * Returns a Promise that resolves when auth state is ready
   */
  waitForAuthState(): Promise<void> {
    if (this.authStateInitialized.value) {
      return Promise.resolve();
    }
    return firstValueFrom(this.authStateReady$).then(() => {});
  }

  /**
   * Create or update user profile in Firestore
   */
  private createOrUpdateUserProfile(user: User, displayName?: string): Observable<void> {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    
    return from(getDoc(userRef)).pipe(
      switchMap(docSnap => {
        const userData: Partial<AppUser> = {
          uid: user.uid,
          email: user.email || '',
          displayName: displayName || user.displayName || user.email?.split('@')[0] || 'User',
          photoURL: user.photoURL || '',
          role: 'member', // Default role
          active_timer: null,
        };

        if (docSnap.exists()) {
          // Update existing user (preserve role and active_timer)
          const existingData = docSnap.data() as AppUser;
          userData.role = existingData.role;
          userData.active_timer = existingData.active_timer;
          return from(setDoc(userRef, { ...existingData, ...userData }, { merge: true }));
        } else {
          // Create new user
          return from(setDoc(userRef, userData));
        }
      })
    );
  }

  /**
   * Load user profile from Firestore
   * Public to allow profile updates from ProfileComponent
   */
  async loadUserProfile(uid: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      const activeTimer = data['active_timer'] || null;
      
      // Check for stale timer (edge case: forgot to stop)
      if (activeTimer) {
        const startTime = activeTimer.startTime?.toDate?.() || new Date(activeTimer.localStartTime);
        const hoursElapsed = (new Date().getTime() - startTime.getTime()) / (1000 * 60 * 60);
        
        // If timer is older than 24 hours, consider it stale
        if (hoursElapsed > 24) {
          console.warn('Stale timer detected. Consider stopping it.');
          // Timer will still be loaded, but user should be prompted to stop it
        }
      }
      
      this.currentUserProfile.set({
        uid: data['uid'] || uid,
        email: data['email'] || '',
        displayName: data['displayName'] || '',
        photoURL: data['photoURL'] || '',
        role: data['role'] || 'member',
        active_timer: activeTimer,
      } as AppUser);
    }
  }
}
