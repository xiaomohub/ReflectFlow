@echo off
setlocal
title ReflectFlow One-Click Start
echo ============================================
echo ReflectFlow One-Click Start
echo ============================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Install Python 3.10+ first.
    pause
    exit /b 1
)
echo [OK] Python found.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install Node.js 18+ first.
    pause
    exit /b 1
)
echo [OK] Node.js found.

echo.
echo [1/3] Setup backend dependencies
cd /d "%~dp0backend"
if not exist "venv\Scripts\python.exe" (
    echo Creating backend virtual environment...
    python -m venv venv
)
echo Installing backend requirements...
call venv\Scripts\python -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Backend dependency install failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Setup frontend dependencies
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Frontend dependency install failed.
        pause
        exit /b 1
    )
) else (
    echo Frontend dependencies already exist.
)

echo.
echo [3/3] Start backend and frontend
cd /d "%~dp0backend"
start "ReflectFlow Backend" cmd /k "call venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd /d "%~dp0frontend"
start "ReflectFlow Frontend" cmd /k "npm run dev"

echo.
echo Started successfully:
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:8000
echo API Docs: http://localhost:8000/docs
echo.
echo Close this window anytime. Services keep running in their own windows.
pause
