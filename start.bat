@echo off
chcp 65001 >nul
title 个人复盘系统 - 一键启动
echo ============================================
echo   个人复盘系统 - 一键启动
echo ============================================
echo.

:: 检查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Python，请先安装 Python 3.10+
    pause
    exit /b 1
)
echo [OK] Python 已安装

:: 检查 Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装 Node.js 18+
    pause
    exit /b 1
)
echo [OK] Node.js 已安装

echo.
echo --- 1. 初始化后端依赖 ---
cd /d "%~dp0backend"

:: 创建虚拟环境（如果不存在）
if not exist "venv" (
    echo [..] 创建 Python 虚拟环境...
    python -m venv venv
)

:: 安装依赖
echo [..] 安装后端依赖...
call venv\Scripts\pip install -r requirements.txt -q
echo [OK] 后端依赖安装完成

echo.
echo --- 2. 初始化前端依赖 ---
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [..] 安装前端依赖...
    call npm install
    echo [OK] 前端依赖安装完成
) else (
    echo [OK] 前端依赖已安装
)

echo.
echo --- 3. 启动服务 ---
echo.
echo [..] 启动后端服务 (http://localhost:8000)
cd /d "%~dp0backend"
start "后端服务" cmd /c "call venv\Scripts\python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo [..] 启动前端服务 (http://localhost:5173)
cd /d "%~dp0frontend"
start "前端服务" cmd /c "npm run dev"

echo.
echo ============================================
echo   启动完成！
echo.
echo   前端地址: http://localhost:5173
echo   后端地址: http://localhost:8000
echo   API 文档: http://localhost:8000/docs
echo.
echo   关闭页面后请按任意键停止所有服务...
echo ============================================
echo.
pause >nul

:: 关闭启动的窗口
echo [..] 正在停止服务...
taskkill /fi "windowtitle eq 后端服务" /f >nul 2>&1
taskkill /fi "windowtitle eq 前端服务" /f >nul 2>&1
echo [OK] 服务已停止
pause
