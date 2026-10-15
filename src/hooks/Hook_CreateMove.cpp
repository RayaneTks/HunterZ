#include "Hook_CreateMove.hpp"

#include <CS2/SDK/SDK.hpp>
#include <CS2/SDK/Interface/IEngineToClient.hpp>
#include <CS2/SDK/Update/CCSGOInput.hpp>

#include <AndromedaClient/CAndromedaClient.hpp>
#include <AndromedaClient/Settings/Settings.hpp>

#include <GameClient/CL_Players.hpp>
#include <GameClient/CL_Bypass.hpp>

auto Hook_CreateMove( CCSGOInput* pCCSGOInput , uint32_t split_screen_index , char a3 ) -> bool
{
	auto Result = CreateMove_o( pCCSGOInput , split_screen_index , a3 );

	// Short-circuit when no feature touches input — avoids running CL_Bypass /
	// CL_Players paths that may dereference stale schema offsets and crash.
	if ( !Settings::Aimbot::Active && !Settings::SilentAim::Active )
		return Result;

	auto* pLocalPlayerController = GetCL_Players()->GetLocalPlayerController();
	if ( !pLocalPlayerController ) return Result;

	const auto pUserCmd = pCCSGOInput->GetUserCmd( pLocalPlayerController );
	if ( !pUserCmd ) return Result;

	if ( SDK::Interfaces::EngineToClient()->IsInGame() && GetCL_Players()->GetLocalPlayerPawn() )
	{
		GetCL_Bypass()->PreClientCreateMove( pUserCmd );
		GetHzClient()->OnCreateMove( pCCSGOInput , pUserCmd );
		GetCL_Bypass()->PostClientCreateMove( pCCSGOInput , pUserCmd );
	}

	return Result;
}

auto Hook_MessageLite_SerializePartialToArray( google::protobuf::Message* pMsg , void* out_buffer , int size ) -> bool
{
#if DISABLE_PROTOBUF == 0
	const google::protobuf::Descriptor* descriptor = pMsg->GetDescriptor();
	const std::string message_name = descriptor->name();

	if ( message_name == XorStr( "CBaseUserCmdPB" ) )
	{
		GetCL_Bypass()->OnCBaseUserCmdPB( reinterpret_cast<CBaseUserCmdPB*>( pMsg ) );
	}
#endif

	return MessageLite_SerializePartialToArray_o( pMsg , out_buffer , size );
}
