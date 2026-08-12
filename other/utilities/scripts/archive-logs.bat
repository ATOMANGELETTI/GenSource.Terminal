@echo off
setlocal EnableExtensions

rem Archive other/logging/app and other/logging/build into scripts/archive/*.7z via 7zr.exe,
rem then delete the archived *.log files (keeps .gitkeep).

pushd "%~dp0" || exit /b 1

set "SEVENZR=%~dp0..\7zr.exe"
set "APPDIR=%~dp0..\..\logging\app"
set "BUILDDIR=%~dp0..\..\logging\build"
set "ARCHIVEDIR=%~dp0archive"
set "LOGGINGDIR=%~dp0..\..\logging"

if not exist "%SEVENZR%" (
  echo ERROR: 7zr.exe not found at "%SEVENZR%"
  popd
  exit /b 1
)

if not exist "%ARCHIVEDIR%" mkdir "%ARCHIVEDIR%"

for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "Get-Date -Format 'HH-mm-ss_yyyy-MM-dd'"`) do set "TS=%%I"
if not defined TS (
  echo ERROR: Failed to build timestamp.
  popd
  exit /b 1
)

set "HASLOGS=0"
if exist "%APPDIR%\*.log" set "HASLOGS=1"
if exist "%BUILDDIR%\*.log" set "HASLOGS=1"
if "%HASLOGS%"=="0" (
  echo No log files to archive.
  popd
  exit /b 0
)

set "OUT=%ARCHIVEDIR%\logs_%TS%.7z"
echo Archiving logs to "%OUT%" ...

pushd "%LOGGINGDIR%" || (
  echo ERROR: logging directory not found: "%LOGGINGDIR%"
  popd
  exit /b 1
)

"%SEVENZR%" a -t7z -y -ssw "%OUT%" "app\*.log" "build\*.log"
set "RC=%ERRORLEVEL%"
popd

if not "%RC%"=="0" (
  echo ERROR: 7zr failed with exit code %RC%.
  popd
  exit /b %RC%
)

if exist "%APPDIR%\*.log" del /q "%APPDIR%\*.log"
if exist "%BUILDDIR%\*.log" del /q "%BUILDDIR%\*.log"

echo Archived and cleaned app/ and build/ logs.
popd
exit /b 0
