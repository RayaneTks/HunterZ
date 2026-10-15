ANDROMEDA CS2 - Build local (Release x64) - 31/08/2026
=======================================================

CONTENU :
  Andromeda-CS2-Base.exe  Injecteur (console, manual map via BlackBone).
                          NE PAS RENOMMER : le nom de la DLL est derive du nom de l'exe.
  Andromeda-CS2-Base.dll  Le cheat (DLL injectee, absente de la liste des modules).
  BlackBone.dll           Moteur d'injection (compile depuis la source officielle).
  BeaEngine*.dll          Decompileur utilise par BlackBone (prebuilt x64).

UTILISATION :
  1. Lancer CS2 via Steam, attendre l'entree en partie / l'ecran de chargement.
  2. Lancer Andromeda-CS2-Base.exe EN ADMINISTRATEUR (UAC) : il attend le
     process cs2.exe puis injecte (manual map, pas de module visible).
  3. En jeu : INSERT = ouvrir/fermer le menu.
  4. Pour decharger : fermer le jeu (pas de unload).

FONCTIONS :
  - ESP : boites 2D, mode a travers les murs (wallhack : fill rouge translucide
    + label), distance en metros, nom d'arme, os, filtres (equipe / ennemis /
    visibles uniquement), types de boites.
  - AIMBOT : FOV (cercle reglable 25-500), os vise (tete/torse/bassin),
    lissage d'angles (1-20), distance max, friendly fire, trigger bot.
    Injection dans CreateMove + recalcul du move_crc (bypass subtick).
  - BHO : bunnyhop automatique (W + au sol).

AVERTISSEMENTS IMPORTANTS :
  - Les patterns et offsets sont compileds pour la version de CS2 du repo
    (base 1.2.5). Si le jeu est maj : crash ou inactivite possible ->
    il faut re-ouvrir les offsets (CS2\SDK\Update\Offsets.hpp) et les patterns
    (CFunctionList) pour la nouvelle version du jeu.
  - VAC : l'usage d'un cheat sur serveurs VAC peut entrainer un ban.
    Utilisez un compte secondaire.
  - L'injecteur a besoin du privilege SE_DEBUG -> toujours en administrateur.
