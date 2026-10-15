#pragma once
// HunterZ stub — google/protobuf/message.h

#include <string>
#include <cstdint>

namespace google { namespace protobuf {

// Guard shared with CUserCmd.hpp
#ifndef HZ_REPEATED_PTR_FIELD_T_DEFINED
#define HZ_REPEATED_PTR_FIELD_T_DEFINED
template <typename T>
struct RepeatedPtrField_t
{
    void*  m_pArena       = nullptr;
    int    m_nCurrentSize = 0;
    int    m_nTotalSize   = 0;
    void*  m_pRep         = nullptr;
};
#endif

// Descriptor stub
class Descriptor {
public:
    const std::string& name() const { static std::string s; return s; }
};

// Message stubs
class MessageLite {};

class Message : public MessageLite {
public:
    virtual ~Message() {}
    virtual const Descriptor* GetDescriptor() const { return nullptr; }
};

} }