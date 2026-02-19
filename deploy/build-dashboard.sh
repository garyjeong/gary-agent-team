#!/bin/bash
# Build dashboard frontend and copy static files into deploy/dashboard-build/
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DASHBOARD_SRC="${SCRIPT_DIR}/../../../agent-dashboard"
OUT_DIR="${SCRIPT_DIR}/dashboard-build"

echo "[build] Building dashboard frontend..."
cd "$DASHBOARD_SRC"
npm install
npm run build

echo "[build] Copying static files to ${OUT_DIR}..."
rm -rf "$OUT_DIR"
cp -r out "$OUT_DIR"

echo "[build] Done. Dashboard static files ready at ${OUT_DIR}"
