// google/protobuf/wire_format_lite.h — HunterZ stub
#pragma once
#include <cstdint>
namespace google { namespace protobuf { namespace internal {
class WireFormatLite {
public:
    enum WireType { WIRETYPE_VARINT = 0, WIRETYPE_FIXED64 = 1, WIRETYPE_LENGTH_DELIMITED = 2, WIRETYPE_FIXED32 = 5 };
    static uint32_t MakeTag(int field_number, WireType type) { return (field_number << 3) | type; }
};
}}} // namespace