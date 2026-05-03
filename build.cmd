@echo off
cls
echo [1/4] Installing dependencies...
call npm install --no-audit --no-fund

echo [2/4] Building dist/mcp.js + copying better_sqlite3.node...
call npm run build

echo [3/4] Running tests...
call npm test

echo [4/4] Cleaning up root node_modules...
if exist node_modules rd /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

echo.
echo Done! dist/ is self-contained:
echo   dist/mcp.js               - bundled server
echo   dist/better_sqlite3.node  - native SQLite binary
