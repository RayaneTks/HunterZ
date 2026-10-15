@echo off
:: HunterZ Stealth Disable — kills Windows Defender + telemetry + reactivation triggers.
:: Must run as Administrator. Tamper Protection must be OFF manually first
:: (Windows Security > Virus & threat protection > Manage settings > Tamper Protection = Off).

net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [-] Lance en Administrateur. Clic droit ^> Executer en tant qu'administrateur.
    pause
    exit /b 1
)

echo ============================================================
echo   HunterZ Stealth Disable
echo   AV, Defender, SmartScreen, auto-restart tous coupes.
echo   Pour reactiver: stealth_enable.bat
echo ============================================================
echo.

:: ---------------------------------------------------------------------------
:: 1. Group Policy locks — survivent au reboot, bloquent Defender au demarrage.
:: ---------------------------------------------------------------------------
echo [*] Verrous Group Policy Defender...
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender" /v DisableAntiSpyware /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender" /v DisableAntiVirus  /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection" /v DisableRealtimeMonitoring /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection" /v DisableBehaviorMonitoring /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection" /v DisableOnAccessProtection /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection" /v DisableScanOnRealtimeEnable /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Real-Time Protection" /v DisableIOAVProtection /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Spynet" /v SubmitSamplesConsent /t REG_DWORD /d 2 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Spynet" /v SpynetReporting      /t REG_DWORD /d 0 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\MpEngine" /v MpEnablePus /t REG_DWORD /d 0 /f >nul

:: ---------------------------------------------------------------------------
:: 2. SmartScreen + reputation
:: ---------------------------------------------------------------------------
echo [*] SmartScreen off...
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows\System" /v EnableSmartScreen /t REG_DWORD /d 0 /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer" /v SmartScreenEnabled /t REG_SZ /d Off /f >nul
reg add "HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\AppHost" /v EnableWebContentEvaluation /t REG_DWORD /d 0 /f >nul

:: ---------------------------------------------------------------------------
:: 3. Services — disabled startup empeche Windows de les relancer.
:: ---------------------------------------------------------------------------
echo [*] Services AV/telemetrie...
for %%S in (WinDefend WdNisSvc Sense WdNisDrv WdFilter SecurityHealthService SgrmBroker DiagTrack dmwappushservice) do (
    sc stop   "%%S" >nul 2>&1
    sc config "%%S" start= disabled >nul 2>&1
)

:: ---------------------------------------------------------------------------
:: 4. Scheduled tasks Defender — empeche la reactivation automatique.
:: ---------------------------------------------------------------------------
echo [*] Taches planifiees Defender off...
for %%T in (
    "\Microsoft\Windows\Windows Defender\Windows Defender Cache Maintenance"
    "\Microsoft\Windows\Windows Defender\Windows Defender Cleanup"
    "\Microsoft\Windows\Windows Defender\Windows Defender Scheduled Scan"
    "\Microsoft\Windows\Windows Defender\Windows Defender Verification"
    "\Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser"
    "\Microsoft\Windows\Customer Experience Improvement Program\Consolidator"
    "\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip"
) do (
    schtasks /Change /TN %%T /DISABLE >nul 2>&1
)

:: ---------------------------------------------------------------------------
:: 5. Firewall — bypass pour cs2.exe + HunterZLauncher.exe
:: ---------------------------------------------------------------------------
echo [*] Firewall autoriser cs2.exe + HunterZLauncher.exe...
set "HUNTERZ_DIR=%~dp0.."
for %%E in ("%HUNTERZ_DIR%\launcher\HunterZLauncher.exe") do (
    netsh advfirewall firewall delete rule name="HunterZ Launcher" >nul 2>&1
    netsh advfirewall firewall add rule name="HunterZ Launcher" dir=in action=allow program="%%~fE" enable=yes >nul 2>&1
    netsh advfirewall firewall add rule name="HunterZ Launcher" dir=out action=allow program="%%~fE" enable=yes >nul 2>&1
)

:: ---------------------------------------------------------------------------
:: 6. Defender exclusions (persistent via policy)
:: ---------------------------------------------------------------------------
echo [*] Exclusions Defender sur dossier HunterZ...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Add-MpPreference -ExclusionPath '%HUNTERZ_DIR%' -ErrorAction Stop; Add-MpPreference -ExclusionProcess 'HunterZLauncher.exe' -ErrorAction Stop; Add-MpPreference -ExclusionProcess 'HunterZ.dll' -ErrorAction Stop; Add-MpPreference -ExclusionProcess 'cs2.exe' -ErrorAction Stop } catch { Write-Host '[!] Add-MpPreference bloque par Tamper Protection — desactive-la manuellement.' }"

:: Persistent policy exclusions (survive reboot + tamper)
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Exclusions"           /v Exclusions_Paths     /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Exclusions\Paths"     /v "%HUNTERZ_DIR%"      /t REG_SZ    /d 0 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Exclusions\Processes" /v "HunterZLauncher.exe" /t REG_SZ   /d 0 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Exclusions\Processes" /v "HunterZ.dll"         /t REG_SZ   /d 0 /f >nul
reg add "HKLM\SOFTWARE\Policies\Microsoft\Windows Defender\Exclusions\Processes" /v "cs2.exe"             /t REG_SZ   /d 0 /f >nul

:: ---------------------------------------------------------------------------
:: 7. Marqueur d'etat — detecte si deja applique.
:: ---------------------------------------------------------------------------
echo DISABLED > "%HUNTERZ_DIR%\tools\.stealth_state"
echo %DATE% %TIME% >> "%HUNTERZ_DIR%\tools\.stealth_state"

echo.
echo ============================================================
echo   [+] Stealth applique. Reboot recommande pour effet complet.
echo   [!] Si Tamper Protection active, desactive-la a la main:
echo       Windows Security ^> Virus ^& threat protection ^>
echo       Manage settings ^> Tamper Protection = Off
echo   Pour reactiver tout: tools\stealth_enable.bat
echo ============================================================
pause
