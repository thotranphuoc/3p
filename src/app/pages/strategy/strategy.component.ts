import { Component, OnInit, inject, signal, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend, ChartConfiguration } from 'chart.js';
import { ObjectiveService } from '../../services/objective.service';
import { TaskService } from '../../services/task.service';
import { Objective } from '../../models/objective.model';
import { Task } from '../../models/task.model';

// Register Chart.js components
Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

@Component({
  selector: 'app-strategy',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './strategy.component.html',
  styleUrl: './strategy.component.scss'
})
export class StrategyComponent implements OnInit, AfterViewInit {
  @ViewChild('radarChart') radarChartRef!: ElementRef<HTMLCanvasElement>;
  
  private objectiveService = inject(ObjectiveService);
  private taskService = inject(TaskService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  
  projectId = signal<string | null>(null);
  objectives = signal<Objective[]>([]);
  linkedTasks = signal<Task[]>([]);
  loading = signal<boolean>(true);
  selectedObjective = signal<Objective | null>(null);
  
  private chart?: Chart;

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const projectId = params['projectId'];
      this.projectId.set(projectId || null);
      this.loadData();
    });
  }

  ngAfterViewInit(): void {
    // Chart will be created after data is loaded
  }

  private loadData(): void {
    this.loading.set(true);
    const projectId = this.projectId();
    
    const loadObservable = projectId 
      ? this.objectiveService.getProjectObjectives(projectId, 50)
      : this.objectiveService.getGlobalObjectives(50);
    
    loadObservable.subscribe({
      next: (objectives) => {
        this.objectives.set(objectives);
        this.loading.set(false);
        setTimeout(() => this.createRadarChart(), 100);
      },
      error: (error) => {
        console.error('Error loading objectives:', error);
        this.loading.set(false);
      }
    });
  }

  private createRadarChart(): void {
    if (!this.radarChartRef || this.chart) return;

    const ctx = this.radarChartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const objectives = this.objectives();
    
    // Calculate average progress for each BSC quadrant
    const financialObjs = objectives.filter(o => o.type === 'financial');
    const customerObjs = objectives.filter(o => o.type === 'customer');
    const internalObjs = objectives.filter(o => o.type === 'internal');
    const learningObjs = objectives.filter(o => o.type === 'learning');
    
    const financialAvg = financialObjs.length > 0 
      ? financialObjs.reduce((sum, o) => sum + o.progress_percent, 0) / financialObjs.length 
      : 0;
    const customerAvg = customerObjs.length > 0 
      ? customerObjs.reduce((sum, o) => sum + o.progress_percent, 0) / customerObjs.length 
      : 0;
    const internalAvg = internalObjs.length > 0 
      ? internalObjs.reduce((sum, o) => sum + o.progress_percent, 0) / internalObjs.length 
      : 0;
    const learningAvg = learningObjs.length > 0 
      ? learningObjs.reduce((sum, o) => sum + o.progress_percent, 0) / learningObjs.length 
      : 0;

    const config: ChartConfiguration<'radar'> = {
      type: 'radar',
      data: {
        labels: ['Financial', 'Customer', 'Internal Process', 'Learning & Growth'],
        datasets: [{
          label: 'BSC Progress',
          data: [financialAvg, customerAvg, internalAvg, learningAvg],
          backgroundColor: 'rgba(59, 130, 246, 0.2)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 2,
          pointBackgroundColor: 'rgb(59, 130, 246)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(59, 130, 246)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20
            }
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    };

    this.chart = new Chart(ctx, config);
  }

  selectObjective(objective: Objective): void {
    this.selectedObjective.set(this.selectedObjective() === objective ? null : objective);
  }

  goBack(): void {
    const projectId = this.projectId();
    if (projectId) {
      this.router.navigate(['/project', projectId]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  goToObjectives(): void {
    const projectId = this.projectId();
    if (projectId) {
      this.router.navigate(['/objectives'], { queryParams: { projectId } });
    } else {
      this.router.navigate(['/objectives']);
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
