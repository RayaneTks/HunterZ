#include "CSilentAim.hpp"

#include <cmath>
#include <cstring>

#include <CS2/SDK/SDK.hpp>
#include <CS2/SDK/CSchemaOffset.hpp>
#include <CS2/SDK/FunctionListSDK.hpp>
#include <CS2/SDK/Interface/IEngineToClient.hpp>
#include <CS2/SDK/Math/Math.hpp>
#include <CS2/SDK/Types/CEntityData.hpp>
#include <CS2/SDK/Update/CCSGOInput.hpp>
#include <CS2/SDK/Update/CUserCmd.hpp>

#include <AndromedaClient/CAndromedaGUI.hpp>
#include <AndromedaClient/Render/CRenderStackSystem.hpp>
#include <AndromedaClient/Settings/Settings.hpp>
#include <AndromedaClient/Features/CKeybinds/CKeybinds.hpp>

#include <GameClient/CEntityCache/CEntityCache.hpp>
#include <GameClient/CL_Bones.hpp>
#include <GameClient/CL_Bypass.hpp>
#include <GameClient/CL_Players.hpp>
#include <GameClient/CL_VisibleCheck.hpp>

static CSilentAim g_CSilentAim{};

// État partagé avec le hook de rendu (GetMatricesForView) — voir CSilentAimRenderState.
static CSilentAimRenderState g_SilentAimRenderState{};

// ---------- VRAIE VUE SOURIS (M) — reconstruction ----------
//
// Les logs in-game (silent-v1 15:05, silent-v2 16:35, silent-v3 17:xx) ont établi :
//   - CCSGOInput_GetViewAngles = l'input du jeu, et la SEULE source démontrée en jeu pour
//     suivre la souris en direct (log 15:05 « input 44.34° = la souris » ; le silent-v1
//     l'appelait déjà game thread au stage 6, sans problème). Elle rend un QAngle* : on
//     peut ÉCRIRE à travers le pointeur (voir ForceInputView, verdict 17:xx).
//   - m_pInputMoves()->m_vecViewAngles() NE suit PAS la souris sur le game thread (log
//     16:35 : l'ancre a marché mais la calibration n'a JAMAIS convergé pendant une session
//     de jeu normal complète — c'est un struct de commande per-tick, pas la vue live) :
//     banni du tracker, conservé comme fallback si la source principale est nulle.
//   - 17:xx (silent-v3) : l'état du joueur + le CViewSetup sont sous notre contrôle
//     (FORCE_ETAT avant=aim → apres=souris_r ; les appels GetMatricesForView portent la
//     souris AVANT et APRÈS l'appel original) MAIS la caméra 3D suit toujours la visée →
//     le monde 3D lit sa vue depuis la « vue courante » du système d'input = le pointeur
//     rendu par CCSGOInput_GetViewAngles (converge sur la souris hors visée = caméra
//     normale ; sur la visée pendant le silent = le « lag caméra » CS2, resync sur
//     l'écho serveur). ForceInputView le force sur M (stage 6 + backstop thread rendu).
//   - 17:xx (suite) : le 1er échantillon de calibration était contaminé (snap de vue en
//     début de round, SIGNES INVERSÉS) et « commit » direct → calibration faussée toute la
//     session. Bootstrap durci : un échantillon ne commit que si 3 échantillons
//     consécutifs (même axe) concordent à 15% près (sinon la run est rejetée).
//   - PENDANT le silent, l'input = la visée CLOBBERÉE : input = écho serveur + delta
//     souris non-ack, et l'écho = la visée envoyée (log call#N « errM=0.00 » : input == visée).
//   - HORS visée, en revanche, l'input = la VRAIE souris EXACTEMENT : l'écho contient la
//     souris envoyée + le delta non-ack = la souris courante (log : input 44.34° = la
//     souris, état 44.48° = la souris quelques ms plus tôt = l'écho normal de CS2).
//   - La caméra rendue de CS2 = l'écho serveur (« lag caméra » propre à CS2), et le jeu
//     ne stocke nulle part de « vue souris absolue » : la souris n'arrive qu'en delta
//     relatif. Aucune source du jeu ne donne donc M pendant le lock — il faut le
//     reconstruire :
//   - ANCRE : sur les frames « propres » (pas d'aim depuis kSilentCleanFrames frames, pas
//     de recoil, pas de menu ouvert — là le mode relative souris est coupé et l'input ne
//     suit plus la souris), input = M EXACTEMENT → on ancre (input + curseur). L'ancre
//     est rafraichie à chaque frame propre et ne change JAMAIS pendant un lock (elle ne
//     bouge que hors visée) → les lectures render thread portent sur des valeurs stables.
//   - CALIBRATION pixel→degrés : mesurée EN DIRECT sur le jeu en cours (EMA des
//     Δinput/Δcurseur, frames propres uniquement) — la sensibilité du jeu, l'eDPI, le
//     scaling pointeur Windows sont tous absorbés : aucune hypothèse, aucun pattern
//     client.dll supplémentaire.
//   - M(t) = Ancre + (curseur(t) - AncreCurseur) × calibration (yaw replié sur 180°,
//     pitch clampé ±88.9 comme le jeu). Le curseur virtuel (GetCursorPos, user32) suit
//     la souris même capturée (SetCapture) — même comportement que le jeu (la vue
//     s'arrête au clip curseur, comme dans CS2).
static constexpr int kSilentCleanFrames  = 20;  // frames sans aim avant que l'input redevienne « souris »
static constexpr int kSilentResyncBase   = 10;  // fenêtre MIN de resync après l'arrêt d'un aim (voir OnCreateMove)
static constexpr int kSilentSrcLogCap    = 24;  // diag sources plafonnés (premiers N frames propres avec souris bougée)

// 0 = un aim a été envoyé sur la dernière frame traitée, sinon le nombre de frames depuis.
static int g_SilentAimFramesSinceAim = 9999;

