#include "CHook_Loader.hpp"

#include <Common/MemoryEngine.hpp>
#include <MinHook/MinHook.h>
#include <HzLog.hpp>

#include <d3d11.h>
#include <dxgi.h>
#pragma comment(lib, "d3d11.lib")
#pragma comment(lib, "dxgi.lib")

#include <CS2/SDK/SDK.hpp>

#include <CS2/Hook/Hook_SOCacheSubscribed.hpp>
#include <CS2/Hook/Hook_Present.hpp>
#include <CS2/Hook/Hook_ResizeBuffers.hpp>
#include <CS2/Hook/Hook_CreateSwapChain.hpp>
#include <CS2/Hook/Hook_MouseInputEnabled.hpp>
#include <CS2/Hook/Hook_FireEventClientSide.hpp>
#include <CS2/Hook/Hook_OnAddEntity.hpp>
#include <CS2/Hook/Hook_OnRemoveEntity.hpp>
#include <CS2/Hook/Hook_FrameStageNotify.hpp>
#include <CS2/Hook/Hook_GetMatricesForView.hpp>
#include <CS2/Hook/Hook_CreateMove.hpp>
#include <CS2/Hook/Hook_OnClientOutput.hpp>
#include <CS2/Hook/Hook_ParseMessage.hpp>
#include <CS2/Hook/Hook_IsRelativeMouseMode.hpp>
#include <CS2/Hook/Hook_AntiTamper.hpp>
#include <CS2/Hook/Hook_IsLoadoutAllowed.hpp>
#include <CS2/Hook/Hook_EquipItemInLoadout.hpp>
#include <CS2/Hook/Hook_DrawGlow.hpp>

static CHook_Loader g_CHook_Loader{};

// Fetches real IDXGISwapChain::Present / ResizeBuffers / IDXGIFactory::CreateSwapChain
// targets from a dummy D3D11 device. Overlay-independent — works whether or not
// gameoverlayrenderer64.dll is loaded or Steam has shifted its signatures.
static bool FetchDXGITargets( void** outPresent , void** outResizeBuffers , void** outCreateSwapChain )
{
	*outPresent = *outResizeBuffers = *outCreateSwapChain = nullptr;

	WNDCLASSEXW wc = { sizeof( wc ) };
	wc.lpfnWndProc   = DefWindowProcW;
	wc.hInstance     = GetModuleHandleW( nullptr );
	wc.lpszClassName = L"HzDummyWnd";
	RegisterClassExW( &wc );

	HWND hwnd = CreateWindowExW( 0 , wc.lpszClassName , L"" , WS_OVERLAPPEDWINDOW ,
		0 , 0 , 2 , 2 , nullptr , nullptr , wc.hInstance , nullptr );
	if ( !hwnd )
	{
		UnregisterClassW( wc.lpszClassName , wc.hInstance );
		return false;
	}

	DXGI_SWAP_CHAIN_DESC sd = {};
	sd.BufferCount                        = 1;
	sd.BufferDesc.Width                   = 100;
	sd.BufferDesc.Height                  = 100;
	sd.BufferDesc.Format                  = DXGI_FORMAT_R8G8B8A8_UNORM;
	sd.BufferDesc.RefreshRate.Numerator   = 60;
	sd.BufferDesc.RefreshRate.Denominator = 1;
	sd.BufferUsage                        = DXGI_USAGE_RENDER_TARGET_OUTPUT;
	sd.OutputWindow                       = hwnd;
	sd.SampleDesc.Count                   = 1;
	sd.Windowed                           = TRUE;
	sd.SwapEffect                         = DXGI_SWAP_EFFECT_DISCARD;

	ID3D11Device*        pDev = nullptr;
	ID3D11DeviceContext* pCtx = nullptr;
	IDXGISwapChain*      pSwap = nullptr;
	D3D_FEATURE_LEVEL    fl;

	HRESULT hr = D3D11CreateDeviceAndSwapChain(
		nullptr , D3D_DRIVER_TYPE_HARDWARE , nullptr , 0 ,
		nullptr , 0 , D3D11_SDK_VERSION , &sd , &pSwap , &pDev , &fl , &pCtx );

	if ( FAILED( hr ) || !pSwap )
	{
		DestroyWindow( hwnd );
		UnregisterClassW( wc.lpszClassName , wc.hInstance );
		return false;
	}

	void** scVt = *reinterpret_cast<void***>( pSwap );
	*outPresent       = scVt[8];  // IDXGISwapChain::Present
	*outResizeBuffers = scVt[13]; // IDXGISwapChain::ResizeBuffers

	// IDXGIFactory::CreateSwapChain lives on the factory, index 10
	IDXGIDevice*  pDxgiDev  = nullptr;
	IDXGIAdapter* pAdapter  = nullptr;
	IDXGIFactory* pFactory  = nullptr;
	if ( SUCCEEDED( pDev->QueryInterface( IID_PPV_ARGS( &pDxgiDev ) ) ) )
	{
		if ( SUCCEEDED( pDxgiDev->GetAdapter( &pAdapter ) ) )
		{
			if ( SUCCEEDED( pAdapter->GetParent( IID_PPV_ARGS( &pFactory ) ) ) )
			{
				void** facVt = *reinterpret_cast<void***>( pFactory );
				*outCreateSwapChain = facVt[10];
				pFactory->Release();
			}
			pAdapter->Release();
		}
		pDxgiDev->Release();
	}

	pSwap->Release();
	pCtx->Release();
	pDev->Release();
	DestroyWindow( hwnd );
	UnregisterClassW( wc.lpszClassName , wc.hInstance );
	return true;
}

