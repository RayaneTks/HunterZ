#pragma once

#include <Common/Common.hpp>

// Radar / minimap autonome — overlay dessiné en phase present (draw list ImGui, rendu par-dessus
// le jeu, au moment du Present) qui trace les joueurs autour de vous : ennemis + équipe, Y COMPRIS
// ceux qui sont HORS ÉCRAN.
//
// La minimap est « face » : le « avant » du joueur pointe toujours vers le haut et la carte tourne
// avec votre vue (comportement du radar du jeu). Les positions mondes viennent du cache d'entités
// (pawn->GetOrigin, donc valide même hors écran) et l'orientation du joueur vient de
// C_CSPlayerPawnBase::m_angEyeAngles (le yaw de la vue, la même source que la caméra 3D).
//
// Indépendant du silent aim et des skins (ne dépend que du cache d'entités + CL_Players + Math).
class CRadar final
{
public:
	// Phase present : l'overlay (fallback) — radar dessinée par-dessus le jeu.
	auto OnRender() -> void;

	// Phase update (FrameStage 6 = FS_POSTSERVER, après les données serveur, avant le rendu) :
	// force l'état "spot" (m_bSpotted + masque) côté client sur les ENNEMIS pour que la radar
	// NATIVE du jeu (Panorama) les affiche — l'effet « mode spectateur », sans overlay.
	auto OnFrameStageNotify( int FrameStage ) -> void;
};

auto GetRadar() -> CRadar*;
