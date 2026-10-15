#include "Hook_MouseInputEnabled.hpp"

#include <AndromedaClient/CAndromedaGUI.hpp>

auto Hook_MouseInputEnabled( void* RCX ) -> bool
{
	if ( GetHzGUI()->IsVisible() )
		return false;

	if ( !MouseInputEnabled_o ) return true;
	return MouseInputEnabled_o( RCX );
}