static struct SilentMouseTracker_t
{
	ImVec2 Cursor{};
	bool   HaveCursor = false;

	QAngle PrevInput{};
	bool   PrevClean = false;
	bool   PrevFiring = false;

	QAngle PrevMove{};   // m_pInputmoves — uniquement pour le diag sources plafonné (comparaison)
	int    SrcLogCount = 0;

	float  YawPerPx = 0.f;
	bool   HaveCalYaw = false;
	float  PitchPerPx = 0.f;
	bool   HaveCalPitch = false;
	bool   CalLogged = false;

	// Bootstrap calibration (log 17:xx : le 1er échantillon était contaminé — snap de vue en
	// début de round, signes inversés — et « commit » direct → calibration faussée toute la
	// session, M dérivait dans le mauvais sens quand la souris bougeait). Un axe ne commit
	// QUE si 3 échantillons consécutifs concordent à 15% près (floor 0.002°/px) : un
	// échantillon isolé non-souris casse la run (reset) et ne suffit jamais à lui seul.
	float  YawRun[ 3 ] = { 0.f , 0.f , 0.f };
	int    YawRunN = 0;
	bool   YawCommitLogged = false;
	float  PitchRun[ 3 ] = { 0.f , 0.f , 0.f };
	int    PitchRunN = 0;
	bool   PitchCommitLogged = false;

	QAngle Anchor{};
	ImVec2 AnchorCursor{};
	bool   HaveAnchor = false;
	bool   AnchorLogged = false;
	bool   NoCalLogged = false;
} g_SilentMouseTracker;

static auto Absf( float a ) -> float
{
	return a < 0.f ? -a : a;
}

static auto Wrap180( float a ) -> float
{
	while ( a >  180.f ) a -= 360.f;
	while ( a < -180.f ) a += 360.f;
	return a;
}

// Distance angulaire absolue (degrés) entre deux yaws, repliée sur 180°.
static auto YawDiff( float a , float b ) -> float
{
	const float d = Wrap180( a - b );
	return d < 0.f ? -d : d;
}

