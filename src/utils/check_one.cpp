// Trusted cross-check of specific FunctionList byte-patterns against on-disk client.dll.
// Reuses the exact SearchInDll/ParsePattern logic proven by patscan.cpp (14/14).
#include <windows.h>
#include <vector>
#include <string>
#include <cstdio>
#include <cstdint>
#include <cstring>

struct ParsedPattern { std::vector<int> b; };
static bool IsHexChar(char c){ return (c>='0'&&c<='9')||(c>='A'&&c<='F')||(c>='a'&&c<='f'); }
static int HexVal(char c){ c=(char)toupper(c); return (c>='A')?(c-'A'+10):(c-'0'); }
static bool ParsePattern(const char* p, ParsedPattern& out){
    out.b.clear();
    while (*p){
        if (*p==' '){ p++; continue; }
        if (*p=='?'){ out.b.push_back(-1); p++; if (*p==' ') p++; continue; }
        if (IsHexChar(*p)&&p[1]&&IsHexChar(p[1])){ out.b.push_back((HexVal(*p)<<4)|HexVal(p[1])); p+=2; if (*p==' ') p++; continue; }
        return false;
    }
    return !out.b.empty();
}
static bool RvaToOffset(IMAGE_NT_HEADERS64* nt, DWORD rva, DWORD& outOff){
    auto sections = IMAGE_FIRST_SECTION(nt);
    for (WORD i=0;i<nt->FileHeader.NumberOfSections;i++){
        auto& s = sections[i];
        if (rva>=s.VirtualAddress && rva<s.VirtualAddress+s.Misc.VirtualSize){
            outOff=(DWORD)((rva-s.VirtualAddress)+s.PointerToRawData); return true; }
    }
    return false;
}
static bool SearchInDll(const std::string& path, const char* pattern, uint64_t* outRva){
    std::vector<uint8_t> buf;
    { FILE* f=fopen(path.c_str(),"rb"); if(!f){ printf("  [open-fail]\n"); return false; }
      fseek(f,0,SEEK_END); long len=ftell(f); fseek(f,0,SEEK_SET);
      buf.resize((size_t)len); size_t rd=fread(buf.data(),1,(size_t)len,f); fclose(f);
      if (rd!=(size_t)len){ printf("  [read-fail]\n"); return false; } }
    if (buf.size()<0x40) return false;
    auto* dos=(IMAGE_DOS_HEADER*)buf.data();
    if (dos->e_magic!='ZM') return false;
    auto* nt=(IMAGE_NT_HEADERS64*)(buf.data()+dos->e_lfanew);
    if (nt->Signature!=0x00004550) return false;
    DWORD baseOfCode=nt->OptionalHeader.BaseOfCode;
    DWORD sizeOfCode=nt->OptionalHeader.SizeOfCode;
    DWORD startOff=0;
    if(!RvaToOffset(nt,baseOfCode,startOff)){ printf("  [no-text]\n"); return false; }
    size_t endOff=(size_t)startOff+sizeOfCode; if (endOff>buf.size()) endOff=buf.size();
    ParsedPattern pp; if(!ParsePattern(pattern,pp)){ printf("  [bad-pattern]\n"); return false; }
    size_t psize=pp.b.size();
    auto file2rva=[&](size_t off)->uint64_t{
        auto sections=IMAGE_FIRST_SECTION(nt);
        for (WORD i=0;i<nt->FileHeader.NumberOfSections;i++){
            auto& s=sections[i];
            if (off>=s.PointerToRawData && off<(size_t)s.PointerToRawData+s.SizeOfRawData)
                return (uint64_t)(off-s.PointerToRawData+s.VirtualAddress); }
        return 0; };
    // base-exact search: first match within [BaseOfCode, BaseOfCode+SizeOfCode]
    for (size_t off=startOff; off+psize<=endOff; off++){
        bool ok=true;
        for (size_t k=0;k<psize;k++){ int want=pp.b[k]; if(want>=0&&(int)buf[off+k]!=want){ ok=false; break; } }
        if (ok){ if (outRva) *outRva=file2rva(off); return true; }
    }
    return false;
}
// Full .text brute-force match COUNT (no anchor, no range limit) — for uniqueness proof.
static size_t CountAllInText(const std::string& path, const char* pattern, std::vector<uint64_t>& hits){
    std::vector<uint8_t> buf;
    { FILE* f=fopen(path.c_str(),"rb"); if(!f) return (size_t)-1;
      fseek(f,0,SEEK_END); long len=ftell(f); fseek(f,0,SEEK_SET);
      buf.resize((size_t)len); size_t rd=fread(buf.data(),1,(size_t)len,f); fclose(f);
      if (rd!=(size_t)len) return (size_t)-1; }
    auto* dos=(IMAGE_DOS_HEADER*)buf.data();
    if (dos->e_magic!='ZM') return (size_t)-1;
    auto* nt=(IMAGE_NT_HEADERS64*)(buf.data()+dos->e_lfanew);
    if (nt->Signature!=0x00004550) return (size_t)-1;
    auto sections=IMAGE_FIRST_SECTION(nt);
    // locate .text raw bytes
    size_t tRaw=0,tSize=0; int64_t tVaddr=0;
    for (WORD i=0;i<nt->FileHeader.NumberOfSections;i++){
        auto& s=sections[i];
        if (memcmp(s.Name,".text",5)==0){ tRaw=s.PointerToRawData; tSize=s.SizeOfRawData; tVaddr=(int64_t)s.VirtualAddress; break; } }
    if (!tRaw) return (size_t)-1;
    ParsedPattern pp; if(!ParsePattern(pattern,pp)) return (size_t)-1;
    size_t psize=pp.b.size(); size_t count=0;
    for (size_t off=tRaw; off+psize<=tRaw+tSize; off++){
        bool ok=true;
        for (size_t k=0;k<psize;k++){ int want=pp.b[k]; if(want>=0&&(int)buf[off+k]!=want){ ok=false; break; } }
        if (ok){ hits.push_back((uint64_t)(off - tRaw + tVaddr)); count++; if (count>20) break; }
    }
    return count;
}
int main(){
    const char* g_game="E:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game";
    std::string client = std::string(g_game)+"\\csgo\\bin\\win64\\client.dll";
    struct T { const char* name; const char* pat; uint64_t expect; };
    std::vector<T> tests = {
        // NEW pattern (single-`?` wildcards) -> must resolve to 0x9be990
        { "GetBaseEntity NEW (expect 0x9be990)", "4C 8D 49 10 81 FA ? ? ? ? 77 ? 8B CA C1 F9 09 83 F9 3F 77", 0x9be990 },
        // CONTROLS (validated earlier) — must still hold
        { "GetLocalPlayerController (CTRL 0x2b9586)", "E8 ? ? ? ? 48 8B E8 48 85 C0 74 ? 33 DB 39 1D", 0x2b9586 },
        { "IGameEvent_GetName (CTRL 0x9afff0)", "8B 41 14 0F BA E0 1E 73 05 48 8D 41 18 C3", 0x9afff0 },
    };
    for (auto& t : tests){
        uint64_t rva=0;
        bool ok = SearchInDll(client, t.pat, &rva);   // base-exact: first match in [BaseOfCode,+SizeOfCode]
        if (ok)
            printf("[OK  ] %-45s base-search -> RVA 0x%llX  %s\n", t.name, (unsigned long long)rva,
                   (t.expect && rva==t.expect) ? "(CORRECT)" : (t.expect ? "(MISMATCH!)" : ""));
        else
            printf("[FAIL] %-45s base-search -> NOT FOUND\n", t.name);
        // full .text uniqueness count (no range limit)
        std::vector<uint64_t> hits;
        size_t cnt = CountAllInText(client, t.pat, hits);
        bool unique = (cnt==1 && !hits.empty() && hits[0]==t.expect);
        printf("        full-text matches=%zu  %s\n", cnt,
               unique ? "(UNIQUE @ expect)" : (cnt==1 ? "(unique but != expect)" : "(NOT UNIQUE)"));
        for (size_t i=0;i<hits.size() && i<5;i++) printf("          hit %zu: 0x%llX\n", i, (unsigned long long)hits[i]);
    }
    return 0;
}
