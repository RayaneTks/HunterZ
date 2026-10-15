#pragma once

#include <unordered_map>

#include <Common/Common.hpp>

class C_CSWeaponBase;
class CCSPlayerInventory;
class C_CS2HudModelWeapon;
class C_CSPlayerPawn;
class IGameEvent;
class CCompositeMaterialOwner;

enum LoadOutSlot_t
{
    LOADOUT_SLOT_C4 = 1 ,
    LOADOUT_SLOT_CLOTHING_APPEARANCE = 46 ,
    LOADOUT_SLOT_CLOTHING_CUSTOMPLAYER = 38 ,
    LOADOUT_SLOT_CLOTHING_EYEWEAR = 42 ,
    LOADOUT_SLOT_CLOTHING_FACEMASK = 40 ,
    LOADOUT_SLOT_CLOTHING_HANDS = 41 ,
    LOADOUT_SLOT_CLOTHING_HAT = 43 ,
    LOADOUT_SLOT_CLOTHING_LOWERBODY = 44 ,
    LOADOUT_SLOT_CLOTHING_TORSO = 45 ,
    LOADOUT_SLOT_COUNT = 57 ,
    LOADOUT_SLOT_EQUIPMENT0 = 32 ,
    LOADOUT_SLOT_EQUIPMENT1 = 33 ,
    LOADOUT_SLOT_EQUIPMENT2 = 34 ,
    LOADOUT_SLOT_EQUIPMENT3 = 35 ,
    LOADOUT_SLOT_EQUIPMENT4 = 36 ,
    LOADOUT_SLOT_EQUIPMENT5 = 37 ,
    LOADOUT_SLOT_FIRST_ALL_CHARACTER = 54 ,
    LOADOUT_SLOT_FIRST_AUTO_BUY_WEAPON = 0 ,
    LOADOUT_SLOT_FIRST_COSMETIC = 41 ,
    LOADOUT_SLOT_FIRST_PRIMARY_WEAPON = 8 ,
    LOADOUT_SLOT_FIRST_WHEEL_EQUIPMENT = 32 ,
    LOADOUT_SLOT_FIRST_WHEEL_GRENADE = 26 ,
    LOADOUT_SLOT_FIRST_WHEEL_WEAPON = 2 ,
    LOADOUT_SLOT_FLAIR0 = 55 ,
    LOADOUT_SLOT_GRENADE0 = 26 ,
    LOADOUT_SLOT_GRENADE1 = 27 ,
    LOADOUT_SLOT_GRENADE2 = 28 ,
    LOADOUT_SLOT_GRENADE3 = 29 ,
    LOADOUT_SLOT_GRENADE4 = 30 ,
    LOADOUT_SLOT_GRENADE5 = 31 ,
    LOADOUT_SLOT_HEAVY0 = 20 ,
    LOADOUT_SLOT_HEAVY1 = 21 ,
    LOADOUT_SLOT_HEAVY2 = 22 ,
    LOADOUT_SLOT_HEAVY3 = 23 ,
    LOADOUT_SLOT_HEAVY4 = 24 ,
    LOADOUT_SLOT_HEAVY5 = 25 ,
    LOADOUT_SLOT_INVALID = 4294967295 ,
    LOADOUT_SLOT_LAST_ALL_CHARACTER = 56 ,
    LOADOUT_SLOT_LAST_AUTO_BUY_WEAPON = 1 ,
    LOADOUT_SLOT_LAST_COSMETIC = 41 ,
    LOADOUT_SLOT_LAST_PRIMARY_WEAPON = 25 ,
    LOADOUT_SLOT_LAST_WHEEL_EQUIPMENT = 37 ,
    LOADOUT_SLOT_LAST_WHEEL_GRENADE = 31 ,
    LOADOUT_SLOT_LAST_WHEEL_WEAPON = 25 ,
    LOADOUT_SLOT_MELEE = 0 ,
    LOADOUT_SLOT_MISC0 = 47 ,
    LOADOUT_SLOT_MISC1 = 48 ,
    LOADOUT_SLOT_MISC2 = 49 ,
    LOADOUT_SLOT_MISC3 = 50 ,
    LOADOUT_SLOT_MISC4 = 51 ,
    LOADOUT_SLOT_MISC5 = 52 ,
    LOADOUT_SLOT_MISC6 = 53 ,
    LOADOUT_SLOT_MUSICKIT = 54 ,
    LOADOUT_SLOT_PET = 39 ,
    LOADOUT_SLOT_PROMOTED = 4294967295 ,
    LOADOUT_SLOT_RIFLE0 = 14 ,
    LOADOUT_SLOT_RIFLE1 = 15 ,
    LOADOUT_SLOT_RIFLE2 = 16 ,
    LOADOUT_SLOT_RIFLE3 = 17 ,
    LOADOUT_SLOT_RIFLE4 = 18 ,
    LOADOUT_SLOT_RIFLE5 = 19 ,
    LOADOUT_SLOT_SECONDARY0 = 2 ,
    LOADOUT_SLOT_SECONDARY1 = 3 ,
    LOADOUT_SLOT_SECONDARY2 = 4 ,
    LOADOUT_SLOT_SECONDARY3 = 5 ,
    LOADOUT_SLOT_SECONDARY4 = 6 ,
    LOADOUT_SLOT_SECONDARY5 = 7 ,
    LOADOUT_SLOT_SMG0 = 8 ,
    LOADOUT_SLOT_SMG1 = 9 ,
    LOADOUT_SLOT_SMG2 = 10 ,
    LOADOUT_SLOT_SMG3 = 11 ,
    LOADOUT_SLOT_SMG4 = 12 ,
    LOADOUT_SLOT_SMG5 = 13 ,
    LOADOUT_SLOT_SPRAY0 = 56
};

