#include "CRadar.hpp"

#include <cmath>
#include <cstring>

#include <ImGui/imgui.h>

#include <CS2/SDK/SDK.hpp>
#include <CS2/SDK/Types/CEntityData.hpp>
#include <CS2/SDK/Interface/IEngineToClient.hpp>
#include <CS2/SDK/Interface/CGameEntitySystem.hpp>
#include <CS2/SDK/Math/Math.hpp>

#include <AndromedaClient/Settings/Settings.hpp>

#include <GameClient/CEntityCache/CEntityCache.hpp>
#include <GameClient/CL_Players.hpp>

// Forward decl — C_CSGameRules est trouvé via m_bindingName au runtime
// Les accesseurs m_vMinimapMins/Maxs sont des schema offsets résolus dynamiquement
#include <CS2/SDK/Math/Vector3.hpp>
#include <CS2/SDK/CSchemaOffset.hpp>

class C_CSGameRules
{
public:
    SCHEMA_OFFSET( "CCSGameRules", "m_vMinimapMins", m_vMinimapMins, Vector3 );
    SCHEMA_OFFSET( "CCSGameRules", "m_vMinimapMaxs", m_vMinimapMaxs, Vector3 );
};

namespace
{
	// ImVec4 (0..1) -> ImU32 pour la draw list ImGui (macro native IM_COL32, toujours disponible).
	auto ToU32( const ImVec4& c ) -> ImU32
	{
		return IM_COL32( static_cast<int>( c.x * 255.f ), static_cast<int>( c.y * 255.f ), static_cast<int>( c.z * 255.f ), static_cast<int>( c.w * 255.f ) );
	}

	// Entité C_CSGameRules (singleton client, stable pour la session) : on la cherche une seule fois
	// (nom de classe via le binding schema, même pattern que IsPlayerPawn/IsC4) puis on la met en cache.
	// Elle porte les bornes MONDE de la minimap du jeu (m_vMinimapMins/Maxs), remplies par le jeu par map.
	auto GetGameRulesCached() -> C_CSGameRules*
	{
		static C_CSGameRules* pCached = nullptr;

		if ( pCached )
			return pCached;

		FOR_EACH_ENTITY( i )
		{
			auto* pEntity = SDK::Interfaces::GameEntitySystem()->GetBaseEntity< C_BaseEntity >( i );

			if ( !pEntity )
				continue;

			auto m_bindingName = pEntity->GetSchemaClassBinding()->m_bindingName();

			if ( m_bindingName && strcmp( m_bindingName , XorStr( "C_CSGameRules" ) ) == 0 )
			{
				pCached = reinterpret_cast< C_CSGameRules* >( pEntity );
				break;
			}
		}

		return pCached;
	}

	// Bornes saines ? (max strictement > min sur chaque axe). Si l'offset résout mal (0) on lit de la
	// merde -> le test échoue et on n'affiche rien ; le log one-shot donne la valeur réellement lue.
	auto BoundsAreValid( const Vector3& Min , const Vector3& Max ) -> bool
	{
		return ( Max.m_x > Min.m_x ) && ( Max.m_y > Min.m_y ) && ( Max.m_z > Min.m_z );
	}
}

static CRadar g_CRadar{};

