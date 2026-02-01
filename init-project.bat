@echo off
REM ============================================================
REM Claude Bridge - Project Initialization (Windows)
REM ============================================================
REM Run this from your project's root directory to set up
REM the bridge for that project.
REM ============================================================

echo.
echo ============================================================
echo  Claude Bridge - Project Initialization
echo ============================================================
echo.

set PROJECT_DIR=%cd%
set SCRIPT_DIR=%~dp0

echo  Project:    %PROJECT_DIR%
echo  Bridge at:  %SCRIPT_DIR%
echo.

REM Check if we're in a valid directory (not root, not home)
if "%PROJECT_DIR%"=="%HOMEDRIVE%\" (
    echo  ERROR: Cannot initialize in root directory.
    echo  Please cd to your project folder first.
    exit /b 1
)

REM Create .claude-bridge folder
if not exist ".claude-bridge" (
    mkdir .claude-bridge
    echo  Created: .claude-bridge\
) else (
    echo  Exists:  .claude-bridge\
)

REM Create README in the project's .claude-bridge folder
(
echo # Claude Bridge - Project Data
echo.
echo This folder contains project-specific data for the Claude Bridge.
echo.
echo ## Contents
echo.
echo - `bridge.db` - SQLite database with tasks, sessions, and decisions
echo - `bridge.db-wal` - Write-ahead log ^(temporary^)
echo - `bridge.db-shm` - Shared memory ^(temporary^)
echo.
echo ## Usage
echo.
echo The bridge should work automatically if your Claude settings are configured.
echo.
echo ### Saving Your Place
echo.
echo **Project state ^(shared^):**
echo ^> "Update project state: working on feature X"
echo.
echo **Session context ^(per-agent^):**
echo ^> "Save my context"
echo.
echo ### Resuming Work
echo.
echo **Check project state:**
echo ^> "What's the project state?"
echo.
echo **Load session:**
echo ^> "Load my previous context"
echo.
echo ## Starting Fresh
echo.
echo To clear all data, delete `bridge.db` in this folder.
echo.
echo ## Documentation
echo.
echo See GUIDE.md in the claude-bridge-server installation folder.
) > .claude-bridge\README.md

echo  Created: .claude-bridge\README.md
echo.

REM Handle .gitignore
if exist ".gitignore" (
    findstr /C:".claude-bridge/" .gitignore >nul 2>&1
    if errorlevel 1 (
        echo.>> .gitignore
        echo # Claude Bridge - local database>> .gitignore
        echo .claude-bridge/bridge.db>> .gitignore
        echo .claude-bridge/bridge.db-wal>> .gitignore
        echo .claude-bridge/bridge.db-shm>> .gitignore
        echo  Updated: .gitignore ^(added bridge database exclusions^)
    ) else (
        echo  Exists:  .gitignore already has .claude-bridge entries
    )
) else (
    echo  Note:    No .gitignore found.
    echo           Consider adding .claude-bridge/bridge.db to your ignore list.
)

echo.
echo ============================================================
echo  Project initialized!
echo ============================================================
echo.
echo  Your Claude terminals can now use the bridge in this project.
echo.
echo  Quick commands:
echo.
echo    Architect: "Push a task to [description]"
echo    Executor:  "Pull the next task"
echo    Either:    "Update project state: [focus]"
echo    Either:    "What's the project state?"
echo.
echo  For more, see GUIDE.md in the bridge installation folder.
echo.
