#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] Installing dependencies..."
npm install --no-audit --no-fund

echo "[2/4] Building dist/mcp.js + copying better_sqlite3.node... "
npm run build

echo "[3/4] Running tests..."
npm test

echo "[4/4] Cleaning up root node_modules..."
rm -rf node_modules package-lock.json

echo ""
echo "Done! dist/ is self-contained:"
echo "  dist/mcp.js               - bundled server"
echo "  dist/better_sqlite3.node  - native SQLite binary"
