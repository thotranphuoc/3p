import { Component, Input, Output, EventEmitter, OnInit, OnChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ObjectiveService } from '../../services/objective.service';
import { Objective, BSCQuadrant, KeyResult } from '../../models/objective.model';

@Component({
  selector: 'app-objective-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './objective-modal.component.html',
  styleUrl: './objective-modal.component.scss'
})
export class ObjectiveModalComponent implements OnChanges {
  @Input() isOpen: boolean = false;
  @Input() projectId!: string | null;
  @Input() objective: Objective | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private objectiveService = inject(ObjectiveService);

  // Form signals
  title = signal<string>('');
  description = signal<string>('');
  type = signal<BSCQuadrant>('financial');
  keyResults = signal<KeyResult[]>([]);
  
  // UI signals
  saving = signal<boolean>(false);
  showAddKR = signal<boolean>(false);
  editingKRId = signal<string | null>(null);
  
  // New KR form
  newKRTitle = signal<string>('');
  newKRWeight = signal<number>(10);
  newKRType = signal<'metric' | 'task_linked'>('metric');
  newKRTargetValue = signal<number>(100);
  newKRUnit = signal<string>('');
  
  // Edit KR form
  editKRTitle = signal<string>('');
  editKRWeight = signal<number>(10);
  editKRType = signal<'metric' | 'task_linked'>('metric');
  editKRTargetValue = signal<number>(100);
  editKRCurrentValue = signal<number>(0);
  editKRUnit = signal<string>('');

  ngOnChanges(): void {
    if (this.isOpen && this.objective) {
      // Edit mode - populate form
      this.title.set(this.objective.title);
      this.description.set(this.objective.description || '');
      this.type.set(this.objective.type);
      this.keyResults.set([...this.objective.key_results]);
    } else if (this.isOpen) {
      // Create mode - reset form
      this.resetForm();
    }
  }

  resetForm(): void {
    this.title.set('');
    this.description.set('');
    this.type.set('financial');
    this.keyResults.set([]);
    this.showAddKR.set(false);
    this.resetKRForm();
  }

  resetKRForm(): void {
    this.newKRTitle.set('');
    this.newKRWeight.set(10);
    this.newKRType.set('metric');
    this.newKRTargetValue.set(100);
    this.newKRUnit.set('');
  }

  addKeyResult(): void {
    const kr: KeyResult = {
      id: `kr_${Date.now()}`,
      title: this.newKRTitle(),
      weight: this.newKRWeight(),
      type: this.newKRType(),
      progress: 0
    };

    if (this.newKRType() === 'metric') {
      kr.target_value = this.newKRTargetValue();
      kr.current_value = 0;
      kr.unit = this.newKRUnit();
    } else {
      kr.linked_task_ids = [];
    }

    this.keyResults.update(krs => [...krs, kr]);
    this.showAddKR.set(false);
    this.resetKRForm();
  }

  removeKeyResult(krId: string): void {
    if (confirm('Are you sure you want to delete this key result?')) {
      this.keyResults.update(krs => krs.filter(kr => kr.id !== krId));
      if (this.editingKRId() === krId) {
        this.editingKRId.set(null);
      }
    }
  }

  startEditKR(kr: KeyResult): void {
    this.editingKRId.set(kr.id);
    this.editKRTitle.set(kr.title);
    this.editKRWeight.set(kr.weight);
    this.editKRType.set(kr.type);
    this.editKRTargetValue.set(kr.target_value || 100);
    this.editKRCurrentValue.set(kr.current_value || 0);
    this.editKRUnit.set(kr.unit || '');
    this.showAddKR.set(false); // Close add form if open
  }

  cancelEditKR(): void {
    this.editingKRId.set(null);
  }

  saveEditKR(): void {
    const krId = this.editingKRId();
    if (!krId) return;

    this.keyResults.update(krs => krs.map(kr => {
      if (kr.id !== krId) return kr;

      const updated: KeyResult = {
        ...kr,
        title: this.editKRTitle(),
        weight: this.editKRWeight(),
        type: this.editKRType()
      };

      if (this.editKRType() === 'metric') {
        updated.target_value = this.editKRTargetValue();
        updated.current_value = this.editKRCurrentValue();
        updated.unit = this.editKRUnit();
        // Recalculate progress
        const current = this.editKRCurrentValue();
        const target = this.editKRTargetValue();
        updated.progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
        // Remove task_linked fields
        delete updated.linked_task_ids;
      } else {
        // task_linked type
        updated.linked_task_ids = kr.linked_task_ids || [];
        // Remove metric fields
        delete updated.target_value;
        delete updated.current_value;
        delete updated.unit;
      }

      return updated;
    }));

    this.editingKRId.set(null);
  }

  closeModal(): void {
    this.resetForm();
    this.close.emit();
  }

  async onSave(): Promise<void> {
    if (!this.title().trim()) {
      alert('Please enter objective title');
      return;
    }

    if (this.keyResults().length === 0) {
      alert('Please add at least one key result');
      return;
    }

    this.saving.set(true);

    try {
      const totalWeight = this.keyResults().reduce((sum, kr) => sum + kr.weight, 0);
      
      const objectiveData: Partial<Objective> = {
        projectId: this.projectId || 'global',
        title: this.title().trim(),
        description: this.description().trim(),
        type: this.type(),
        status: 'on_track',
        total_weight: totalWeight,
        current_weighted_score: 0,
        progress_percent: 0,
        key_results: this.keyResults()
      };

      if (this.objective) {
        // Update existing
        await this.objectiveService.updateObjective(this.objective.id, objectiveData);
      } else {
        // Create new
        await this.objectiveService.createObjective(objectiveData as Objective);
      }

      this.saved.emit();
      this.closeModal();
    } catch (error) {
      console.error('Error saving objective:', error);
      alert('Failed to save objective. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  getTypeLabel(type: BSCQuadrant): string {
    const labels = {
      financial: 'Financial',
      customer: 'Customer',
      internal: 'Internal Process',
      learning: 'Learning & Growth'
    };
    return labels[type];
  }

  getTotalWeight(): number {
    return this.keyResults().reduce((sum, kr) => sum + kr.weight, 0);
  }
}
