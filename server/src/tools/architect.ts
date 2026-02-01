import { z } from 'zod';
import type { BridgeDatabase } from '../database.js';
import type { Priority, Category } from '../types.js';

// Zod schemas for validation
const PushTaskSchema = z.object({
  title: z.string().min(1).max(200),
  instructions: z.string().min(1),
  acceptance_criteria: z.array(z.string()).min(1),
  priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
  category: z.enum(['feature', 'bugfix', 'refactor', 'research', 'test', 'docs']).optional(),
  context_files: z.array(z.string()).optional(),
  context_summary: z.string().optional(),
  depends_on: z.array(z.string().uuid()).optional(),
  assign_to: z.literal('executor').optional(),
});

const PushTasksSchema = z.object({
  tasks: z.array(PushTaskSchema).min(1).max(20),
  execution_order: z.enum(['sequential', 'parallel']).optional(),
});

const UpdateTaskSchema = z.object({
  task_id: z.string().uuid(),
  updates: z.object({
    title: z.string().min(1).max(200).optional(),
    instructions: z.string().min(1).optional(),
    acceptance_criteria: z.array(z.string()).optional(),
    priority: z.enum(['critical', 'high', 'normal', 'low']).optional(),
    context_files: z.array(z.string()).optional(),
    context_summary: z.string().nullable().optional(),
    assigned_to: z.enum(['architect', 'executor']).nullable().optional(),
  }),
});

const CancelTaskSchema = z.object({
  task_id: z.string().uuid(),
  reason: z.string().optional(),
});

const RespondClarificationSchema = z.object({
  clarification_id: z.string().uuid(),
  response: z.string().min(1),
});

