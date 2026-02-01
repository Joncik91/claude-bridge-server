import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type {
  Task,
  TaskResult,
  TaskStatus,
  Priority,
  Category,
  AgentRole,
  ProjectState,
  Decision,
  EventLogEntry,
  ClarificationRequest,
  SessionContext,
} from './types.js';

// Database row types (JSON fields stored as strings)
interface TaskRow {
  id: string;
  sequence: number;
  priority: string;
  category: string;
  status: string;
  title: string;
  instructions: string;
  acceptance_criteria: string | null;
  context_files: string | null;
  context_summary: string | null;
  related_tasks: string | null;
  depends_on: string | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  claimed_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result: string | null;
}

interface ProjectStateRow {
  id: number;
  current_focus: string | null;
  recent_decisions: string | null;
  known_issues: string | null;
  last_sync: string | null;
}

interface EventLogRow {
  id: number;
  timestamp: string;
  agent: string;
  event_type: string;
  task_id: string | null;
  payload: string | null;
}

interface ClarificationRow {
  id: string;
  task_id: string;
  question: string;
  options: string | null;
  response: string | null;
  created_at: string;
  responded_at: string | null;
}

interface SessionRow {
  id: string;
  agent: string;
  project_path: string;
  current_task_id: string | null;
  task_title: string | null;
  working_on: string;
  progress_made: string;
  next_steps: string;
  open_questions: string | null;
  files_in_focus: string | null;
  important_notes: string | null;
  created_at: string;
  resumed_at: string | null;
}

export class BridgeDatabase {
  private db: Database.Database;
  private projectPath: string;

  constructor(dbPath: string, projectPath: string = '') {
    this.db = new Database(dbPath);
    this.projectPath = projectPath;
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.initialize();
  }