static bool InstallDXGIHooks()
{
	void* pPresent = nullptr;
	void* pResizeBuffers = nullptr;
	void* pCreateSwapChain = nullptr;

	HzLog( "DXGI: fetching vtable via dummy D3D11 device..." );
	if ( !FetchDXGITargets( &pPresent , &pResizeBuffers , &pCreateSwapChain ) || !pPresent || !pResizeBuffers )
	{
		HzLog( "[FATAL] DXGI vtable fetch failed — D3D11CreateDeviceAndSwapChain unavailable in CS2 process" );
		return false;
	}
	HzLog( "DXGI: Present=%p ResizeBuffers=%p CreateSwapChain=%p", pPresent, pResizeBuffers, pCreateSwapChain );

	MH_STATUS s1 = MH_CreateHook( pPresent , &Hook_Present , reinterpret_cast<LPVOID*>( &Present_o ) );
	HzLog( "MH_CreateHook Present status=%d", s1 );
	if ( s1 != MH_OK ) return false;

	MH_STATUS s2 = MH_CreateHook( pResizeBuffers , &Hook_ResizeBuffers , reinterpret_cast<LPVOID*>( &ResizeBuffers_o ) );
	HzLog( "MH_CreateHook ResizeBuffers status=%d", s2 );
	if ( s2 != MH_OK ) return false;

	if ( pCreateSwapChain ) {
		MH_STATUS s3 = MH_CreateHook( pCreateSwapChain , &Hook_CreateSwapChain , reinterpret_cast<LPVOID*>( &CreateSwapChain_o ) );
		HzLog( "MH_CreateHook CreateSwapChain status=%d", s3 );
	}

	MH_STATUS e1 = MH_EnableHook( pPresent );
	MH_STATUS e2 = MH_EnableHook( pResizeBuffers );
	HzLog( "MH_EnableHook Present=%d ResizeBuffers=%d", e1, e2 );
	if ( pCreateSwapChain ) MH_EnableHook( pCreateSwapChain );

	return true;
}

auto CHook_Loader::InitalizeMH() -> bool
{
	return MH_Initialize() == MH_OK;
}

