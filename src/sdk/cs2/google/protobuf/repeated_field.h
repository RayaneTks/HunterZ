#pragma once
// HunterZ stub — protobuf repeated_field.h
#include "port_def.inc"
#include <vector>
namespace google { namespace protobuf {
  template<typename Element>
  class RepeatedField {
  public:
    int size() const { return 0; }
    Element Get(int i) const { return Element{}; }
    void Add(Element val) {}
    void Clear() {}
  };
} }
#include "port_undef.inc"
