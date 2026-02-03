import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GlobalTimerComponent } from './components/global-timer/global-timer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, GlobalTimerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'project-management-pwa';
}