auto CSilentAim::TrackMouseInput( const QAngle& InputView , bool Firing , CCSGOInput* pInput , bool InputValid ) -> void
{
	auto& T = g_SilentMouseTracker;

	// Menu ouvert : le mode relative souris est coupé (Hook_IsRelativeMouseMode) → l'input ne
	// suit plus la souris : ni ancrage, ni calibration sur ces frames.
	const bool MenuOpen = GetHzGUI()->IsVisible();

	// Recoil (cette frame ou la précédente) : l'input inclut le kick/recouvrement de recoil,
	// pas que la souris → frames exclues de l'ancre et de la calibration.
	const bool NoRecoil = !Firing && !T.PrevFiring;

	// InputValid=false (source principale nulle, fallback per-tick utilisé) : la vue transmise
	// peut être périmée → frame exclue de l'ancre et de la calibration (elle ne sert alors
	// qu'au fallback du test FOV et à la comparaison du resync).
	const bool Clean = ( g_SilentAimFramesSinceAim >= kSilentCleanFrames ) && NoRecoil && !MenuOpen && InputValid;

	POINT P{};

	const bool GotCursor = ( ::GetCursorPos( &P ) != 0 );

	if ( T.HaveCursor && GotCursor )
	{
		const float Dcx = static_cast<float>( P.x ) - T.Cursor.x;
		const float Dcy = static_cast<float>( P.y ) - T.Cursor.y;

		// COHÉRENCE (quand une calibration existe) : le delta input DOIT coïncider avec le
		// delta curseur × calibration (hors visée, input = souris EXACTEMENT). Rejette les
		// frames transitoires (reprise après menu, etc.) où l'input reconverge encore vers
		// la souris. Un axe non calibré ne contraint pas.
		bool Consistent = true;

		if ( T.HaveCalYaw )
		{
			const float Dvy = Wrap180( InputView.m_y - T.PrevInput.m_y );

			if ( Absf( Dcx ) >= 1.f && YawDiff( Dvy , Dcx * T.YawPerPx ) > 0.75f )
				Consistent = false;
		}

		if ( T.HaveCalPitch )
		{
			const float Dvx = InputView.m_x - T.PrevInput.m_x;

			if ( Absf( Dcy ) >= 1.f && Absf( Dvx - Dcy * T.PitchPerPx ) > 0.75f )
				Consistent = false;
		}

		if ( Clean )
		{
			// Calibration (frames propres + cohérente, la PREVIOUS frame propre aussi : son
			// input = la souris, le delta input est donc un vrai delta souris). Seuil de
			// mouvement pour un ratio stable ; garde anti-spike (< 30°/frame).
			if ( Consistent && T.PrevClean && ( Absf( Dcx ) >= 4.f || Absf( Dcy ) >= 4.f ) )
			{
				const float Dvy = Wrap180( InputView.m_y - T.PrevInput.m_y );
				const float Dvx = InputView.m_x - T.PrevInput.m_x;

				// DIAG SOURCES (plafonné) : le delta de la source en cours suit-il le delta
				// curseur ? Signal définitif « source vivante ou périmée » — le log 16:35 a
				// prouvé que m_pInputMoves ne suivait pas la souris (dIn≈0) : la calibration
				// n'a jamais convergé. Ici In = la source utilisée (CCSGOInput_GetViewAngles),
				// Mv = m_pInputMoves (comparaison, pour trancher sans deviner).
				if ( T.SrcLogCount < kSilentSrcLogCap )
				{
					T.SrcLogCount++;

					float DmYaw = 0.f , DmPitch = 0.f;
					float mYaw  = 0.f , mPitch = 0.f;

					if ( pInput && pInput->m_pInputMoves() )
					{
						const auto& MV = pInput->m_pInputMoves()->m_vecViewAngles();

						DmYaw   = Wrap180( MV.m_y - T.PrevMove.m_y );
						DmPitch = MV.m_x - T.PrevMove.m_x;
						mYaw    = MV.m_y;
						mPitch  = MV.m_x;
					}

					DEV_LOG( "[silent-aim] SOURIS: diag#%d dcur=(%d,%d)  dIn=(%.3f,%.3f) in=(%.2f,%.2f)  dMv=(%.3f,%.3f) mv=(%.2f,%.2f)\n" ,
						T.SrcLogCount , P.x , P.y , Dvy , Dvx , InputView.m_x , InputView.m_y , DmYaw , DmPitch , mPitch , mYaw );
				}

				// Calibration YAW :
				//  - déjà commit : EMA per-frame (0.7/0.3), garde fine 4px/0.1° ;
				//  - pas encore commit : bootstrap (log 17:xx) — un échantillon isolé n'est
				//    JAMAIS de confiance (le 1er échantillon de la session 17:xx portait un
				//    snap de vue de début de round, signes inversés, et a faussé la
				//    calibration pour toute la session). Règle : 3 échantillons CONSÉCUTIFS
				//    qui concordent à 15% près (floor 0.002°/px) → commit (moyenne) ; tout
				//    désaccord → la run est rejetée, on repart de zéro. Garde plus stricte
				//    avant commit (8px/0.3°) pour réduire les échantillons suspects.
				{
					const float MinPx  = T.HaveCalYaw ? 4.f : 8.f;
					const float MinDeg = T.HaveCalYaw ? 0.1f : 0.3f;

					if ( Absf( Dcx ) >= MinPx && Absf( Dvy ) >= MinDeg && Absf( Dvy ) < 30.f )
					{
						const float S = Dvy / Dcx;

						if ( T.HaveCalYaw )
						{
							T.YawPerPx = T.YawPerPx * 0.7f + S * 0.3f;
						}
						else
						{
							T.YawRun[ T.YawRunN ] = S;
							T.YawRunN++;

							if ( T.YawRunN == 3 )
							{
								const float Mean = ( T.YawRun[ 0 ] + T.YawRun[ 1 ] + T.YawRun[ 2 ] ) / 3.f;

								float Min = T.YawRun[ 0 ] , Max = T.YawRun[ 0 ];

								for ( int i = 1; i < 3; i++ )
								{
									if ( T.YawRun[ i ] < Min ) Min = T.YawRun[ i ];
									if ( T.YawRun[ i ] > Max ) Max = T.YawRun[ i ];
								}

								if ( ( Max - Min ) <= ( 0.15f * ( Absf( Mean ) > 0.001f ? Absf( Mean ) : 0.001f ) + 0.002f ) )
								{
									T.YawPerPx   = Mean;
									T.HaveCalYaw = true;
									T.YawRunN    = 0;

									if ( !T.YawCommitLogged )
									{
										T.YawCommitLogged = true;
										DEV_LOG( "[silent-aim] SOURIS: calibration yaw commit: %.5f deg/px (3 echantillons consecutifs concordants)\n" , T.YawPerPx );
									}
								}
								else
								{
									T.YawRunN = 0; // désaccord : run rejetée, on repart de zéro
								}
							}
						}
					}
				}

				// Calibration PITCH : même bootstrap que le yaw (symétrique sur Dcy/Dvx).
				{
					const float MinPx  = T.HaveCalPitch ? 4.f : 8.f;
					const float MinDeg = T.HaveCalPitch ? 0.1f : 0.3f;

					if ( Absf( Dcy ) >= MinPx && Absf( Dvx ) >= MinDeg && Absf( Dvx ) < 30.f )
					{
						const float S = Dvx / Dcy;

						if ( T.HaveCalPitch )
						{
							T.PitchPerPx = T.PitchPerPx * 0.7f + S * 0.3f;
						}
						else
						{
							T.PitchRun[ T.PitchRunN ] = S;
							T.PitchRunN++;

							if ( T.PitchRunN == 3 )
							{
								const float Mean = ( T.PitchRun[ 0 ] + T.PitchRun[ 1 ] + T.PitchRun[ 2 ] ) / 3.f;

								float Min = T.PitchRun[ 0 ] , Max = T.PitchRun[ 0 ];

								for ( int i = 1; i < 3; i++ )
								{
									if ( T.PitchRun[ i ] < Min ) Min = T.PitchRun[ i ];
									if ( T.PitchRun[ i ] > Max ) Max = T.PitchRun[ i ];
								}

								if ( ( Max - Min ) <= ( 0.15f * ( Absf( Mean ) > 0.001f ? Absf( Mean ) : 0.001f ) + 0.002f ) )
								{
									T.PitchPerPx   = Mean;
									T.HaveCalPitch = true;
									T.PitchRunN    = 0;

									if ( !T.PitchCommitLogged )
									{
										T.PitchCommitLogged = true;
										DEV_LOG( "[silent-aim] SOURIS: calibration pitch commit: %.5f deg/px (3 echantillons consecutifs concordants)\n" , T.PitchPerPx );
									}
								}
								else
								{
									T.PitchRunN = 0; // désaccord : run rejetée, on repart de zéro
								}
							}
						}
					}
				}
			}

			// Re-ancrage (frame propre + cohérente) : l'input courant EST la vraie souris —
			// on ancre la reconstruction sur la valeur la plus fraîche possible. L'ancre ne
			// dépend que des valeurs courantes (input + curseur), pas de deltas → safe.
			if ( Consistent )
			{
				T.Anchor = InputView;
				T.AnchorCursor.x = static_cast<float>( P.x );
				T.AnchorCursor.y = static_cast<float>( P.y );
				T.HaveAnchor = true;

				if ( !T.AnchorLogged )
				{
					T.AnchorLogged = true;
					DEV_LOG( "[silent-aim] SOURIS: ancre input=(%.2f,%.2f,%.2f) curseur=(%d,%d)\n" ,
						InputView.m_x , InputView.m_y , InputView.m_z , P.x , P.y );
				}
			}

			if ( T.HaveCalYaw && T.HaveCalPitch && !T.CalLogged )
			{
				T.CalLogged = true;
				DEV_LOG( "[silent-aim] SOURIS: calibration mesuree sur le jeu en cours: yaw=%.5f pitch=%.5f deg/px\n" ,
					T.YawPerPx , T.PitchPerPx );
			}
		}
	}

	T.PrevClean = Clean;
	T.PrevFiring = Firing;

	if ( GotCursor )
	{
		T.Cursor.x = static_cast<float>( P.x );
		T.Cursor.y = static_cast<float>( P.y );
		T.HaveCursor = true;
	}

	// Valeur m_pInputMoves de cette frame : base du delta pour le diag sources plafonné.
	if ( pInput && pInput->m_pInputMoves() )
	{
		const auto& MV = pInput->m_pInputMoves()->m_vecViewAngles();

		T.PrevMove.m_x = MV.m_x;
		T.PrevMove.m_y = MV.m_y;
		T.PrevMove.m_z = MV.m_z;
	}

	T.PrevInput = InputView;
}

