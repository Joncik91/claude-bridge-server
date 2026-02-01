# Claude Bridge

An MCP server that enables collaboration between [Claude Code](https://claude.ai/code) and [Z.ai's GLM models](https://z.ai) — use Claude Opus for planning while GLM handles implementation.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## The Problem

Claude Code with Max 5x is powerful but has weekly token limits. Max 20x ($200/month) helps but gets expensive.

Z.ai offers GLM models with generous limits at lower cost — but GLM lacks Opus's architectural reasoning.

**Solution: Use both.** Opus plans, GLM implements.

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

## Cost Comparison

| Setup | Monthly Cost | Opus Reasoning | Implementation Capacity |
|-------|--------------|----------------|------------------------|
| Max 5x alone | $20 | Yes | Limited by weekly cap |
| Max 20x | $200 | Yes | 4x the cap |
| **Max 5x + Z.ai GLM** | ~$130 | Yes | Effectively unlimited |

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
- Claude Code CLI with Max subscription
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