auto CRadar::OnRender() -> void
{
	if ( !Settings::Radar::Active )
		return;

	if ( !SDK::Interfaces::EngineToClient()->IsInGame() )
		return;

	auto* pRules = GetGameRulesCached();

	if ( !pRules )
		return;

	const Vector3 Min = pRules->m_vMinimapMins();
	const Vector3 Max = pRules->m_vMinimapMaxs();

	// Log one-shot des bornes lues : vérifie in-game que l'ajout SDK lit les bonnes valeurs du jeu.
	static bool bBoundsLogged = false;

	if ( !bBoundsLogged )
	{
		bBoundsLogged = true;

		const char* pMapName = SDK::Interfaces::EngineToClient()->GetLevelName();

		DEV_LOG( "[Radar] map=%s minimap bounds: mins=(%.2f,%.2f,%.2f) maxs=(%.2f,%.2f,%.2f) valid=%d\n" ,
			( pMapName ? pMapName : "(unknown)" ) ,
			Min.m_x , Min.m_y , Min.m_z , Max.m_x , Max.m_y , Max.m_z , static_cast<int>( BoundsAreValid( Min , Max ) ) );
	}

	if ( !BoundsAreValid( Min , Max ) )
		return;

	// Région écran du rendu (coin HAUT-GAUCHE, en px, Y vers le bas). Le SDK n'expose PAS la position
	// écran de la radar du jeu -> c'est réglable au menu (X/Y/W/H) pour la caler dessus au pixel près.
	const float RX = static_cast<float>( Settings::Radar::X );
	const float RY = static_cast<float>( Settings::Radar::Y );
	const float RW = static_cast<float>( Settings::Radar::W );
	const float RH = static_cast<float>( Settings::Radar::H );

	if ( RW < 2.f || RH < 2.f )
		return;

	const float SpanX = Max.m_x - Min.m_x;
	const float SpanY = Max.m_y - Min.m_y;

	// Transform monde -> écran (NORD-UP, comme la minimap du jeu) :
	//   +X monde (est)  -> +X écran (droite) ; +Y monde (nord) -> -Y écran (haut).
	// Le point est clampé dans le rect (un joueur est normalement toujours dans la map).
	auto Project = [&]( const Vector3& W , ImVec2& Out ) -> void
	{
		const float u = ( W.m_x - Min.m_x ) / SpanX;
		const float v = ( W.m_y - Min.m_y ) / SpanY;

		float sx = RX + u * RW;
		float sy = RY + RH - v * RH;

		if ( Settings::Radar::FlipX )
			sx = RX + ( RW - ( sx - RX ) );
		if ( Settings::Radar::FlipY )
			sy = RY + ( RH - ( sy - RY ) );

		if ( sx < RX ) sx = RX;
		else if ( sx > RX + RW ) sx = RX + RW;
		if ( sy < RY ) sy = RY;
		else if ( sy > RY + RH ) sy = RY + RH;

		Out = { sx , sy };
	};

	auto* pDraw = ImGui::GetForegroundDrawList();

	// Clip sur le rect (sécurité : rien ne déborde de la zone).
	pDraw->PushClipRect( ImVec2( RX , RY ) , ImVec2( RX + RW , RY + RH ) , false );

	// 0) panneau de fond optionnel (OFF par défaut : on s'appuie sur la minimap du jeu, on n'y peint
	//    pas de fond). À activer pour un rendu autonome (ShowBackground + couleurs Background/Frame).
	if ( Settings::Radar::ShowBackground )
	{
		pDraw->AddRectFilled( ImVec2( RX , RY ) , ImVec2( RX + RW , RY + RH ) , ToU32( Settings::Colors::Radar::Background ) );
		pDraw->AddRect( ImVec2( RX , RY ) , ImVec2( RX + RW , RY + RH ) , ToU32( Settings::Colors::Radar::Frame ) , 0.f , 0 , 1.5f );
	}

	// 1) points joueurs (ennemis + équipe), calés sur la minimap du jeu, y compris hors écran.
	{
		auto* pLocalPawn = GetCL_Players()->GetLocalPlayerPawn();
		const int LocalTeam = ( pLocalPawn ? pLocalPawn->m_iTeamNum() : 0 );

		auto& CachedVec = *GetEntityCache()->GetCachedEntity();

		std::scoped_lock Lock( GetEntityCache()->GetLock() );

		for ( const auto& CachedEntity : CachedVec )
		{
			if ( CachedEntity.m_Type != CachedEntity_t::PLAYER_CONTROLLER )
				continue;

			auto pEntity = CachedEntity.m_Handle.Get();
			if ( !pEntity )
				continue;

			if ( pEntity->pEntityIdentity()->Handle() != CachedEntity.m_Handle )
				continue;

			auto* pCCSPlayerController = reinterpret_cast< CCSPlayerController* >( pEntity );

			if ( !pCCSPlayerController->m_bPawnIsAlive() )
				continue;

			auto* pPawn = pCCSPlayerController->m_hPawn().Get< C_CSPlayerPawn >();
			if ( !pPawn || !pPawn->IsPlayerPawn() )
				continue;

			if ( pLocalPawn && pPawn == pLocalPawn )
				continue;

			const bool IsEnemy = ( pPawn->m_iTeamNum() != LocalTeam );

			if ( IsEnemy && !Settings::Radar::ShowEnemies )
				continue;

			if ( !IsEnemy && !Settings::Radar::ShowTeam )
				continue;

			ImVec2 P;
			Project( pPawn->GetOrigin() , P );

			pDraw->AddCircleFilled( P , static_cast<float>( Settings::Radar::DotRadius ) , ToU32( IsEnemy ? Settings::Colors::Radar::Enemy : Settings::Colors::Radar::Team ) , 12 );
		}
	}

	// 2) indicateur joueur : flèche plein pointant dans la direction du regard (nord-up).
	//    Sert aussi d'AIDE AU CALAGE : quand elle recouvre la flèche de la radar du jeu, le mapping
	//    monde->écran est correct et les points ennemis/toute l'équipe sont alors exacts.
	if ( Settings::Radar::ShowOwn )
	{
		auto* pLocalPawn = GetCL_Players()->GetLocalPlayerPawn();

		if ( pLocalPawn && pLocalPawn->IsAlive() )
		{
			ImVec2 P;
			Project( pLocalPawn->GetOrigin() , P );

			const float y = DEG2RAD( pLocalPawn->m_angEyeAngles().m_y );
			const float Dx = std::cos( y );      // +X monde (est)  -> +X écran (droite)
			const float Dy = -std::sin( y );     // +Y monde (nord) -> -Y écran (haut)

			const float L = 9.0f;                // longueur de la flèche
			const float B = 4.0f;                // demi-largeur de la base

			const ImVec2 Perp = { -Dy , Dx };    // perpendiculaire unitaire à (Dx, Dy)

			const ImVec2 Tip   = { P.x + Dx * L , P.y + Dy * L };
			const ImVec2 Base1 = { P.x + Perp.x * B , P.y + Perp.y * B };
			const ImVec2 Base2 = { P.x - Perp.x * B , P.y - Perp.y * B };

			pDraw->AddTriangleFilled( Tip , Base1 , Base2 , ToU32( Settings::Colors::Radar::Player ) );
		}
	}

	pDraw->PopClipRect();
}

