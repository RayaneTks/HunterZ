#pragma once

// Système de keybinds (header-only, sans nouveau .cpp / sans toucher au .vcxproj).
//
//   - Stockage            : Settings::Keybinds::<Fonction> (code VK ; 0 = désactivé)
//   - Bascule en jeu      : CKeybinds::KeybindToggle( <Vk> , &Settings::<Fonction>::Active )
//                           (à appeler dans le hook par-tick ; détection d'ascenseur, 1 toggle par pression)
//   - Saisie dans le menu : CKeybinds::TryCaptureKey( &Vk )  (uniquement dans OnRenderMenu)
//   - Persistance         : CKeybinds::Load() (à l'init) / CKeybinds::Save() (à chaque modification)
//
// Utilise GetAsyncKeyState (état global, indépendant du focus) plutôt que GetKeyState,
// afin que la bascule fonctionne même quand la fenêtre de jeu n'est pas au premier plan.

#include <cstdint>
#include <cstdio>
#include <string>
#include <fstream>
#include <iterator>

#include <Common/Common.hpp>                 // Windows.h , uint*
#include <DllLauncher.hpp>                  // GetDllDir()
#include <AndromedaClient/Settings/Settings.hpp>

#include <rapidjson/rapidjson.h>
#include <rapidjson/document.h>
#include <rapidjson/prettywriter.h>
#include <rapidjson/stringbuffer.h>

namespace CKeybinds
{
	static constexpr int MAX_VK = 256;

	// Une pression (ascenseur) sur la touche bascule le flag cible.
	inline auto KeybindToggle( int Vk , bool* pTarget ) -> void
	{
		static bool bPrev[ MAX_VK ] = {};

		if ( !pTarget || Vk <= 0 || Vk >= MAX_VK )
			return;

		const bool bDown = ( GetAsyncKeyState( Vk ) & 0x8000 ) != 0;

		if ( bDown && !bPrev[Vk] )
			*pTarget = !*pTarget;

		bPrev[Vk] = bDown;
	}

	// État « hold » : renvoie true si la touche est actuellement maintenue (0/désactivé -> false).
	// Contrairement à KeybindToggle : pas de détection d'ascenseur — c'est l'état instantané.
	// Sert à activer une fonction (ex : Silent Aim) UNIQUEMENT pendant que la touche est appuyée.
	inline auto KeybindHold( int Vk ) -> bool
	{
		if ( Vk <= 0 || Vk >= MAX_VK )
			return false;

		return ( GetAsyncKeyState( Vk ) & 0x8000 ) != 0;
	}

	// Jeu de touches autorisées pour une saisie (évite de binder sur Echap / Modif. / Ctrl).
	inline auto IsBindableKey( int Vk ) -> bool
	{
		if ( Vk >= 'A' && Vk <= 'Z' )
			return true;
		if ( Vk >= '0' && Vk <= '9' )
			return true;
		if ( Vk >= VK_F1 && Vk <= VK_F12 )
			return true;
		return false;
	}

	// Retourne 1 si une touche a été capturée (outVk), -1 si annulée (Echap), 0 sinon.
	inline auto TryCaptureKey( int& outVk ) -> int
	{
		static bool bPrev[ MAX_VK ] = {};

		for ( int vk = 0 ; vk < MAX_VK ; vk++ )
		{
			const bool bDown = ( GetAsyncKeyState( vk ) & 0x8000 ) != 0;
			const bool bEdge = bDown && !bPrev[vk];
			bPrev[vk] = bDown;

			if ( !bEdge )
				continue;

			if ( vk == VK_ESCAPE )
				return -1;

			if ( !IsBindableKey( vk ) )
				continue;

			outVk = vk;
			return 1;
		}

		return 0;
	}

	// Nom affiché d'un code VK (0 ou non mappé -> "None").
	inline auto VkToName( int Vk ) -> const char*
	{
		static const char* Names[ MAX_VK ] = {};
		static bool bBuilt = false;

		if ( !bBuilt )
		{
			static char Single[ 128 ][ 2 ] = {};
			for ( int i = 0 ; i < 128 ; i++ )
			{
				Single[i][0] = static_cast<char>( i );
				Single[i][1] = 0;
			}
			for ( int c = 'A' ; c <= 'Z' ; c++ )
				Names[c] = Single[c];
			for ( int c = '0' ; c <= '9' ; c++ )
				Names[c] = Single[c];

			static const char* Fn[ 12 ] =
			{
				"F1" , "F2" , "F3" , "F4" , "F5" , "F6" ,
				"F7" , "F8" , "F9" , "F10" , "F11" , "F12"
			};
			for ( int i = 0 ; i < 12 ; i++ )
				Names[ VK_F1 + i ] = Fn[i];

			bBuilt = true;
		}

		if ( Vk >= 0 && Vk < MAX_VK && Names[Vk] )
			return Names[Vk];

		return nullptr; // 0 ou non mappé
	}

	// ---- Persistance (fichier keybinds.json dans le répertoire du DLL) ----

	inline auto ConfigPath() -> std::string
	{
		return GetDllDir() + "keybinds.json";
	}

	inline auto Save() -> void
	{
		rapidjson::StringBuffer Buffer;
		rapidjson::PrettyWriter< rapidjson::StringBuffer > Writer( Buffer );
		Writer.SetIndent( '\t' , 1 );

		Writer.StartObject();
		{
			Writer.Key( "Keybinds" );
			Writer.StartObject();
			{
				Writer.Key( "Aimbot" );
				Writer.Int( Settings::Keybinds::Aimbot );

				Writer.Key( "AimbotHold" );
				Writer.Int( Settings::Keybinds::AimbotHold );

				Writer.Key( "SilentAim" );
				Writer.Int( Settings::Keybinds::SilentAim );
			}
			Writer.EndObject();
		}
		Writer.EndObject();

		std::ofstream File( ConfigPath() , std::ios::trunc );
		if ( !File )
			return;

		File << Buffer.GetString();
		File.flush();
	}

	inline auto Load() -> void
	{
		std::ifstream File( ConfigPath() );
		if ( !File )
			return; // pas de fichier -> garde les valeurs par défaut

		std::string Content( ( std::istreambuf_iterator< char >( File ) ) , std::istreambuf_iterator< char >() );
		File.close();

		rapidjson::Document Doc;
		Doc.Parse( Content.c_str() );

		if ( Doc.HasParseError() || !Doc.IsObject() )
			return;

		if ( !Doc.HasMember( "Keybinds" ) || !Doc[ "Keybinds" ].IsObject() )
			return;

		auto& Kb = Doc[ "Keybinds" ];

		if ( Kb.HasMember( "Aimbot" ) && Kb[ "Aimbot" ].IsInt() )
		{
			const int V = Kb[ "Aimbot" ].GetInt();
			Settings::Keybinds::Aimbot = ( V >= 0 && V < MAX_VK ) ? V : 0;
		}

		if ( Kb.HasMember( "AimbotHold" ) && Kb[ "AimbotHold" ].IsInt() )
		{
			const int V = Kb[ "AimbotHold" ].GetInt();
			Settings::Keybinds::AimbotHold = ( V >= 0 && V < MAX_VK ) ? V : 0;
		}

		if ( Kb.HasMember( "SilentAim" ) && Kb[ "SilentAim" ].IsInt() )
		{
			const int V = Kb[ "SilentAim" ].GetInt();
			Settings::Keybinds::SilentAim = ( V >= 0 && V < MAX_VK ) ? V : 0;
		}
	}
}
