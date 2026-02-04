export type BSCQuadrant = 'financial' | 'customer' | 'internal' | 'learning';
export type ObjectiveStatus = 'on_track' | 'at_risk' | 'behind';
export type KeyResultType = 'metric' | 'task_linked';

export interface KeyResult {
  id: string;
  title: string;
  weight: number; // Importance (1-100)
  type: KeyResultType;
  
  // Type A: Manual Metric (e.g., Revenue)
  target_value?: number;
  current_value?: number;
  unit?: string;
  
  // Type B: Task Linked (Auto-calculated)
  linked_task_ids?: string[]; // List of Task IDs contributing to this KR
  
  progress: number; // 0-100%
}

export interface Objective {
  id: string;
  projectId: string | 'global'; // 'global' for company-wide objectives
  title: string;
  description?: string;
  type: BSCQuadrant; // BSC Quadrants
  status: ObjectiveStatus;
  
  // WEIGHTED PROGRESS CALCULATION
  total_weight: number;           // Sum of all Key Results' weights (e.g., 100)
  current_weighted_score: number; // Sum of (KR_Progress * KR_Weight)
  progress_percent: number;       // (current_weighted_score / total_weight) * 100
  
  // KEY RESULTS (Nested Array for atomic updates)
  key_results: KeyResult[];
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}
