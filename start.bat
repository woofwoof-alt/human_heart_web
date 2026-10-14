@echo off
chcp 65001 >nul
rem Chay web server ngay trong thu muc web\ roi mo trinh duyet.
cd /d "%~dp0"

set "PY="
where py >nul 2>nul && set "PY=py"
if not defined PY (where python >nul 2>nul && set "PY=python")
if not defined PY (
  echo Khong tim thay Python 3. Cai tu python.org va tick "Add python.exe to PATH".
  pause
  exit /b 1
)

echo Web server: http://localhost:8000/   (dong cua so nay de dung)
start "" "http://localhost:8000/"
%PY% -m http.server 8000
