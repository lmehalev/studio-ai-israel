@echo off
title Studio AI - Internal System
echo.
echo  ===================================
echo   Studio AI - Starting...
echo  ===================================
echo.

:: Kill any existing processes on ports 3001 and 8080
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8080" ^| findstr "LISTENING" 2^>nul') do taskkill /F /PID %%a >nul 2>&1

timeout /t 2 /nobreak >nul

echo [1/2] Starting API Server on port 3001...
start "Studio AI - API Server" cmd /k "cd /d %~dp0server && node index.js"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend on port 8080...
start "Studio AI - Frontend" cmd /k "cd /d %~dp0 && npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo  ===================================
echo   Ready!
echo   Open: http://localhost:8080
echo  ===================================
echo.
start "" "http://localhost:8080"
pause
