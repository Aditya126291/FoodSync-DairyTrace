#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo ""
  echo "Stopping DairyTrace services..."
  if [[ -n "$FRONTEND_PID" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "$BACKEND_PID" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "============================================================"
echo "  DairyTrace — Farm-to-Paneer Traceability & Smart Recall"
echo "============================================================"

# 1. Backend setup
if [[ ! -d "$VENV_DIR" ]]; then
  echo "[1/4] Creating Python virtual environment in backend/.venv..."
  python3 -m venv "$VENV_DIR"
fi

PYTHON_BIN="$VENV_DIR/bin/python"
PIP_BIN="$VENV_DIR/bin/pip"

if ! "$PYTHON_BIN" -c "import fastapi, uvicorn, sqlalchemy, qrcode" >/dev/null 2>&1; then
  echo "[1/4] Installing backend Python dependencies..."
  "$PIP_BIN" install -r "$BACKEND_DIR/requirements.txt"
else
  echo "[1/4] Backend Python dependencies verified."
fi

# 2. Seed database if missing or if --reset flag passed
if [[ ! -f "$BACKEND_DIR/dairytrace.db" ]] || [[ "${1:-}" == "--reset" ]]; then
  echo "[2/4] Seeding DairyTrace SQLite database..."
  (cd "$BACKEND_DIR" && "$PYTHON_BIN" -m app.manage seed)
else
  echo "[2/4] Existing SQLite database found at backend/dairytrace.db (pass --reset to re-seed)."
fi

# 3. Frontend dependencies check
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "[3/4] Installing frontend npm dependencies..."
  (cd "$FRONTEND_DIR" && npm install)
else
  echo "[3/4] Frontend node_modules verified."
fi

# 4. Launch Backend & Frontend
echo "[4/4] Starting FastAPI backend (http://127.0.0.1:8000) and Vite frontend (http://127.0.0.1:5173)..."
(cd "$BACKEND_DIR" && "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port 8000) &
BACKEND_PID=$!

(cd "$FRONTEND_DIR" && npm run dev -- --host 127.0.0.1 --port 5173) &
FRONTEND_PID=$!

echo ""
echo "------------------------------------------------------------"
echo "  Frontend App      : http://127.0.0.1:5173"
echo "  Backend API Docs  : http://127.0.0.1:8000/docs"
echo "------------------------------------------------------------"
echo "  Demo Staff Accounts (server-verified JWT):"
echo "    Inspector  : inspector@dairytrace.demo  /  Inspect@2026"
echo "    QA Officer : qa@dairytrace.demo         /  QaOfficer@2026"
echo "------------------------------------------------------------"
echo "Press Ctrl+C to stop both servers."
echo ""

wait
