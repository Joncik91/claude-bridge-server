import { z } from 'zod';
import type { BridgeDatabase } from '../database.js';
import type { TaskStatus, Category, AgentRole } from '../types.js';

// Zod schemas for validation
const ListTasksSchema = z.object({
  status: z.union([
    z.enum(['queued', 'claimed', 'in_progress', 'blocked', 'completed', 'failed', 'cancelled']),
    z.array(z.enum(['queued', 'claimed', 'in_progress', 'blocked', 'completed', 'failed', 'cancelled'])),
  ]).optional(),
  assigned_to: z.enum(['architect', 'executor']).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

const GetTaskSchema = z.object({
  task_id: z.string().uuid(),
});

const GetHistorySchema = z.object({
  since: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
  category: z.enum(['feature', 'bugfix', 'refactor', 'research', 'test', 'docs']).optional(),
});

const UpdateStateSchema = z.object({
  current_focus: z.string().nullable().optional(),
  known_issues: z.array(z.string()).optional(),
});

const LogDecisionSchema = z.object({
  summary: z.string().min(1),
  rationale: z.string().min(1),
  affects_files: z.array(z.string()).optional(),
});

const SaveContextSchema = z.object({
  current_task_id: z.string().uuid().optional(),
  working_on: z.string().min(1),
  progress_made: z.string().min(1),
  next_steps: z.string().min(1),
  open_questions: z.array(z.string()).optional(),
  files_in_focus: z.array(z.string()).optional(),
  important_notes: z.string().optional(),
});

const ListSessionsSchema = z.object({
  include_resumed: z.boolean().optional(),
  limit: z.number().int().positive().max(20).optional(),
  offset: z.number().int().nonnegative().optional(),
});

export function createSharedTools(db: BridgeDatabase, agentRole: AgentRole) {
  return {
    bridge_list_tasks: {
      description: 'List tasks in the queue with optional filters by status and assignment.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            oneOf: [
              { type: 'string', enum: ['queued', 'claimed', 'in_progress', 'blocked', 'completed', 'failed', 'cancelled'] },
              { type: 'array', items: { type: 'string', enum: ['queued', 'claimed', 'in_progress', 'blocked', 'completed', 'failed', 'cancelled'] } },
            ],
            description: 'Filter by status (single value or array)',
          },
          assigned_to: {
            type: 'string',
            enum: ['architect', 'executor'],
            description: 'Filter by assigned agent',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tasks to return (default: 50, max: 100)',
          },
          offset: {
            type: 'number',
            description: 'Number of tasks to skip for pagination (default: 0)',
          },
        },
      },
      handler: (params: unknown) => {
        const validated = ListTasksSchema.parse(params || {});

        const tasks = db.listTasks({
          status: validated.status as TaskStatus | TaskStatus[],
          assigned_to: validated.assigned_to as AgentRole,
          limit: validated.limit || 50,
          offset: validated.offset || 0,
        });

        const counts = db.getTaskCountsByStatus();

        return {
          tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            category: t.category,
            status: t.status,
            assigned_to: t.assigned_to,
            created_at: t.created_at,
            depends_on_count: t.depends_on.length,
          })),
          total: tasks.length,
          counts_by_status: counts,
        };
      },
    },

    bridge_get_task: {
      description: 'Get full details of a specific task by ID.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: { type: 'string', description: 'UUID of the task' },
        },
        required: ['task_id'],
      },
      handler: (params: unknown) => {
        const validated = GetTaskSchema.parse(params);

        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        return { task };
      },
    },

    bridge_get_history: {
      description: 'Get completed/failed/cancelled tasks. Useful for reviewing past work.',
      inputSchema: {
        type: 'object',
        properties: {
          since: {
            type: 'string',
            description: 'ISO timestamp to filter tasks completed after this time',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of tasks to return (default: 20, max: 100)',
          },
          offset: {
            type: 'number',
            description: 'Number of tasks to skip for pagination (default: 0)',
          },
          category: {
            type: 'string',
            enum: ['feature', 'bugfix', 'refactor', 'research', 'test', 'docs'],
            description: 'Filter by task category',
          },
        },
      },
      handler: (params: unknown) => {
        const validated = GetHistorySchema.parse(params || {});

        const tasks = db.getTaskHistory({
          since: validated.since,
          limit: validated.limit || 20,
          offset: validated.offset || 0,
          category: validated.category as Category,
        });

        return {
          tasks: tasks.map(t => ({
            id: t.id,
            title: t.title,
            category: t.category,
            status: t.status,
            created_at: t.created_at,
            completed_at: t.completed_at,
            result: t.result
              ? {
                  success: t.result.success,
                  summary: t.result.summary,
                  files_modified: t.result.files_modified.length,
                  files_created: t.result.files_created.length,
                }
              : null,
          })),
          total: tasks.length,
        };
      },
    },

    bridge_get_state: {
      description: 'Get the shared project state including current focus, recent decisions, and known issues.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: () => {
        const state = db.getProjectState();
        const counts = db.getTaskCountsByStatus();

        return {
          state: {
            current_focus: state.current_focus,
            known_issues: state.known_issues,
            last_sync: state.last_sync,
            recent_decisions: state.recent_decisions.slice(-10), // Last 10 decisions
          },
          queue_summary: {
            queued: counts.queued,
            in_progress: counts.claimed + counts.in_progress,
            blocked: counts.blocked,
            completed_total: counts.completed,
          },
        };
      },
    },

    bridge_update_state: {
      description: 'Update the shared project state. Use to set current focus or track known issues.',
      inputSchema: {
        type: 'object',
        properties: {
          current_focus: {
            type: ['string', 'null'],
            description: 'What the project is currently focused on',
          },
          known_issues: {
            type: 'array',
            items: { type: 'string' },
            description: 'List of known issues/problems',
          },
        },
      },
      handler: (params: unknown) => {
        const validated = UpdateStateSchema.parse(params || {});

        if (Object.keys(validated).length === 0) {
          return { success: false, message: 'No updates provided' };
        }

        const success = db.updateProjectState(validated);

        if (success) {
          db.logEvent({
            agent: agentRole,
            event_type: 'state_updated',
            payload: { updated_fields: Object.keys(validated) },
          });
        }

        return { success };
      },
    },

    bridge_log_decision: {
      description: 'Log an architectural or design decision for shared memory. Both agents should use this to record important choices.',
      inputSchema: {
        type: 'object',
        properties: {
          summary: { type: 'string', description: 'Brief summary of the decision' },
          rationale: { type: 'string', description: 'Why this decision was made' },
          affects_files: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files affected by this decision',
          },
        },
        required: ['summary', 'rationale'],
      },
      handler: (params: unknown) => {
        const validated = LogDecisionSchema.parse(params);

        const decision = db.addDecision({
          summary: validated.summary,
          rationale: validated.rationale,
          made_by: agentRole,
          affects_files: validated.affects_files,
        });

        db.logEvent({
          agent: agentRole,
          event_type: 'decision_logged',
          payload: { decision_id: decision.id, summary: decision.summary },
        });

        return {
          decision_id: decision.id,
          logged_at: decision.made_at,
        };
      },
    },

    bridge_sync: {
      description: 'Mark a sync point. Use after reviewing shared state to acknowledge you are up-to-date.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      handler: () => {
        const timestamp = new Date().toISOString();
        db.updateProjectState({ last_sync: timestamp });

        db.logEvent({
          agent: agentRole,
          event_type: 'sync',
          payload: { timestamp },
        });

        return {
          synced_at: timestamp,
          agent: agentRole,
        };
      },
    },

    bridge_get_events: {
      description: 'Get recent events from the audit log. Useful for seeing what the other agent has been doing.',
      inputSchema: {
        type: 'object',
        properties: {
          since: {
            type: 'string',
            description: 'ISO timestamp to filter events after this time',
          },
          task_id: {
            type: 'string',
            description: 'Filter events for a specific task',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of events to return (default: 50)',
          },
          offset: {
            type: 'number',
            description: 'Number of events to skip for pagination (default: 0)',
          },
        },
      },
      handler: (params: unknown) => {
        const schema = z.object({
          since: z.string().optional(),
          task_id: z.string().uuid().optional(),
          limit: z.number().int().positive().max(200).optional(),
          offset: z.number().int().nonnegative().optional(),
        });

        const validated = schema.parse(params || {});

        const events = db.getEvents({
          since: validated.since,
          task_id: validated.task_id,
          limit: validated.limit || 50,
          offset: validated.offset || 0,
        });

        return {
          events: events.map(e => ({
            id: e.id,
            timestamp: e.timestamp,
            agent: e.agent,
            event_type: e.event_type,
            task_id: e.task_id,
            payload: e.payload,
          })),
          total: events.length,
        };
      },
    },

    // ==================== SESSION CONTEXT TOOLS ====================

    bridge_save_context: {
      description: 'Save your current working context before closing the session. Use this when you need to pause work and want to remember where you left off.',
      inputSchema: {
        type: 'object',
        properties: {
          current_task_id: {
            type: 'string',
            description: 'UUID of the task you were working on (if any)',
          },
          working_on: {
            type: 'string',
            description: 'What you were doing / working on',
          },
          progress_made: {
            type: 'string',
            description: 'What you accomplished so far',
          },
          next_steps: {
            type: 'string',
            description: 'What you were about to do next',
          },
          open_questions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Unresolved questions or uncertainties',
          },
          files_in_focus: {
            type: 'array',
            items: { type: 'string' },
            description: 'Files you were working with',
          },
          important_notes: {
            type: 'string',
            description: 'Any other important context to remember',
          },
        },
        required: ['working_on', 'progress_made', 'next_steps'],
      },
      handler: (params: unknown) => {
        const validated = SaveContextSchema.parse(params);

        const session = db.saveSessionContext({
          agent: agentRole,
          current_task_id: validated.current_task_id,
          working_on: validated.working_on,
          progress_made: validated.progress_made,
          next_steps: validated.next_steps,
          open_questions: validated.open_questions,
          files_in_focus: validated.files_in_focus,
          important_notes: validated.important_notes,
        });

        db.logEvent({
          agent: agentRole,
          event_type: 'session_saved',
          task_id: validated.current_task_id,
          payload: { session_id: session.id },
        });

        return {
          session_id: session.id,
          saved_at: session.created_at,
          message: 'Context saved. Use bridge_load_context when you return to resume.',
        };
      },
    },

    bridge_load_context: {
      description: 'Load your previous working context when starting a new session. Shows what you were doing and where you left off.',
      inputSchema: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'Specific session ID to load (optional - defaults to most recent)',
          },
        },
      },
      handler: (params: unknown) => {
        const schema = z.object({
          session_id: z.string().uuid().optional(),
        });
        const validated = schema.parse(params || {});

        let session;
        if (validated.session_id) {
          session = db.getSessionContext(validated.session_id);
          if (!session) {
            throw new Error(`Session not found: ${validated.session_id}`);
          }
        } else {
          session = db.getLatestSessionContext(agentRole);
          if (!session) {
            return {
              found: false,
              message: 'No saved session context found. This appears to be a fresh start.',
            };
          }
        }

        // Mark as resumed
        db.markSessionResumed(session.id);

        db.logEvent({
          agent: agentRole,
          event_type: 'session_resumed',
          task_id: session.current_task_id ?? undefined,
          payload: { session_id: session.id },
        });

        return {
          found: true,
          session: {
            id: session.id,
            saved_at: session.created_at,
            current_task: session.current_task_id
              ? {
                  id: session.current_task_id,
                  title: session.task_title,
                }
              : null,
            working_on: session.working_on,
            progress_made: session.progress_made,
            next_steps: session.next_steps,
            open_questions: session.open_questions,
            files_in_focus: session.files_in_focus,
            important_notes: session.important_notes,
          },
        };
      },
    },

    bridge_list_sessions: {
      description: 'List saved session contexts. Useful for seeing your work history across sessions.',
      inputSchema: {
        type: 'object',
        properties: {
          include_resumed: {
            type: 'boolean',
            description: 'Include sessions that have already been resumed (default: false)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of sessions to return (default: 10, max: 20)',
          },
          offset: {
            type: 'number',
            description: 'Number of sessions to skip for pagination (default: 0)',
          },
        },
      },
      handler: (params: unknown) => {
        const validated = ListSessionsSchema.parse(params || {});

        const sessions = db.listSessionContexts({
          agent: agentRole,
          include_resumed: validated.include_resumed,
          limit: validated.limit || 10,
          offset: validated.offset || 0,
        });

        return {
          sessions: sessions.map(s => ({
            id: s.id,
            saved_at: s.created_at,
            resumed_at: s.resumed_at,
            task_title: s.task_title,
            working_on: s.working_on.substring(0, 100) + (s.working_on.length > 100 ? '...' : ''),
          })),
          total: sessions.length,
        };
      },
    },

    // ==================== TASK CONTEXT RECOVERY ====================

    bridge_load_task_context: {
      description: 'Load context from a specific task and its dependencies. Use this to recover context after a context reset or compaction by providing the task ID you were working on.',
      inputSchema: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'UUID of the task to load context from',
          },
          include_dependencies: {
            type: 'boolean',
            description: 'Include context from tasks this task depends on (default: true)',
          },
          include_dependents: {
            type: 'boolean',
            description: 'Include context from tasks that depend on this task (default: false)',
          },
        },
        required: ['task_id'],
      },
      handler: (params: unknown) => {
        const schema = z.object({
          task_id: z.string().uuid(),
          include_dependencies: z.boolean().optional(),
          include_dependents: z.boolean().optional(),
        });
        const validated = schema.parse(params);
        const includeDeps = validated.include_dependencies !== false; // default true
        const includeDependents = validated.include_dependents === true; // default false

        // Get the main task
        const task = db.getTask(validated.task_id);
        if (!task) {
          throw new Error(`Task not found: ${validated.task_id}`);
        }

        // Helper to format task context
        const formatTaskContext = (t: typeof task) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          category: t.category,
          instructions: t.instructions,
          acceptance_criteria: t.acceptance_criteria,
          context_files: t.context_files,
          context_summary: t.context_summary,
          created_at: t.created_at,
          completed_at: t.completed_at,
          result: t.result ? {
            success: t.result.success,
            summary: t.result.summary,
            files_modified: t.result.files_modified,
            files_created: t.result.files_created,
            files_deleted: t.result.files_deleted,
            follow_up_tasks: t.result.follow_up_tasks,
          } : null,
        });

        // Get dependency tasks
        const dependencies: ReturnType<typeof formatTaskContext>[] = [];
        if (includeDeps && task.depends_on.length > 0) {
          for (const depId of task.depends_on) {
            const depTask = db.getTask(depId);
            if (depTask) {
              dependencies.push(formatTaskContext(depTask));
            }
          }
        }

        // Get dependent tasks (tasks that depend on this one)
        const dependents: ReturnType<typeof formatTaskContext>[] = [];
        if (includeDependents) {
          // Find tasks where depends_on includes this task's ID
          const allTasks = db.listTasks({ limit: 100, offset: 0 });
          for (const t of allTasks) {
            if (t.depends_on.includes(task.id)) {
              dependents.push(formatTaskContext(t));
            }
          }
        }

        // Collect all files touched across the task chain
        const allFilesTouched = new Set<string>();
        const addFiles = (t: typeof task) => {
          t.context_files.forEach(f => allFilesTouched.add(f));
          if (t.result) {
            t.result.files_modified.forEach(f => allFilesTouched.add(f));
            t.result.files_created.forEach(f => allFilesTouched.add(f));
          }
        };
        addFiles(task);
        dependencies.forEach(d => {
          const fullTask = db.getTask(d.id);
          if (fullTask) addFiles(fullTask);
        });

        // Log the context load event
        db.logEvent({
          agent: agentRole,
          event_type: 'task_context_loaded',
          task_id: task.id,
          payload: {
            dependencies_loaded: dependencies.length,
            dependents_loaded: dependents.length,
          },
        });

        return {
          task: formatTaskContext(task),
          dependencies,
          dependents,
          all_files_touched: Array.from(allFilesTouched).sort(),
          summary: {
            task_status: task.status,
            has_result: !!task.result,
            dependency_count: dependencies.length,
            dependent_count: dependents.length,
            total_files: allFilesTouched.size,
          },
        };
      },
    },
  };
}
