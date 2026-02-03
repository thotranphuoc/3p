export interface Project {
  id: string;
  name: string;
  members: string[]; // List of UIDs for security rules
  // AGGREGATES (Updated via Batch Write)
  stats: {
    total_tasks: number;
    completed_tasks: number;
  };
}
