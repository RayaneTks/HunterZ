#include "Hook_OnClientOutput.hpp"

#include <AndromedaClient/CAndromedaClient.hpp>
#include <AndromedaClient/Render/CRenderStackSystem.hpp>
#include <AndromedaClient/Settings/Settings.hpp>

auto Hook_OnClientOutput( void* a1 , void* a2 , void* a3 , void* a4 ) -> void
{
	// Only tick render-stack when visuals are active; otherwise the
	// RenderStackSystem walks entity cache + schema offsets each frame
	// which is where stale offsets translate to crashes on map load.
	if ( Settings::Visual::Active ) {
		GetHzClient()->OnClientOutput();
		GetRenderStackSystem()->OnClientOutput();
	}

	return OnClientOutput_o( a1 , a2 , a3 , a4 );
}