auto CSilentAim::GetTrueMouseView() -> QAngle
{
	auto& T = g_SilentMouseTracker;

	QAngle M{};

	if ( !T.HaveAnchor || !T.HaveCalYaw || !T.HaveCalPitch )
		return M;

	POINT P{};

	if ( ::GetCursorPos( &P ) != 0 )
	{
		// M = ancre + déplacement curseur depuis l'ancre × calibration (mesurée sur le jeu :
		// sensibilité, eDPI, scaling Windows — tout est absorbé).
		M.m_x = T.Anchor.m_x + ( static_cast<float>( P.y ) - T.AnchorCursor.y ) * T.PitchPerPx;
		M.m_y = Wrap180( T.Anchor.m_y + ( static_cast<float>( P.x ) - T.AnchorCursor.x ) * T.YawPerPx );
		M.m_z = 0.f;
	}
	else
	{
		// GetCursorPos en échec (rare) : on reste sur l'ancre (caméra figée, plutôt que de
		// repartir sur la visée clobberée).
		M = T.Anchor;
	}

	Math::NormalizeAngles( M );
	Math::ClampAngles( M );

	return M;
}

auto CSilentAim::MouseTracked() -> bool
{
	return g_SilentMouseTracker.HaveAnchor && g_SilentMouseTracker.HaveCalYaw && g_SilentMouseTracker.HaveCalPitch;
}

// Distance (en pixels, depuis le CENTRE de l'écran = le crosshair) de la bone pour la VUE SOURIS
// (MouseView) — test ANGULAIRE, sans transformer de point avec un VMatrix (la convention row/column
// des VMatrix de ce moteur n'est pas documentée dans la base, et une formule NDC mal calibrée
// projetait tout hors du FOV -> le silent ne s'engageait jamais, cf. build 11:37). On n'utilise que :
//   - la base vue monde (Math::AngleVectors : convention validée in-game par l'aimbot) ;
//   - f_x/f_y = ÉLÉMENTS DIAGONAUX de la matrice view->projection capturée dans le hook :
//     f = 1/tan(halfFov) si la NDC est [-1,1] (cas de ce moteur, cf. formule de Math::WorldToScreen),
//     identique quelle que soit la convention row/column (la transposée a la même diagonale) ;
//     auto-adaptatif si le moteur stockerait (W/2)/tan(halfFov) (NDC en pixels).
// Retourne -1 si la bone est derrière la caméra ou si les f sont invalides.
static auto SilentDistanceFromCenter( const Vector3& EyeOrigin , const Vector3& BonePos , const QAngle& MouseView , const VMatrix* pViewToProjection , int ScreenW , int ScreenH ) -> float
{
	if ( !pViewToProjection )
		return -1.f;

	const float FocalX = pViewToProjection->m_data[0][0];
	const float FocalY = pViewToProjection->m_data[1][1];

	if ( FocalX < 0.1f || FocalY < 0.1f )
		return -1.f;

	Vector3 Forward , Right , Up;

	Math::AngleVectors( MouseView , Forward , Right , Up );

	const Vector3 ToBone = ( BonePos - EyeOrigin ).Normalized();

	const float Dz = ToBone.Dot( Forward );

	if ( Dz <= 0.01f )
		return -1.f; // derrière la caméra (ou rasant)

	const float Dx = ToBone.Dot( Right );
	const float Dy = ToBone.Dot( Up );

	// f est soit 1/tan(halfFov) (NDC [-1,1] -> on multiplie par la demi-taille d'écran) soit
	// (W/2)/tan(halfFov) (NDC en pixels -> pas d'échelle) : f < 50 => NDC, f >= 50 => pixels.
	const float ScaleX = ( FocalX < 50.f ) ? static_cast<float>( ScreenW ) * 0.5f : 1.f;
	const float ScaleY = ( FocalY < 50.f ) ? static_cast<float>( ScreenH ) * 0.5f : 1.f;

	const float Sx = FocalX * ScaleX * ( Dx / Dz );
	const float Sy = FocalY * ScaleY * ( Dy / Dz );

	return sqrtf( Sx * Sx + Sy * Sy );
}

// Diagnostic one-shot (premier tick où le bind est tenu) : où les cibles sont-elles filtrées ?
// (permet de distinguer « pas d'ennemi proche » de « géométrie FOV faussée » dans debug.log)
static struct SilentDiag_t
{
	int Total = 0;             // pawns ennemis vivants considérés
	int PassedMaxDistance = 0; // à portée (MaxDistance)
	float MinCircleDist = 1e9f; // distance au centre min parmi ceux-là (avant le test FOV)
	int PassedCircle = 0;      // dans le cercle FOV
	int PassedVisible = 0;     // + visible (line-of-sight)
	int UsedFallback = 0;      // la distance est venue du fallback Math::WorldToScreen
} g_SilentDiag;

