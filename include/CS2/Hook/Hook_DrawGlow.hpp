#pragma once

#include <Common/Common.hpp>

class CGlowProperty;

auto Hook_DrawGlow( CGlowProperty* pCGlowProperty ) -> void*;

using DrawGlow_t = decltype( &Hook_DrawGlow );
inline DrawGlow_t DrawGlow_o = nullptr;
