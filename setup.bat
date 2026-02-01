@echo off
REM Claude Bridge Server - Global Setup Script
REM Run this ONCE to install the bridge server globally

echo ========================================
echo Claude Bridge Server - Global Setup
echo ========================================
echo.
echo Location: %~dp0
echo.

cd /d "%~dp0server"

echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    exit /b 1
)

echo.
echo [2/2] Building TypeScript...
call npm run build
if errorlevel 1 (
    echo ERROR: Build failed
    exit /b 1
)

echo.
echo ========================================
echo Setup complete!
echo ========================================
echo.
echo The Claude Bridge server is now installed globally.
echo.
echo NEXT STEPS:
echo.
echo 1. For each project, create a .claude-bridge folder:
echo    mkdir .claude-bridge
echo.
echo 2. Add to your Claude settings (.claude/settings.json):
echo.
echo    For Architect (Claude Opus):
echo    {
echo      "mcpServers": {
echo        "claude-bridge": {
echo          "command": "node",
echo          "args": ["%~dp0server\dist\index.js", "--mode=architect"]
echo        }
echo      }
echo    }
echo.
echo    For Executor (Claude GLM):
echo    {
echo      "mcpServers": {
echo        "claude-bridge": {
echo          "command": "node",
echo          "args": ["%~dp0server\dist\index.js", "--mode=executor"]
echo        }
echo      }
echo    }
echo.
echo 3. Restart your Claude terminals
echo.
