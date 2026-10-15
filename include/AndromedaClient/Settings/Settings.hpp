#pragma once

#include <Common/Common.hpp>
#include <ImGui/imgui.h>

namespace Settings
{
	namespace Visual
	{
		// Default OFF — a feature detour over a stale schema offset can crash CS2
		// on asset streaming. User enables per-feature after validating stability.
		inline auto Active       = false;
		inline auto Team         = false;
		inline auto Enemy        = true;
		inline auto OnlyVisible  = false;
		inline auto PlayerBox    = false;
		inline auto BoneESP      = false;
		inline auto BoneESPTeam  = false;
		inline auto BoneESPEnemy = true;
		inline auto Glow         = false;
		inline auto GlowTeam     = false;
		inline auto GlowEnemy    = true;

		inline auto PlayerBoxType = 3;
	}

	namespace Aimbot
	{
		inline auto Active       = false;
		inline auto SilentAim    = false;
		inline auto Fov          = 5.f;
		inline auto FOV          = 5.f;         // alias float pour DrawCircle
		inline auto FOVDisplay   = false;
		inline auto Smooth       = 3.f;
		inline auto Smoothing    = 3.f;
		inline auto HeadOnly     = false;
		inline auto VisibleOnly  = true;
		inline auto OnlyVisible  = true;
		inline auto AutoFire     = false;
		inline auto DrawFov      = false;
		inline auto Team         = false;
		inline auto Friendly     = false;
		inline auto Bone         = 0;           // 0=head, 1=chest, 2=pelvis
		inline auto MaxDistance  = 8192;
		inline auto Trigger      = false;
		inline auto KeybindMode  = 0;           // 0=toggle, 1=hold
	}

	namespace SilentAim
	{
		inline auto Active       = false;
		inline auto BacktrackTicks = 4;
		inline auto Fov          = 8.f;
		inline auto FOV          = 8.f;         // alias float pour DrawCircle / GetBestTarget
		inline auto FOVDisplay   = false;
		inline auto Smoothing    = 3.f;
		inline auto Trigger      = false;
		inline auto Friendly     = false;
		inline auto OnlyVisible  = true;
		inline auto Bone         = 0;           // 0=head, 1=chest, 2=pelvis
		inline auto MaxDistance  = 8192;
	}

	namespace Inventory
	{
		inline auto Active     = false;
		inline auto KnifeModel = 0;
		inline auto GloveModel = 0;
		inline auto AgentCT    = 0;
		inline auto AgentTT    = 0;
	}

	namespace Radar
	{
		inline auto Active = false;
		inline auto X      = 20;
		inline auto Y      = 20;
		inline auto W      = 200;
		inline auto H      = 200;
	}

	namespace Misc
	{
		inline auto Radar          = false;
		inline auto AntiAimActive  = false;
		inline auto SpeedHack      = false;
		inline auto SpeedHackValue = 1.f;
	}

	namespace Movement
	{
		inline auto Bhop = false;
	}

	namespace Keybinds
	{
		inline auto Aimbot    = 0;   // VK code ; 0 = disabled
		inline auto AimbotHold = 0;
		inline auto SilentAim = 0;
	}

	namespace Menu
	{
		inline auto MenuAlpha = 200;
		inline auto MenuStyle = 0;
	}

	namespace Colors
	{
		namespace Visual
		{
			inline ImVec4 PlayerBoxTT         = { 255.f / 255.f , 75.f / 255.f  , 75.f / 255.f  , 1.f };
			inline ImVec4 PlayerBoxTT_Visible  = { 0             , 1.f           , 0.f            , 1.f };
			inline ImVec4 PlayerBoxCT          = { 65.f / 255.f  , 200 / 255.f  , 255.f / 255.f  , 1.f };
			inline ImVec4 PlayerBoxCT_Visible  = { 0             , 1.f           , 0.f            , 1.f };
			inline ImVec4 BoneESPTT            = { 255.f / 255.f , 75.f / 255.f  , 75.f / 255.f  , 1.f };
			inline ImVec4 BoneESPTT_Visible    = { 0             , 1.f           , 0.f            , 1.f };
			inline ImVec4 BoneESPCT            = { 65.f / 255.f  , 200 / 255.f  , 255.f / 255.f  , 1.f };
			inline ImVec4 BoneESPCT_Visible    = { 0             , 1.f           , 0.f            , 1.f };
			inline ImVec4 GlowTT               = { 255.f / 255.f , 75.f / 255.f  , 75.f / 255.f  , 1.f };
			inline ImVec4 GlowTT_Visible       = { 0             , 1.f           , 0.f            , 1.f };
			inline ImVec4 GlowCT               = { 65.f / 255.f  , 200 / 255.f  , 255.f / 255.f  , 1.f };
			inline ImVec4 GlowCT_Visible       = { 0             , 1.f           , 0.f            , 1.f };
		}
	}
}
