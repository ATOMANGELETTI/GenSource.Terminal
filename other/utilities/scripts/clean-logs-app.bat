@echo off
setlocal EnableExtensions

rem Delete *.log under other/logging/app/ (keeps .gitkeep).

pushd "%~dp0" || exit /b 1

set "APPDIR=%~dp0..\..\logging\app"

if not exist "%APPDIR%" (
  echo App log directory not found: "%APPDIR%"
  popd
  exit /b 0
)

if exist "%APPDIR%\*.log" (
  del /q "%APPDIR%\*.log"
  echo Deleted app logs in "%APPDIR%"
) else (
  echo No app log files to delete.
)

popd
exit /b 0
