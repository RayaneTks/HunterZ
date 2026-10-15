#pragma once
// HunterZ stub — protobuf stubs/common.h
#include "../port_def.inc"
#include <stdint.h>
#include <string>
namespace google { namespace protobuf {
  typedef int int32;
  typedef long long int64;
  typedef unsigned int uint32;
  typedef unsigned long long uint64;
  typedef signed char int8;
  typedef short int16;
  typedef unsigned char uint8;
  typedef unsigned short uint16;
  namespace internal {
    void LogMessage(int level, const char* filename, int line, const std::string& message) {}
  }
} }
#include "../port_undef.inc"
