// HunterZ DLL — Entry point + stubs
// src/dllmain.cpp

#include <Common/Common.hpp>
#include <AndromedaClient/CAndromedaClient.hpp>
#include <CS2/CHook_Loader.hpp>
#include <CS2/CFunctionList.hpp>
#include <CS2/CSDK_Loader.hpp>
#include <Common/CrashLog.hpp>
#include <HzLog.hpp>

// ── Stubs pour les symboles manquants ────────────────────────────────────────

class CDllLauncher {
public:
    std::string m_DllDir;
    std::string m_CS2Dir;
    HINSTANCE   m_hDllImage  = nullptr;
    DWORD       m_SizeofImage = 0;
    DWORD       m_BaseOfCode  = 0;
    bool        m_bDestroyed  = false;

    void OnDestroy()
    {
        if ( !m_bDestroyed )
        {
            GetHook_Loader()->DestroyHooks();
            m_bDestroyed = true;
        }
    }

    static DWORD WINAPI StartCheatTheard( LPVOID );
};

static CDllLauncher g_Launcher{};

auto GetDllLauncher() -> CDllLauncher* { return &g_Launcher; }
auto GetDllDir()      -> std::string&  { return g_Launcher.m_DllDir; }
auto GetCS2Dir()      -> std::string   { return g_Launcher.m_CS2Dir; }

// Hook_CDemoRecorder stub — désactivé MVP
class CDemoRecorder; class CNetworkSerializerPB; class CNetMessagePB;
auto Hook_CDemoRecorder( CDemoRecorder*, CNetworkSerializerPB*, CNetMessagePB* ) -> bool { return false; }

// ── Thread principal ─────────────────────────────────────────────────────────

static DWORD WINAPI HunterZ_Thread( LPVOID lpParam )
{
    HzLog( "==== HunterZ_Thread start ====" );

    // Paths
    char szPath[MAX_PATH]{};
    GetModuleFileNameA( g_Launcher.m_hDllImage, szPath, MAX_PATH );
    std::string p( szPath );
    g_Launcher.m_DllDir = p.substr( 0, p.find_last_of( '\\' ) ) + '\\';
    HzLog( "DllDir=%s", g_Launcher.m_DllDir.c_str() );

    char szGame[MAX_PATH]{};
    GetModuleFileNameA( nullptr, szGame, MAX_PATH );
    std::string gp( szGame );
    g_Launcher.m_CS2Dir = gp.substr( 0, gp.find_last_of( '\\' ) ) + '\\';
    HzLog( "CS2Dir=%s", g_Launcher.m_CS2Dir.c_str() );

    GetCrashLog()->InitVectorExceptionHandler();
    HzLog( "CrashLog init OK" );

    // All init stages are best-effort. The GUI critical path lives inside
    // InstallSecondHook (DXGI vtable hook). Nothing else is allowed to abort
    // the thread before that call runs.
    if ( !GetHook_Loader()->InitalizeMH() ) {
        HzLog( "[FATAL] MH_Initialize failed — ABORT, menu cannot render" );
        return 0;
    }
    HzLog( "MH_Initialize OK" );

    if ( !GetHook_Loader()->InstallFirstHook() )
        HzLog( "[warn] InstallFirstHook failed (SOCacheSubscribed) — inventory features dead, menu still lives" );
    else
        HzLog( "InstallFirstHook OK" );

    GetFunctionList()->OnInit();
    HzLog( "FunctionList::OnInit done" );

    if ( !GetSDK_Loader()->LoadSDK() )
        HzLog( "[warn] SDK_Loader::LoadSDK partial — some features will no-op, menu still lives" );
    else
        HzLog( "SDK_Loader::LoadSDK OK" );

    if ( !GetHook_Loader()->InstallSecondHook() ) {
        HzLog( "[FATAL] InstallSecondHook failed — DXGI hooks could not install, menu dead" );
        return 0;
    }
    HzLog( "InstallSecondHook OK — DXGI hooks live" );

    GetHzClient()->OnInit();
    HzLog( "HzClient::OnInit OK — ready. Press F1 in CS2." );
    return 0;
}

DWORD WINAPI CDllLauncher::StartCheatTheard( LPVOID lpParam )
{
    return HunterZ_Thread( lpParam );
}

// ── DllMain ──────────────────────────────────────────────────────────────────

BOOL WINAPI DllMain( HINSTANCE hInstance, DWORD dwReason, LPVOID lpReserved )
{
    if ( dwReason == DLL_PROCESS_ATTACH )
    {
        HzLog( "==== DllMain DLL_PROCESS_ATTACH ====" );
        DisableThreadLibraryCalls( hInstance );
        g_Launcher.m_hDllImage = hInstance;
        HANDLE th = CreateThread( nullptr, 0, HunterZ_Thread, lpReserved, 0, nullptr );
        if ( th ) { HzLog( "HunterZ_Thread spawned OK" ); CloseHandle( th ); }
        else      { HzLog( "[FATAL] CreateThread failed err=%lu", GetLastError() ); }
    }
    else if ( dwReason == DLL_PROCESS_DETACH )
    {
        HzLog( "==== DllMain DLL_PROCESS_DETACH ====" );
        g_Launcher.OnDestroy();
    }
    return TRUE;
}
