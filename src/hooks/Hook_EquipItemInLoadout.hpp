#pragma once

#include <CS2/SDK/Cstrike15/CCSInventoryManager.hpp>

using EquipItemInLoadout_t = void( __fastcall* )( CCSInventoryManager* , int , int , uint64_t );
inline EquipItemInLoadout_t EquipItemInLoadout_o = nullptr;

auto Hook_EquipItemInLoadout( CCSInventoryManager* pManager , int iTeam , int iSlot , uint64_t iItemID ) -> void;
