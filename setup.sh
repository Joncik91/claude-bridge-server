#!/bin/bash
# ============================================================
# Claude Bridge Server - Setup Script (macOS/Linux)
# ============================================================
# Run this ONCE after cloning/downloading to build the server.
# Usage: chmod +x setup.sh && ./setup.sh
# ============================================================

set -e  # Exit on any error

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "============================================================"
echo " Claude Bridge Server - Setup"
echo "============================================================"
echo ""
echo " Location: $SCRIPT_DIR"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo " ERROR: Node.js is not installed or not in PATH."
    echo " Please install Node.js 18+ from https://nodejs.org/"
    echo ""
    exit 1
fi

# Check Node.js version (need 18+)
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo " ERROR: Node.js 18+ required. Found: $(node --version)"
    echo " Please upgrade Node.js from https://nodejs.org/"
    echo ""
    exit 1
fi

echo " Node.js version: $(node --version)"
echo ""

# Navigate to server directory
cd "$SCRIPT_DIR/server"
if [ $? -ne 0 ]; then
    echo " ERROR: Could not find server directory."
    exit 1
fi

echo " [1/2] Installing dependencies..."
echo ""
npm install
if [ $? -ne 0 ]; then
    echo ""
    echo " ERROR: npm install failed."
    echo " Check your internet connection and try again."
    exit 1
fi

echo ""
echo " [2/2] Building TypeScript..."
echo ""
npm run build
if [ $? -ne 0 ]; then
    echo ""
    echo " ERROR: TypeScript build failed."
    echo " Check for errors above."
    exit 1
fi

echo ""
echo "============================================================"
echo " Setup complete!"
echo "============================================================"
echo ""
echo " The Claude Bridge server is ready."
echo ""
echo " NEXT STEPS:"
echo ""
echo " 1. Add to your Claude settings (~/.claude/settings.json):"
echo ""
echo '    {'
echo '      "mcpServers": {'
echo '        "claude-bridge": {'
echo '          "command": "node",'
echo "          \"args\": [\"$SCRIPT_DIR/server/dist/index.js\"]"
echo '        }'
echo '      }'
echo '    }'
echo ""
echo " 2. (Optional) Set agent role in your shell profile:"
echo ""
echo '    export CLAUDE_BRIDGE_MODE="architect"  # or "executor"'
echo ""
echo " 3. Initialize each project you want to use:"
echo ""
echo "    cd /path/to/your/project"
echo "    $SCRIPT_DIR/init-project.sh"
echo ""
echo " 4. Restart your Claude terminals."
echo ""
echo " For detailed instructions, see: GUIDE.md"
echo ""
