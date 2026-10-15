// patscan.cpp - Verifie sur disque si des patterns (syntaxe IDA avec ? wildcard)
// sont presents dans le code (.text) de DLLs CS2. Logique identique a MemoryEngine::FindPattern.
#include <windows.h>
#include <vector>
#include <string>
#include <cstdio>
#include <cstdint>

static std::vector<uint8_t> g_bytes;
static size_t g_size = 0;

// --- Parser de pattern (meme logique que GetIDAPatternSize) ---
struct ParsedPattern {
    std::vector<int> b; // -1 = wildcard
};

static bool IsHexChar(char c){ return (c>='0'&&c<='9')||(c>='A'&&c<='F')||(c>='a'&&c<='f'); }
static int HexVal(char c){ c = (char)toupper(c); return (c>='A') ? (c-'A'+10) : (c-'0'); }

static bool ParsePattern(const char* p, ParsedPattern& out){
    out.b.clear();
    while (*p){
        if (*p == ' '){ p++; continue; }
        if (*p == '?'){
            out.b.push_back(-1);
            p++;
            if (*p==' ') p++;
            continue;
        }
        if (IsHexChar(*p) && p[1] && IsHexChar(p[1])){
            out.b.push_back((HexVal(*p)<<4) | HexVal(p[1]));
            p += 2;
            if (*p==' ') p++;
            continue;
        }
        return false; // char invalide
    }
    return !out.b.empty();
}

// --- PE : RVA -> offset fichier ---
static bool RvaToOffset(IMAGE_NT_HEADERS64* nt, DWORD rva, DWORD& outOff){
    auto sections = IMAGE_FIRST_SECTION(nt);
    for (WORD i=0;i<nt->FileHeader.NumberOfSections;i++){
        auto& s = sections[i];
        if (rva >= s.VirtualAddress && rva < s.VirtualAddress + s.Misc.VirtualSize){
            outOff = (DWORD)( (rva - s.VirtualAddress) + s.PointerToRawData );
            return true;
        }
    }
    return false;
}

// Charge la DLL, parse le PE, cherche le pattern dans le .text
static bool SearchInDll(const std::string& path, const char* pattern, uint64_t* outRva){
    // lire le fichier
    std::vector<uint8_t> buf;
    {
        FILE* f = fopen(path.c_str(),"rb");
        if (!f){ printf("  [open-fail] %s\n", path.c_str()); return false; }
        fseek(f,0,SEEK_END); long len = ftell(f); fseek(f,0,SEEK_SET);
        buf.resize((size_t)len);
        size_t rd = fread(buf.data(),1,(size_t)len,f);
        fclose(f);
        if (rd != (size_t)len){ printf("  [read-fail] %s\n", path.c_str()); return false; }
    }
    if (buf.size() < 0x40) return false;
    auto* dos = (IMAGE_DOS_HEADER*)buf.data();
    if (dos->e_magic != 'ZM') { printf("  [not-PE] %s\n", path.c_str()); return false; }
    if ((size_t)dos->e_lfanew + sizeof(IMAGE_NT_HEADERS64) > buf.size()) return false;
    auto* nt = (IMAGE_NT_HEADERS64*)(buf.data() + dos->e_lfanew);
    if (nt->Signature != 0x00004550) { printf("  [not-PE2] %s\n", path.c_str()); return false; }

    DWORD baseOfCode = nt->OptionalHeader.BaseOfCode;
    DWORD sizeOfCode = nt->OptionalHeader.SizeOfCode;

    DWORD startOff=0;
    if (!RvaToOffset(nt, baseOfCode, startOff)) { printf("  [no-text] %s\n", path.c_str()); return false; }

    // bornes : ne pas aller au-dela du fichier ni de la raw data de la section
    size_t endOff = (size_t)startOff + sizeOfCode;
    if (endOff > buf.size()) endOff = buf.size();

    ParsedPattern pp;
    if (!ParsePattern(pattern, pp)) { printf("  [bad-pattern] %s\n", pattern); return false; }
    size_t psize = pp.b.size();

    for (size_t off = startOff; off + psize <= endOff; off++){
        bool ok = true;
        for (size_t k=0;k<psize;k++){
            int want = pp.b[k];
            if (want >= 0 && (int)buf[off+k] != want){ ok=false; break; }
        }
        if (ok){
            // convertir offset fichier -> RVA (pour info)
            auto sections = IMAGE_FIRST_SECTION(nt);
            for (WORD i=0;i<nt->FileHeader.NumberOfSections;i++){
                auto& s = sections[i];
                if (off >= s.PointerToRawData && off < (size_t)s.PointerToRawData + s.SizeOfRawData){
                    if (outRva) *outRva = (uint64_t)(off - s.PointerToRawData + s.VirtualAddress);
                    break;
                }
            }
            printf("  [FOUND] RVA 0x%llX (file off 0x%llX)\n", (unsigned long long)(outRva?*outRva:0), (unsigned long long)off);
            return true;
        }
    }
    return false;
}

