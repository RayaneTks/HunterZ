#include "Hook_IsRelativeMouseMode.hpp"

#include <AndromedaClient/CAndromedaGUI.hpp>

auto Hook_IsRelativeMouseMode( CInputSystem* pInputSystem , bool Active ) -> void
{
	GetHzGUI()->m_bMainActive = Active;

	if ( GetHzGUI()->IsVisible() )
		return IsRelativeMouseMode_o( pInputSystem , false );

	return IsRelativeMouseMode_o( pInputSystem , Active );
}
