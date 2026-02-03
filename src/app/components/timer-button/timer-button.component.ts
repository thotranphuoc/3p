import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimerService } from '../../services/timer.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-timer-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timer-button.component.html',
  styleUrl: './timer-button.component.scss'
})
export class TimerButtonComponent {
  @Input() taskId!: string;
  @Input() subtaskId!: string;
  @Input() projectId!: string;
  @Input() subtaskTitle?: string;

  private timerService = inject(TimerService);
  private authService = inject(AuthService);

  loading = signal<boolean>(false);

  get isActive(): boolean {
    const timer = this.timerService.activeTimer();
    return timer?.subtaskId === this.subtaskId && timer?.isRunning === true;
  }

  get isAnyTimerRunning(): boolean {
    return this.timerService.isRunning();
  }

  async toggleTimer(): Promise<void> {
    if (this.isActive) {
      // Stop timer
      this.loading.set(true);
      try {
        await this.timerService.stopTimer();
      } catch (error) {
        console.error('Error stopping timer:', error);
      } finally {
        this.loading.set(false);
      }
    } else {
      // Start timer (stop any existing timer first)
      this.loading.set(true);
      try {
        await this.timerService.startTimer(this.taskId, this.subtaskId, this.projectId);
      } catch (error) {
        console.error('Error starting timer:', error);
        alert('Failed to start timer. Please make sure you are logged in.');
      } finally {
        this.loading.set(false);
      }
    }
  }
}
