#!/bin/bash
# ============================================================
# Claude Bridge - Project Initialization (macOS/Linux)
# ============================================================
# Run this from your project's root directory to set up
# the bridge for that project.
# Usage: /path/to/claude-bridge-server/init-project.sh
# ============================================================

# Get directories
PROJECT_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "============================================================"
echo " Claude Bridge - Project Initialization"
echo "============================================================"
echo ""
echo " Project:    $PROJECT_DIR"
echo " Bridge at:  $SCRIPT_DIR"
echo ""

# Check if we're in a valid directory (not root, not home)
if [ "$PROJECT_DIR" = "/" ] || [ "$PROJECT_DIR" = "$HOME" ]; then
    echo " ERROR: Cannot initialize in root or home directory."
    echo " Please cd to your project folder first."
    exit 1
fi

# Create .claude-bridge folder
if [ ! -d ".claude-bridge" ]; then
    mkdir -p .claude-bridge
    echo " Created: .claude-bridge/"
else
    echo " Exists:  .claude-bridge/"
fi

# Create README in the project's .claude-bridge folder
cat > .claude-bridge/README.md << 'EOF'
# Claude Bridge - Project Data

This folder contains project-specific data for the Claude Bridge.

## Contents

- `bridge.db` - SQLite database with tasks, sessions, and decisions
- `bridge.db-wal` - Write-ahead log (temporary)
- `bridge.db-shm` - Shared memory (temporary)

## Usage

The bridge should work automatically if your Claude settings are configured.

### Saving Your Place

**Project state (shared):**
> "Update project state: working on feature X"

**Session context (per-agent):**
> "Save my context"

### Resuming Work

**Check project state:**
> "What's the project state?"

**Load session:**
> "Load my previous context"

## Starting Fresh

To clear all data, delete `bridge.db` in this folder.

## Documentation

See GUIDE.md in the claude-bridge-server installation folder.
EOF

echo " Created: .claude-bridge/README.md"
echo ""

# Handle .gitignore
if [ -f ".gitignore" ]; then
    if grep -q ".claude-bridge/" .gitignore 2>/dev/null; then
        echo " Exists:  .gitignore already has .claude-bridge entries"
    else
        echo "" >> .gitignore
        echo "# Claude Bridge - local database" >> .gitignore
        echo ".claude-bridge/bridge.db" >> .gitignore
        echo ".claude-bridge/bridge.db-wal" >> .gitignore
        echo ".claude-bridge/bridge.db-shm" >> .gitignore
        echo " Updated: .gitignore (added bridge database exclusions)"
    fi
else
    echo " Note:    No .gitignore found."
    echo "          Consider adding .claude-bridge/bridge.db to your ignore list."
fi

echo ""
echo "============================================================"
echo " Project initialized!"
echo "============================================================"
echo ""
echo " Your Claude terminals can now use the bridge in this project."
echo ""
echo " Quick commands:"
echo ""
echo '   Architect: "Push a task to [description]"'
echo '   Executor:  "Pull the next task"'
echo '   Either:    "Update project state: [focus]"'
echo '   Either:    "What'\''s the project state?"'
echo ""
echo " For more, see GUIDE.md in the bridge installation folder."
echo ""
