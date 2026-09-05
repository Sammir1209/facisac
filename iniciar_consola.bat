@echo off
title SUNAT RCE Automator - Consola Directa
color 0b
echo ======================================================================
echo           SISTEMA DE MODIFICACION RCE EN VIVO (CONSOLA DIRECTA)
echo ======================================================================
echo.
echo Este script ejecuta el navegador Chrome visible y te permite seleccionar
echo cualquier empresa de tu lista o procesar la cartera completa.
echo.
cd /d "%~dp0"
node cli_runner.js
pause
