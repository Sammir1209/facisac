@echo off
title FACISAC - SISTEMAS • Auditor RCE SUNAT 2026
chcp 65001 >nul
color 0B

echo =====================================================================
echo              FACISAC - SISTEMAS • GESTOR AUTOMATIZADO RCE
echo =====================================================================
echo.
echo [*] Verificando entorno y permisos...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo [+] Ejecutando con privilegios de Administrador.
) else (
    echo [i] Modo estándar de usuario.
)

cd /d "%~dp0"

echo [*] Verificando dependencias nativas...
if not exist "WebView2Loader.dll" (
    if exist "src-tauri\target\release\WebView2Loader.dll" (
        copy /y "src-tauri\target\release\WebView2Loader.dll" "WebView2Loader.dll" >nul
    )
)

echo [*] Levantando el motor de automatización local (Node.js)...
start /min "FACISAC_MOTOR" node server.js

echo [*] Abriendo la aplicación de escritorio FACISAC - SISTEMAS...
start "" "%~dp0FACISAC-SISTEMAS.exe"

echo.
echo [+] ¡Sistema iniciado con éxito!
timeout /t 3 >nul
exit
