import { z } from 'zod';
import type { BridgeDatabase } from '../database.js';
import type { Category, TaskResult } from '../types.js';

// Zod schemas for validation
const PullTaskSchema = z.object({
  categories: z.array(z.enum(['feature', 'bugfix', 'refactor', 'research', 'test', 'docs'])).optional(),
});

const ClaimTaskSchema = z.object({
  task_id: z.string().uuid(),
});

const ReportProgressSchema = z.object({
  task_id: z.string().uuid(),
  status: z.enum(['in_progress', 'blocked']),
  message: z.string().min(1),
  files_touched: z.array(z.string()).optional(),
});

const TaskResultSchema = z.object({
  success: z.boolean(),
  summary: z.string().min(1),
  files_modified: z.array(z.string()),
  files_created: z.array(z.string()),
  files_deleted: z.array(z.string()),
  commits: z.array(z.string()).optional(),
  blockers: z.array(z.string()).optional(),
  follow_up_tasks: z.array(z.string()).optional(),
});

const CompleteTaskSchema = z.object({
  task_id: z.string().uuid(),
  result: TaskResultSchema,
});

const FailTaskSchema = z.object({
  task_id: z.string().uuid(),
  error: z.string().min(1),
  recoverable: z.boolean(),
  blockers: z.array(z.string()).optional(),
});

const RequestClarificationSchema = z.object({
  task_id: z.string().uuid(),
  question: z.string().min(1),
  options: z.array(z.string()).optional(),
});

