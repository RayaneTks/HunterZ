#include "Hook_OnAddEntity.hpp"

#include <AndromedaClient/CAndromedaClient.hpp>
#include <AndromedaClient/Settings/Settings.hpp>

auto Hook_OnAddEntity( CGameEntitySystem* pCGameEntitySystem , CEntityInstance* pInst , CHandle handle ) -> void
{
	// Entity cache walks CEntityInstance via schema offsets — if any offset is
	// stale, the walk crashes on map load (hundreds of spawns in <1s).
	if ( Settings::Visual::Active || Settings::Aimbot::Active || Settings::SilentAim::Active )
		GetHzClient()->OnAddEntity( pInst , handle );

	return OnAddEntity_o( pCGameEntitySystem , pInst , handle );
}