auto CHook_Loader::InstallFirstHook() -> bool
{
	m_Hooks =
	{
#if DISABLE_INVENTORY == 0
		{ { XorStr( "Hook::SOCacheSubscribed" ) , XorStr( "4C 8B DC 55 56 41 56 49 8D 6B" ) , CLIENT_DLL } , &Hook_SOCacheSubscribed , reinterpret_cast<LPVOID*>( &SOCacheSubscribed_o ) },
#endif
	};

	return InstallHooks();
}

auto CHook_Loader::InstallSecondHook() -> bool
{
	// Present / ResizeBuffers / CreateSwapChain hooked via DXGI vtable — no overlay dependency.
	if ( !InstallDXGIHooks() )
	{
		DEV_LOG( "[error] InstallDXGIHooks failed\n" );
		return false;
	}

	m_Hooks =
	{
		{ { XorStr( "Hook::MouseInputEnabled" ) , XorStr( "40 53 48 83 EC 20 80 B9 ? ? ? ? ? 48 8B D9 75 78" ) , CLIENT_DLL } , &Hook_MouseInputEnabled , reinterpret_cast<LPVOID*>( &MouseInputEnabled_o ) },
		{ { XorStr( "Hook::FireEventClientSide" ) , XorStr( "40 53 41 54 41 56 48 83 EC ? 4C 8B F2" ) , CLIENT_DLL } , &Hook_FireEventClientSide , reinterpret_cast<LPVOID*>( &FireEventClientSide_o ) },
		{ { XorStr( "Hook::OnAddEntity" ) , XorStr( "48 89 74 24 10 57 48 83 EC 20 41 B9 FF 7F 00 00 41 8B C0 41 23 C1 48 8B F2 41 83 F8 FF 48 8B F9 44 0F 45 C8 41 81 F9 00 40 00 00 73 0D" ) , CLIENT_DLL } , &Hook_OnAddEntity , reinterpret_cast<LPVOID*>( &OnAddEntity_o ) },
		{ { XorStr( "Hook::OnRemoveEntity" ) , XorStr( "48 89 74 24 10 57 48 83 EC 20 41 B9 FF 7F 00 00 41 8B C0 41 23 C1 48 8B F2 41 83 F8 FF 48 8B F9 44 0F 45 C8 41 81 F9 00 40 00 00 73 08" ) , CLIENT_DLL } , &Hook_OnRemoveEntity , reinterpret_cast<LPVOID*>( &OnRemoveEntity_o ) },
		{ { XorStr( "Hook::FrameStageNotify" ) , XorStr( "48 89 5C 24 ? 48 89 6C 24 ? 57 48 83 EC ? 48 8B F9 33 ED" ) , CLIENT_DLL } , &Hook_FrameStageNotify , reinterpret_cast<LPVOID*>( &FrameStageNotify_o ) },
		{ { XorStr( "Hook::GetMatricesForView" ) , XorStr( "48 8B C4 48 89 68 ? 48 89 70 ? 57 48 81 EC ? ? ? ? 0F 29 70 ? 49 8B F1" ) , CLIENT_DLL } , &Hook_GetMatricesForView , reinterpret_cast<LPVOID*>( &GetMatricesForView_o ) },
		{ { XorStr( "Hook::CreateMove" ) , XorStr( "85 D2 0F 85 ? ? ? ? 48 8B C4 44 88 40 18" ) , CLIENT_DLL } , &Hook_CreateMove , reinterpret_cast<LPVOID*>( &CreateMove_o ) },
		{ { XorStr( "Hook::SerializePartialToArray" ) , XorStr( "48 89 5C 24 ? 55 56 57 48 81 EC ? ? ? ? 48 8B 05 ? ? ? ? 48 33 C4 48 89 84 24 ? ? ? ? 49 63 F0" ) , CLIENT_DLL } , &Hook_MessageLite_SerializePartialToArray , reinterpret_cast<LPVOID*>( &MessageLite_SerializePartialToArray_o ) },
		{ { XorStr( "Hook::OnClientOutput" ) , XorStr( "4C 8B DC 49 89 5B ? 49 89 6B ? 49 89 73 ? 57 41 56 41 57 48 83 EC ? 49 C7" ) , ENGINE2_DLL } , &Hook_OnClientOutput , reinterpret_cast<LPVOID*>( &OnClientOutput_o ) },
		{ { XorStr( "Hook::CDemoRecorder" ) , XorStr( "40 56 57 41 57 48 83 EC ? 4C 8B F9" ) , ENGINE2_DLL } , &Hook_CDemoRecorder , reinterpret_cast<LPVOID*>( &CDemoRecorder_o ) },
		{ { XorStr( "Hook::IsRelativeMouseMode" ) , XorStr( "48 89 6C 24 ? 48 89 74 24 ? 48 89 7C 24 ? 41 56 48 83 EC ? 0F B6 F2" ) , INPUTSYSTEM_DLL } , &Hook_IsRelativeMouseMode , reinterpret_cast<LPVOID*>( &IsRelativeMouseMode_o ) },
		// Hook::AntiTamper + Hook::IsLoadoutAllowed removed — forcing a constant
		// return (false / true) interferes with CS2's loading state machine and
		// hangs the map load at ~50%. They can be re-enabled per-feature once
		// their effect on the current build is validated.
		{ { XorStr( "Hook::EquipItemInLoadout" ) , XorStr( "48 89 5C 24 ? 48 89 6C 24 ? 48 89 74 24 ? 89 54 24 ? 57 41 54 41 55 41 56 41 57 48 83 EC ? 0F B7 FA" ) , CLIENT_DLL } ,& Hook_EquipItemInLoadout , reinterpret_cast<LPVOID*>( &EquipItemInLoadout_o ) },
		{ { XorStr( "Hook::DrawGlow" ) , XorStr( "40 53 48 83 EC 20 48 8B 54" ) , CLIENT_DLL } , &Hook_DrawGlow , reinterpret_cast<LPVOID*>( &DrawGlow_o ) },
	};

	return InstallHooks();
}

