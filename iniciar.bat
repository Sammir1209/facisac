@echo off
title FACISAC - Panel Modular SUNAT RCE & SIRE
color 0b
echo =======================================================
echo    INICIANDO PLATAFORMA MODULAR SUNAT (NEXT.JS + HEROUI)
echo =======================================================
echo.
cd /d "%~dp0"

:: Liberar puertos 3000 y 3001 si estuvieran ocupados previamente
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo 1. Iniciando Servicio API Backend en puerto 3000...
start "Backend Playwright API" /min cmd /c "node server.js"

timeout /t 2 /nobreak >nul

echo 2. Iniciando Frontend Modular Next.js en puerto 3001...
cd /d "%~dp0\frontend"
start "Frontend Next.js" /min cmd /c "npm run dev -- -p 3001"

timeout /t 3 /nobreak >nul

echo 3. Abriendo Panel de Control en tu navegador...
start http://localhost:3001

echo.
echo =======================================================
echo    SISTEMA LISTO Y OPERATIVO EN: http://localhost:3001
echo =======================================================
echo.
pause
