#pragma once
// HunterZ stub — protobuf metadata_lite.h
#include "port_def.inc"
namespace google { namespace protobuf { namespace internal {
  class InternalMetadata {
  public:
    InternalMetadata() {}
    template<typename T> T& mutable_unknown_fields() { static T t; return t; }
    bool have_unknown_fields() const { return false; }
    void* raw_arena_ptr() const { return nullptr; }
  };
} } }
#include "port_undef.inc"
