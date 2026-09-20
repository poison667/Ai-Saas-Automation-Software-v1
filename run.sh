#!/usr/bin/env bash
# Lumina launcher — installs deps if missing, then serves on 0.0.0.0:8000
set -e
cd "$(dirname "$0")"
if ! python3 -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  echo "Installing dependencies…"
  python3 -m pip install --quiet fastapi "uvicorn[standard]"
fi
exec python3 server.py
