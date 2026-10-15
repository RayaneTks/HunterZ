#include "CAimbot.hpp"

#include <cmath>

#include <CS2/SDK/SDK.hpp>
#include <CS2/SDK/Interface/IEngineToClient.hpp>
#include <CS2/SDK/Math/Math.hpp>
#include <CS2/SDK/Types/CEntityData.hpp>
#include <CS2/SDK/Update/CCSGOInput.hpp>
#include <CS2/SDK/Update/CUserCmd.hpp>

#include <AndromedaClient/Render/CRenderStackSystem.hpp>
#include <AndromedaClient/Settings/Settings.hpp>
#include <AndromedaClient/Features/CKeybinds/CKeybinds.hpp>

#include <GameClient/CEntityCache/CEntityCache.hpp>
#include <GameClient/CL_Bones.hpp>
#include <GameClient/CL_Bypass.hpp>
#include <GameClient/CL_Players.hpp>
#include <GameClient/CL_VisibleCheck.hpp>

static CAimbot g_Caimbot{};

static const char* g_AimBones[] =
{
	"head_0" ,
	"spine_3" ,
	"pelvis"
};

// FL_ONGROUND (Source engine)
#define FL_ONGROUND 0x1

auto CAimbot::GetBoneWorldPosition( C_CSPlayerPawn* pC_CSPlayerPawn ) -> Vector3
{
	if ( !pC_CSPlayerPawn )
		return Vector3::Zero;

	int BoneIndex = 0;

	if ( Settings::Aimbot::Bone < 1 )
		BoneIndex = 0;
	else if ( Settings::Aimbot::Bone < 2 )
		BoneIndex = 1;
	else
		BoneIndex = 2;

	return GetCL_Bones()->GetBonePositionByName( pC_CSPlayerPawn , g_AimBones[ BoneIndex ] );
}

auto CAimbot::GetBestTarget( const Vector3& EyeOrigin , const ImVec2& ScreenCenter , float FovRadius ) -> TargetInfo_t
{
	TargetInfo_t Best;

	if ( auto* pLocalController = GetCL_Players()->GetLocalPlayerController(); pLocalController )
	{
		const auto LocalTeam = pLocalController->m_iTeamNum();

		const auto& CachedVec = GetEntityCache()->GetCachedEntity();

		std::scoped_lock Lock( GetEntityCache()->GetLock() );

		for ( const auto& CachedEntity : *CachedVec )
		{
			if ( CachedEntity.m_Type != CachedEntity_t::PLAYER_CONTROLLER )
				continue;

			auto* pEntity = CachedEntity.m_Handle.Get();

			if ( !pEntity )
				continue;

			if ( pEntity->pEntityIdentity()->Handle() != CachedEntity.m_Handle )
				continue;

			auto* pController = reinterpret_cast<CCSPlayerController*>( pEntity );

			if ( pController == pLocalController )
				continue;

			if ( !Settings::Aimbot::Friendly && pController->m_iTeamNum() == LocalTeam )
				continue;

			if ( !pController->m_bPawnIsAlive() )
				continue;

			auto* pPawn = pController->m_hPawn().Get< C_CSPlayerPawn >();

			if ( !pPawn || !pPawn->IsPlayerPawn() )
				continue;

			const auto BonePos = GetBoneWorldPosition( pPawn );

			if ( BonePos.IsZero() )
				continue;

			if ( EyeOrigin.Distance( BonePos ) > static_cast<float>( Settings::Aimbot::MaxDistance ) )
				continue;

			Vector2 ScreenPos;

			if ( !Math::WorldToScreen( BonePos , ScreenPos ) )
				continue;

			const auto DxC = ScreenPos.m_x - ScreenCenter.x;
			const auto DyC = ScreenPos.m_y - ScreenCenter.y;
			const auto DistanceToCenter = sqrtf( DxC * DxC + DyC * DyC );

			if ( DistanceToCenter > FovRadius )
				continue;

			// Visible Only : exclure les cibles derrière un mur (line-of-sight sur la bone visée)
			if ( Settings::Aimbot::OnlyVisible && !GetCL_VisibleCheck()->IsBoneVisible( pPawn , BonePos ) )
				continue;

			if ( !Best.pPawn || DistanceToCenter < Best.DistanceToScreenCenter )
			{
				Best.pPawn = pPawn;
				Best.DistanceToScreenCenter = DistanceToCenter;
			}
		}
	}

	return Best;
}

