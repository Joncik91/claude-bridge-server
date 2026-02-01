# Claude Bridge - User Guide

A comprehensive guide to coordinating two Claude Code terminals working together on your projects.

---

## Table of Contents

1. [What Is This?](#what-is-this)
2. [Installation](#installation)
3. [Using the Bridge](#using-the-bridge)
4. [Task Management](#task-management)
5. [Saving Your Place](#saving-your-place)
6. [Clarification Flow](#clarification-flow)
7. [Decisions and Shared Memory](#decisions-and-shared-memory)
8. [Typical Workflows](#typical-workflows)
9. [Command Reference](#command-reference)
10. [Tips for Best Results](#tips-for-best-results)
11. [Troubleshooting](#troubleshooting)
12. [FAQ](#faq)

---

## What Is This?

Claude Bridge lets two Claude Code instances communicate through a shared task queue. Think of it like a to-do list that both can see:

- **You** give tasks to the Architect (your main Claude terminal)
- **Architect** breaks down complex work and puts tasks in the queue
- **Executor** (your second Claude terminal) picks up tasks and does the work
- **Both** can see what's been done and share important decisions

No more copy-pasting between terminals. No more "what did the other one do?"

### The Two Roles

| Role | Purpose | Typical Model |
|------|---------|---------------|
| **Architect** | Planning, design decisions, task creation, code review | Claude Opus, Sonnet |
| **Executor** | Implementation, coding, research, execution | Claude Sonnet, Haiku, or other models |

You can use any models you want. The bridge doesn't care - it just passes tasks between terminals.

---

## Installation

### Prerequisites

- **Node.js 18+** installed
- **Claude Code** CLI installed and working
- **Two terminal windows** (or ability to open two)

### Step 1: Get the Code

Clone or download this repository to a permanent location:

```bash
# Example locations:
# Windows: C:\Users\YourName\.claude-bridge-server
# macOS:   ~/.claude-bridge-server
# Linux:   ~/.claude-bridge-server

git clone https://github.com/yourusername/claude-bridge-server.git ~/.claude-bridge-server
cd ~/.claude-bridge-server
```

### Step 2: Build the Server

**Windows:**
```cmd
setup.bat
```

**macOS/Linux:**
```bash
chmod +x setup.sh
./setup.sh
```

Wait for "Setup complete!" - this installs dependencies and compiles TypeScript.

### Step 3: Configure Claude Code

Add to your Claude settings file:

**Location of settings file:**
- Project-specific: `<your-project>/.claude/settings.json`
- User-wide: `~/.claude/settings.json` (macOS/Linux) or `%USERPROFILE%\.claude\settings.json` (Windows)

**Add this configuration:**
```json
{
  "mcpServers": {
    "claude-bridge": {
      "command": "node",
      "args": ["<FULL_PATH_TO>/claude-bridge-server/server/dist/index.js"]
    }
  }
}
```

**Important:** Replace `<FULL_PATH_TO>` with the actual absolute path. Examples:
- Windows: `C:\\Users\\YourName\\.claude-bridge-server\\server\\dist\\index.js`
- macOS/Linux: `/Users/yourname/.claude-bridge-server/server/dist/index.js`

### Step 4: Set Up Agent Roles

The bridge can detect which terminal is which via an environment variable. This is optional but recommended.

**Windows PowerShell:**

Edit your PowerShell profile (`notepad $PROFILE`):

```powershell
# Add at the end of your profile:

# Default mode for your main terminal
$env:CLAUDE_BRIDGE_MODE = "architect"

# If you have a function to switch models, add executor mode there:
# function use-other-model {
#     $env:CLAUDE_BRIDGE_MODE = "executor"
#     # ... your other setup
# }
```

**macOS/Linux:**

Edit `~/.bashrc`, `~/.zshrc`, or equivalent:

```bash
# Default mode for your main terminal
export CLAUDE_BRIDGE_MODE="architect"

# If you have aliases/functions for other models:
# alias use-executor='export CLAUDE_BRIDGE_MODE="executor" && ...'
```

### Step 5: Initialize Your Project

For each project you want to use the bridge with:

**Windows:**
```cmd
cd C:\path\to\your\project
<FULL_PATH_TO>\claude-bridge-server\init-project.bat
```

**macOS/Linux:**
```bash
cd /path/to/your/project
<FULL_PATH_TO>/claude-bridge-server/init-project.sh
```

This creates a `.claude-bridge/` folder with the project's database.

### Step 6: Restart Claude Code

Close and reopen both Claude terminals to load the MCP server.

Verify it's working by running `/mcp` - you should see `claude-bridge` listed.

---

## Using the Bridge

### As the Architect (Terminal 1)

**Creating a task:**

> You: "Push a task to add input validation to the login form"
>
> Claude: *creates the task with instructions, acceptance criteria, etc.*
>
> "Task created! The Executor can now pick it up."

**Checking the queue:**

> You: "What tasks are in the queue?"
>
> Claude: "There are 3 tasks: 1 in progress, 2 waiting."

**Reviewing completed work:**

> You: "What did the Executor finish?"
>
> Claude: "Completed 2 tasks today. Here's what was done..."

**Pushing multiple tasks:**

> You: "Push these tasks in sequence: 1) Add user model, 2) Add user API endpoints, 3) Add user tests"
>
> Claude: *creates 3 tasks with dependencies so they run in order*

### As the Executor (Terminal 2)

**Getting work:**

> You: "Pull the next task"
>
> Claude: "Got task: Add input validation to login form. Let me work on it."
> *reads context files, implements the feature*

**Reporting progress:**

> You: "Report progress on the current task"
>
> Claude: *updates task status with current progress*

**Completing work:**

> You: "Mark the task complete"
>
> Claude: "Task completed! Modified 3 files, added 2 tests."

**Asking for help:**

> You: "Request clarification: Should validation happen client-side or server-side?"
>
> Claude: *blocks task, creates clarification request*
> "Question sent to Architect. Task is blocked until they respond."

---

## Task Management

### Task Structure

When pushing a task, include:

| Field | Purpose | Example |
|-------|---------|---------|
| `title` | Short description | "Add retry logic to API client" |
| `instructions` | Detailed what-to-do | "Implement exponential backoff..." |
| `acceptance_criteria` | Definition of "done" | ["Retries 3 times", "Logs attempts"] |
| `context_files` | Files to read first | ["src/api/client.ts"] |
| `context_summary` | Why this matters | "Users seeing intermittent failures" |
| `priority` | Urgency level | "high" |
| `category` | Type of work | "feature" |

### Priority Levels

| Priority | When to Use |
|----------|-------------|
| `critical` | Production is broken, drop everything |
| `high` | Important, do soon |
| `normal` | Standard work (default) |
| `low` | Nice to have, when time permits |

Tasks are pulled in priority order (critical first).

### Categories

| Category | Use For |
|----------|---------|
| `feature` | New functionality |
| `bugfix` | Fixing broken behavior |
| `refactor` | Code improvement without behavior change |
| `research` | Investigation, exploration |
| `test` | Adding or fixing tests |
| `docs` | Documentation |

### Task Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌───────────┐
│ queued  │────►│ claimed │────►│ in_progress │────►│ completed │
└─────────┘     └─────────┘     └─────────────┘     └───────────┘
                                       │
                                       ▼
                                 ┌─────────┐
                                 │ blocked │ (waiting for clarification)
                                 └─────────┘
```

### Task Dependencies

You can make tasks depend on each other:

> "Push these tasks sequentially: First create the database schema, then create the API endpoints, then create the tests"

The bridge automatically sets up dependencies so task 2 waits for task 1, task 3 waits for task 2, etc.

---

## Saving Your Place

The bridge provides two ways to preserve context across sessions:

### 1. Project State (Shared) - Use This Most of the Time

Project state is **shared between both terminals**. Either agent can update it, and both can read it.

**To save (from either terminal):**
> You: "Update project state: working on auth refactor, blocked on API design decision"
>
> Claude: *updates shared state*

**To check (from either terminal):**
> You: "What's the current project state?"
>
> Claude: "Current focus: Auth refactor. Known issues: Blocked on API design decision."

This is your **primary tool** for continuity. One save, both terminals see it.

### 2. Session Context (Per-Agent) - For Complex Situations

Session context is **specific to each terminal**. Use it when an agent is mid-task with lots of working state.

**To save:**
> You: "Save my context"
>
> Claude: Saves what this agent was doing, files in focus, next steps, open questions

**To load:**
> You: "Load my previous context"
>
> Claude: Restores this agent's previous working state

### When to Use Each

| Situation | What to Use |
|-----------|-------------|
| End of day, clean stopping point | Project state (shared) |
| Switching focus, need to remember direction | Project state (shared) |
| Mid-task, complex debugging, lots of context | Session context (per-agent) |
| Agent has specific files/decisions in flight | Session context (per-agent) |

**Most users only need project state.** Session context is for edge cases.

### Viewing Past Sessions

> You: "Show me my recent sessions"
>
> Claude: Lists your saved sessions with timestamps and summaries

---

## Clarification Flow

When the Executor needs help:

### Executor Asks

> Executor: "Request clarification: The login form has two submit buttons - which one should I add validation to?"
>
> Claude: *creates clarification request, blocks the task*
> "Question sent. Task blocked until Architect responds."

### Architect Sees and Responds

> Architect: "Any clarification requests?"
>
> Claude: "Yes, 1 pending: 'The login form has two submit buttons - which one should I add validation to?'"
>
> Architect: "Respond: Add validation to both buttons - they both submit the same form"
>
> Claude: *records response, unblocks the task*

### Executor Continues

The task is automatically unblocked. Next time Executor checks, they'll see the response and can continue.

---

## Decisions and Shared Memory

Both agents can log important decisions for shared context:

> "Log decision: Using SQLite instead of PostgreSQL because this is a single-user app and simplicity wins"
>
> Claude: *records decision with timestamp*

View recent decisions:

> "What decisions have been made?"
>
> Claude: Lists recent decisions with rationale

This creates institutional memory - both agents know "why we did it this way" without re-explaining.

---

## Typical Workflows

### Feature Development

```
1. Architect: "Push a task to add user profile page"
   - Includes acceptance criteria, relevant files

2. Executor: "Pull the next task"
   - Reads context files
   - Implements feature
   - "Complete the task"

3. Architect: "Review what was done"
   - Checks implementation
   - May push follow-up tasks
```

### Research Task

```
1. Architect: "Push a research task to analyze how error handling works in the codebase"

2. Executor: "Pull the next task"
   - Explores codebase
   - Documents findings
   - "Complete the task with summary"

3. Architect: Sees findings in executor's terminal
   - Makes architectural decisions based on research
```

### Bug Investigation

```
1. Architect: "Push a task to investigate why login fails intermittently"

2. Executor: "Pull the next task"
   - Investigates
   - "Request clarification: I found two potential causes - race condition in session handling or timeout in auth API. Which should I investigate first?"

3. Architect: "Respond: Focus on the race condition first, that's more likely"

4. Executor: Continues with direction
   - Finds root cause
   - "Complete the task"
```

### End of Day

```
1. Either terminal: "Update project state: Finished auth module, next is payment integration"

2. Close terminals

3. Next day, either terminal: "What's the project state?"
   - Immediately know where you left off
```

---

## Command Reference

### Architect Terminal

| What You Want | What to Say |
|---------------|-------------|
| Create a task | "Push a task to [description]" |
| Create multiple tasks | "Push these tasks: 1) X, 2) Y, 3) Z" |
| See the queue | "List all tasks" or "What's in the queue?" |
| Check progress | "What's being worked on?" |
| See finished work | "Show completed tasks" |
| Cancel something | "Cancel the task about [description]" |
| Answer a question | "Respond to the clarification: [answer]" |
| Log a decision | "Log decision: [what and why]" |

### Executor Terminal

| What You Want | What to Say |
|---------------|-------------|
| Get work | "Pull the next task" |
| See task details | "Show current task details" |
| Update status | "Report progress: [what's done]" |
| Finish up | "Complete the task" or "Mark task done" |
| Give up | "Fail this task: [reason]" |
| Ask for help | "Request clarification: [question]" |
| Log a decision | "Log decision: [what and why]" |

### Either Terminal (Shared)

| What You Want | What to Say |
|---------------|-------------|
| Save project focus | "Update project state: [current focus]" |
| Check project state | "What's the project state?" |
| View decisions | "What decisions have been made?" |
| Save agent's working state | "Save my context" |
| Load agent's working state | "Load my previous context" |
| View session history | "Show my recent sessions" |

---

## Tips for Best Results

### 1. Be Specific in Task Descriptions

The Executor doesn't have your conversation history. Include all context in the task.

**Bad:** "Fix the bug"
**Good:** "Fix the null pointer exception in UserService.getProfile() when user has no avatar set. See error logs in context_summary."

### 2. Use Acceptance Criteria

Tell the Executor exactly what "done" looks like.

```
acceptance_criteria: [
  "Profile page loads without errors",
  "Avatar displays correctly (or placeholder if none)",
  "Edit button navigates to edit page",
  "All existing tests pass"
]
```

### 3. Reference Files, Don't Embed Content

List files in `context_files`. The Executor will read them. This saves tokens and keeps tasks concise.

**Bad:** "Here's the current code: [500 lines]..."
**Good:** `context_files: ["src/services/UserService.ts", "src/models/User.ts"]`

### 4. Update Project State Before Breaks

One quick update from either terminal. Both agents see it when you return.

### 5. Log Important Decisions

Both agents can record decisions. This creates shared memory of "why we did it this way."

### 6. Push Research to the Executor

If you need codebase exploration, make it a task. Let the Executor do the heavy lifting while you focus on decisions.

### 7. Batch Related Tasks

Use sequential task pushing for related work:

> "Push these tasks sequentially: 1) Create user model, 2) Create user repository, 3) Create user service, 4) Create user controller"

### 8. Check In Periodically

Review completed tasks to make sure things are going in the right direction. Course-correct early.

---

## Troubleshooting

### "The tools aren't showing up"

1. Make sure `setup.bat` or `setup.sh` completed successfully (look for "Setup complete!")
2. Verify the path in `settings.json` is correct and absolute
3. Check the path uses correct separators (Windows: `\\`, Unix: `/`)
4. Restart Claude Code completely (close and reopen terminal)
5. Run `/mcp` to check if the server is listed

### "Getting database errors"

Usually means two processes tried to write simultaneously (rare with SQLite's locking).
- Just retry the operation
- If persistent, check if multiple Claude instances are using different `.claude-bridge` folders

### "Session not loading"

- Make sure you're in the same project directory
- Project state and sessions are project-specific
- Check `bridge_list_sessions` to see available sessions
- Verify you're loading the right type (project state vs session context)

### "Task stuck in 'claimed' status"

This happens if the Executor terminal closed mid-task.
- The task needs to be manually completed or failed
- Ask Architect to check and update task status

### "Want to start fresh?"

Delete the `bridge.db` file in your project's `.claude-bridge/` folder:

```bash
rm your-project/.claude-bridge/bridge.db
```

All tasks, sessions, and decisions will be cleared.

---

## FAQ

### Setup & Technical

**"Do I need to run any servers manually?"**
No. Claude Code starts the MCP server automatically when you open the terminal.

**"What if my computer restarts?"**
No problem. Everything is saved to an SQLite database file. Tasks, sessions, and history persist.

**"Where is the data stored?"**
- Server code: Wherever you installed claude-bridge-server
- Project data: `<your-project>/.claude-bridge/bridge.db`

**"Can I use this with multiple projects?"**
Yes! Each project has its own `.claude-bridge/` folder with separate data. Just run `init-project` for each one.

**"How do I update the bridge?"**
Pull the latest code and re-run `setup.bat` or `setup.sh`.

### Tasks

**"What if both Claudes try to work on the same task?"**
Can't happen. When the Executor claims a task, it's locked. The other terminal can't claim it.

**"Can I cancel a task?"**
Yes, but only if it's queued or blocked (not actively being worked on).

**"How do I know which tasks are urgent?"**
Tasks have priorities: critical > high > normal > low. Higher priority gets pulled first.

**"Can the Architect also execute tasks?"**
Technically yes, but it defeats the purpose. The model helps most when roles are separated.

### Context & Sessions

**"Do I need to save in both terminals?"**
No. Use **project state** (shared) for most cases - save from either terminal, both can read it. Only use per-agent session context if you have complex mid-task state to preserve.

**"What's the difference between project state and session context?"**
- **Project state:** Shared, lightweight, tracks "where is the project?"
- **Session context:** Per-agent, detailed, tracks "where was this agent specifically?"

**"What if I forget to save?"**
Task history is always preserved. You can review completed tasks anytime. Explicit saves add richer context about intent and next steps.

**"Can I have multiple saved sessions?"**
Yes. By default, loading gets the most recent one. Use `bridge_list_sessions` to see all.

### Clarifications

**"What if the Executor gets confused about a task?"**
Use `bridge_request_clarification`. This pauses the task until the Architect answers.

**"How do I see pending questions?"**
Ask: "Any clarification requests?" or "Check for pending clarifications"

**"What if I don't answer a clarification?"**
The task stays blocked. The Executor can work on other tasks in the meantime.

---

## Need Help?

- **Issues:** Report bugs or suggest features on GitHub
- **Documentation:** Check README.md for quick reference
- **Source Code:** Review the TypeScript source in `server/src/`

---

That's it! The bridge handles all the technical coordination. You just tell Claude what you want in plain English.
