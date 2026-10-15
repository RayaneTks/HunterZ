#pragma once

#include <Common/Common.hpp>
#include <Common/MemoryEngine.hpp>

#include <CS2/SDK/Types/CBaseTypes.hpp>
#include <CS2/SDK/Update/Offsets.hpp>

#include <CS2/Protobuf/cs_usercmd.pb.h>

// https://cs2.poggu.me/reverse-engineering/enums/in-buttons
enum : uint64_t
{
    IN_ATTACK = 1 << 0 ,
    IN_JUMP = 1 << 1 ,
    IN_DUCK = 1 << 2 ,
    IN_FORWARD = 1 << 3 ,
    IN_BACK = 1 << 4 ,
    IN_USE = 1 << 5 ,
    IN_TURNLEFT =  1 << 7 ,
    IN_TURNRIGHT = 1 << 8 ,
    IN_MOVELEFT = 1 << 9 ,
    IN_MOVERIGHT = 1 << 10 ,
    IN_ATTACK2 = 1 << 11 ,
    IN_RELOAD = 1 << 13 ,
    IN_SPEED = 1 << 16 ,
    IN_JOYAUTOSPRINT = 1 << 17 ,
};

class CInButtonState // maybe CInButtonStatePB didn't check
{
	void* vtable;
public:
	uint64_t buttonstate1;
	uint64_t buttonstate2;
	uint64_t buttonstate3;
};

class CUserCmdArray
{
public:
    CUSTOM_OFFSET_FIELD( uint32 , m_nSequenceNumber , g_CUserCmdArray_m_nSequenceNumber );
};

/*
class CUserCmd: CCSGOUserCmd
check first func for sizeof CUserCmd
*/
#pragma pack(push, 1)
class CUserCmd
{
private:
    PAD( 0x10 );
public:
	CSGOUserCmdPB cmd;
	CInButtonState button_states;
private:
    PAD( 0x20 );
};
#pragma pack(pop)

#ifndef HZ_REPEATED_PTR_FIELD_T_DEFINED
#define HZ_REPEATED_PTR_FIELD_T_DEFINED
namespace google { namespace protobuf {
    template <typename T>
    struct RepeatedPtrField_t
    {
        void*  m_pArena       = nullptr;
        int    m_nCurrentSize = 0;
        int    m_nTotalSize   = 0;
        void*  m_pRep         = nullptr;
    };
} }
#endif // HZ_REPEATED_PTR_FIELD_T_DEFINED

