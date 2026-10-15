#pragma once
// HunterZ stub — protobuf arenastring.h
#include "port_def.inc"
#include <string>
namespace google { namespace protobuf { namespace internal {
  class ArenaStringPtr {
  public:
    std::string* MutableNoArena(const std::string*) { return nullptr; }
    const std::string& Get() const { static std::string s; return s; }
    void Set(const std::string*, std::string value, void*) {}
    void Destroy() {}
  };
} } }
#include "port_undef.inc"
