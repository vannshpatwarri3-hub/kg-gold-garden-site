@echo off
REM Launcher for the KG Gold Garden caretaker heartbeat.
REM Kept as a .cmd so Task Scheduler needs no complicated quoting.
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0heartbeat.ps1" -Quiet
exit /b %ERRORLEVEL%
