#!/bin/bash
cd "$(dirname "$0")"
echo "Starting AcWing Tracker server..."
start "" "http://localhost:8765" 2>/dev/null || xdg-open "http://localhost:8765" 2>/dev/null || open "http://localhost:8765" 2>/dev/null || true
python3 server.py || python server.py
