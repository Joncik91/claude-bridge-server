@echo off
REM ============================================================
REM Claude Bridge Server - Setup Script (Windows)
REM ============================================================
REM Run this ONCE after cloning/downloading to build the server.
REM ============================================================

echo.
echo ============================================================
echo  Claude Bridge Server - Setup
echo ============================================================
echo.
echo  Location: %~dp0
echo.

REM Check for Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo  ERROR: Node.js is not installed or not in PATH.
    echo  Please install Node.js 18+ from https://nodejs.org/
    echo.
    exit /b 1
)

REM Display Node.js version
echo  Node.js version:
node --version
echo.

REM Navigate to server directory
cd /d "%~dp0server"
if errorlevel 1 (
    echo  ERROR: Could not find server directory.
    exit /b 1
)

echo  [1/2] Installing dependencies...
echo.
call npm install
if errorlevel 1 (
    echo.
    echo  ERROR: npm install failed.
    echo  Check your internet connection and try again.
    exit /b 1
)

echo.
echo  [2/2] Building TypeScript...
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo  ERROR: TypeScript build failed.
    echo  Check for errors above.
    exit /b 1
)

echo.
echo ============================================================
echo  Setup complete!
echo ============================================================
echo.
echo  The Claude Bridge server is ready.
echo.
echo  NEXT STEPS:
echo.
echo  1. Add to your Claude settings (.claude/settings.json):
echo.
echo     {
echo       "mcpServers": {
echo         "claude-bridge": {
echo           "command": "node",
echo           "args": ["%~dp0server\dist\index.js"]
echo         }
echo       }
echo     }
echo.
echo  2. (Optional) Set agent role in PowerShell profile:
echo.
echo     $env:CLAUDE_BRIDGE_MODE = "architect"  # or "executor"
echo.
echo  3. Initialize each project you want to use:
echo.
echo     cd C:\path\to\your\project
echo     %~dp0init-project.bat
echo.
echo  4. Restart your Claude terminals.
echo.
echo  For detailed instructions, see: GUIDE.md
echo.
