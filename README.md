# Claude Bridge

An MCP server that enables collaboration between [Claude Code](https://claude.ai/code) and [Z.ai's GLM models](https://z.ai) — use Claude Opus for planning while GLM handles implementation.

Combine the strengths of Claude Code and Z.ai's GLM in one workflow. This MCP server lets Opus
handle high-level planning while GLM tackles implementation — coordinated through a shared task
queue, running simultaneously in separate terminals. Run Claude Code with your Max
subscription or API for architecture, and Claude Code with Z.ai (GLM) for execution — both working together at the same time.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## Why This Exists

You have a Claude subscription but you're hitting limits. Getting a second Claude subscription is pricey (or upgrading might be too expensive) — but a Z.ai subscription costs less and GLM codes just as well as Sonnet.

**The question:** How do you make Claude and GLM work together?

**The answer:** Claude Bridge. An MCP server that coordinates both through a shared task queue.

```
┌─────────────────────────┐                    ┌─────────────────────────┐
│   Terminal 1            │                    │   Terminal 2            │
│   Claude Opus           │                    │   Z.ai GLM              │
│   (Architect)           │                    │   (Executor)            │
│                         │    Claude Bridge   │                         │
│   • Plans features      │◄──────────────────►│   • Pulls tasks         │
│   • Designs architecture│    (Shared Queue)  │   • Writes code         │
│   • Makes decisions     │                    │   • Reports back        │
└─────────────────────────┘                    └─────────────────────────┘
```



## Quick Example

**Terminal 1 (Opus):** "Push a task to implement JWT authentication"

**Terminal 2 (GLM):** "Pull the next task" → implements → "Complete the task"

**Terminal 1:** "What did the executor complete?" → reviews results

## Features

- **Task Queue** — Priority-based with dependencies and categories
- **Shared State** — Project focus and decisions visible to both
- **Session Context** — Resume where you left off
- **Clarifications** — Executor asks questions, Architect responds
- **Token-Conscious** — Designed to minimize Opus usage

## When NOT to Use This

If you're using a **planning framework** like [Get-Shit-Done (GSD)](https://github.com/cyanheads/get-shit-done), you don't need this bridge. Frameworks like GSD store context in project files (`.planning/`) that both terminals can read directly. Slash commands like `/gsd:plan-phase` and `/gsd:execute-phase` work in any terminal.

**Use Claude Bridge for:**
- Ad-hoc tasks, quick fixes, one-off research
- Projects without a planning framework
- Session continuity across restarts

**Skip the bridge if:**
- Using GSD or similar file-based planning frameworks
- Both terminals share the project filesystem

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org/)
- **Claude Code CLI** — [Installation](https://docs.anthropic.com/en/docs/claude-code)
- **Z.ai account** — For GLM access ([z.ai](https://z.ai))
- **Two terminal windows**

### Terminal Profile Setup

**Same subscription in both terminals?** Just run `claude` in each — no profile setup needed.

**Claude + Z.ai GLM?** Add this function to your shell profile:

**Windows PowerShell** (`notepad $PROFILE`):
```powershell
function use-glm {
    $env:ANTHROPIC_BASE_URL = "https://api.z.ai/api/anthropic"
    $env:ANTHROPIC_AUTH_TOKEN = "your_zai_api_key_here"
    Write-Host ">>> GLM ACTIVE (Executor mode)" -ForegroundColor Cyan
}
```

**macOS/Linux** (`~/.bashrc` or `~/.zshrc`):
```bash
use-glm() {
    export ANTHROPIC_BASE_URL="https://api.z.ai/api/anthropic"
    export ANTHROPIC_AUTH_TOKEN="your_zai_api_key_here"
    echo ">>> GLM ACTIVE (Executor mode)"
}
```

**Usage:**
- Terminal 1: Just run `claude` (uses your Claude subscription)
- Terminal 2: Run `use-glm`, then `claude` (uses Z.ai API)

See [GUIDE.md](GUIDE.md#terminal-profile-setup) for complete setup details.

## Quick Start

```bash
# 1. Clone and build
git clone https://github.com/Joncik91/claude-bridge-server.git
cd claude-bridge-server
./setup.sh          # or setup.bat on Windows

# 2. Configure MCP (see GUIDE.md for details)
claude mcp add --scope user --transport stdio claude-bridge -- node /path/to/server/dist/index.js
```

## Documentation

**[GUIDE.md](GUIDE.md)** — Complete setup, terminal configuration, usage, and troubleshooting

## Works with Other MCP Clients Too

While designed for Claude + GLM, the bridge is a standard MCP server — it works with any MCP-compatible CLI:

- Two Claude Code instances (same or different subscriptions)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli)
- [OpenCode](https://opencode.ai/)
- [Qwen Code](https://github.com/QwenLM/qwen-code)
- Any other MCP client

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgments

- Built for [Claude Code](https://claude.ai/code) by Anthropic
- Designed for [Z.ai](https://z.ai) GLM integration

<a href="https://glama.ai/mcp/servers/@Joncik91/claude-bridge-server">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@Joncik91/claude-bridge-server/badge" />
</a>
