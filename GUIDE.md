# Claude Bridge - User Guide

Complete documentation for setting up and using Claude Bridge to coordinate work between Claude Code and Z.ai GLM.

---

## Table of Contents

1. [Overview](#overview)
2. [Installation](#installation)
3. [Terminal Profile Setup](#terminal-profile-setup)
4. [Starting Your First Session](#starting-your-first-session)
5. [Using the Bridge](#using-the-bridge)
6. [Task Management](#task-management)
7. [Token-Conscious Design](#token-conscious-design)
8. [Best Practices](#best-practices)
9. [Saving Your Place](#saving-your-place)
10. [Clarification Flow](#clarification-flow)
11. [Decisions and Shared Memory](#decisions-and-shared-memory)
12. [Typical Workflows](#typical-workflows)
13. [Command Reference](#command-reference)
14. [Tool Reference](#tool-reference)
15. [Project Structure](#project-structure)
16. [Troubleshooting](#troubleshooting)
17. [FAQ](#faq)

---

## Overview

Claude Bridge connects two Claude Code terminals through a shared task queue:

- **Architect** (Claude Opus) — Plans features, designs architecture, reviews work
- **Executor** (Z.ai GLM) — Implements code, runs research, executes tasks

The bridge passes tasks between them, tracks state, and enables async communication — all without copy-pasting.

### Why Combine Claude + GLM?

| Role | Model | Why |
|------|-------|-----|
| Architect | Claude Opus | Your existing Claude subscription |
| Executor | Z.ai GLM | Similar capability, fraction of the cost |

Running two Claude subscriptions for parallel work gets expensive. GLM offers similar coding capability at lower cost — so you get parallel agents without paying double.

### When to Use the Bridge

The bridge is useful for **ad-hoc coordination** between terminals. However, if you're using a **planning framework** like [Get-Shit-Done (GSD)](https://github.com/cyanheads/get-shit-done), the bridge becomes unnecessary.

**Why?** Frameworks like GSD store context in project files (`.planning/`) that both terminals can read:

| GSD Approach | Bridge Approach |
|--------------|-----------------|
| Context lives in `.planning/` files | Context lives in bridge queue |
| Both terminals read/write same files | Tasks passed through MCP server |
| `/gsd:plan-phase` in Opus terminal | `bridge_push_task` from Opus |
| `/gsd:execute-phase` in GLM terminal | `bridge_pull_task` from GLM |
| Files ARE the shared state | Queue IS the shared state |

**Use the bridge for:**
- Ad-hoc tasks, quick fixes, one-off requests
- Research tasks without structured planning
- Session continuity (`save_context` / `load_context`)
- Projects without a planning framework

**Skip the bridge if:**
- Using GSD or similar file-based frameworks
- Structured planning with phases and roadmaps
- Both terminals share the project filesystem

---

## Installation

### Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Claude Code CLI** — [claude.ai/code](https://claude.ai/code)
- **Z.ai account** — For GLM access ([z.ai](https://z.ai))
- **Two terminal windows**

### Step 1: Clone and Build

```bash
# Clone to a permanent location
git clone https://github.com/Joncik91/claude-bridge-server.git ~/.claude-bridge-server
cd ~/.claude-bridge-server

# Build the server
./setup.sh          # macOS/Linux
# or
setup.bat           # Windows
```

Wait for "Setup complete!" before proceeding.

### Step 2: Configure Claude Code MCP

Add the bridge as a global MCP server (available in all projects):

**macOS/Linux:**
```bash
claude mcp add --scope user --transport stdio claude-bridge -- node ~/.claude-bridge-server/server/dist/index.js
```

**Windows:**
```powershell
claude mcp add --scope user --transport stdio claude-bridge -- node C:\Users\YourName\.claude-bridge-server\server\dist\index.js
```

Replace `YourName` with your Windows username.

**Verify it's configured:**
```bash
claude mcp list
```

You should see `claude-bridge` listed.

> **Alternative: Per-project setup**
>
> If you prefer project-specific configuration, create `.mcp.json` in your project root:
> ```json
> {
>   "mcpServers": {
>     "claude-bridge": {
>       "command": "node",
>       "args": ["/full/path/to/claude-bridge-server/server/dist/index.js"]
>     }
>   }
> }
> ```

### Step 3: Initialize Your Project

For each project you want to use the bridge with:

```bash
cd /path/to/your/project
~/.claude-bridge-server/init-project.sh     # macOS/Linux
# or
C:\Users\YourName\.claude-bridge-server\init-project.bat   # Windows
```

This creates a `.claude-bridge/` folder with the project database.

---

## Terminal Profile Setup

This is the critical step. You need to configure your shell so you can run both Claude and GLM terminals simultaneously.

- **Terminal 1:** Just run `claude` — uses your normal Claude subscription
- **Terminal 2:** Run `use-glm` first, then run `claude` — uses Z.ai API

### Windows PowerShell

Open your profile:
```powershell
notepad $PROFILE
```

Add this complete configuration:

```powershell
# ============================================================
# CLAUDE CODE - DUAL TERMINAL SETUP
# ============================================================
# Run both Claude and GLM terminals simultaneously:
#
#   Terminal 1: Just run `claude` (uses your Claude subscription)
#   Terminal 2: Run `use-glm`, then `claude` (uses Z.ai API)
#
# The `use-glm` function configures environment variables
# before starting Claude Code. Always start with `claude`.
# ============================================================

function use-max {
    # Resets to default Anthropic settings (your Claude subscription)
    [Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", $null, "Process")
    [Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", $null, "Process")
    [Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", $null, "Process")
    [Environment]::SetEnvironmentVariable("CLAUDE_BRIDGE_MODE", "architect", "Process")
    Write-Host ">>> CLAUDE MAX ACTIVE (Architect mode)" -ForegroundColor Green
}

function use-glm {
    # Configures Z.ai GLM via their Anthropic-compatible API
    $zai_key = "your_zai_api_key_here"  # <-- Replace with your Z.ai API key
    [Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", "https://api.z.ai/api/anthropic", "Process")
    [Environment]::SetEnvironmentVariable("ANTHROPIC_AUTH_TOKEN", $zai_key, "Process")
    [Environment]::SetEnvironmentVariable("ANTHROPIC_MODEL", "glm-4.7", "Process")
    [Environment]::SetEnvironmentVariable("CLAUDE_BRIDGE_MODE", "executor", "Process")
    Write-Host ">>> GLM ACTIVE (Executor mode)" -ForegroundColor Cyan
}

# ============================================================
# WINDOWS PERFORMANCE FIXES (Recommended)
# ============================================================
# These improve Claude Code responsiveness on Windows

$env:CLAUDE_CODE_ENABLE_TASKS = "false"  # Reduces input lag
$env:DISABLE_AUTOUPDATER = "1"           # Prevents update interruptions

# ============================================================
# DEFAULT MODE
# ============================================================
# New terminals default to Architect mode (Claude Max)

$env:CLAUDE_BRIDGE_MODE = "architect"
```

**Important:** Replace `your_zai_api_key_here` with your actual Z.ai API key.

Save and reload:
```powershell
. $PROFILE
```

### macOS/Linux

Edit your shell profile (`~/.bashrc`, `~/.zshrc`, or equivalent):

```bash
# ============================================================
# CLAUDE CODE - DUAL TERMINAL SETUP
# ============================================================
# Run both Claude and GLM terminals simultaneously:
#
#   Terminal 1: Just run `claude` (uses your Claude subscription)
#   Terminal 2: Run `use-glm`, then `claude` (uses Z.ai API)
#
# The `use-glm` function configures environment variables
# before starting Claude Code. Always start with `claude`.
# ============================================================

use-max() {
    # Resets to default Anthropic settings (your Claude subscription)
    unset ANTHROPIC_BASE_URL
    unset ANTHROPIC_AUTH_TOKEN
    unset ANTHROPIC_MODEL
    export CLAUDE_BRIDGE_MODE="architect"
    echo ">>> CLAUDE MAX ACTIVE (Architect mode)"
}

use-glm() {
    # Configures Z.ai GLM via their Anthropic-compatible API
    local zai_key="your_zai_api_key_here"  # <-- Replace with your Z.ai API key
    export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
    export ANTHROPIC_AUTH_TOKEN="$zai_key"
    export ANTHROPIC_MODEL="glm-4.7"
    export CLAUDE_BRIDGE_MODE="executor"
    echo ">>> GLM ACTIVE (Executor mode)"
}

# ============================================================
# DEFAULT MODE
# ============================================================
# New terminals default to Architect mode (Claude Max)

export CLAUDE_BRIDGE_MODE="architect"
```

**Important:** Replace `your_zai_api_key_here` with your actual Z.ai API key.

Reload:
```bash
source ~/.bashrc  # or ~/.zshrc
```

---

## Starting Your First Session

### Terminal 1 (Architect - Claude Max)

```
> claude
```

Just run `claude`. Your profile defaults to Architect mode.

### Terminal 2 (Executor - Z.ai GLM)

```
> use-glm
>>> GLM ACTIVE (Executor mode)
> claude
```

Run `use-glm` first to configure the environment, THEN run `claude`.

### Verify the Bridge

In both terminals:
```
/mcp
```

You should see `claude-bridge` listed.

### Repurposing a Terminal (Optional)

If you need to change a terminal from GLM to Claude (or vice versa):

1. Exit Claude (`exit` or Ctrl+C)
2. Run `use-max` or `use-glm`
3. Run `claude`

Most of the time you'll just keep both terminals running as-is.

---

## Using the Bridge

### As the Architect (Terminal 1)

**Creating a task:**
> "Push a task to add input validation to the login form"

Claude creates the task with instructions, acceptance criteria, and context files.

**Checking the queue:**
> "What tasks are in the queue?"

**Reviewing completed work:**
> "What did the Executor finish?"

**Pushing multiple tasks:**
> "Push these tasks in sequence: 1) Add user model, 2) Add user API endpoints, 3) Add user tests"

### As the Executor (Terminal 2)

**Getting work:**
> "Pull the next task"

Claude reads context files and starts working.

**Reporting progress:**
> "Report progress on the current task"

**Completing work:**
> "Complete the task" or "Mark task done"

**Asking for help:**
> "Request clarification: Should validation happen client-side or server-side?"

This blocks the task until Architect responds.

---

## Task Management

### Task Structure

When pushing a task, include:

| Field | Purpose | Example |
|-------|---------|---------|
| `title` | Short description | "Add retry logic to API" |
| `instructions` | Detailed steps | "Implement exponential backoff..." |
| `acceptance_criteria` | Definition of done | ["Retries 3x", "Logs attempts"] |
| `context_files` | Files to read first | ["src/api/client.ts"] |
| `context_summary` | Why this matters | "Users seeing failures" |
| `priority` | Urgency | "high" |
| `category` | Type of work | "feature" |

### Priority Levels

| Priority | When to Use |
|----------|-------------|
| `critical` | Production broken |
| `high` | Important, do soon |
| `normal` | Standard work (default) |
| `low` | Nice to have |

### Categories

| Category | Use For |
|----------|---------|
| `feature` | New functionality |
| `bugfix` | Fixing bugs |
| `refactor` | Code improvement |
| `research` | Investigation |
| `test` | Test work |
| `docs` | Documentation |

### Task Lifecycle

```
queued → claimed → in_progress → completed
                        ↓
                    blocked (waiting for clarification)
```

### Task Dependencies

> "Push these tasks sequentially: First create schema, then create API, then create tests"

Tasks run in order — each waits for the previous to complete.

---

## Token-Conscious Design

Opus tokens are expensive. GLM tokens are cheap. Design your workflow accordingly.

### 1. Reference Files, Don't Embed

**Bad (wastes Opus tokens):**
```
"Here's the code: [500 lines]... now fix the bug"
```

**Good (GLM reads the files):**
```
context_files: ["src/api/client.ts", "src/utils/retry.ts"]
```

### 2. Push Research to Executor (With File Output)

Instead of Opus exploring the codebase, push a research task with a file output location:

> "Push a research task to analyze error handling in src/api/. Write findings to docs/research/error-handling.md"

GLM explores (cheap), writes detailed findings to file. Opus reads the file (cheap), makes decisions (valuable).

**Why file output?** Task completion summaries are brief. Detailed findings with code references, tables, and analysis belong in files that both terminals can access.

### 3. Batch Tasks

One Opus session → create multiple tasks → close Opus → GLM executes queue

```
"Push these tasks sequentially:
1. Create User model
2. Create User repository
3. Create User service
4. Create User controller
5. Add User tests"
```

### 4. Log Decisions Once

Don't re-explain context. Log it:
> "Log decision: Using SQLite because this is a single-user app"

Both agents can see logged decisions.

---

## Best Practices

### 1. Let Opus Plan, Let GLM Execute

**Opus (expensive):**
- Architecture and design
- Breaking down features
- Reviewing completed work
- Answering clarifications

**GLM (cheap):**
- Code implementation
- Research and exploration
- Running tests
- Documentation

### 2. Be Specific in Task Descriptions

GLM doesn't have your Opus conversation. Include everything:

```
Title: "Fix null pointer in UserService"
Instructions: "Handle case where user has no avatar"
Context files: ["src/services/UserService.ts"]
Context summary: "Users without avatars cause crash on profile page"
Acceptance criteria: ["Profile loads without error", "Placeholder shown if no avatar"]
```

### 3. Use Acceptance Criteria

Define exactly what "done" means:

```
acceptance_criteria: [
  "Profile page loads without errors",
  "Avatar displays (or placeholder)",
  "All existing tests pass"
]
```

### 4. Update Project State Before Breaks

> "Update project state: Finished auth module, next is payment"

Next session: "What's the project state?" — immediately know where you left off.

### 5. Check In Periodically

Review completed tasks to course-correct early.

### 6. Research Tasks: Write Findings to Files

The bridge passes task status, not content. For research tasks, instruct the Executor to write detailed findings to a file.

**Less useful:**
```
Task completed with summary: "Found 3 issues with auth"
```
Architect only sees a brief summary. Details are lost.

**More useful:**
```
Task instructions: "Analyze auth flow. Write findings to docs/research/auth-analysis.md"
```
Executor writes detailed findings to file. Architect reads the file directly.

**Why this matters:**
- Task summaries are meant for status, not detailed content
- Research findings need code references, tables, specific values
- Both terminals see the filesystem — use it for sharing content

### 7. Use the Filesystem for Shared Content

Both terminals see the same files. Use this for complex work:

| Use | For |
|-----|-----|
| Bridge tasks | Coordinating work, tracking status |
| Files | Detailed findings, plans, analysis |
| Decisions | Recording architectural choices |

The bridge coordinates work. Files carry content.

---

## Saving Your Place

### Project State (Shared) — Use This Most

Both terminals can read and update project state:

**Save:**
> "Update project state: working on auth refactor, blocked on API design"

**Load:**
> "What's the project state?"

One save, both see it. Primary tool for continuity.

### Session Context (Per-Agent) — For Complex Situations

Specific to each terminal. Use when mid-task with lots of context:

**Save:**
> "Save my context"

**Load:**
> "Load my previous context"

### When to Use Each

| Situation | Use |
|-----------|-----|
| End of day, clean stop | Project state |
| Switching focus | Project state |
| Mid-task, complex debugging | Session context |
| Specific files in flight | Session context |

Most users only need project state.

---

## Clarification Flow

### Executor Asks
> "Request clarification: The form has two buttons - which one?"

Task is blocked until Architect responds.

### Architect Responds
> "Any clarification requests?"

Claude shows pending questions.

> "Respond: Add validation to both buttons"

Task is unblocked automatically.

### Executor Continues

Next time Executor checks, they see the response and continue.

---

## Decisions and Shared Memory

Log important decisions:
> "Log decision: Using JWT instead of sessions for stateless auth"

View decisions:
> "What decisions have been made?"

Both agents see logged decisions — no re-explaining.

---

## Typical Workflows

### Feature Development

```
1. Architect: "Push a task to add user profile page"
2. Executor: "Pull the next task" → implements → "Complete the task"
3. Architect: "Review what was done" → may push follow-ups
```

### Research Task

```
1. Architect: "Push a research task to analyze the database schema.
              Write findings to docs/research/schema-analysis.md"
2. Executor: explores codebase → writes findings to file → completes task
3. Architect: reads docs/research/schema-analysis.md
4. Architect: makes decisions, may push implementation tasks
```

### Research → Decision → Implementation

For complex work requiring exploration before coding:

```
1. Architect: pushes research task with file output location
2. Executor: writes detailed findings to file, completes task
3. Architect: reads findings, logs key decisions
4. Architect: pushes implementation tasks (sequential if dependent)
5. Executor: pulls and completes tasks one by one
```

### Bug Investigation

```
1. Architect: "Push task to investigate intermittent login failure"
2. Executor: investigates → "Request clarification: Two causes found..."
3. Architect: "Respond: Focus on race condition first"
4. Executor: continues, finds root cause, completes
```

### End of Day

```
1. Either terminal: "Update project state: Finished auth, next is payments"
2. Close terminals
3. Next day: "What's the project state?"
```

---

## Command Reference

### Architect Commands

| Want | Say |
|------|-----|
| Create task | "Push a task to [description]" |
| Create multiple | "Push these tasks: 1) X, 2) Y, 3) Z" |
| See queue | "List all tasks" |
| Check progress | "What's being worked on?" |
| See completed | "Show completed tasks" |
| Cancel task | "Cancel the task about [description]" |
| Answer question | "Respond to the clarification: [answer]" |
| Log decision | "Log decision: [what and why]" |

### Executor Commands

| Want | Say |
|------|-----|
| Get work | "Pull the next task" |
| See details | "Show current task details" |
| Update status | "Report progress: [what's done]" |
| Finish | "Complete the task" |
| Give up | "Fail this task: [reason]" |
| Ask help | "Request clarification: [question]" |
| Log decision | "Log decision: [what and why]" |

### Shared Commands (Either Terminal)

| Want | Say |
|------|-----|
| Save project focus | "Update project state: [focus]" |
| Check project state | "What's the project state?" |
| View decisions | "What decisions have been made?" |
| Save agent state | "Save my context" |
| Load agent state | "Load my previous context" |
| View sessions | "Show my recent sessions" |

---

## Tool Reference

### Architect Tools

| Tool | Description |
|------|-------------|
| `bridge_push_task` | Create a single task |
| `bridge_push_tasks` | Create multiple tasks (sequential or parallel) |
| `bridge_update_task` | Modify an existing task |
| `bridge_cancel_task` | Cancel a queued/blocked task |
| `bridge_respond_clarification` | Answer executor's question |
| `bridge_get_clarifications` | View pending questions |

### Executor Tools

| Tool | Description |
|------|-------------|
| `bridge_pull_task` | Get next available task |
| `bridge_claim_task` | Lock a specific task |
| `bridge_report_progress` | Update task status |
| `bridge_complete_task` | Mark task done with results |
| `bridge_fail_task` | Mark task as failed |
| `bridge_request_clarification` | Ask architect a question |

### Shared Tools

| Tool | Description |
|------|-------------|
| `bridge_list_tasks` | View all tasks with filters |
| `bridge_get_task` | Get details of specific task |
| `bridge_get_history` | View completed/failed tasks |
| `bridge_get_state` | Get shared project state |
| `bridge_update_state` | Update project focus/issues |
| `bridge_log_decision` | Record architectural decision |
| `bridge_get_events` | View audit log |
| `bridge_sync` | Mark sync point |
| `bridge_save_context` | Save agent's working state |
| `bridge_load_context` | Restore previous session |
| `bridge_list_sessions` | View saved sessions |

---

## Project Structure

```
claude-bridge-server/
├── README.md              # Quick overview
├── GUIDE.md               # This file
├── LICENSE                # MIT license
├── .gitignore             # Git exclusions
├── setup.bat              # Windows build
├── setup.sh               # Unix build
├── init-project.bat       # Windows project init
├── init-project.sh        # Unix project init
└── server/
    ├── package.json       # Dependencies
    ├── tsconfig.json      # TypeScript config
    └── src/
        ├── index.ts       # MCP server entry
        ├── database.ts    # SQLite layer
        ├── types.ts       # Type definitions
        └── tools/
            ├── architect.ts   # Architect tools
            ├── executor.ts    # Executor tools
            └── shared.ts      # Shared tools
```

### Project Data

Each project has its own data:

```
your-project/
└── .claude-bridge/
    ├── README.md      # Quick reference
    └── bridge.db      # SQLite database
```

---

## Troubleshooting

### "The tools aren't showing up"

1. Verify `setup.bat`/`setup.sh` completed successfully
2. Check path in `settings.json` is absolute and correct
3. Windows paths need double backslashes: `C:\\Users\\...`
4. Restart Claude completely
5. Run `/mcp` to verify

### "Getting database errors"

Rare concurrent write issue. Just retry. If persistent, check for multiple instances using different `.claude-bridge` folders.

### "Session not loading"

- Must be in the same project directory
- Sessions are project-specific
- Use `bridge_list_sessions` to see available

### "Task stuck in 'claimed'"

Terminal closed mid-task. Manually complete or fail via Architect.

### "Want to start fresh?"

Delete the database:

```bash
# macOS/Linux
rm your-project/.claude-bridge/bridge.db

# Windows
del your-project\.claude-bridge\bridge.db
```

---

## FAQ

### Setup

**"Do I need to run servers manually?"**
No. Claude Code starts the MCP server automatically.

**"What if my computer restarts?"**
Data persists in SQLite. Tasks, sessions, history survive.

**"Multiple projects?"**
Yes. Each has its own `.claude-bridge/` folder. Run `init-project` for each.

**"How to update?"**
Pull latest code, re-run `setup.bat`/`setup.sh`.

### Tasks

**"Both terminals grab same task?"**
Can't happen. Claiming locks the task.

**"Cancel a task?"**
Only if queued or blocked. Not if in progress.

**"Priority order?"**
critical > high > normal > low

### Context

**"Save in both terminals?"**
No. Use project state (shared). Only use session context for complex mid-task situations.

**"Difference between project state and session context?"**
- Project state: shared, "where is the project?"
- Session context: per-agent, "where was this agent?"

**"Forgot to save?"**
Task history always preserved. Explicit saves add richer context.

### Clarifications

**"Executor confused?"**
Use `bridge_request_clarification`. Blocks task until answered.

**"See pending questions?"**
"Any clarification requests?"

**"Don't answer clarification?"**
Task stays blocked. Executor can work on other tasks.

---

## Getting Help

- **Issues:** Report on GitHub
- **Source:** `server/src/` for implementation details
