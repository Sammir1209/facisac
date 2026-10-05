@echo off
title FACISAC - Sistema Unificado Todo-en-Uno
color 0b
echo =======================================================
echo    INICIANDO SISTEMA UNIFICADO FACISAC RCE SUNAT
echo =======================================================
echo.
cd /d "%~dp0"

:: Cerrar procesos previos en puerto 3000 si estuvieran ocupados
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do taskkill /f /pid %%a >nul 2>&1

echo Iniciando servidor y panel integrado en http://localhost:3000...
node facisac_app.js
pause
