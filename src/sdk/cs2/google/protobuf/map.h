#pragma once
// HunterZ stub — protobuf map.h
#include "port_def.inc"
#include <map>
namespace google { namespace protobuf {
  template<typename Key, typename T>
  using Map = std::map<Key, T>;
} }
#include "port_undef.inc"
