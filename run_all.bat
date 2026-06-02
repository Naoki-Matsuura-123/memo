@echo off
title nao-memo Automation Launcher

:: Force current directory to be the directory of this batch file
cd /d "%~dp0"

echo =====================================================================
echo                nao-memo Automation Launcher (v1.1.0)
echo =====================================================================
echo.
echo [1/3] Starting FastAPI server and ngrok tunnel...
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

:: 1. Launch FastAPI Server in a separate window
echo [2/3] Starting FastAPI API Server in a new window...
start "nao-memo API Server" cmd /k "%UVICORN_CMD%"

:: 2. Wait 3 seconds to let uvicorn initialize
echo [INFO] Waiting for server initialization (3s)...
timeout /t 3 /nobreak >nul

:: 3. Launch ngrok tunnel in a separate window
echo [3/3] Starting ngrok tunnel (port 8000) in a new window...
start "nao-memo ngrok Tunnel" cmd /k "ngrok http 8000 --domain=snubby-arlette-denunciatory.ngrok-free.dev"

echo.
echo =====================================================================
echo [SUCCESS] All services started in separate windows successfully!
echo.
echo * You can stop each service by closing its terminal window.
echo * Open the Web UI in your browser to start:
echo   https://naoki-matsuura-123.github.io/naomemo_test/
echo =====================================================================
echo.
pause
