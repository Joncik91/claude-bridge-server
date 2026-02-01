# Claude Bridge

A Model Context Protocol (MCP) server that enables collaboration between [Claude Code](https://claude.ai/code) and [Z.ai's GLM models](https://z.ai), letting you use Claude Opus for planning while GLM handles implementation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## The Problem

Claude Code with a Max subscription 5x is powerful but has weekly token limits. Heavy workflows like feature planning, code generation, and debugging can burn through your allocation quickly. Upgrading to Max subscription 20x ($200/month) helps but gets expensive. (for some...)

Meanwhile, Z.ai offers GLM models with generous token limits at a fraction of the cost - but GLM alone lacks the architectural reasoning of Claude Opus.

**What if you could use both?**

- **Claude Opus** for what it's best at: planning, architecture, complex decisions
- **GLM** for what it's best at: high-volume code implementation

## The Solution

Claude Bridge connects two Claude Code terminals through a shared task queue:

```
┌─────────────────────────┐                    ┌─────────────────────────┐
│   Terminal 1            │                    │   Terminal 2            │
│   Claude Opus           │                    │   Z.ai GLM              │
│   (Architect)           │                    │   (Executor)            │
│                         │    Claude Bridge   │                         │
│   • Plans features      │◄──────────────────►│   • Pulls tasks         │
│   • Designs architecture│    (Shared Queue)  │   • Writes code         │
│   • Reviews results     │                    │   • Runs tests          │
│   • Makes decisions     │                    │   • Reports back        │
└─────────────────────────┘                    └─────────────────────────┘
```

**The result:** Opus-quality planning with GLM-volume implementation, at a fraction of the cost of Max 20. With Claude Bridge, you get the best of both worlds.

## How It Works

1. **You** describe what you want to the Architect (Claude Opus)
2. **Architect** plans the work and pushes tasks to the queue
3. **Executor** (GLM) pulls tasks and implements them
4. **Both** share project state, decisions, and can communicate via clarifications

The bridge handles:
- **Task Queue**: Priority-based, with dependencies and categories
- **Project State**: Shared focus and known issues
- **Session Context**: Resume where you left off after breaks
- **Decisions Log**: Architectural decisions visible to both agents
- **Clarifications**: Executor can ask questions, Architect responds

## Quick Example

**Terminal 1 (Opus):**
```
You: "Push a task to implement user authentication with JWT"

Claude: Creates task with instructions, acceptance criteria, context files.
        "Task created! Executor can pick it up."
```

**Terminal 2 (GLM):**
```
You: "Pull the next task"

Claude: "Got task: Implement user authentication with JWT."
        [reads context files, implements feature, writes tests]
        "Done! Marking complete."
```

**Back in Terminal 1:**
```
You: "What did the executor complete?"

Claude: "Completed: JWT authentication. Created 4 files, modified 2.
        Added login/logout endpoints, middleware, and tests."
```

---

## Requirements

- **Node.js** 18 or higher
- **Claude Code** CLI with Max subscription
- **Z.ai account** with GLM access (or any second Claude instance)
- **Two terminal windows**

## Installation

### Step 1: Clone or Download

```bash
git clone https://github.com/yourusername/claude-bridge-server.git
cd claude-bridge-server
```

Or download and extract to a permanent location (e.g., `~/.claude-bridge-server`).

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

### Step 3: Configure Claude Code

Add to your Claude settings file (`.claude/settings.json`):

```json
{
  "mcpServers": {
    "claude-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/claude-bridge-server/server/dist/index.js"]
    }
  }
}
```

This same configuration works for both terminals.

### Step 4: Set Up Your Terminal Profile

This is the critical step. You need to configure your shell to switch between Claude Max (Opus) and Z.ai GLM.

#### Windows PowerShell

Open your PowerShell profile for editing:

```powershell
notepad $PROFILE
```

Add the following complete configuration:

```powershell
# ============================================================
# CLAUDE CODE SWITCHER
# ============================================================
# These functions configure environment variables BEFORE you
# start Claude Code. Run the function first, then run `claude`.
#
# Workflow:
#   Terminal 1: Just run `claude` (uses Max by default)
#   Terminal 2: Run `use-glm`, then run `claude` (uses GLM)
#
# ============================================================

function use-max {
    # Resets to default Anthropic settings (Claude Max subscription)
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
# These settings improve Claude Code responsiveness on Windows

$env:CLAUDE_CODE_ENABLE_TASKS = "false"  # Reduces input lag
$env:DISABLE_AUTOUPDATER = "1"           # Prevents update interruptions

# ============================================================
# DEFAULT MODE
# ============================================================
# New terminals default to Architect mode (Claude Max)

$env:CLAUDE_BRIDGE_MODE = "architect"
```

**Important:** Replace `your_zai_api_key_here` with your actual Z.ai API key.

Save the file and restart PowerShell, or reload with:

```powershell
. $PROFILE
```

#### macOS/Linux

Edit your shell profile (`~/.bashrc`, `~/.zshrc`, or equivalent):

```bash
# ============================================================
# CLAUDE CODE SWITCHER
# ============================================================
# These functions configure environment variables BEFORE you
# start Claude Code. Run the function first, then run `claude`.
#
# Workflow:
#   Terminal 1: Just run `claude` (uses Max by default)
#   Terminal 2: Run `use-glm`, then run `claude` (uses GLM)
#
# To switch models: exit Claude, run use-max or use-glm,
# then start Claude again.
# ============================================================

use-max() {
    # Resets to default Anthropic settings (Claude Max subscription)
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

Reload your profile:

```bash
source ~/.bashrc  # or ~/.zshrc
```

### Step 5: Initialize Your Project

For each project you want to use the bridge with:

**Windows:**
```cmd
cd C:\path\to\your\project
C:\path\to\claude-bridge-server\init-project.bat
```

**macOS/Linux:**
```bash
cd /path/to/your/project
/path/to/claude-bridge-server/init-project.sh
```

### Step 6: Start Working

**Terminal 1 (Architect - Claude Max):**
```
> claude
```
Just run `claude`. Your profile defaults to Architect mode with your Max subscription.

**Terminal 2 (Executor - Z.ai GLM):**
```
> use-glm
>>> GLM ACTIVE (Executor mode)
> claude
```
Run `use-glm` first to configure the environment, THEN run `claude`.

**Verify both terminals see the bridge:**
```
/mcp
```
You should see `claude-bridge` listed in both.

**Switching back to Max (if needed):**
```
> use-max
>>> CLAUDE MAX ACTIVE (Architect mode)
> claude
```

---

## Works with Standard Claude Too

While designed for Opus + GLM, Claude Bridge works with any two Claude Code instances:

- **Two Max subscriptions** (different accounts)
- **Opus + Sonnet** (quality vs speed tradeoff)
- **Two Sonnet instances** (parallel work)
- **Any model combination** supported by Claude Code

The bridge doesn't care what models you use - it just passes tasks between terminals.

---

## Features

### Task Management
- Priority levels: critical, high, normal, low
- Categories: feature, bugfix, refactor, research, test, docs
- Task dependencies (sequential execution)
- Acceptance criteria for clear "done" definition
- Context files for executor reference
- Batch task creation (sequential or parallel)

### Token-Conscious Design
- **Reference files, don't embed**: List files in `context_files`, executor reads them
- **Push research to executor**: GLM explores, Opus decides
- **Batch tasks**: One Opus session creates many tasks, GLM executes
- **Log decisions once**: Shared memory avoids re-explaining

### Shared State
- Project-wide current focus
- Known issues tracking
- Decision logging with rationale
- Audit trail of all actions

### Session Continuity
- Save project state before closing (shared between both)
- Save agent context for complex mid-task situations
- Resume exactly where you left off

### Clarification Flow
- Executor can request help (blocks task)
- Architect responds (unblocks task)
- Async communication without copy-paste

---

## Best Practices

### 1. Let Opus Plan, Let GLM Execute

Opus is expensive - use it for high-value decisions:
- Architecture and design
- Breaking down complex features
- Reviewing completed work
- Answering clarifications

GLM has abundant tokens - use it for volume:
- Code implementation
- Research and exploration
- Running tests
- Documentation

### 2. Be Specific in Task Descriptions

GLM doesn't have your Opus conversation. Include everything:

```
Title: "Add JWT authentication"
Instructions: "Implement JWT-based auth with refresh tokens..."
Context files: ["src/auth/", "src/middleware/"]
Acceptance criteria: ["Login returns JWT", "Refresh works", "Tests pass"]
```

### 3. Batch Related Tasks

One Opus session → multiple tasks → close Opus → GLM works through queue

```
"Push these tasks sequentially:
1. Create User model
2. Create User repository
3. Create User service
4. Create User controller
5. Add User tests"
```

### 4. Use Project State for Continuity

Before closing for the day:
```
"Update project state: Finished auth module, next is payment integration"
```

Next session:
```
"What's the project state?"
```

---

## Documentation

See [GUIDE.md](GUIDE.md) for comprehensive documentation:

- Detailed workflow examples
- All available commands
- Project state vs session context
- Troubleshooting guide
- FAQ

---

## Tool Reference

### Architect Tools
| Tool | Description |
|------|-------------|
| `bridge_push_task` | Create a task for the executor |
| `bridge_push_tasks` | Create multiple tasks at once |
| `bridge_respond_clarification` | Answer executor's question |

### Executor Tools
| Tool | Description |
|------|-------------|
| `bridge_pull_task` | Get the next available task |
| `bridge_complete_task` | Mark task done with results |
| `bridge_request_clarification` | Ask architect for help |

### Shared Tools
| Tool | Description |
|------|-------------|
| `bridge_get_state` | Get shared project state |
| `bridge_update_state` | Update project focus/issues |
| `bridge_log_decision` | Record architectural decision |
| `bridge_save_context` | Save agent's working state |
| `bridge_load_context` | Restore previous session |

See GUIDE.md for the complete tool reference.

---

## Project Structure

```
claude-bridge-server/
├── README.md              # This file
├── GUIDE.md               # Detailed user guide
├── LICENSE                # MIT license
├── setup.bat / setup.sh   # Build scripts
├── init-project.bat / .sh # Project initialization
└── server/
    ├── package.json
    ├── tsconfig.json
    └── src/               # TypeScript source
```

---

## Contributing

Contributions welcome! This project grew from a personal need to optimize Claude Code costs while maintaining quality. If you have ideas for improvement, please open an issue or PR.

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Acknowledgments

- Built for use with [Claude Code](https://claude.ai/code) by Anthropic
- Designed for integration with [Z.ai](https://z.ai) GLM models
- Inspired by the need to make AI-assisted development more cost-effective
