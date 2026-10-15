#pragma once

#include <Common/Common.hpp>

#include <CS2/SDK/Math/Matrix.hpp>
#include <CS2/SDK/Math/QAngle.hpp>

#include <ImGui/imgui.h>

class CCSGOInput;
class CUserCmd;
class C_CSPlayerPawn;
class Vector3;

// État partagé avec le hook de rendu (GetMatricesForView) pour le mode silencieux.
//
// Le log in-game a établi le modèle réel (builds 20:11 → silent-v1, 15:05) :
//   - La caméra VISIBLE = l'ÉTAT du joueur local (C_CSPlayerPawn::m_angEyeAngles, 0x3350 au
//     schema live) = l'écho serveur de cmd.base.viewangles — le « lag caméra » propre à CS2.
//     Pendant le silent actif, cet état converge vers la visée (le « clobber » :
//     caméra/crosshair sur la cible).
//   - CCSGOInput_GetViewAngles() n'est PAS la souris pendant le silent : l'input du jeu =
//     écho + delta souris non-ack = la visée (log call#N « errM=0.00 »). Le jeu ne stocke
//     nulle part de « vue souris absolue » (la souris n'arrive qu'en delta relatif).
// Principe du silent : le tir (cmd.base) vise la cible, et le rendu local (l'état au stage 6,
// le CViewSetup au rendu) est forcé sur M = la vraie vue souris reconstruite dans CSilentAim
// (ancre sur l'input hors visée — où input = souris EXACTEMENT — + GetCursorPos + calibration
// pixel→degrés mesurée sur le jeu en cours) => les balles touchent la cible, la
// caméra/crosshair restent sous la souris.
struct CSilentAimRenderState
{
	bool Active = false;            // le silent est actif sur ce tick (touche maintenue + cible valide)
	QAngle AimView{};              // dernière visée écrite dans cmd.base (réf. de matching + diagnostics)
	CCSGOInput* Input = nullptr;      // pour CCSGOInput_GetViewAngles dans le hook (la vraie souris)
	VMatrix ViewToProjection{};       // matrice view->projection capturée dans le hook : f_x/f_y sur la diagonale
	bool HasViewToProjection = false; // pour le test FOV angulaire (GetBestTarget) — indépendant de la convention VMatrix
};

// Silent Aim : visée « silencieuse » — le tir est corrigé côté serveur (cmd.base.viewangles)
// SANS bouger la caméra : l'état du joueur est forcé au stage 6 sur M = la vraie vue souris
// reconstruite (voir TrackMouseInput), et le hook de rendu le reforce en backstop.
// Verdict 17:xx (silent-v3) : l'état + le CViewSetup sont sous contrôle (log : avant=aim →
// apres=souris_r, et les appels GetMatricesForView portent la souris avant/après l'original)
// MAIS la caméra 3D suit toujours la visée → le monde 3D lit sa vue depuis la « vue courante »
// du système d'input = le pointeur rendu par CCSGOInput_GetViewAngles (converge sur la souris
// hors visée = caméra normale ; sur la visée pendant le silent = le « lag caméra » CS2,
// resync sur l'écho serveur) → ForceInputView la force sur M (stage 6 + backstop rendu).
// Activé uniquement pendant que la keybind (hold) Settings::Keybinds::SilentAim est maintenue.
// Fonction indépendante de CAimbot.
class CSilentAim final
{
public:
	auto OnCreateMove( CCSGOInput* pInput , CUserCmd* pUserCmd ) -> void;

	// Frame stage 6 (après l'update des données serveur — l'écho de la visée envoyée au tick
	// précédent vient d'être appliqué à m_angEyeAngles — et AVANT CreateMove et tout passage
	// de view) : force l'état du joueur (m_angEyeAngles + m_arrOldEyeAngles[4]) sur M, la
	// vraie vue souris reconstruite. La caméra rendue (quelle que soit la phase qui la lit :
	// 3D, 2D, CViewSetup) reste sous la souris sur tout le reste du tick. Gate sur
	// Silent.Active (un aim a été envoyé sur la frame précédente) : hors visée, l'état reste
	// sur l'écho normal (feeling caméra natif CS2, pas de « sur-réactivité » liée à la
	// touche). ForceLocalEyeState est un no-op si la souris n'est pas calibrée.
	auto OnFrameStageNotify( int FrameStage ) -> void;

	// Ré-écrit l'état oculaire du joueur local (m_angEyeAngles + m_arrOldEyeAngles[4]) sur M,
	// la vraie vue souris reconstruite (voir TrackMouseInput/GetTrueMouseView). Le serveur
	// garde la visée (le tir est déjà dans le cmd à CreateMove) — seul le rendu local est
	// corrigé. Tag « sim » (stage 6) / « render » (backstop dans le hook GetMatricesForView)
	// : one-shots avant/après + offsets résolus dans debug.log ([silent-aim] FORCE_ETAT).
	auto ForceLocalEyeState( const char* Tag ) -> void;

