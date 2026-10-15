// google/protobuf/io/coded_stream.h — HunterZ stub
#pragma once
#include <cstdint>
namespace google { namespace protobuf { namespace io {
class CodedInputStream {
public:
    explicit CodedInputStream(const uint8_t* buf, int size) {}
    bool ReadVarint32(uint32_t* value) { return false; }
    bool Skip(int count) { return false; }
    int CurrentPosition() const { return 0; }
};
class CodedOutputStream {
public:
    static uint8_t* WriteVarint32ToArray(uint32_t value, uint8_t* target) { return target; }
    static uint8_t* WriteTagToArray(uint32_t tag, uint8_t* target) { return target; }
    static int VarintSize32(uint32_t value) { return 4; }
};
}}} // namespace google::protobuf::io