static bool g_SilentDiagLogged = false;
static bool g_SilentTargetLogged = false;

// Noms des bones de visée (mêmes bones que l'aimbot) : 0 = head , 1 = chest , 2 = pelvis.
static const char* g_SilentAimBones[] =
{
	"head_0" ,
	"spine_3" ,
	"pelvis"
};

auto CSilentAim::GetBoneWorldPosition( C_CSPlayerPawn* pC_CSPlayerPawn ) -> Vector3
{
	if ( !pC_CSPlayerPawn )
		return Vector3::Zero;

	int BoneIndex = 0;

	if ( Settings::SilentAim::Bone < 1 )
		BoneIndex = 0;
	else if ( Settings::SilentAim::Bone < 2 )
		BoneIndex = 1;
	else
		BoneIndex = 2;

	return GetCL_Bones()->GetBonePositionByName( pC_CSPlayerPawn , g_SilentAimBones[ BoneIndex ] );
}

auto CSilentAim::GetBestTarget( const Vector3& EyeOrigin , const ImVec2& ScreenCenter , const QAngle& MouseView , float FovRadius , const VMatrix* pViewToProjection , int ScreenW , int ScreenH ) -> TargetInfo_t
{
	TargetInfo_t Best;

	g_SilentDiag = {};

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

			if ( !Settings::SilentAim::Friendly && pController->m_iTeamNum() == LocalTeam )
				continue;

			if ( !pController->m_bPawnIsAlive() )
				continue;

			auto* pPawn = pController->m_hPawn().Get< C_CSPlayerPawn >();

			if ( !pPawn || !pPawn->IsPlayerPawn() )
				continue;

			g_SilentDiag.Total++;

			const auto BonePos = GetBoneWorldPosition( pPawn );

			if ( BonePos.IsZero() )
				continue;

			if ( EyeOrigin.Distance( BonePos ) > static_cast<float>( Settings::SilentAim::MaxDistance ) )
				continue;

			g_SilentDiag.PassedMaxDistance++;

			// Distance au centre de l'écran (crosshair) dans la VUE SOURIS — test ANGULAIRE
			// (SilentDistanceFromCenter) : la cible doit être dans le cercle TEL QUE L'UTILISATEUR
			// LE VOIT. Pas via ScreenTransform du moteur (vue de l'état du joueur = la visée quand
			// le silent est actif, ce qui rendrait la cible « toujours dans le FOV »).
			float DistanceToCenter = SilentDistanceFromCenter( EyeOrigin , BonePos , MouseView , pViewToProjection , ScreenW , ScreenH );

			if ( DistanceToCenter < 0.f )
			{
				// Fallback (matrice view->projection indisponible) : Math::WorldToScreen — vue de
				// l'état (comportement du build précédent, « verrouillage plein écran »).
				ImVec2 ScreenPos;

				if ( !Math::WorldToScreen( BonePos , ScreenPos ) )
					continue;

				g_SilentDiag.UsedFallback++;

				const auto DxC = ScreenPos.x - ScreenCenter.x;
				const auto DyC = ScreenPos.y - ScreenCenter.y;
				DistanceToCenter = sqrtf( DxC * DxC + DyC * DyC );
			}

			if ( DistanceToCenter < g_SilentDiag.MinCircleDist )
				g_SilentDiag.MinCircleDist = DistanceToCenter;

			if ( DistanceToCenter > FovRadius )
				continue;

			g_SilentDiag.PassedCircle++;

			// Visible Only : exclure les cibles derrière un mur (line-of-sight sur la bone visée)
			if ( Settings::SilentAim::OnlyVisible && !GetCL_VisibleCheck()->IsBoneVisible( pPawn , BonePos ) )
				continue;

			g_SilentDiag.PassedVisible++;

			if ( !Best.pPawn || DistanceToCenter < Best.DistanceToScreenCenter )
			{
				Best.pPawn = pPawn;
				Best.DistanceToScreenCenter = DistanceToCenter;
			}
		}
	}

	// Diagnostic one-shot (1er tick où le bind est tenu) : où les cibles sont-elles filtrées ?
	if ( !g_SilentDiagLogged )
	{
		g_SilentDiagLogged = true;

		DEV_LOG( "[silent-aim] diag FOV: total=%d maxdist=%d minCircle=%.1f px circle=%d visible=%d fallback=%d (fov=%.0f px, ecran=%dx%d)\n" ,
			g_SilentDiag.Total , g_SilentDiag.PassedMaxDistance , g_SilentDiag.MinCircleDist ,
			g_SilentDiag.PassedCircle , g_SilentDiag.PassedVisible , g_SilentDiag.UsedFallback ,
			FovRadius , ScreenW , ScreenH );
	}

	if ( Best.pPawn && !g_SilentTargetLogged )
	{
		g_SilentTargetLogged = true;
		DEV_LOG( "[silent-aim] cible dans le FOV: dist=%.1f px (rayon=%.0f px)\n" , Best.DistanceToScreenCenter , FovRadius );
	}

	return Best;
}