	// CAMÉRA 3D (verdict 17:xx) : le monde 3D lit sa vue depuis la « vue courante » du
	// système d'input — le pointeur QAngle* rendu par CCSGOInput_GetViewAngles(pInput, 0) —
	// et non depuis l'état du joueur (forcé ci-dessus : log 17:xx, l'état + le CViewSetup
	// sont sous contrôle mais la caméra 3D suit la visée). Forcer ce pointeur sur M = le
	// dernier levier. Tag « sim » (stage 6) / « render » (backstop hook) : one-shots
	// avant/après ([silent-aim] INPUT_VIEW) — si « avant » montre l'aim au render, un
	// resync vers l'écho se produit entre l'écriture et le rendu (étape suivante : pattern
	// du resync / de la vue setup du monde). No-op si souris non trackée ou pointeur null.
	auto ForceInputView( const QAngle& M , const char* Tag ) -> void;

	// VRAIE VUE SOURIS (M) — tracker, appelé à chaque frame depuis OnCreateMove (quel que soit
	// l'état du silent). Le log in-game (silent-v1) a prouvé : pendant le silent,
	// CCSGOInput_GetViewAngles est la visée CLOBBERÉE (input = écho + delta non-ack = la visée,
	// call#N « errM=0.00 ») ; hors visée, c'est la souris EXACTEMENT (écho = souris envoyée +
	// delta = souris courante). D'où la reconstruction :
	//
	// InputView : la vue input du jeu, issue de CCSGOInput_GetViewAngles — la SEULE source
	// démontrée en jeu pour suivre la souris en direct. Le log 16:35 (silent-v2) a prouvé
	// que m_pInputMoves()->m_vecViewAngles() ne suit PAS la souris sur le game thread
	// (ancre OK, calibration jamais convergée sur une session de jeu normal complète) :
	// source bannie, conservée comme fallback (InputValid=false) + diag plafonné.
	//   - ancre : sur les frames « propres » (pas d'aim depuis kSilentCleanFrames frames, pas
	//     de recoil, pas de menu ouvert), input = M EXACTEMENT → on ancre (input + curseur) ;
	//     l'ancre est rafraichie à chaque frame propre et ne change JAMAIS pendant un lock
	//     (elle ne bouge que hors visée) → les lectures render thread sont stables ;
	 //   - calibration pixel→degrés : mesurée EN DIRECT sur le jeu en cours (EMA des
	//     Δinput/Δcurseur, frames propres seulement) — la sensibilité du jeu, l'eDPI, le
	//     scaling pointeur Windows sont tous absorbés : aucune hypothèse, aucun pattern
	//     client.dll supplémentaire ;
	//   - M(t) = Ancre + (curseur(t) - AncreCurseur) × calibration. Le curseur virtuel
	//     (GetCursorPos, user32) suit la souris même capturée (SetCapture) — comportement
	//     identique au jeu (la vue s'arrête au clip curseur, comme dans CS2).
	// MouseTracked() = true si la reconstruction est utilisable (ancre + calibration complète).
	// Firing : bouton de tir enfoncé (cette frame) — frames exclues de l'ancre/calibration.
	// pInput : pour le diag sources plafonné (comparaison contre m_pInputMoves, null-safe).
	// InputValid : false si la source principale (CCSGOInput_GetViewAngles) est nulle et que
	// le fallback per-tick a été utilisé → frame exclue de l'ancre et de la calibration.
	auto TrackMouseInput( const QAngle& InputView , bool Firing , CCSGOInput* pInput , bool InputValid ) -> void;
	auto GetTrueMouseView() -> QAngle;
	auto MouseTracked() -> bool;

private:
	struct TargetInfo_t
	{
		C_CSPlayerPawn* pPawn = nullptr;
		float DistanceToScreenCenter = 0.f;
	};

	// MouseView : la vraie vue souris (pour le test FOV angulaire dans la vue que l'utilisateur voit).
	// pViewToProjection : matrice view->projection capturée dans le hook (f_x/f_y = diagonale,
	// convention-indépendante). nullptr ou f invalides -> fallback Math::WorldToScreen (vue de
	// l'état du moteur — comportement du build précédent, qui « verrouille plein écran »).
	auto GetBestTarget( const Vector3& EyeOrigin , const ImVec2& ScreenCenter , const QAngle& MouseView , float FovRadius , const VMatrix* pViewToProjection , int ScreenW , int ScreenH ) -> TargetInfo_t;
	auto GetBoneWorldPosition( C_CSPlayerPawn* pC_CSPlayerPawn ) -> Vector3;
};

auto GetSilentAim() -> CSilentAim*;
auto GetSilentAimRenderState() -> CSilentAimRenderState&;
