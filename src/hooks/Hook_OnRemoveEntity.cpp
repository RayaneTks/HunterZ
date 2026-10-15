#include "Hook_OnRemoveEntity.hpp"

#include <AndromedaClient/CAndromedaClient.hpp>
#include <AndromedaClient/Settings/Settings.hpp>

auto Hook_OnRemoveEntity( CGameEntitySystem* pCGameEntitySystem , CEntityInstance* pInst , CHandle handle ) -> void
{
	if ( Settings::Visual::Active || Settings::Aimbot::Active || Settings::SilentAim::Active )
		GetHzClient()->OnRemoveEntity( pInst , handle );

	return OnRemoveEntity_o( pCGameEntitySystem , pInst , handle );
}