auto CHook_Loader::InstallHooks() -> bool
{
	// Treat every feature pattern as best-effort: a broken signature should
	// NEVER kill the GUI or the hook pipeline. Log, skip, keep going.
	// Module wait is bounded so a wrong DLL name can't deadlock init.
	for ( auto& Hook : m_Hooks )
	{
		int waitMs = 0;
		while ( !GetModuleHandleA( Hook.m_Pattern.GetDllName() ) && waitMs < 10000 )
		{
			Sleep( 10 );
			waitMs += 10;
		}

		if ( !GetModuleHandleA( Hook.m_Pattern.GetDllName() ) )
		{
			DEV_LOG( "[warn] module not loaded for '%s' — skip\n" , Hook.m_Pattern.GetPatternName() );
			continue;
		}

		if ( !Hook.m_Pattern.Search( Hook.m_bSkipError ) )
		{
			if ( !Hook.m_bSkipError )
				DEV_LOG( "[warn] pattern miss '%s' — skip\n" , Hook.m_Pattern.GetPatternName() );
			continue;
		}

		auto Status = MH_CreateHook( Hook.m_Pattern.GetFunction() , Hook.m_pDetour , Hook.m_pOriginal );

		if ( Status != MH_OK )
		{
			DEV_LOG( "[warn] MH_CreateHook [%i] '%s' — skip\n" , Status , Hook.m_Pattern.GetPatternName() );
			continue;
		}
	}

	MH_EnableHook( MH_ALL_HOOKS );
	m_Hooks.clear();

	return true;
}

auto CHook_Loader::DestroyHooks() -> void
{
	MH_DisableHook( MH_ALL_HOOKS );
	MH_RemoveHook( MH_ALL_HOOKS );

	MH_Uninitialize();
}

auto GetHook_Loader() -> CHook_Loader*
{
	return &g_CHook_Loader;
}
