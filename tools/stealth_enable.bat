@echo off
:: HunterZ Stealth Enable — restaure Windows Defender + telemetrie + reactivation.
:: Must run as Administrator.

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [-] Lance en Administrateur.
    pause
    exit /b 1
)

echo ============================================================
echo   HunterZ Stealth Enable — restauration des protections
echo ============================================================
echo.

:: ---------------------------------------------------------------------------
:: 1. Supprime les verrous Group Policy.
:: ---------------------------------------------------------------------------
echo [*] Suppression verrous Group Policy...
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender" /f >nul 2>&1
reg delete "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v EnableSmartScreen /f >nul 2>&1
reg add    "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer" /v SmartScreenEnabled /t REG_SZ /d RequireAdmin /f >nul
reg add    "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\AppHost" /v EnableWebContentEvaluation /t REG_DWORD /d 1 /f >nul

:: ---------------------------------------------------------------------------
:: 2. Services — remet en Automatic (ou Manual pour certains).
:: ---------------------------------------------------------------------------
echo [*] Services AV/telemetrie restores...
sc config WinDefend             start= auto    >nul 2>&1
sc config WdNisSvc              start= manual  >nul 2>&1
sc config Sense                 start= manual  >nul 2>&1
sc config WdNisDrv              start= manual  >nul 2>&1
sc config WdFilter              start= boot    >nul 2>&1
sc config SecurityHealthService start= manual  >nul 2>&1
sc config SgrmBroker            start= auto    >nul 2>&1
sc config DiagTrack             start= auto    >nul 2>&1
sc config dmwappushservice      start= manual  >nul 2>&1

sc start WinDefend             >nul 2>&1
sc start SecurityHealthService >nul 2>&1

:: ---------------------------------------------------------------------------
:: 3. Scheduled tasks — reactive.
:: ---------------------------------------------------------------------------
echo [*] Taches planifiees Defender on...
for %%T in (
    "\Microsoft\Windows\Windows Defender\Windows Defender Cache Maintenance"
    "\Microsoft\Windows\Windows Defender\Windows Defender Cleanup"
    "\Microsoft\Windows\Windows Defender\Windows Defender Scheduled Scan"
    "\Microsoft\Windows\Windows Defender\Windows Defender Verification"
    "\Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser"
    "\Microsoft\Windows\Customer Experience Improvement Program\Consolidator"
    "\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip"
) do (
    schtasks /Change /TN %%T /ENABLE >nul 2>&1
)

:: ---------------------------------------------------------------------------
:: 4. Firewall rules HunterZ supprimees.
:: ---------------------------------------------------------------------------
echo [*] Suppression regles firewall HunterZ...
netsh advfirewall firewall delete rule name="HunterZ Launcher" >nul 2>&1

:: ---------------------------------------------------------------------------
:: 5. Retire exclusions Defender.
:: ---------------------------------------------------------------------------
echo [*] Retrait exclusions Defender...
set "HUNTERZ_DIR=%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Remove-MpPreference -ExclusionPath '%HUNTERZ_DIR%' -ErrorAction SilentlyContinue; Remove-MpPreference -ExclusionProcess 'HunterZLauncher.exe' -ErrorAction SilentlyContinue; Remove-MpPreference -ExclusionProcess 'HunterZ.dll' -ErrorAction SilentlyContinue; Remove-MpPreference -ExclusionProcess 'cs2.exe' -ErrorAction SilentlyContinue; Set-MpPreference -DisableRealtimeMonitoring $false -ErrorAction SilentlyContinue } catch { }"

:: ---------------------------------------------------------------------------
:: 6. Marqueur.
:: ---------------------------------------------------------------------------
if exist "%HUNTERZ_DIR%\tools\.stealth_state" del /f /q "%HUNTERZ_DIR%\tools\.stealth_state"
echo ENABLED > "%HUNTERZ_DIR%\tools\.stealth_state"
echo %DATE% %TIME% >> "%HUNTERZ_DIR%\tools\.stealth_state"

echo.
echo ============================================================
echo   [+] Protections restaurees.
echo   [!] Reboot recommande pour forcer Defender a se relancer.
echo ============================================================
pause
