#pragma once
// HunterZ stub — protobuf inlined_string_field.h
#include "port_def.inc"
namespace google { namespace protobuf { namespace internal {
  class InlinedStringField {
  public:
    const std::string& Get() const { static std::string s; return s; }
  };
} } }
#include "port_undef.inc"
