@echo off
REM Mantem o espelho na nuvem alinhado com o MAS local, nos dois sentidos:
REM   push  assets do MAS  -> Supabase (o Roi le dali)
REM   pull  revisoes salvas -> MAS     (o que ele salvou com sua maquina desligada)
REM
REM Requer o MAS no ar em localhost:8000 (start-dashboard.bat).
REM Agendar a cada 30 min:
REM   schtasks /Create /TN "Yedda MAS Mirror Sync" /SC MINUTE /MO 30 /TR "'%~f0'"

cd /d "%~dp0"

set "PY=C:\Users\Admin\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe"
if not exist "%PY%" set "PY=python"

"%PY%" -X utf8 scripts\sync_mas_mirror.py

if errorlevel 1 (
  echo.
  echo [WARN] Sync terminou com falhas — veja as linhas [FAIL] acima.
)
