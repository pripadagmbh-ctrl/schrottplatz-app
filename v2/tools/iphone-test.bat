@echo off
setlocal enableextensions
title Schrottplatz-App - iPhone-Test
set "LOG=%~dp0iphone-test-log.txt"
echo ==== Schrottplatz iPhone-Test ==== > "%LOG%"
echo Gestartet: %DATE% %TIME% >> "%LOG%"
echo BAT-Ordner: %~dp0 >> "%LOG%"
echo. >> "%LOG%"
cd /d "%~dp0..\..\prototype"
echo Aktueller Ordner: %CD% >> "%LOG%"
if not exist package.json (
  echo FEHLER: package.json nicht gefunden - falscher Ordner. >> "%LOG%"
  echo FEHLER: package.json nicht gefunden - falscher Ordner.
  echo Log: %LOG%
  pause
  exit /b 1
)
echo. >> "%LOG%"
echo ---- npm-Pfad ---- >> "%LOG%"
where npm >> "%LOG%" 2>&1
if errorlevel 1 (
  echo FEHLER: npm nicht gefunden. Node.js fehlt oder ist nicht im PATH. >> "%LOG%"
  echo FEHLER: npm nicht gefunden. Bitte Node.js LTS von nodejs.org installieren.
  echo Log: %LOG%
  pause
  exit /b 1
)
echo. >> "%LOG%"
echo ---- Netzwerkadressen ---- >> "%LOG%"
ipconfig >> "%LOG%" 2>&1
echo. >> "%LOG%"
echo ---- Node-Version ---- >> "%LOG%"
call node -v >> "%LOG%" 2>&1
call npm -v >> "%LOG%" 2>&1
echo. >> "%LOG%"
if not exist node_modules (
  echo Installiere Abhaengigkeiten, das dauert einmalig ca. 1 Minute...
  echo ---- npm install ---- >> "%LOG%"
  call npm install >> "%LOG%" 2>&1
)
echo Build laeuft, bitte warten...
echo ---- npm run build ---- >> "%LOG%"
call npm run build >> "%LOG%" 2>&1
if errorlevel 1 (
  echo BUILD FEHLGESCHLAGEN - siehe Log. >> "%LOG%"
  echo BUILD FEHLGESCHLAGEN. Details stehen in: %LOG%
  pause
  exit /b 1
)
echo BUILD OK >> "%LOG%"
echo.
echo ============================================================
echo  Build fertig. Der Server startet jetzt.
echo  Gleich erscheint eine Zeile "Network:  http://192.168...:4173"
echo  Diese Adresse auf dem iPhone in Safari eintippen.
echo  Fenster offen lassen. Beenden mit Strg+C.
echo ============================================================
echo.
echo ---- vite preview ---- >> "%LOG%"
call npx vite preview --host --port 4173
echo Server beendet. >> "%LOG%"
pause
