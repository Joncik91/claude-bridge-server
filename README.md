# Claude Bridge

An MCP server that enables collaboration between [Claude Code](https://claude.ai/code) and [Z.ai's GLM models](https://z.ai) — use Claude Opus for planning while GLM handles implementation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## Why This Exists

You have a Claude subscription but you're hitting limits. Getting a second Claude subscription is pricey — but a Z.ai subscription costs less and GLM codes just as well as Sonnet.

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

## Quick Start

```bash
# 1. Clone and build
git clone https://github.com/anthropics/claude-bridge-server.git
cd claude-bridge-server
./setup.sh          # or setup.bat on Windows

# 2. See GUIDE.md for:
#    - Claude Code MCP configuration
#    - Terminal profile setup (use-max / use-glm functions)
#    - Project initialization
```

## Requirements

- Node.js 18+
- Claude Code CLI
- Z.ai account with GLM access
- Two terminal windows

## Documentation

**[GUIDE.md](GUIDE.md)** — Complete setup, terminal configuration, usage, and troubleshooting

## Works with Standard Claude Too

While designed for Opus + GLM, the bridge works with any two Claude Code instances.

## License

MIT — see [LICENSE](LICENSE)

## Acknowledgments

- Built for [Claude Code](https://claude.ai/code) by Anthropic
- Designed for [Z.ai](https://z.ai) GLM integration
