#pragma once
// HunterZ stub — cs_usercmd.pb.h
// Provides CSGOUserCmdPB and CBaseUserCmdPB stubs for CUserCmd.hpp / CL_Bypass
#ifndef HZ_STUB3_CS_USERCMD_PB_H
#define HZ_STUB3_CS_USERCMD_PB_H

#include <cstdint>
#include <string>

// ── CSGOUserCmdPB stub ───────────────────────────────────────────────────────
// Used as embedded member in CUserCmd — must be concrete (non-empty) for layout
// Real size in CS2: ~0x80 bytes. We pad it to match.
class CSGOUserCmdPB
{
public:
    uint8_t _pad[0x80];

    // Accessors used by CL_Bypass (silent aim)
    float   move_forward_scale() const  { return 0.f; }
    float   move_left_scale()    const  { return 0.f; }
    void    set_move_forward_scale(float) {}
    void    set_move_left_scale(float)  {}
};

// ── CBaseUserCmdPB stub ──────────────────────────────────────────────────────
// Used by Hook_CreateMove / CL_Bypass when DISABLE_PROTOBUF==0
// With DISABLE_PROTOBUF==1 this code is never reached but must compile
class CBaseUserCmdPB : public CSGOUserCmdPB
{
public:
    int32_t  commandnumber()    const { return 0; }
    int32_t  tickcount()        const { return 0; }
    float    forwardmove()      const { return 0.f; }
    float    sidemove()         const { return 0.f; }
    float    upmove()           const { return 0.f; }
    uint64_t buttons()          const { return 0; }
    void set_commandnumber(int32_t)  {}
    void set_tickcount(int32_t)      {}
    void set_forwardmove(float)      {}
    void set_sidemove(float)         {}
    void set_upmove(float)           {}
    void set_buttons(uint64_t)       {}
};

#endif // HZ_STUB3_CS_USERCMD_PB_H
