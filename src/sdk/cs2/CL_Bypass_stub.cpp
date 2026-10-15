// CL_Bypass.cpp — STUB (protobuf bypass desactivé, DISABLE_PROTOBUF=1)
// Next update: réactiver quand libprotobuf headers complets disponibles
#include "CL_Bypass.hpp"

static CL_Bypass g_CL_Bypass{};

auto CL_Bypass::PreClientCreateMove( CUserCmd* pUserCmd ) -> void {}
auto CL_Bypass::PostClientCreateMove( CCSGOInput* pCCSGOInput, CUserCmd* pUserCmd ) -> void {}
auto CL_Bypass::SetViewAngles( QAngle* ViewAngles, CCSGOInput* pInput, CUserCmd* pUserCmd, bool AddSetViewAngles, bool OnlyInputHistory ) -> void {}
auto CL_Bypass::SetAttack( CUserCmd* pUserCmd, bool AddSubTIck ) -> void {}
auto CL_Bypass::SetDontAttack( CUserCmd* pUserCmd, bool AddSubTIck ) -> void {}
auto CL_Bypass::SetJump( CUserCmd* pUserCmd, bool AddSubTIck ) -> void {}
auto CL_Bypass::SetDontJump( CUserCmd* pUserCmd, bool AddSubTIck ) -> void {}
auto CL_Bypass::AddProcessSubTick( const uint64_t Button, const bool Pressed ) -> void {}
auto CL_Bypass::AddProcessSubTick( const uint64_t Button, const bool Pressed, const float When ) -> void {}
auto CL_Bypass::OnCBaseUserCmdPB( CBaseUserCmdPB* pBaseUserCmdPB ) -> void {}
auto CL_Bypass::CalculateWhenValue() -> float { return 0.f; }
auto CL_Bypass::AddSubtickMoveStep( CUserCmd* pUserCmd, const uint64_t button, const bool pressed, const float when ) -> void {}
auto CL_Bypass::SpoofCrc() -> std::string { return {}; }

auto GetCL_Bypass() -> CL_Bypass* { return &g_CL_Bypass; }
