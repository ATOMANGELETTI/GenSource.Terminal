@echo off
setlocal EnableExtensions

rem Delete *.log under other/logging/build/ (keeps .gitkeep).

pushd "%~dp0" || exit /b 1

set "BUILDDIR=%~dp0..\..\logging\build"

if not exist "%BUILDDIR%" (
  echo Build log directory not found: "%BUILDDIR%"
  popd
  exit /b 0
)

if exist "%BUILDDIR%\*.log" (
  del /q "%BUILDDIR%\*.log"
  echo Deleted build logs in "%BUILDDIR%"
) else (
  echo No build log files to delete.
)

popd
exit /b 0
