import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ObjectiveService } from '../../services/objective.service';
import { ObjectiveCalculationService } from '../../services/objective-calculation.service';
import { AuthService } from '../../services/auth.service';
import { Objective, BSCQuadrant } from '../../models/objective.model';
import { ObjectiveModalComponent } from '../../components/objective-modal/objective-modal.component';

@Component({
  selector: 'app-objectives',
  standalone: true,
  imports: [CommonModule, FormsModule, ObjectiveModalComponent],
  templateUrl: './objectives.component.html',
  styleUrl: './objectives.component.scss'
})
export class ObjectivesComponent implements OnInit {
  private objectiveService = inject(ObjectiveService);
  private calculationService = inject(ObjectiveCalculationService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  projectId = signal<string | null>(null);
  objectives = signal<Objective[]>([]);
  loading = signal<boolean>(true);
  selectedType = signal<BSCQuadrant | 'all'>('all');
  showCreateModal = signal<boolean>(false);
  selectedObjective = signal<Objective | null>(null);

  // Computed: Check if modal is open (create or edit)
  isModalOpen = computed(() => this.showCreateModal());

  // Editing metric values inline
  editingMetricKR = signal<{ objectiveId: string; krId: string } | null>(null);

  // Computed: Check if user can manage objectives (Admin or Director only)
  canManageObjectives = computed(() => {
    const user = this.authService.currentUserProfile();
    return user?.role === 'admin' || user?.role === 'director';
  });

  // Computed: Filtered objectives by type
  filteredObjectives = computed(() => {
    const type = this.selectedType();
    const objs = this.objectives();
    if (type === 'all') return objs;
    return objs.filter(o => o.type === type);
  });

  // Computed: Statistics by quadrant
  stats = computed(() => {
    const objs = this.objectives();
    const financial = objs.filter(o => o.type === 'financial');
    const customer = objs.filter(o => o.type === 'customer');
    const internal = objs.filter(o => o.type === 'internal');
    const learning = objs.filter(o => o.type === 'learning');
    
    return {
      financial: {
        objectives: financial,
        count: financial.length,
        avgProgress: financial.length > 0 ? Math.round(financial.reduce((sum, o) => sum + o.progress_percent, 0) / financial.length) : 0
      },
      customer: {
        objectives: customer,
        count: customer.length,
        avgProgress: customer.length > 0 ? Math.round(customer.reduce((sum, o) => sum + o.progress_percent, 0) / customer.length) : 0
      },
      internal: {
        objectives: internal,
        count: internal.length,
        avgProgress: internal.length > 0 ? Math.round(internal.reduce((sum, o) => sum + o.progress_percent, 0) / internal.length) : 0
      },
      learning: {
        objectives: learning,
        count: learning.length,
        avgProgress: learning.length > 0 ? Math.round(learning.reduce((sum, o) => sum + o.progress_percent, 0) / learning.length) : 0
      }
    };
  });

  ngOnInit(): void {
    // Check if projectId is in query params
    this.route.queryParams.subscribe(params => {
      const projectId = params['projectId'];
      this.projectId.set(projectId || null);
      this.loadObjectives();
    });
  }

  private loadObjectives(): void {
    this.loading.set(true);
    const projectId = this.projectId();
    
    console.log('[ObjectivesComponent] Loading objectives for project:', projectId || 'global');
    
    if (projectId) {
      // Load project objectives
      this.objectiveService.getProjectObjectives(projectId, 50).subscribe({
        next: (objectives) => {
          console.log('[ObjectivesComponent] Loaded objectives:', objectives.length);
          this.objectives.set(objectives);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading objectives:', error);
          this.loading.set(false);
        }
      });
    } else {
      // Load global objectives
      this.objectiveService.getGlobalObjectives(50).subscribe({
        next: (objectives) => {
          console.log('[ObjectivesComponent] Loaded global objectives:', objectives.length);
          this.objectives.set(objectives);
          this.loading.set(false);
        },
        error: (error) => {
          console.error('Error loading objectives:', error);
          this.loading.set(false);
        }
      });
    }
  }

  filterByType(type: BSCQuadrant | 'all'): void {
    this.selectedType.set(type);
  }

  openCreateModal(): void {
    this.selectedObjective.set(null);
    this.showCreateModal.set(true);
  }

  openEditModal(objective: Objective): void {
    this.selectedObjective.set(objective);
    this.showCreateModal.set(true);
  }

  closeModal(): void {
    this.showCreateModal.set(false);
    this.selectedObjective.set(null);
  }

  onObjectiveSaved(): void {
    this.closeModal();
    this.loadObjectives();
  }

  deleteObjective(objectiveId: string): void {
    if (!confirm('Are you sure you want to delete this objective? Tasks linked to it will no longer be connected.')) {
      return;
    }

    this.objectiveService.deleteObjective(objectiveId).subscribe({
      next: () => {
        console.log('Objective deleted successfully');
        this.loadObjectives();
      },
      error: (error) => {
        console.error('Error deleting objective:', error);
        alert('Failed to delete objective');
      }
    });
  }

  recalculateObjective(objectiveId: string): void {
    this.calculationService.recalculateObjectiveProgress(objectiveId).subscribe({
      next: () => {
        console.log('Objective recalculated successfully');
        this.loadObjectives();
      },
      error: (error) => {
        console.error('Error recalculating objective:', error);
        alert('Failed to recalculate objective');
      }
    });
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'on_track': return 'bg-green-100 text-green-700';
      case 'at_risk': return 'bg-yellow-100 text-yellow-700';
      case 'behind': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  getTypeColor(type: BSCQuadrant): string {
    switch (type) {
      case 'financial': return 'bg-blue-100 text-blue-700';
      case 'customer': return 'bg-purple-100 text-purple-700';
      case 'internal': return 'bg-orange-100 text-orange-700';
      case 'learning': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  getTypeLabel(type: BSCQuadrant): string {
    switch (type) {
      case 'financial': return 'Financial';
      case 'customer': return 'Customer';
      case 'internal': return 'Internal Process';
      case 'learning': return 'Learning & Growth';
      default: return type;
    }
  }

  startEditMetric(objectiveId: string, krId: string): void {
    this.editingMetricKR.set({ objectiveId, krId });
  }

  cancelEditMetric(): void {
    this.editingMetricKR.set(null);
  }

  async updateMetricValue(objective: Objective, kr: any, newValue: number): Promise<void> {
    try {
      console.log(`[updateMetricValue] Updating KR ${kr.id} to ${newValue}`);
      
      // Update current_value and recalculate progress for KRs
      const updatedKRs = objective.key_results.map(k => {
        if (k.id !== kr.id) return k;
        const progress = kr.target_value > 0 ? Math.min(100, (newValue / kr.target_value) * 100) : 0;
        console.log(`[updateMetricValue] KR progress: ${progress}%`);
        return { ...k, current_value: newValue, progress };
      });

      // Calculate new objective weighted progress locally
      const currentWeightedScore = updatedKRs.reduce((sum, k) => sum + (k.progress * k.weight), 0);
      const totalWeight = updatedKRs.reduce((sum, k) => sum + k.weight, 0);
      const progressPercent = totalWeight > 0 ? (currentWeightedScore / totalWeight) : 0;
      
      // Update local signal immediately for instant UI feedback
      this.objectives.update(objs => objs.map(obj => {
        if (obj.id !== objective.id) return obj;
        return {
          ...obj,
          key_results: updatedKRs,
          current_weighted_score: currentWeightedScore,
          total_weight: totalWeight,
          progress_percent: progressPercent,
          status: progressPercent >= 75 ? 'on_track' : progressPercent >= 50 ? 'at_risk' : 'behind'
        };
      }));
      
      this.editingMetricKR.set(null);
      console.log('[updateMetricValue] Local UI updated immediately');

      // Step 1: Update Firestore in background
      await this.objectiveService.updateObjective(objective.id, {
        key_results: updatedKRs
      });
      console.log('[updateMetricValue] Firestore updated');

      // Step 2: Recalculate objective weighted progress in Firestore
      await new Promise<void>((resolve, reject) => {
        this.calculationService.recalculateObjectiveProgress(objective.id).subscribe({
          next: () => {
            console.log('[updateMetricValue] Objective progress recalculated in Firestore');
            resolve();
          },
          error: (err) => reject(err)
        });
      });
      
      // Step 3: Reload from Firestore to ensure sync
      setTimeout(() => {
        console.log('[updateMetricValue] Reloading from Firestore to ensure sync...');
        this.loadObjectives();
      }, 500);
      
      console.log('[updateMetricValue] Update completed successfully');
    } catch (error) {
      console.error('Error updating metric value:', error);
      alert('Failed to update metric value');
      // Reload on error to revert local changes
      this.loadObjectives();
    }
  }

  isEditingMetric(objectiveId: string, krId: string): boolean {
    const editing = this.editingMetricKR();
    return editing?.objectiveId === objectiveId && editing?.krId === krId;
  }

  goBack(): void {
    const projectId = this.projectId();
    if (projectId) {
      this.router.navigate(['/project', projectId]);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  goToStrategy(): void {
    const projectId = this.projectId();
    if (projectId) {
      this.router.navigate(['/strategy'], { queryParams: { projectId } });
    } else {
      this.router.navigate(['/strategy']);
    }
  }
}