export function createExecutorTools(db: BridgeDatabase) {
  return {
    bridge_pull_task: {
      description: 'Pull the next available task from the queue. Respects task dependencies and priority ordering.',
      inputSchema: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['feature', 'bugfix', 'refactor', 'research', 'test', 'docs'],
            },
            description: 'Optional filter by task categories',
          },
        },
      },
      handler: (params: unknown) => {
        const validated = PullTaskSchema.parse(params || {});

        const task = db.pullNextTask({
          categories: validated.categories as Category[],
          assigned_to: 'executor',
        });

        if (!task) {
          return {
            available: false,
            message: 'No tasks available in queue (or all have unmet dependencies)',
          };
        }

        return {
          available: true,
          task: {
            id: task.id,
            title: task.title,
            priority: task.priority,
            category: task.category,
            instructions: task.instructions,
            acceptance_criteria: task.acceptance_criteria,
            context_files: task.context_files,
            context_summary: task.context_summary,
            depends_on: task.depends_on,
            created_at: task.created_at,
          },
        };
      },
    },

    bridge_claim_task: {
      description: 'Claim a specific task to begin working on it. Updates status to "claimed".',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the task to claim' },
        },
        required: ['task_id'],
      },
      handler: (params: unknown) => {
        const validated = ClaimTaskSchema.parse(params);

        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        if (task.status !== 'queued') {
          throw new Error(`Task cannot be claimed. Current status: ${task.status}`);
        }

        // Check dependencies
        if (task.depends_on.length > 0) {
          const deps = task.depends_on.map(id => db.getTask(id)).filter(Boolean);
          const incomplete = deps.filter(d => d!.status !== 'completed');
          if (incomplete.length > 0) {
            throw new Error(
              `Task has incomplete dependencies: ${incomplete.map(d => d!.id).join(', ')}`
            );
          }
        }

        const success = db.updateTask(validated.task_id, {
          status: 'claimed',
          assigned_to: 'executor',
          claimed_at: new Date().toISOString(),
        });

        if (success) {
          db.logEvent({
            agent: 'executor',
            event_type: 'task_claimed',
            task_id: validated.task_id,
          });
        }

        const updatedTask = db.getTask(validated.task_id)!;

        return {
          success,
          task: {
            id: updatedTask.id,
            title: updatedTask.title,
            priority: updatedTask.priority,
            category: updatedTask.category,
            instructions: updatedTask.instructions,
            acceptance_criteria: updatedTask.acceptance_criteria,
            context_files: updatedTask.context_files,
            context_summary: updatedTask.context_summary,
          },
        };
      },
    },

    bridge_report_progress: {
      description: 'Report progress on a task. Use status "in_progress" for updates, or "blocked" if you cannot continue.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the task' },
          status: {
            type: 'string',
            enum: ['in_progress', 'blocked'],
            description: 'Current working status',
          },
          message: { type: 'string', description: 'Progress update message' },
          files_touched: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files modified so far',
          },
        },
        required: ['task_id', 'status', 'message'],
      },
      handler: (params: unknown) => {
        const validated = ReportProgressSchema.parse(params);

        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        if (!['claimed', 'in_progress'].includes(task.status)) {
          throw new Error(`Cannot report progress on task with status: ${task.status}`);
        }

        const updates: { status: 'in_progress' | 'blocked'; started_at?: string } = {
          status: validated.status,
        };

        // Set started_at on first progress report
        if (task.status === 'claimed') {
          updates.started_at = new Date().toISOString();
        }

        db.updateTask(validated.task_id, updates);

        db.logEvent({
          agent: 'executor',
          event_type: 'progress_reported',
          task_id: validated.task_id,
          payload: {
            status: validated.status,
            message: validated.message,
            files_touched: validated.files_touched,
          },
        });

        return {
          acknowledged: true,
          task_id: validated.task_id,
          current_status: validated.status,
        };
      },
    },

    bridge_complete_task: {
      description: 'Mark a task as completed with results. Include summary, files changed, and any follow-up recommendations.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the task' },
          result: {
            type: 'object',
            properties: {
              success: { type: 'boolean', description: 'Whether the task succeeded' },
              summary: { type: 'string', description: 'Summary of what was done' },
              files_modified: { type: 'array', items: { type: 'string' } },
              files_created: { type: 'array', items: { type: 'string' } },
              files_deleted: { type: 'array', items: { type: 'string' } },
              commits: { type: 'array', items: { type: 'string' }, description: 'Git commit SHAs' },
              blockers: { type: 'array', items: { type: 'string' }, description: 'Issues encountered' },
              follow_up_tasks: { type: 'array', items: { type: 'string' }, description: 'Suggested next tasks' },
            },
            required: ['success', 'summary', 'files_modified', 'files_created', 'files_deleted'],
          },
        },
        required: ['task_id', 'result'],
      },
      handler: (params: unknown) => {
        const validated = CompleteTaskSchema.parse(params);

        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        if (!['claimed', 'in_progress'].includes(task.status)) {
          throw new Error(`Cannot complete task with status: ${task.status}`);
        }

        const success = db.updateTask(validated.task_id, {
          status: 'completed',
          completed_at: new Date().toISOString(),
          result: validated.result as TaskResult,
        });

        if (success) {
          db.logEvent({
            agent: 'executor',
            event_type: 'task_completed',
            task_id: validated.task_id,
            payload: {
              success: validated.result.success,
              files_modified: validated.result.files_modified.length,
              files_created: validated.result.files_created.length,
            },
          });
        }

        // Check if there's another task available
        const nextTask = db.pullNextTask({ assigned_to: 'executor' });

        return {
          success,
          task_id: validated.task_id,
          next_task: nextTask
            ? {
                id: nextTask.id,
                title: nextTask.title,
                priority: nextTask.priority,
              }
            : null,
        };
      },
    },

    bridge_fail_task: {
      description: 'Mark a task as failed. Use when the task cannot be completed.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the task' },
          error: { type: 'string', description: 'Error description' },
          recoverable: {
            type: 'boolean',
            description: 'Whether the task could be retried after fixes',
          },
          blockers: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific blockers preventing completion',
          },
        },
        required: ['task_id', 'error', 'recoverable'],
      },
      handler: (params: unknown) => {
        const validated = FailTaskSchema.parse(params);

        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        if (!['claimed', 'in_progress', 'blocked'].includes(task.status)) {
          throw new Error(`Cannot fail task with status: ${task.status}`);
        }

        const result: TaskResult = {
          success: false,
          summary: validated.error,
          files_modified: [],
          files_created: [],
          files_deleted: [],
          blockers: validated.blockers,
        };

        const success = db.updateTask(validated.task_id, {
          status: 'failed',
          completed_at: new Date().toISOString(),
          result,
        });

        if (success) {
          db.logEvent({
            agent: 'executor',
            event_type: 'task_failed',
            task_id: validated.task_id,
            payload: {
              error: validated.error,
              recoverable: validated.recoverable,
              blockers: validated.blockers,
            },
          });
        }

        return {
          success,
          task_id: validated.task_id,
          recoverable: validated.recoverable,
        };
      },
    },

    bridge_request_clarification: {
      description: 'Request clarification from the Architect. Marks the task as blocked until answered.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the task' },
          question: { type: 'string', description: 'Your question for the Architect' },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Suggested answer options',
          },
        },
        required: ['task_id', 'question'],
      },
      handler: (params: unknown) => {
        const validated = RequestClarificationSchema.parse(params);

        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        if (!['claimed', 'in_progress'].includes(task.status)) {
          throw new Error(`Cannot request clarification for task with status: ${task.status}`);
        }

        // Create clarification request
        const clarification = db.createClarification({
          task_id: validated.task_id,
          question: validated.question,
          options: validated.options,
        });

        // Mark task as blocked
        db.updateTask(validated.task_id, { status: 'blocked' });

        db.logEvent({
          agent: 'executor',
          event_type: 'clarification_requested',
          task_id: validated.task_id,
          payload: {
            clarification_id: clarification.id,
            question: validated.question,
          },
        });

        return {
          request_id: clarification.id,
          task_id: validated.task_id,
          status: 'blocked',
          message: 'Task blocked pending clarification from Architect',
        };
      },
    },
  };
}
