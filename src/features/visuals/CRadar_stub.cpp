// CRadar.cpp — STUB (radar feature disabled for MVP build)
#include "CRadar.hpp"
static CRadar g_CRadar{};
auto CRadar::OnRender() -> void {}
auto CRadar::OnFrameStageNotify( int FrameStage ) -> void {}
auto GetRadar() -> CRadar* { return &g_CRadar; }
