@echo off
setlocal

:: Locate vcvarsall.bat in BuildTools or any Visual Studio install.
set "VCVARS="
for %%P in (
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\2022\Professional\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files\Microsoft Visual Studio\2022\Enterprise\VC\Auxiliary\Build\vcvarsall.bat"
    "C:\Program Files (x86)\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
) do (
    if exist %%P set "VCVARS=%%~P"
)

if "%VCVARS%"=="" (
    for /f "tokens=*" %%i in ('where /r "C:\Program Files" vcvarsall.bat 2^>nul') do set "VCVARS=%%i"
)
if "%VCVARS%"=="" (
    for /f "tokens=*" %%i in ('where /r "C:\Program Files (x86)" vcvarsall.bat 2^>nul') do set "VCVARS=%%i"
)

if "%VCVARS%"=="" (
    echo [-] vcvarsall.bat introuvable.
    pause & exit /b 1
)

echo [+] vcvars: %VCVARS%
echo [+] Init environnement VS x64...
call "%VCVARS%" x64 >nul 2>&1

echo [+] Compilation launcher...
cl /nologo /O2 /EHsc /MT /GS- /GL launcher.cpp /link /SUBSYSTEM:CONSOLE /OUT:HunterZLauncher.exe /LTCG /OPT:REF /OPT:ICF
if errorlevel 1 ( echo [-] Compilation echouee. & pause & exit /b 1 )

if exist launcher.obj del /f launcher.obj >nul 2>&1
if exist HunterZLauncher.exp del /f HunterZLauncher.exp >nul 2>&1
if exist HunterZLauncher.lib del /f HunterZLauncher.lib >nul 2>&1

echo [+] Copie DLL et dependances...
copy /y "..\bin\Release\HunterZ.dll" "HunterZ.dll" >nul 2>&1
copy /y "..\third_party\blackbone\BlackBone.dll" "BlackBone.dll" >nul 2>&1
copy /y "..\third_party\blackbone\BeaEngine64.dll" "BeaEngine64.dll" >nul 2>&1
copy /y "..\third_party\blackbone\msdia140.dll" "msdia140.dll" >nul 2>&1

echo.
echo ============================================================
echo   [+] Pret.
echo   1. Lance CS2 et attends le menu principal
echo   2. Lance HunterZLauncher.exe en Administrateur
echo   3. Dans CS2, appuie INSERT pour ouvrir le menu
echo ============================================================
pause