// « Radar du jeu » (hack intégré) : force l'état "spot" CÔTÉ CLIENT sur les ENNEMIS pour que la
// radar NATIVE du jeu (Panorama) les affiche — l'effet « mode spectateur », sans overlay.
//
// m_entitySpottedState (m_bSpotted + m_bSpottedByMask) est un état réseau serveur->client : la seule
// « visibilité radar » qu'un joueur ennemi possède côté client. On l'écrit à FS_POSTSERVER (stage 6),
// APRÈS l'application des données serveur, avant le rendu : la radar a alors le temps de le voir.
// Le serveur ré-écrase le champ au unspot/timeout/respawn -> on ré-écrit chaque frame (écart < 1
// frame, invisible). Confiance low/medium : le consommateur Panorama n'est pas dans ce repo.
auto CRadar::OnFrameStageNotify( int FrameStage ) -> void
{
	if ( !Settings::RadarHack::Active )
		return;

	if ( FrameStage != 6 || !SDK::Interfaces::EngineToClient()->IsInGame() )
		return;

	auto* pLocalPawn = GetCL_Players()->GetLocalPlayerPawn();
	const int LocalTeam = ( pLocalPawn ? pLocalPawn->m_iTeamNum() : 0 );

	int ForcedCount = 0;
	int SampleSpottedReadback = -1;
	uint32_t SampleMaskLo = 0 , SampleMaskHi = 0;

	auto& CachedVec = *GetEntityCache()->GetCachedEntity();

	std::scoped_lock Lock( GetEntityCache()->GetLock() );

	for ( const auto& CachedEntity : CachedVec )
	{
		if ( CachedEntity.m_Type != CachedEntity_t::PLAYER_CONTROLLER )
			continue;

		auto pEntity = CachedEntity.m_Handle.Get();
		if ( !pEntity )
			continue;

		if ( pEntity->pEntityIdentity()->Handle() != CachedEntity.m_Handle )
			continue;

		auto* pCCSPlayerController = reinterpret_cast< CCSPlayerController* >( pEntity );

		if ( !pCCSPlayerController->m_bPawnIsAlive() )
			continue;

		auto* pPawn = pCCSPlayerController->m_hPawn().Get< C_CSPlayerPawn >();
		if ( !pPawn || !pPawn->IsPlayerPawn() )
			continue;

		if ( pLocalPawn && pPawn == pLocalPawn )
			continue;

		// Ennemi uniquement (l'équipe est déjà affichée nativement par la radar du jeu).
		// Spectateur/mort (LocalTeam = 0/1) -> toute équipe != la mienne est forcée (T + CT).
		if ( pPawn->m_iTeamNum() == LocalTeam )
			continue;

		// Force l'état "spot" : m_bSpotted = true + masque "spotted by" = tout-à-un (couvre toute
		// interprétation du filtre d'équipe du consommateur client).
		auto& State = pPawn->m_entitySpottedState();
		State.m_bSpotted() = true;
		State.m_bSpottedByMask()[0] = 0xFFFFFFFFu;
		State.m_bSpottedByMask()[1] = 0xFFFFFFFFu;

		++ForcedCount;

		if ( SampleSpottedReadback < 0 )
		{
			SampleSpottedReadback = ( State.m_bSpotted() ? 1 : 0 );
			SampleMaskLo = State.m_bSpottedByMask()[0];
			SampleMaskHi = State.m_bSpottedByMask()[1];
		}
	}

	// Log one-shot : confirme que l'écriture ATTEINT le client (read-back) + nb d'ennemis forcés.
	// read-back = 1 mais radar muette -> le consommateur Panorama ne lit pas ce champ (ou filtre le
	// masque) : on bissecte le layout du masque. read-back = 0 -> le serveur ré-écrit plus vite que
	// notre ré-écriture par frame (à creuser).
	static bool bLogged = false;
	if ( !bLogged )
	{
		bLogged = true;

		const char* pMapName = SDK::Interfaces::EngineToClient()->GetLevelName();
		DEV_LOG( "[RadarHack] map=%s ennemis forcés=%d | read-back (1er) : m_bSpotted=%d mask=(%08X %08X)\n" ,
			( pMapName ? pMapName : "(unknown)" ) , ForcedCount , SampleSpottedReadback , SampleMaskLo , SampleMaskHi );
	}
}

auto GetRadar() -> CRadar*
{
	return &g_CRadar;
}
