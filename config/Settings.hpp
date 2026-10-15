#pragma once

#include <Common/Common.hpp>
#include <ImGui/imgui.h>

namespace Settings
{
    // ── Visual ─────────────────────────────────────────────────────────────
    // All features default OFF — pattern drift can crash CS2 on asset streaming
    // if a feature detour runs through a stale offset. User enables per-feature
    // from the menu once the build is validated for the current CS2 patch.
    namespace Visual
    {
        inline auto Active       = false;
        inline auto Team         = false;
        inline auto Enemy        = true;
        inline auto OnlyVisible  = false;

        inline auto PlayerBox    = false;
        inline auto PlayerBoxType = 3;

        inline auto BoneESP      = false;
        inline auto BoneESPTeam  = false;
        inline auto BoneESPEnemy = true;

        inline auto Glow         = false;
        inline auto GlowTeam     = false;
        inline auto GlowEnemy    = true;
    }

    // ── Aimbot ─────────────────────────────────────────────────────────────
    namespace Aimbot
    {
        inline auto Active      = false;
        inline auto Team        = false;
        inline auto OnlyVisible = true;
        inline auto Bone        = 0;     // 0=Tête 1=Torse 2=Bassin
        inline auto Fov         = 5;     // degrés
        inline auto Smooth      = 20;    // 1–100
    }

    // ── Silent Aim ─────────────────────────────────────────────────────────
    namespace SilentAim
    {
        inline auto Active          = false;
        inline auto BacktrackTicks  = 4;
    }

    // ── Inventory Changer ──────────────────────────────────────────────────
    namespace Inventory
    {
        inline auto Active = false;
    }

    // ── Menu ───────────────────────────────────────────────────────────────
    namespace Menu
    {
        inline auto MenuAlpha = 220;
        inline auto MenuStyle = 3;   // 3 = HunterZ Dark
    }

    // ── Colors ─────────────────────────────────────────────────────────────
    namespace Colors
    {
        namespace Visual
        {
            inline ImVec4 PlayerBoxTT          = { 1.00f, 0.29f, 0.29f, 1.0f };
            inline ImVec4 PlayerBoxTT_Visible  = { 0.00f, 1.00f, 0.00f, 1.0f };
            inline ImVec4 PlayerBoxCT          = { 0.25f, 0.78f, 1.00f, 1.0f };
            inline ImVec4 PlayerBoxCT_Visible  = { 0.00f, 1.00f, 0.00f, 1.0f };

            inline ImVec4 BoneESPTT            = { 1.00f, 0.29f, 0.29f, 1.0f };
            inline ImVec4 BoneESPTT_Visible    = { 0.00f, 1.00f, 0.00f, 1.0f };
            inline ImVec4 BoneESPCT            = { 0.25f, 0.78f, 1.00f, 1.0f };
            inline ImVec4 BoneESPCT_Visible    = { 0.00f, 1.00f, 0.00f, 1.0f };

            inline ImVec4 GlowTT               = { 1.00f, 0.29f, 0.29f, 1.0f };
            inline ImVec4 GlowTT_Visible       = { 0.00f, 1.00f, 0.00f, 1.0f };
            inline ImVec4 GlowCT               = { 0.25f, 0.78f, 1.00f, 1.0f };
            inline ImVec4 GlowCT_Visible       = { 0.00f, 1.00f, 0.00f, 1.0f };
        }
    }
}
