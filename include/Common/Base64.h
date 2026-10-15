#pragma once
// HunterZ stub — Base64 encode/decode (used by CL_Bypass for anti-cheat bypass)
#include <string>
#include <vector>
namespace Base64 {
    inline std::string Encode(const std::vector<uint8_t>& data) { return ""; }
    inline std::vector<uint8_t> Decode(const std::string& s) { return {}; }
}