auto CSilentAim::OnCreateMove( CCSGOInput* pInput , CUserCmd* pUserCmd ) -> void
{
	auto& Silent = g_SilentAimRenderState;

	if ( !pInput || !pUserCmd )
	{
		Silent.Active = false;
		return;
	}

	if ( !SDK::Interfaces::EngineToClient()->IsInGame() )
	{
		Silent.Active = false;
		return;
	}

	if ( !pInput->m_pInputMoves() )
	{
		Silent.Active = false;
		return;
	}

	// ---- VRAIE VUE SOURIS (M) — tracker (à chaque frame, quel que soit l'état du silent).
	// Le log in-game (silent-v1) a prouvé que l'input n'est PAS la souris pendant le silent :
	// input = écho serveur + delta non-ack = la visée (call#N « errM=0.00 »). Hors visée, en
	// revanche, input = la souris EXACTEMENT (log : input 44.34° = la souris, état 44.48° =
	// la souris quelques ms plus tôt = l'écho normal de CS2). TrackMouseInput en use l'ancre
	// + le curseur + la calibration mesurée en jeu pour reconstruire M en continu.
	//
	// SOURCE : CCSGOInput_GetViewAngles — la seule source démontrée en jeu pour suivre la
	// souris en direct (log 15:05 « input 44.34° = la souris » ; le silent-v1 l'appelait
	// déjà game thread au stage 6, sans problème). Le log 16:35 (silent-v2) a prouvé que
	// m_pInputMoves()->m_vecViewAngles() ne suit PAS la souris sur le game thread (l'ancre
	// a marché, la calibration n'a jamais convergé sur toute une session de jeu normal) :
	// bannie du tracker, conservée ici uniquement en fallback si la source est nulle.
	QAngle InputView{};
	bool InputViewValid = false;

	if ( const QAngle* pVA = CCSGOInput_GetViewAngles( pInput , 0 ) )
	{
		InputView.m_x = pVA->m_x;
		InputView.m_y = pVA->m_y;
		InputView.m_z = pVA->m_z;
		InputViewValid = true;
	}
	else if ( pInput->m_pInputMoves() )
	{
		const auto& VA = pInput->m_pInputMoves()->m_vecViewAngles();

		InputView.m_x = VA.m_x;
		InputView.m_y = VA.m_y;
		InputView.m_z = VA.m_z;
	}

	const bool Firing = ( pUserCmd->button_states.buttonstate1 & IN_ATTACK ) != 0;

	TrackMouseInput( InputView , Firing , pInput , InputViewValid );

	const bool MValid = MouseTracked();

	QAngle M{};

	if ( MValid )
		M = GetTrueMouseView();

	// Pointeur input conservé (gate du hook de rendu + garde nulle de ForceLocalEyeState).
	Silent.Input = pInput;

	bool SentAim = false;

	// Silent Aim : actif UNIQUEMENT pendant que sa keybind (hold) est maintenue.
	// 0 (aucune touche associée) -> la fonction est désactivée.
	if ( CKeybinds::KeybindHold( Settings::Keybinds::SilentAim ) )
	{
		auto* pLocalController = GetCL_Players()->GetLocalPlayerController();
		auto* pLocalPawn = GetCL_Players()->GetLocalPlayerPawn();

		if ( pLocalController && pLocalPawn && pLocalPawn->IsPlayerPawn() && pLocalPawn->IsAlive() )
		{
			int ScreenWidth = 0 , ScreenHeight = 0;

			SDK::Interfaces::EngineToClient()->GetScreenSize( ScreenWidth , ScreenHeight );

			ImVec2 ScreenCenter( static_cast<float>( ScreenWidth ) / 2.f , static_cast<float>( ScreenHeight ) / 2.f );

			// Cercle de FOV en bleu (distinct du rouge de l'aimbot) pour repérer le mode silencieux actif.
			if ( Settings::SilentAim::FOVDisplay )
				GetRenderStackSystem()->DrawCircle( ScreenCenter , Settings::SilentAim::FOV , ImColor( 0 , 200 , 255 , 100 ) );

			// Le test FOV se fait dans la VRAIE vue souris (M) : avec l'input clobberé (la
			// visée), la cible « restait toujours dans le FOV » (l'aim la verrouille) et le
			// silent ne se désengageait jamais quand la souris s'éloignait (log silent-v1).
			// M est cohérent avec ce que l'utilisateur voit : la caméra est forcée sur M au
			// stage 6, le crosshair (centre écran) pointe donc dans la direction M.
			const QAngle MouseView = ( MValid ) ? M : InputView;

			// Géométrie du FOV (test angulaire + matrice view->projection capturée dans le hook).
			const auto Best = GetBestTarget( GetCL_Players()->GetLocalEyeOrigin() , ScreenCenter , MouseView , Settings::SilentAim::FOV ,
				Silent.HasViewToProjection ? &Silent.ViewToProjection : nullptr , ScreenWidth , ScreenHeight );

			if ( Best.pPawn )
			{
				const auto BonePos = GetBoneWorldPosition( Best.pPawn );

				if ( !BonePos.IsZero() )
				{
					QAngle AimAngles = Math::CalcAngle( GetCL_Players()->GetLocalEyeOrigin() , BonePos );

					QAngle FinalAngles;

					Math::SmoothAngles( MouseView , AimAngles , FinalAngles , Settings::SilentAim::Smoothing );

					// SILENT : on écrit l'ANGLE DU TIR dans cmd.base.viewangles -> le serveur tire sur
					// la cible. La caméra rendue (l'état m_angEyeAngles = l'écho de ce cmd) est forcée
					// sur M au stage 6 (OnFrameStageNotify) et au rendu (backstop) : le tir vise la
					// cible, la caméra/crosshair restent sous la souris.
					Silent.AimView = FinalAngles;   // référence de matching de l'offset CViewSetup + diagnostics
					Silent.Active  = true;
					SentAim        = true;

					//   AddSetViewAngles=false : pas d'appel CCSGOInput_SetViewAngles.
					//   OnlyInputHistory=false  : on écrit cmd.base.viewangles (le serveur y lit l'angle du tir).
					// (test in-game : l'écriture de input_history seule ne redirigeait PAS le tir sur cette
					//  base ; c'est bien cmd.base.viewangles qui pilote l'angle du tir.)
					GetCL_Bypass()->SetViewAngles( &FinalAngles , pInput , pUserCmd , /*AddSetViewAngles=*/false , /*OnlyInputHistory=*/false );

					if ( Settings::SilentAim::Trigger )
						GetCL_Bypass()->SetAttack( pUserCmd );
				}
			}
		}
	}

	if ( !SentAim )
		Silent.Active = false;

	// ---- RESYNC (pas de « jump » caméra au désengagement) : le dernier aim envoyé est encore
	// en vol ; son écho va converger m_angEyeAngles (la caméra rendue) vers la cible pendant
	// un aller-retour serveur = un flicker visible vers la cible. On renvoie M (la vraie
	// souris) pendant la fenêtre : l'écho suivant = la souris -> la caméra reste continue.
	// La fenêtre couvre les frames « en vol » (input_history = frames pas encore traitées par
	// le serveur — ping élevé inclus). Arrêt anticipé dès que l'input du jeu a reconvergé sur
	// la souris (M ~= I) : le relais vers le cmd du jeu est alors transparent.
	int ResyncWindow = kSilentResyncBase;

#if DISABLE_PROTOBUF == 0

	if ( pUserCmd->cmd.input_history_size() + 2 > ResyncWindow )
		ResyncWindow = pUserCmd->cmd.input_history_size() + 2;

#endif

	if ( SentAim )
	{
		g_SilentAimFramesSinceAim = 0;
	}
	else if ( g_SilentAimFramesSinceAim < ResyncWindow && MValid )
	{
		QAngle Send = M;

		GetCL_Bypass()->SetViewAngles( &Send , pInput , pUserCmd , /*AddSetViewAngles=*/false , /*OnlyInputHistory=*/false );

		if ( YawDiff( Send.m_y , InputView.m_y ) < 0.05f && Absf( Send.m_x - InputView.m_x ) < 0.05f )
			g_SilentAimFramesSinceAim = 90000;
	}

	if ( g_SilentAimFramesSinceAim < 90000 )
		g_SilentAimFramesSinceAim++;
}

