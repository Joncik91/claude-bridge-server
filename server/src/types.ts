// Task priority levels
export type Priority = 'critical' | 'high' | 'normal' | 'low';

// Task categories
export type Category = 'feature' | 'bugfix' | 'refactor' | 'research' | 'test' | 'docs';

// Task status lifecycle
export type TaskStatus = 'queued' | 'claimed' | 'in_progress' | 'blocked' | 'completed' | 'failed' | 'cancelled';

// Agent identifiers
export type AgentRole = 'architect' | 'executor';

// Task execution result
export interface TaskResult {
  success: boolean;
  summary: string;
  files_modified: string[];
  files_created: string[];
  files_deleted: string[];
  commits?: string[];
  blockers?: string[];
  follow_up_tasks?: string[];
}

// Core task structure
export interface Task {
  id: string;
  sequence: number;
  priority: Priority;
  category: Category;
  status: TaskStatus;
  title: string;
  instructions: string;
  acceptance_criteria: string[];
  context_files: string[];
  context_summary: string | null;
  related_tasks: string[];
  depends_on: string[];
  created_by: AgentRole;
  assigned_to: AgentRole | null;
  created_at: string;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result: TaskResult | null;
}

// Session context for pause/resume
export interface SessionContext {
  id: string;
  agent: AgentRole;
  project_path: string;

  // What was being worked on
  current_task_id: string | null;
  task_title: string | null;

  // Context snapshot
  working_on: string;           // What you were doing
  progress_made: string;        // What you accomplished
  next_steps: string;           // What you were about to do
  open_questions: string[];     // Unresolved questions
  files_in_focus: string[];     // Files you were working with
  important_notes: string;      // Any other context

  // Timestamps
  created_at: string;
  resumed_at: string | null;
}

// Clarification request for blocked tasks
export interface ClarificationRequest {
  id: string;
  task_id: string;
  question: string;
  options: string[] | null;
  response: string | null;
  created_at: string;
  responded_at: string | null;
}

// Architectural decision record
export interface Decision {
  id: string;
  summary: string;
  rationale: string;
  made_by: AgentRole | 'human';
  made_at: string;
  affects_files: string[];
}

// Project state singleton
export interface ProjectState {
  current_focus: string | null;
  recent_decisions: Decision[];
  known_issues: string[];
  last_sync: string | null;
}

// Event log entry
export interface EventLogEntry {
  id: number;
  timestamp: string;
  agent: AgentRole;
  event_type: string;
  task_id: string | null;
  payload: Record<string, unknown>;
}

// Tool parameter types for Architect
export interface PushTaskParams {
  title: string;
  instructions: string;
  acceptance_criteria: string[];
  priority?: Priority;
  category?: Category;
  context_files?: string[];
  context_summary?: string;
  depends_on?: string[];
  assign_to?: 'executor';
}

export interface PushTasksParams {
  tasks: PushTaskParams[];
  execution_order?: 'sequential' | 'parallel';
}

export interface UpdateTaskParams {
  task_id: string;
  updates: {
    title?: string;
    instructions?: string;
    acceptance_criteria?: string[];
    priority?: Priority;
    context_files?: string[];
    context_summary?: string;
    assigned_to?: AgentRole | null;
  };
}

export interface CancelTaskParams {
  task_id: string;
  reason?: string;
}

// Tool parameter types for Executor
export interface PullTaskParams {
  categories?: Category[];
  max_priority?: Priority;
}

export interface ClaimTaskParams {
  task_id: string;
}

export interface ReportProgressParams {
  task_id: string;
  status: 'in_progress' | 'blocked';
  message: string;
  files_touched?: string[];
}

export interface CompleteTaskParams {
  task_id: string;
  result: TaskResult;
}

export interface FailTaskParams {
  task_id: string;
  error: string;
  recoverable: boolean;
  blockers?: string[];
}

export interface RequestClarificationParams {
  task_id: string;
  question: string;
  options?: string[];
}

// Tool parameter types for Shared
export interface ListTasksParams {
  status?: TaskStatus | TaskStatus[];
  assigned_to?: AgentRole;
  limit?: number;
  offset?: number;
}

export interface GetTaskParams {
  task_id: string;
}

export interface GetHistoryParams {
  since?: string;
  limit?: number;
  offset?: number;
  category?: Category;
}

export interface UpdateStateParams {
  current_focus?: string | null;
  known_issues?: string[];
}

export interface LogDecisionParams {
  summary: string;
  rationale: string;
  affects_files?: string[];
}

// Session context params
export interface SaveContextParams {
  current_task_id?: string;
  working_on: string;
  progress_made: string;
  next_steps: string;
  open_questions?: string[];
  files_in_focus?: string[];
  important_notes?: string;
}

// Server mode configuration
export type ServerMode = 'architect' | 'executor' | 'full';

export interface ServerConfig {
  mode: ServerMode;
  dbPath: string;
  projectPath: string;
}
