#pragma once
// HunterZ stub — gameevents.pb.h
// Minimal stub providing CMsgSosStartSoundEvent for Hook_ParseMessage.cpp
#ifndef HZ_STUB3_GAMEEVENTS_PB_H
#define HZ_STUB3_GAMEEVENTS_PB_H

#include <cstdint>
#include <string>
#include <vector>

// Protobuf message IDs
enum EGameEventMessageIds : int
{
    GE_SosStartSoundEvent   = 1,
    GE_SosStopSoundEvent    = 2,
    GE_SosSetSoundEventParams = 3,
    GE_SosSetLibraryStackFields = 4,
    GE_SosStopSoundEventHash = 5,
};

// Minimal CMsgSosStartSoundEvent stub
class CMsgSosStartSoundEvent
{
public:
    bool has_source_entity_index() const { return m_has_source_entity_index; }
    int32_t source_entity_index() const { return m_source_entity_index; }

    bool has_packed_params() const { return !m_packed_params.empty(); }
    const std::string& packed_params() const { return m_packed_params; }

    uint32_t soundevent_hash() const { return m_soundevent_hash; }

    bool has_soundevent_guid() const { return false; }
    int64_t soundevent_guid() const { return 0; }

private:
    bool     m_has_source_entity_index = false;
    int32_t  m_source_entity_index = 0;
    std::string m_packed_params;
    uint32_t m_soundevent_hash = 0;
};

#endif // HZ_STUB3_GAMEEVENTS_PB_H
