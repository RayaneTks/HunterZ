#pragma once
// HunterZ stub — protobuf repeated_ptr_field.h
#include "port_def.inc"
#include <vector>
namespace google { namespace protobuf {
  template<typename Element>
  class RepeatedPtrField {
  public:
    int size() const { return 0; }
    const Element& Get(int i) const { static Element e; return e; }
    Element* Add() { return nullptr; }
    void Clear() {}
    Element* Mutable(int i) { return nullptr; }
  };
} }
#include "port_undef.inc"