export function createArchitectTools(db: BridgeDatabase) {
  return {
    bridge_push_task: {
      description: 'Push a new task to the queue for execution. Use this to delegate work to the Executor agent.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short descriptive title (max 200 chars)' },
          instructions: { type: 'string', description: 'Detailed markdown instructions for the task' },
          acceptance_criteria: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of criteria that define "done"',
          },
          priority: {
            type: 'string',
            enum: ['critical', 'high', 'normal', 'low'],
            description: 'Task priority (default: normal)',
          },
          category: {
            type: 'string',
            enum: ['feature', 'bugfix', 'refactor', 'research', 'test', 'docs'],
            description: 'Task category (default: feature)',
          },
          context_files: {
            type: 'array',
            items: { type: 'string' },
            description: 'File paths the Executor should read before starting',
          },
          context_summary: {
            type: 'string',
            description: 'High-level context explaining "why" this task matters',
          },
          depends_on: {
            type: 'array',
            items: { type: 'string' },
            description: 'Task IDs that must complete before this task can start',
          },
          assign_to: {
            type: 'string',
            enum: ['executor'],
            description: 'Auto-assign to executor agent',
          },
        },
        required: ['title', 'instructions', 'acceptance_criteria'],
      },
      handler: (params: unknown) => {
        const validated = PushTaskSchema.parse(params);

        // Validate dependencies exist
        if (validated.depends_on) {
          for (const depId of validated.depends_on) {
            const dep = db.getTask(depId);
            if (!dep) {
              throw new Error(`Dependency task not found: ${depId}`);
            }
          }
        }

        const task = db.createTask({
          title: validated.title,
          instructions: validated.instructions,
          acceptance_criteria: validated.acceptance_criteria,
          priority: validated.priority as Priority,
          category: validated.category as Category,
          context_files: validated.context_files,
          context_summary: validated.context_summary,
          depends_on: validated.depends_on,
          created_by: 'architect',
          assigned_to: validated.assign_to || null,
        });

        db.logEvent({
          agent: 'architect',
          event_type: 'task_created',
          task_id: task.id,
          payload: { title: task.title, priority: task.priority },
        });

        const position = db.getQueuePosition(task.id);

        return {
          task_id: task.id,
          queue_position: position,
          status: task.status,
        };
      },
    },

    bridge_push_tasks: {
      description: 'Push multiple related tasks at once. Optionally set them to run sequentially (with dependencies) or in parallel.',
      inputSchema: {
        type: 'object',
        properties: {
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                instructions: { type: 'string' },
                acceptance_criteria: { type: 'array', items: { type: 'string' } },
                priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'] },
                category: { type: 'string', enum: ['feature', 'bugfix', 'refactor', 'research', 'test', 'docs'] },
                context_files: { type: 'array', items: { type: 'string' } },
                context_summary: { type: 'string' },
              },
              required: ['title', 'instructions', 'acceptance_criteria'],
            },
            description: 'Array of tasks to create (max 20)',
          },
          execution_order: {
            type: 'string',
            enum: ['sequential', 'parallel'],
            description: 'If sequential, each task depends on the previous one',
          },
        },
        required: ['tasks'],
      },
      handler: (params: unknown) => {
        const validated = PushTasksSchema.parse(params);
        const taskIds: string[] = [];
        let previousTaskId: string | null = null;

        for (const taskParams of validated.tasks) {
          const depends_on: string[] = [];

          if (validated.execution_order === 'sequential' && previousTaskId) {
            depends_on.push(previousTaskId);
          }

          const task = db.createTask({
            title: taskParams.title,
            instructions: taskParams.instructions,
            acceptance_criteria: taskParams.acceptance_criteria,
            priority: taskParams.priority as Priority,
            category: taskParams.category as Category,
            context_files: taskParams.context_files,
            context_summary: taskParams.context_summary,
            depends_on,
            created_by: 'architect',
            assigned_to: taskParams.assign_to || null,
          });

          taskIds.push(task.id);
          previousTaskId = task.id;

          db.logEvent({
            agent: 'architect',
            event_type: 'task_created',
            task_id: task.id,
            payload: { title: task.title, batch: true },
          });
        }

        return {
          task_ids: taskIds,
          count: taskIds.length,
          dependencies_created: validated.execution_order === 'sequential',
        };
      },
    },

    bridge_update_task: {
      description: 'Update an existing task. Can modify title, instructions, priority, or reassign.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the task to update' },
          updates: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              instructions: { type: 'string' },
              acceptance_criteria: { type: 'array', items: { type: 'string' } },
              priority: { type: 'string', enum: ['critical', 'high', 'normal', 'low'] },
              context_files: { type: 'array', items: { type: 'string' } },
              context_summary: { type: ['string', 'null'] },
              assigned_to: { type: ['string', 'null'], enum: ['architect', 'executor', null] },
            },
            description: 'Fields to update',
          },
        },
        required: ['task_id', 'updates'],
      },
      handler: (params: unknown) => {
        const validated = UpdateTaskSchema.parse(params);

        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        // Only allow updates to tasks that aren't in terminal states
        if (['completed', 'failed', 'cancelled'].includes(task.status)) {
          throw new Error(`Cannot update task in ${task.status} state`);
        }

        const success = db.updateTask(validated.task_id, validated.updates);

        if (success) {
          db.logEvent({
            agent: 'architect',
            event_type: 'task_updated',
            task_id: validated.task_id,
            payload: { updates: Object.keys(validated.updates) },
          });
        }

        return { success, task_id: validated.task_id };
      },
    },

    bridge_cancel_task: {
      description: 'Cancel a queued or blocked task. Cannot cancel tasks that are in progress.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the task to cancel' },
          reason: { type: 'string', description: 'Optional reason for cancellation' },
        },
        required: ['task_id'],
      },
      handler: (params: unknown) => {
        const validated = CancelTaskSchema.parse(params);

        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        if (!['queued', 'blocked'].includes(task.status)) {
          throw new Error(`Can only cancel queued or blocked tasks. Current status: ${task.status}`);
        }

        const success = db.updateTask(validated.task_id, {
          status: 'cancelled',
          completed_at: new Date().toISOString(),
        });

        if (success) {
          db.logEvent({
            agent: 'architect',
            event_type: 'task_cancelled',
            task_id: validated.task_id,
            payload: { reason: validated.reason },
          });
        }

        return { success, task_id: validated.task_id };
      },
    },

    bridge_respond_clarification: {
      description: 'Respond to a clarification request from the Executor. This unblocks the associated task.',
      inputSchema: {
        type: 'object',
        properties: {
          clarification_id: { type: 'string', description: 'UUID of the clarification request' },
          response: { type: 'string', description: 'Your response to the question' },
        },
        required: ['clarification_id', 'response'],
      },
      handler: (params: unknown) => {
        const validated = RespondClarificationSchema.parse(params);

        const success = db.respondToClarification(validated.clarification_id, validated.response);
        if (!success) {
          throw new Error(`Clarification not found: ${validated.clarification_id}`);
        }

        db.logEvent({
          agent: 'architect',
          event_type: 'clarification_responded',
          payload: { clarification_id: validated.clarification_id },
        });

        return { success: true, clarification_id: validated.clarification_id };
      },
    },

    bridge_get_clarifications: {
      description: 'Get all pending clarification requests that need a response.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: () => {
        const clarifications = db.getPendingClarifications();
        return {
          count: clarifications.length,
          clarifications: clarifications.map(c => ({
            id: c.id,
            task_id: c.task_id,
            question: c.question,
            options: c.options,
            created_at: c.created_at,
          })),
        };
      },
    },
  };
}
