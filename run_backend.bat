@echo off
title nao-memo API Server Launcher

:: Force current directory to be the directory of this batch file
cd /d "%~dp0"

echo =====================================================================
echo                nao-memo FastAPI Server Launcher
echo =====================================================================
echo.

:: Detect virtual environment and prepare command
set "UVICORN_CMD=python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

if exist "%~dp0.venv\Scripts\activate.bat" (
    echo [INFO] Found virtual environment: .venv. Activating on startup.
    set "UVICORN_CMD=call "%~dp0.venv\Scripts\activate.bat" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else if exist "%~dp0venv\Scripts\activate.bat" (
    echo [INFO] Found virtual environment: venv. Activating on startup.
    set "UVICORN_CMD=call "%~dp0venv\Scripts\activate.bat" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    echo [INFO] No local virtual environment found. Using global Python.
)

echo Starting FastAPI API Server...
echo.
%UVICORN_CMD%
