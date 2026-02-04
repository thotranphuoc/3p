export interface Project {
  id: string;
  name: string;
  
  // Client & Team Information
  client_name?: string;
  client_contact?: string;
  pm_id?: string; // Project Manager UID
  members: string[]; // Team member UIDs
  
  // Timeline
  start_date?: Date;
  end_date?: Date;
  status?: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
  
  // Budget
  budget?: number;
  currency?: string; // USD, VND, EUR, etc.
  
  // Project Details
  description?: string;
  objectives?: string; // Strategic objectives/goals
  scope?: string; // Project scope
  deliverables?: string; // Key deliverables
  
  // Metadata
  created_at?: Date;
  updated_at?: Date;
  created_by?: string; // Creator UID
  
  // AGGREGATES (Updated via Batch Write)
  stats: {
    total_tasks: number;
    completed_tasks: number;
  };
}
