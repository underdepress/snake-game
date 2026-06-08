@echo off
cd /d "%~dp0"
echo Starting AcWing Tracker server...
echo.
start "" "http://localhost:8765"
python server.py
pause
