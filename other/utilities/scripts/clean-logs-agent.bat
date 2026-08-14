@echo off
setlocal EnableExtensions

rem Delete *.log under other/logging/agent/ (keeps .gitkeep).

pushd "%~dp0" || exit /b 1

set "AGENTDIR=%~dp0..\..\logging\agent"

if not exist "%AGENTDIR%" (
  echo Agent log directory not found: "%AGENTDIR%"
  popd
  exit /b 0
)

if exist "%AGENTDIR%\*.log" (
  del /q "%AGENTDIR%\*.log"
  echo Deleted agent logs in "%AGENTDIR%"
) else (
  echo No agent log files to delete.
)

popd
exit /b 0