auto CAimbot::OnCreateMove( CCSGOInput* pInput , CUserCmd* pUserCmd ) -> void
{
	if ( !pInput || !pUserCmd )
		return;

	if ( !SDK::Interfaces::EngineToClient()->IsInGame() )
		return;

	// Keybind d'activation (mode sélectionné par Settings::Aimbot::KeybindMode) :
	//  - Mode Toggle (0) : 1 pression sur Keybinds::Aimbot bascule l'état persistant « Active » (on/off).
	//    Exécuté AVANT le check « Active » pour pouvoir ré-activer même si l'aimbot est désactivé.
	//  - Mode Hold (1) : rien à basculer ici ; l'activation est transitoire (vérifiée plus bas).
	if ( Settings::Aimbot::KeybindMode == 0 )
		CKeybinds::KeybindToggle( Settings::Keybinds::Aimbot , &Settings::Aimbot::Active );

	auto* pLocalController = GetCL_Players()->GetLocalPlayerController();
	auto* pLocalPawn = GetCL_Players()->GetLocalPlayerPawn();

	if ( !pLocalController || !pLocalPawn || !pLocalPawn->IsPlayerPawn() )
		return;

	if ( !pLocalPawn->IsAlive() )
		return;

	// Bhop : saut auto au sol avec W
	if ( Settings::Movement::Bhop && ( pLocalPawn->m_fFlags() & FL_ONGROUND ) && IS_KEY_DOWN( 'W' ) )
	{
		GetCL_Bypass()->SetJump( pUserCmd );
	}

	// Silent Aim (keybind hold) : si sa touche est maintenue, on ne fait AUCUNE visée visible ce tick
	// (le crosshair doit rester figé). La correction du tir est gérée par CSilentAim::OnCreateMove.
	if ( CKeybinds::KeybindHold( Settings::Keybinds::SilentAim ) )
		return;

	// Master « Active » : off => aucun aim (les deux modes). En mode Toggle, le keybind (plus haut)
	// a pu le basculer (y compris l'activer depuis l'off) — d'où l'évaluation après ce check.
	if ( !Settings::Aimbot::Active )
		return;

	// Mode Hold : le master est ON, mais on ne vise QUE pendant que le keybind « hold » est maintenu.
	// (Mode Toggle : on vise en continu tant que le master est ON — rien à ajouter ici.)
	if ( Settings::Aimbot::KeybindMode == 1 && !CKeybinds::KeybindHold( Settings::Keybinds::AimbotHold ) )
		return;

	if ( !pInput->m_pInputMoves() )
		return;

	// m_vecViewAngles() retourne un Vector3 (pitch/yaw/roll) : conversion QAngle
	const auto& VA = pInput->m_pInputMoves()->m_vecViewAngles();

	QAngle CurrentAngles( VA.m_x , VA.m_y , VA.m_z );

	int ScreenWidth = 0 , ScreenHeight = 0;

	SDK::Interfaces::EngineToClient()->GetScreenSize( ScreenWidth , ScreenHeight );

	ImVec2 ScreenCenter( static_cast<float>( ScreenWidth ) / 2.f , static_cast<float>( ScreenHeight ) / 2.f );

	if ( Settings::Aimbot::FOVDisplay )
		GetRenderStackSystem()->DrawCircle( ScreenCenter , Settings::Aimbot::FOV , ImColor( 255 , 0 , 0 , 100 ) );

	const auto Best = GetBestTarget( GetCL_Players()->GetLocalEyeOrigin() , ScreenCenter , Settings::Aimbot::FOV );

	if ( !Best.pPawn )
		return;

	const auto BonePos = GetBoneWorldPosition( Best.pPawn );

	if ( BonePos.IsZero() )
		return;

	QAngle AimAngles = Math::CalcAngle( GetCL_Players()->GetLocalEyeOrigin() , BonePos );

	QAngle FinalAngles;

	Math::SmoothAngles( CurrentAngles , AimAngles , FinalAngles , Settings::Aimbot::Smoothing );

	// Écriture dans le protobuf via le bypass move_crc
	GetCL_Bypass()->SetViewAngles( &FinalAngles , pInput , pUserCmd );

	if ( Settings::Aimbot::Trigger )
		GetCL_Bypass()->SetAttack( pUserCmd );
}

auto GetAimbot() -> CAimbot*
{
	return &g_Caimbot;
}
