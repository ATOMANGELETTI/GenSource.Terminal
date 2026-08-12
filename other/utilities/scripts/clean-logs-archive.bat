@echo off
setlocal EnableExtensions

rem Delete all *.7z under other/utilities/scripts/archive/ (keeps .gitkeep).

pushd "%~dp0" || exit /b 1

set "ARCHIVEDIR=%~dp0archive"

if not exist "%ARCHIVEDIR%" (
  echo Archive directory not found: "%ARCHIVEDIR%"
  popd
  exit /b 0
)

if exist "%ARCHIVEDIR%\*.7z" (
  del /q "%ARCHIVEDIR%\*.7z"
  echo Deleted archive files in "%ARCHIVEDIR%"
) else (
  echo No archive .7z files to delete.
)

popd
exit /b 0
