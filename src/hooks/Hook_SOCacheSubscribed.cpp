#include "Hook_SOCacheSubscribed.hpp"

#include <CS2/SDK/Cstrike15/CCSPlayerInventory.hpp>
#include <AndromedaClient/Features/CInventoryChanger/CInventoryItemsManager.hpp>

auto Hook_SOCacheSubscribed( CCSPlayerInventory* pCSPlayerInventory , GCSDK::SOID_t owner , int64_t unk ) -> void*
{
	auto pResult = SOCacheSubscribed_o( pCSPlayerInventory , owner , unk );

	if ( pCSPlayerInventory->GetOwner().m_type == owner.m_type && pCSPlayerInventory->GetOwner().m_id == owner.m_id )
	{
		GetInventoryItemsManager()->OnAddAllItems();
	}

	return pResult;
}