class IInventoryChanger
{
public:
	virtual void OnFrameStageNotify( int FrameStage ) = 0;
    virtual void OnEquipItemInLoadout( int iTeam , int iSlot , uint64_t iItemID ) = 0;
    virtual void OnFireEventClientSide( IGameEvent* pGameEvent ) = 0;
};

class CInventoryChanger final : public IInventoryChanger
{
public:
    virtual void OnFrameStageNotify( int FrameStage ) override;
    virtual void OnEquipItemInLoadout( int iTeam , int iSlot , uint64_t iItemID ) override;
    virtual void OnFireEventClientSide( IGameEvent* pGameEvent ) override;

public:
    auto SetGlove( CCSPlayerInventory* pInventory , C_CSPlayerPawn* pLocalPawn , C_CS2HudModelWeapon* pViewModel ) -> void;
    auto SetAgent( CCSPlayerInventory* pInventory , C_CSPlayerPawn* pLocalPawn ) -> void;
    auto SetMusic( CCSPlayerInventory* pInventory ) -> void;

public:
    struct EquipItem_t
    {
        EquipItem_t() = default;
        EquipItem_t(int team, int slot, uint64_t itemID, bool equipped) 
            : m_iTeam(team), m_iSlot(slot), m_iItemID(itemID), m_bEquipped(equipped) {}

        int m_iTeam = -1;
        int m_iSlot = -1;
        uint64_t m_iItemID = 0;
        bool m_bEquipped = false;
    };

    using VecEquipItems_t = std::vector<EquipItem_t>;

public:
    auto EquipConfigItem( int iTeam , int iSlot , uint64_t iItemID , bool Equipped = false ) -> void;

public:
    inline auto GetEquipConfigItems() -> VecEquipItems_t&
    {
        return m_vecEquipItems;
    }

public:
    bool m_bApplyGloves = false;
    
    // Made public for CInventoryItemsManager access
    std::unordered_map<CCompositeMaterialOwner* , bool> m_ApplySkin;
    
    // Refresh all skins (for periodic revalidation)
    auto RefreshAllSkins() -> void { m_ApplySkin.clear(); }

private:
    VecEquipItems_t m_vecEquipItems;
    float m_flLastSpawnTime = -1.f;
    int m_nUpdateSkinFrame = 0;
};

auto GetInventoryChanger() -> CInventoryChanger*;
