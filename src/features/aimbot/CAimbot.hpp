#pragma once

#include <Common/Common.hpp>

#include <ImGui/imgui.h>

class CCSGOInput;
class CUserCmd;
class C_CSPlayerPawn;
class Vector3;

class CAimbot final
{
public:
	auto OnCreateMove( CCSGOInput* pInput , CUserCmd* pUserCmd ) -> void;

private:
	struct TargetInfo_t
	{
		C_CSPlayerPawn* pPawn = nullptr;
		float DistanceToScreenCenter = 0.f;
	};

	auto GetBestTarget( const Vector3& EyeOrigin , const ImVec2& ScreenCenter , float FovRadius ) -> TargetInfo_t;
	auto GetBoneWorldPosition( C_CSPlayerPawn* pC_CSPlayerPawn ) -> Vector3;
};

auto GetAimbot() -> CAimbot*;
