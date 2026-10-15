#include "Hook_GetMatricesForView.hpp"

#include <CS2/SDK/Math/Math.hpp>

#include <AndromedaClient/Features/CVisual/CVisual.hpp>
#include <AndromedaClient/Settings/Settings.hpp>

auto Hook_GetMatricesForView( void* rcx , void* view ,
                              VMatrix* pWorldToView ,
                              VMatrix* pViewToProjection ,
                              VMatrix* pWorldToProjection ,
                              VMatrix* pWorldToPixels ) -> void
{
    GetMatricesForView_o( rcx , view , pWorldToView , pViewToProjection , pWorldToProjection , pWorldToPixels );

    // CalculateBoundingBoxes walks every player via schema offsets. Stale
    // offsets → page fault during the per-frame visibility pass → CS2 dies.
    if ( Settings::Visual::Active || Settings::Aimbot::Active || Settings::SilentAim::Active )
        GetVisual()->CalculateBoundingBoxes();
}