auto CSilentAim::ForceLocalEyeState( const char* Tag ) -> void
{
	auto& Silent = g_SilentAimRenderState;

	if ( !Silent.Input )
		return;

	// Vraie vue souris (M) — reconstruite (tracker en tête de fichier) : le log in-game
	// (silent-v1) a prouvé que CCSGOInput_GetViewAngles est la visée CLOBBERÉE pendant le
	// silent (call#N « errM=0.00 ») — M = ancre hors visée + curseur (GetCursorPos) ×
	// calibration mesurée sur le jeu en cours. Sans calibration (souris jamais bougée hors
	// visée) : on n'écrit rien (pas de valeur fausse imposée à l'état).
	if ( !MouseTracked() )
	{
		if ( !g_SilentMouseTracker.NoCalLogged )
		{
			g_SilentMouseTracker.NoCalLogged = true;
			DEV_LOG( "[silent-aim] SOURIS: calibration indisponible (menu FERME + souris bougee quelques secondes ?) - etat non force, degradation silent-v1\n" );
		}
		return;
	}

	const QAngle M = GetTrueMouseView();

	auto* pLocalPawn = GetCL_Players()->GetLocalPlayerPawn();

	if ( !pLocalPawn || !pLocalPawn->IsAlive() )
		return;

	// Résolution du schema (mise en cache pour la session). Le dump lie m_angEyeAngles /
	// m_arrOldEyeAngles à C_CSPlayerPawn (section « // client », 0x3340 / 0x33E0) et PAS à
	// C_CSPlayerPawnBase (l'entrée SCHEMA_OFFSET existante sur la base est stale : retourne 0 =
	// vtable -> crash). Fallback sur la base pour la forme ; l'offset résolu est loggé.
	static struct
	{
		uint32_t OffAngles = 0;
		uint32_t OffOld = 0;
		bool Tried = false;
		bool LogBefore[ 2 ] = { false , false }; // [0] = sim (stage 6) , [1] = render
		bool LogAfter[ 2 ] = { false , false };
		bool LogFail = false;
	} s_ForceState;

	if ( !s_ForceState.Tried )
	{
		s_ForceState.Tried = true;

		s_ForceState.OffAngles = GetSchemaOffset()->GetOffset( "C_CSPlayerPawn" , "m_angEyeAngles" );
		if ( s_ForceState.OffAngles == 0 )
			s_ForceState.OffAngles = GetSchemaOffset()->GetOffset( "C_CSPlayerPawnBase" , "m_angEyeAngles" );

		s_ForceState.OffOld = GetSchemaOffset()->GetOffset( "C_CSPlayerPawn" , "m_arrOldEyeAngles" );
		if ( s_ForceState.OffOld == 0 )
			s_ForceState.OffOld = GetSchemaOffset()->GetOffset( "C_CSPlayerPawnBase" , "m_arrOldEyeAngles" );
	}

	if ( s_ForceState.OffAngles == 0 )
	{
		if ( !s_ForceState.LogFail )
		{
			s_ForceState.LogFail = true;
			DEV_LOG( "[silent-aim] FORCE_ETAT: offset m_angEyeAngles NON trouve dans le schema (pawn=%p)\n" , pLocalPawn );
		}
		return;
	}

	const int Which = ( Tag && strcmp( Tag , "render" ) == 0 ) ? 1 : 0;

	auto* pEtat = reinterpret_cast<QAngle*>( reinterpret_cast<uint64_t>( pLocalPawn ) + s_ForceState.OffAngles );

	// One-shot TRANCHANT : « avant » dit si l'écho a déjà atteint l'état à ce stade (avant ~=
	// aim = l'écho s'est appliqué avant ce point) ; « après » confirme que l'écriture a tenu.
	if ( !s_ForceState.LogBefore[ Which ] )
	{
		s_ForceState.LogBefore[ Which ] = true;

		DEV_LOG( "[silent-aim] FORCE_ETAT %s: avant=(%.2f,%.2f,%.2f)  souris_r=(%.2f,%.2f,%.2f)  aim=(%.2f,%.2f,%.2f)  (off=0x%X, old=0x%X)\n" ,
			Tag ,
			pEtat->m_x , pEtat->m_y , pEtat->m_z ,
			M.m_x , M.m_y , M.m_z ,
			Silent.AimView.m_x , Silent.AimView.m_y , Silent.AimView.m_z ,
			s_ForceState.OffAngles , s_ForceState.OffOld );
	}

	// Vue courante + historique d'interpolation (tous les slots à la souris -> n'importe quel
	// ratio d'interp = la souris ; neutralise tout lerp vers l'ancienne vue). Le serveur garde
	// la visée : le tir a déjà été envoyé dans cmd.base à CreateMove.
	*pEtat = M;

	if ( s_ForceState.OffOld > 0 )
	{
		auto* pOld = reinterpret_cast<QAngle*>( reinterpret_cast<uint64_t>( pLocalPawn ) + s_ForceState.OffOld );

		for ( int i = 0; i < 4; i++ )
			pOld[ i ] = M;
	}

	if ( !s_ForceState.LogAfter[ Which ] )
	{
		s_ForceState.LogAfter[ Which ] = true;

		DEV_LOG( "[silent-aim] FORCE_ETAT %s: apres ecriture etat=(%.2f,%.2f,%.2f)  souris_r=(%.2f,%.2f,%.2f)\n" ,
			Tag ,
			pEtat->m_x , pEtat->m_y , pEtat->m_z ,
			M.m_x , M.m_y , M.m_z );
	}
}

