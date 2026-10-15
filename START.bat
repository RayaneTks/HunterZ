@echo off
:: HunterZ — one-click launcher.
:: Attend que CS2 soit lance, puis injecte en admin.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Relance ce script en Administrateur.
    echo    Clic droit ^> Executer en tant qu'administrateur.
    pause
    exit /b 1
)

echo ============================================================
echo   HunterZ Launcher
echo ============================================================
echo.

if not exist "%~dp0launcher\HunterZ.dll" (
    echo [-] launcher\HunterZ.dll introuvable.
    echo    Lance launcher\build.bat pour recompiler.
    pause
    exit /b 1
)
if not exist "%~dp0launcher\HunterZLauncher.exe" (
    echo [-] launcher\HunterZLauncher.exe introuvable.
    echo    Lance launcher\build.bat pour recompiler.
    pause
    exit /b 1
)

echo [*] Verification cs2.exe...
tasklist /FI "IMAGENAME eq cs2.exe" 2>nul | find /I "cs2.exe" >nul
if errorlevel 1 (
    echo [-] cs2.exe n'est pas lance.
    echo    1. Lance CS2 via Steam
    echo    2. Attends le menu principal
    echo    3. Relance ce script
    pause
    exit /b 1
)

echo [+] cs2.exe detecte. Injection...
echo.
cd /d "%~dp0launcher"
HunterZLauncher.exe
