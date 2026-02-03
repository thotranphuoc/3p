import { Injectable, signal } from '@angular/core';
import { fromEvent, merge } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

/**
 * Service to track browser tab visibility
 * Helps reduce Firebase costs by pausing listeners when tab is hidden
 */
@Injectable({
  providedIn: 'root'
})
export class VisibilityService {
  // Signal to track if tab is currently visible
  isVisible = signal<boolean>(true);
  
  // Track how long tab has been hidden (for analytics)
  private hiddenSince: Date | null = null;

  constructor() {
    this.initVisibilityTracking();
  }

  private initVisibilityTracking(): void {
    // Listen to visibility change events
    const visibilityChange$ = fromEvent(document, 'visibilitychange').pipe(
      map(() => !document.hidden),
      startWith(!document.hidden)
    );

    // Update signal when visibility changes
    visibilityChange$.subscribe((visible) => {
      this.isVisible.set(visible);
      
      if (!visible) {
        this.hiddenSince = new Date();
        console.log('[VisibilityService] Tab hidden - consider pausing expensive listeners');
      } else {
        if (this.hiddenSince) {
          const hiddenDuration = Date.now() - this.hiddenSince.getTime();
          console.log(`[VisibilityService] Tab visible - was hidden for ${Math.round(hiddenDuration / 1000)}s`);
        }
        this.hiddenSince = null;
      }
    });
  }

  /**
   * Get current visibility state
   */
  get visible(): boolean {
    return this.isVisible();
  }

  /**
   * Check if tab has been hidden for more than specified duration
   * @param seconds Duration in seconds
   */
  hasBeenHiddenFor(seconds: number): boolean {
    if (!this.hiddenSince) return false;
    const hiddenDuration = Date.now() - this.hiddenSince.getTime();
    return hiddenDuration > seconds * 1000;
  }
}
