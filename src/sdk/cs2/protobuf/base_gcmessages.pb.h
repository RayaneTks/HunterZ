#pragma once
#ifndef HZ_BASE_GCMESSAGES_PB_H
#define HZ_BASE_GCMESSAGES_PB_H

#include <string>
#include <vector>
#include <cstdint>

// Minimal stubs for CSOEcon* classes used in inventory changer.
// SetMusic() is disabled for MVP; these stubs satisfy forward references only.

class CSOEconItemAttribute
{
public:
    bool        has_def_index()   const { return false; }
    bool        has_value_bytes() const { return false; }
    uint32_t    def_index()       const { return 0u; }
    const std::string& value_bytes() const { static std::string s; return s; }
};

class CSOEconItem
{
public:
    int attribute_size() const { return 0; }
    const CSOEconItemAttribute& attribute( int ) const { static CSOEconItemAttribute a; return a; }
};

class CSOEconItemEquipped {};
class CSOEconGameAccountClient {};
class CSOEconClaimCode {};

#endif // HZ_BASE_GCMESSAGES_PB_H
