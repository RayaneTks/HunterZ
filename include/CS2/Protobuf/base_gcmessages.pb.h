#pragma once
// HunterZ stub — base_gcmessages.pb.h
// Minimal stub providing GC message base classes
#ifndef HZ_STUB3_BASE_GCMESSAGES_PB_H
#define HZ_STUB3_BASE_GCMESSAGES_PB_H

#include <cstdint>
#include <string>

// Base GC message IDs  
enum EGCBaseMsg : int
{
    k_EMsgGCBase = 4000,
};

// Minimal CMsgSOCacheSubscribed stub
class CMsgSOCacheSubscribed
{
public:
    uint64_t owner_soid_id() const { return 0; }
    int32_t owner_soid_type() const { return 0; }
    bool has_owner_soid() const { return false; }
};

// Minimal CMsgSOCacheUnsubscribed stub
class CMsgSOCacheUnsubscribed
{
public:
    uint64_t owner_soid_id() const { return 0; }
    int32_t owner_soid_type() const { return 0; }
};

#endif // HZ_STUB3_BASE_GCMESSAGES_PB_H
