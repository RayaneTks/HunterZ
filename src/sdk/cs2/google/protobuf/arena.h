#pragma once
// HunterZ stub — protobuf arena.h
#include "port_def.inc"
namespace google { namespace protobuf {
  class Arena {
  public:
    Arena() {}
    ~Arena() {}
    template<typename T, typename... Args>
    static T* CreateMaybeMessage(Arena* arena, Args&&... args) {
      return new T(std::forward<Args>(args)...);
    }
    template<typename T>
    static T* Create(Arena* arena) { return new T(); }
    void Reset() {}
    uint64_t SpaceUsed() const { return 0; }
  };
} }
#include "port_undef.inc"