  private initialize(): void {
    // Tasks table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        sequence INTEGER,
        priority TEXT CHECK(priority IN ('critical','high','normal','low')) DEFAULT 'normal',
        category TEXT CHECK(category IN ('feature','bugfix','refactor','research','test','docs')) DEFAULT 'feature',
        status TEXT CHECK(status IN ('queued','claimed','in_progress','blocked','completed','failed','cancelled')) DEFAULT 'queued',
        title TEXT NOT NULL,
        instructions TEXT NOT NULL,
        acceptance_criteria TEXT,
        context_files TEXT,
        context_summary TEXT,
        related_tasks TEXT,
        depends_on TEXT,
        created_by TEXT NOT NULL,
        assigned_to TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        claimed_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        result TEXT
      )
    `);

    // Sequence counter for task ordering
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sequence_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        value INTEGER DEFAULT 0
      )
    `);
    this.db.exec(`INSERT OR IGNORE INTO sequence_counter (id, value) VALUES (1, 0)`);

    // Project state singleton
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS project_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_focus TEXT,
        recent_decisions TEXT,
        known_issues TEXT,
        last_sync TEXT
      )
    `);
    this.db.exec(`
      INSERT OR IGNORE INTO project_state (id, recent_decisions, known_issues)
      VALUES (1, '[]', '[]')
    `);

    // Event log for audit trail
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS event_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT DEFAULT (datetime('now')),
        agent TEXT NOT NULL,
        event_type TEXT NOT NULL,
        task_id TEXT,
        payload TEXT
      )
    `);

    // Clarification requests
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS clarifications (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        question TEXT NOT NULL,
        options TEXT,
        response TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        responded_at TEXT,
        FOREIGN KEY (task_id) REFERENCES tasks(id)
      )
    `);

    // Session contexts for pause/resume
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent TEXT NOT NULL,
        project_path TEXT NOT NULL,
        current_task_id TEXT,
        task_title TEXT,
        working_on TEXT NOT NULL,
        progress_made TEXT NOT NULL,
        next_steps TEXT NOT NULL,
        open_questions TEXT,
        files_in_focus TEXT,
        important_notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        resumed_at TEXT,
        FOREIGN KEY (current_task_id) REFERENCES tasks(id)
      )
    `);

    // Indexes
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON event_log(timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_events_task ON event_log(task_id)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_path)`);
  }

  // Helper to get next sequence number
  private nextSequence(): number {
    const stmt = this.db.prepare(`UPDATE sequence_counter SET value = value + 1 WHERE id = 1 RETURNING value`);
    const row = stmt.get() as { value: number };
    return row.value;
  }

  // Convert database row to Task object
  private rowToTask(row: TaskRow): Task {
    return {
      id: row.id,
      sequence: row.sequence,
      priority: row.priority as Priority,
      category: row.category as Category,
      status: row.status as TaskStatus,
      title: row.title,
      instructions: row.instructions,
      acceptance_criteria: row.acceptance_criteria ? JSON.parse(row.acceptance_criteria) : [],
      context_files: row.context_files ? JSON.parse(row.context_files) : [],
      context_summary: row.context_summary,
      related_tasks: row.related_tasks ? JSON.parse(row.related_tasks) : [],
      depends_on: row.depends_on ? JSON.parse(row.depends_on) : [],
      created_by: row.created_by as AgentRole,
      assigned_to: row.assigned_to as AgentRole | null,
      created_at: row.created_at,
      claimed_at: row.claimed_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      result: row.result ? JSON.parse(row.result) : null,
    };
  }

  // Convert database row to SessionContext
  private rowToSession(row: SessionRow): SessionContext {
    return {
      id: row.id,
      agent: row.agent as AgentRole,
      project_path: row.project_path,
      current_task_id: row.current_task_id,
      task_title: row.task_title,
      working_on: row.working_on,
      progress_made: row.progress_made,
      next_steps: row.next_steps,
      open_questions: row.open_questions ? JSON.parse(row.open_questions) : [],
      files_in_focus: row.files_in_focus ? JSON.parse(row.files_in_focus) : [],
      important_notes: row.important_notes || '',
      created_at: row.created_at,
      resumed_at: row.resumed_at,
    };
  }

  // ==================== TASK OPERATIONS ====================

  createTask(params: {
    title: string;
    instructions: string;
    acceptance_criteria: string[];
    priority?: Priority;
    category?: Category;
    context_files?: string[];
    context_summary?: string;
    depends_on?: string[];
    created_by: AgentRole;
    assigned_to?: AgentRole | null;
  }): Task {
    const id = uuidv4();
    const sequence = this.nextSequence();

    const stmt = this.db.prepare(`
      INSERT INTO tasks (
        id, sequence, priority, category, status, title, instructions,
        acceptance_criteria, context_files, context_summary, depends_on,
        created_by, assigned_to
      ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      sequence,
      params.priority || 'normal',
      params.category || 'feature',
      params.title,
      params.instructions,
      JSON.stringify(params.acceptance_criteria),
      JSON.stringify(params.context_files || []),
      params.context_summary || null,
      JSON.stringify(params.depends_on || []),
      params.created_by,
      params.assigned_to || null
    );

    return this.getTask(id)!;
  }

  getTask(id: string): Task | null {
    const stmt = this.db.prepare(`SELECT * FROM tasks WHERE id = ?`);
    const row = stmt.get(id) as TaskRow | undefined;
    return row ? this.rowToTask(row) : null;
  }

  updateTask(id: string, updates: Partial<{
    title: string;
    instructions: string;
    acceptance_criteria: string[];
    priority: Priority;
    category: Category;
    status: TaskStatus;
    context_files: string[];
    context_summary: string | null;
    assigned_to: AgentRole | null;
    claimed_at: string | null;
    started_at: string | null;
    completed_at: string | null;
    result: TaskResult | null;
  }>): boolean {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        if (['acceptance_criteria', 'context_files', 'result'].includes(key)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (fields.length === 0) return false;

    values.push(id);
    const stmt = this.db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  listTasks(params: {
    status?: TaskStatus | TaskStatus[];
    assigned_to?: AgentRole;
    limit?: number;
  } = {}): Task[] {
    let query = `SELECT * FROM tasks WHERE 1=1`;
    const queryParams: unknown[] = [];

    if (params.status) {
      if (Array.isArray(params.status)) {
        query += ` AND status IN (${params.status.map(() => '?').join(',')})`;
        queryParams.push(...params.status);
      } else {
        query += ` AND status = ?`;
        queryParams.push(params.status);
      }
    }

    if (params.assigned_to) {
      query += ` AND assigned_to = ?`;
      queryParams.push(params.assigned_to);
    }

    query += ` ORDER BY
      CASE priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      sequence ASC`;

    if (params.limit) {
      query += ` LIMIT ?`;
      queryParams.push(params.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...queryParams) as TaskRow[];
    return rows.map(row => this.rowToTask(row));
  }

  // Get next available task (respects dependencies)
  pullNextTask(params: {
    categories?: Category[];
    assigned_to?: AgentRole;
  } = {}): Task | null {
    // Get all queued tasks
    let query = `SELECT * FROM tasks WHERE status = 'queued'`;
    const queryParams: unknown[] = [];

    if (params.categories && params.categories.length > 0) {
      query += ` AND category IN (${params.categories.map(() => '?').join(',')})`;
      queryParams.push(...params.categories);
    }

    if (params.assigned_to) {
      query += ` AND (assigned_to = ? OR assigned_to IS NULL)`;
      queryParams.push(params.assigned_to);
    }

    query += ` ORDER BY
      CASE priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      sequence ASC`;

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...queryParams) as TaskRow[];
    const tasks = rows.map(row => this.rowToTask(row));

    // Find first task with all dependencies completed
    for (const task of tasks) {
      if (task.depends_on.length === 0) {
        return task;
      }

      // Check if all dependencies are completed
      const depCheck = this.db.prepare(`
        SELECT COUNT(*) as count FROM tasks
        WHERE id IN (${task.depends_on.map(() => '?').join(',')})
        AND status != 'completed'
      `);
      const result = depCheck.get(...task.depends_on) as { count: number };
      if (result.count === 0) {
        return task;
      }
    }

    return null;
  }

  getTaskCountsByStatus(): Record<TaskStatus, number> {
    const stmt = this.db.prepare(`SELECT status, COUNT(*) as count FROM tasks GROUP BY status`);
    const rows = stmt.all() as { status: string; count: number }[];

    const counts: Record<TaskStatus, number> = {
      queued: 0,
      claimed: 0,
      in_progress: 0,
      blocked: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const row of rows) {
      counts[row.status as TaskStatus] = row.count;
    }

    return counts;
  }

  getTaskHistory(params: {
    since?: string;
    limit?: number;
    category?: Category;
  } = {}): Task[] {
    let query = `SELECT * FROM tasks WHERE status IN ('completed', 'failed', 'cancelled')`;
    const queryParams: unknown[] = [];

    if (params.since) {
      query += ` AND completed_at >= ?`;
      queryParams.push(params.since);
    }

    if (params.category) {
      query += ` AND category = ?`;
      queryParams.push(params.category);
    }

    query += ` ORDER BY completed_at DESC`;

    if (params.limit) {
      query += ` LIMIT ?`;
      queryParams.push(params.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...queryParams) as TaskRow[];
    return rows.map(row => this.rowToTask(row));
  }

  getQueuePosition(taskId: string): number {
    const task = this.getTask(taskId);
    if (!task || task.status !== 'queued') return -1;

    const stmt = this.db.prepare(`
      SELECT COUNT(*) as position FROM tasks
      WHERE status = 'queued'
      AND (
        CASE priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END < CASE ?
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END
        OR (priority = ? AND sequence < ?)
      )
    `);
    const result = stmt.get(task.priority, task.priority, task.sequence) as { position: number };
    return result.position + 1;
  }

  // ==================== SESSION CONTEXT ====================

  saveSessionContext(params: {
    agent: AgentRole;
    current_task_id?: string;
    working_on: string;
    progress_made: string;
    next_steps: string;
    open_questions?: string[];
    files_in_focus?: string[];
    important_notes?: string;
  }): SessionContext {
    const id = uuidv4();

    // Get task title if task ID provided
    let taskTitle: string | null = null;
    if (params.current_task_id) {
      const task = this.getTask(params.current_task_id);
      taskTitle = task?.title || null;
    }

    const stmt = this.db.prepare(`
      INSERT INTO sessions (
        id, agent, project_path, current_task_id, task_title,
        working_on, progress_made, next_steps,
        open_questions, files_in_focus, important_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      params.agent,
      this.projectPath,
      params.current_task_id || null,
      taskTitle,
      params.working_on,
      params.progress_made,
      params.next_steps,
      JSON.stringify(params.open_questions || []),
      JSON.stringify(params.files_in_focus || []),
      params.important_notes || null
    );

    return this.getSessionContext(id)!;
  }

  getSessionContext(id: string): SessionContext | null {
    const stmt = this.db.prepare(`SELECT * FROM sessions WHERE id = ?`);
    const row = stmt.get(id) as SessionRow | undefined;
    return row ? this.rowToSession(row) : null;
  }

  getLatestSessionContext(agent: AgentRole): SessionContext | null {
    const stmt = this.db.prepare(`
      SELECT * FROM sessions
      WHERE agent = ? AND project_path = ? AND resumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const row = stmt.get(agent, this.projectPath) as SessionRow | undefined;
    return row ? this.rowToSession(row) : null;
  }

  listSessionContexts(params: {
    agent?: AgentRole;
    include_resumed?: boolean;
    limit?: number;
  } = {}): SessionContext[] {
    let query = `SELECT * FROM sessions WHERE project_path = ?`;
    const queryParams: unknown[] = [this.projectPath];

    if (params.agent) {
      query += ` AND agent = ?`;
      queryParams.push(params.agent);
    }

    if (!params.include_resumed) {
      query += ` AND resumed_at IS NULL`;
    }

    query += ` ORDER BY created_at DESC`;

    if (params.limit) {
      query += ` LIMIT ?`;
      queryParams.push(params.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...queryParams) as SessionRow[];
    return rows.map(row => this.rowToSession(row));
  }

  markSessionResumed(id: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE sessions SET resumed_at = datetime('now') WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  // ==================== PROJECT STATE ====================

  getProjectState(): ProjectState {
    const stmt = this.db.prepare(`SELECT * FROM project_state WHERE id = 1`);
    const row = stmt.get() as ProjectStateRow;
    return {
      current_focus: row.current_focus,
      recent_decisions: row.recent_decisions ? JSON.parse(row.recent_decisions) : [],
      known_issues: row.known_issues ? JSON.parse(row.known_issues) : [],
      last_sync: row.last_sync,
    };
  }

  updateProjectState(updates: Partial<{
    current_focus: string | null;
    known_issues: string[];
    last_sync: string;
  }>): boolean {
    const fields: string[] = [];
    const values: unknown[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'known_issues') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (fields.length === 0) return false;

    const stmt = this.db.prepare(`UPDATE project_state SET ${fields.join(', ')} WHERE id = 1`);
    const result = stmt.run(...values);
    return result.changes > 0;
  }

  addDecision(params: {
    summary: string;
    rationale: string;
    made_by: AgentRole | 'human';
    affects_files?: string[];
  }): Decision {
    const decision: Decision = {
      id: uuidv4(),
      summary: params.summary,
      rationale: params.rationale,
      made_by: params.made_by,
      made_at: new Date().toISOString(),
      affects_files: params.affects_files || [],
    };

    const state = this.getProjectState();
    const decisions = [...state.recent_decisions, decision].slice(-50); // Keep last 50

    const stmt = this.db.prepare(`UPDATE project_state SET recent_decisions = ? WHERE id = 1`);
    stmt.run(JSON.stringify(decisions));

    return decision;
  }

  // ==================== CLARIFICATIONS ====================

  createClarification(params: {
    task_id: string;
    question: string;
    options?: string[];
  }): ClarificationRequest {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO clarifications (id, task_id, question, options)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, params.task_id, params.question, params.options ? JSON.stringify(params.options) : null);

    return {
      id,
      task_id: params.task_id,
      question: params.question,
      options: params.options || null,
      response: null,
      created_at: new Date().toISOString(),
      responded_at: null,
    };
  }

  getPendingClarifications(): ClarificationRequest[] {
    const stmt = this.db.prepare(`SELECT * FROM clarifications WHERE response IS NULL ORDER BY created_at ASC`);
    const rows = stmt.all() as ClarificationRow[];
    return rows.map(row => ({
      id: row.id,
      task_id: row.task_id,
      question: row.question,
      options: row.options ? JSON.parse(row.options) : null,
      response: row.response,
      created_at: row.created_at,
      responded_at: row.responded_at,
    }));
  }

  respondToClarification(id: string, response: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE clarifications
      SET response = ?, responded_at = datetime('now')
      WHERE id = ?
    `);
    const result = stmt.run(response, id);
    return result.changes > 0;
  }

  // ==================== EVENT LOG ====================

  logEvent(params: {
    agent: AgentRole;
    event_type: string;
    task_id?: string;
    payload?: Record<string, unknown>;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO event_log (agent, event_type, task_id, payload)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(
      params.agent,
      params.event_type,
      params.task_id || null,
      params.payload ? JSON.stringify(params.payload) : null
    );
  }

  getEvents(params: {
    since?: string;
    task_id?: string;
    limit?: number;
  } = {}): EventLogEntry[] {
    let query = `SELECT * FROM event_log WHERE 1=1`;
    const queryParams: unknown[] = [];

    if (params.since) {
      query += ` AND timestamp >= ?`;
      queryParams.push(params.since);
    }

    if (params.task_id) {
      query += ` AND task_id = ?`;
      queryParams.push(params.task_id);
    }

    query += ` ORDER BY timestamp DESC`;

    if (params.limit) {
      query += ` LIMIT ?`;
      queryParams.push(params.limit);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...queryParams) as EventLogRow[];
    return rows.map(row => ({
      id: row.id,
      timestamp: row.timestamp,
      agent: row.agent as AgentRole,
      event_type: row.event_type,
      task_id: row.task_id,
      payload: row.payload ? JSON.parse(row.payload) : {},
    }));
  }

  close(): void {
    this.db.close();
  }
}