auto CSilentAim::ForceInputView( const QAngle& M , const char* Tag ) -> void
{
	// CAMÉRA 3D (verdict 17:xx, silent-v3) : l'état du joueur + le CViewSetup sont sous
	// notre contrôle (FORCE_ETAT avant=aim → apres=souris_r ; call#N : le struct porte
	// souris_r AVANT et APRÈS l'appel original) MAIS la caméra 3D suit toujours la visée
	// → le monde 3D lit sa vue depuis la « vue courante » du système d'input = le pointeur
	// rendu par CCSGOInput_GetViewAngles (hors visée elle converge sur la souris = caméra
	// normale ; pendant le silent sur la visée = le « lag caméra » CS2, resync sur l'écho
	// serveur). L'écrire sur M = le dernier levier. Le one-shot avant/après par tag (sim =
	// stage 6 / render = backstop) dit si un resync vers l'écho se produit entre nos deux
	// écritures (si « avant » = l'aim au render : il y a resync en aval → étape suivante :
	// pattern de la fonction de resync / de la vue setup du monde 3D).
	if ( !g_SilentAimRenderState.Input )
		return;

	if ( !MouseTracked() )
		return;

	// Non-const : c'est un pointeur d'ÉCRITURE — la « vue courante » du système d'input est
	// exactement ce qu'on veut forcer sur M.
	QAngle* pVA = CCSGOInput_GetViewAngles( g_SilentAimRenderState.Input , 0 );

	if ( !pVA )
		return;

	static struct
	{
		bool Log[ 2 ] = { false , false }; // [0] = sim (stage 6) , [1] = render
	} s_InputViewLog;

	const int Which = ( Tag && strcmp( Tag , "render" ) == 0 ) ? 1 : 0;

	if ( !s_InputViewLog.Log[ Which ] )
	{
		s_InputViewLog.Log[ Which ] = true;

		DEV_LOG( "[silent-aim] INPUT_VIEW %s: avant=(%.2f,%.2f,%.2f)  ecrit M=(%.2f,%.2f,%.2f)\n" ,
			Tag ,
			pVA->m_x , pVA->m_y , pVA->m_z ,
			M.m_x , M.m_y , M.m_z );
	}

	*pVA = M;
}

auto CSilentAim::OnFrameStageNotify( int FrameStage ) -> void
{
	// Stage 6 = juste après l'update des données serveur (l'écho de cmd.base.viewangles — la
	// visée envoyée au tick précédent — vient d'être appliqué à m_angEyeAngles) et AVANT
	// CreateMove et tout passage de view (monde 3D, 2D, CViewSetup). Forcer l'état sur M, la
	// vraie vue souris reconstruite, ici le garde sous la souris sur tout le reste du tick :
	// la caméra rendue (quelle que soit la phase qui la lit) suit la souris. Le backstop au
	// rendu (hook GetMatricesForView -> ForceLocalEyeState("render")) couvre ce qui relirait
	// l'état entre le stage 6 et le rendu.
	// Gate sur Silent.Active (un aim a été envoyé sur la frame précédente) : hors visée,
	// l'état reste sur l'écho normal (feeling caméra natif CS2 — pas de « sur-réactivité »
	// liée à la touche, et aucun changement de comportement quand la touche est tenue sans
	// cible). Au 1er frame de visée, la correction d'amorçage est d'ordre du sous-degré
	// (l'écho = la souris quelques ms plus tôt : même trajectoire, léger décalage).
	// Verdict 17:xx : l'état + le CViewSetup ne suffisent PAS — la caméra 3D lit la « vue
	// courante » du système d'input : ForceInputView la force sur M ici aussi (le backstop
	// thread rendu le refait dans le hook GetMatricesForView).
	if ( FrameStage != 6 )
		return;

	if ( !SDK::Interfaces::EngineToClient()->IsInGame() )
		return;

	if ( !g_SilentAimRenderState.Active )
		return;

	ForceLocalEyeState( "sim" );

	// ForceInputView est un no-op si la souris n'est pas trackée (M = QAngle nul).
	ForceInputView( GetTrueMouseView() , "sim" );
}

auto GetSilentAim() -> CSilentAim*
{
	return &g_CSilentAim;
}

auto GetSilentAimRenderState() -> CSilentAimRenderState&
{
	return g_SilentAimRenderState;
}