struct HookDef { const char* name; const char* dll; const char* pattern; };

int main(int argc, char** argv){
    // chemins des DLLs sur disque
    const char* g_game = "E:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game";
    struct DllPath { const char* key; std::string path; };
    std::vector<DllPath> dlls = {
        { "client.dll",               std::string(g_game)+"\\csgo\\bin\\win64\\client.dll" },
        { "gameoverlayrenderer64.dll",std::string("E:\\Steam\\GameOverlayRenderer64.dll") },
        { "engine2.dll",              std::string(g_game)+"\\bin\\win64\\engine2.dll" },
        { "inputsystem.dll",          std::string(g_game)+"\\bin\\win64\\inputsystem.dll" },
    };

    std::vector<HookDef> hooks = {
        { "Present", "gameoverlayrenderer64.dll", "48 89 5C 24 08 48 89 6C 24 10 56 57 41 54 41 56 41 57 48 83 EC 20 41 8B F0 8B EA 4C 8B F9 41 F6 C0 01 74 0E" },
        { "ResizeBuffers", "gameoverlayrenderer64.dll", "40 53 55 56 57 41 54 41 56 41 57 48 83 EC ? 44 8B E2" },
        { "CreateSwapChain", "gameoverlayrenderer64.dll", "40 53 55 56 57 48 83 EC ? 48 8B F9 49 8B F1 48 8D 0D ? ? ? ? 49 8B D8 48 8B EA E8 ? ? ? ? 48 8D 0D ? ? ? ? E8 ? ? ? ? 48 8D 0D ? ? ? ? E8 ? ? ? ? 48 8D 0D ? ? ? ? E8 ? ? ? ? 48 8B 05 ? ? ? ? 4C 8B CE 4C 8B C3 48 8B D5 48 8B CF FF D0 8B D8 85 C0 78 ? 48 85 F6 74 ? 48 83 3E ? 74 ? 48 8B D5 48 8B CE E8 ? ? ? ? 8B C3 48 83 C4 ? 5F 5E 5D 5B C3 CC CC CC CC CC CC CC CC CC CC CC CC CC CC CC 48 83 EC" },
        { "MouseInputEnabled", "client.dll", "40 53 48 83 EC 20 80 B9 ? ? ? ? ? 48 8B D9 75 78" },
        { "OnAddEntity", "client.dll", "48 89 74 24 10 57 48 83 EC 20 41 B9 FF 7F 00 00 41 8B C0 41 23 C1 48 8B F2 41 83 F8 FF 48 8B F9 44 0F 45 C8 41 81 F9 00 40 00 00 73 0D" },
        { "OnRemoveEntity", "client.dll", "48 89 74 24 10 57 48 83 EC 20 41 B9 FF 7F 00 00 41 8B C0 41 23 C1 48 8B F2 41 83 F8 FF 48 8B F9 44 0F 45 C8 41 81 F9 00 40 00 00 73 08" },
        { "GetMatricesForView", "client.dll", "48 8B C4 48 89 68 ? 48 89 70 ? 57 48 81 EC ? ? ? ? 0F 29 70 ? 49 8B F1" },
        { "CreateMove", "client.dll", "85 D2 0F 85 ? ? ? ? 48 8B C4 44 88 40 18" },
        { "SerializePartialToArray", "client.dll", "48 89 5C 24 ? 55 56 57 48 81 EC ? ? ? ? 48 8B 05 ? ? ? ? 48 33 C4 48 89 84 24 ? ? ? ? 49 63 F0" },
        { "OnClientOutput", "engine2.dll", "4C 8B DC 49 89 5B ? 49 89 6B ? 49 89 73 ? 57 41 56 41 57 48 83 EC ? 49 C7" },
        { "CDemoRecorder", "engine2.dll", "40 56 57 41 57 48 83 EC ? 4C 8B F9" },
        { "IsRelativeMouseMode", "inputsystem.dll", "48 89 6C 24 ? 48 89 74 24 ? 48 89 7C 24 ? 41 56 48 83 EC ? 0F B6 F2" },
        { "AntiTamper", "client.dll", "40 53 41 57 48 83 EC ? 48 89 74 24 ? 48 8B F1" },
        { "DrawGlow", "client.dll", "40 53 48 83 EC 20 48 8B 54" },
    };

    int found = 0, missing = 0;
    printf("=== PATTERN SCAN (disque, .text) ===\n");
    for (auto& h : hooks){
        std::string path;
        for (auto& d : dlls) if (d.key == h.dll){ path = d.path; break; }
        if (path.empty()){ printf("[?] %s : DLL inconnue %s\n", h.name, h.dll); missing++; continue; }
        uint64_t rva=0;
        bool ok = SearchInDll(path, h.pattern, &rva);
        printf("[%s] %-22s (%s)\n", ok?"OK  ":"FAIL", h.name, h.dll);
        if (ok) found++; else missing++;
    }
    printf("\n=== RESUME : %d OK / %d FAIL (sur %d) ===\n", found, missing, (int)hooks.size());
    return missing ? 1 : 0;
}
