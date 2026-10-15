// patscan3.cpp - Inspecte les entrees de la table @ 0x1206E8 (Present) / 0x120728 (ResizeBuffers)
// pour extraire le pointeur de fonction Present. Controle: ResizeBuffers doit contenir 0x941A0.
#include <windows.h>
#include <vector>
#include <string>
#include <cstdint>
#include <cstdio>
#include <cstring>

static std::vector<uint8_t> g_buf;
static IMAGE_NT_HEADERS64* g_nt = nullptr;
static IMAGE_SECTION_HEADER* g_sec = nullptr;
static int g_nsec = 0;

static bool RvaToFile(DWORD rva, size_t& outOff){
    for (int i=0;i<g_nsec;i++){
        auto& s = g_sec[i];
        if (rva >= s.VirtualAddress && rva < s.VirtualAddress + s.Misc.VirtualSize){
            outOff = (size_t)(rva - s.VirtualAddress + s.PointerToRawData);
            return true;
        }
    }
    return false;
}
static bool InCode(DWORD rva){
    for (int i=0;i<g_nsec;i++){
        auto& s = g_sec[i];
        if (s.Characteristics & 0x20000000){
            if (rva >= s.VirtualAddress && rva < s.VirtualAddress + s.Misc.VirtualSize) return true;
        }
    }
    return false;
}
static void DumpEntry(const char* label, DWORD baseRva, DWORD expectFn){
    size_t off; if(!RvaToFile(baseRva,off)){ printf("  %s: RvaToFile fail\n", label); return; }
    printf("\n=== entree %s @ RVA 0x%X (file 0x%llX) ===\n", label, baseRva, (unsigned long long)off);
    for (int q=0; q<8; q++){ // 0x40 octets = 8 qwords
        uint64_t val = *(uint64_t*)(g_buf.data()+off+q*8);
        bool code = InCode((DWORD)val);
        bool isExpect = (val==(uint64_t)expectFn);
        printf("  [+0x%02X] 0x%016llX  %s%s\n", q*8, (unsigned long long)val,
               code? "[CODE]": (isExpect?" [EXPECT-OK]":""), "");
        if (code){
            size_t tOff; if(RvaToFile((DWORD)val,tOff)){
                char hex[160]=""; int p=0;
                for (int k=0;k<28 && tOff+k<g_buf.size();k++) p+=sprintf(hex+p,"%02X ",g_buf[tOff+k]);
                printf("       prologue@0x%llX: %s\n",(unsigned long long)val,hex);
            }
        }
    }
}
int main(){
    const char* path = "E:\\Steam\\GameOverlayRenderer64.dll";
    FILE* f=fopen(path,"rb"); if(!f){printf("open fail\n");return 2;}
    fseek(f,0,SEEK_END); long len=ftell(f); fseek(f,0,SEEK_SET);
    g_buf.resize((size_t)len); size_t rd=fread(g_buf.data(),1,(size_t)len,f); fclose(f);
    if(rd!=(size_t)len){printf("read fail\n");return 2;}
    auto* dos=(IMAGE_DOS_HEADER*)g_buf.data();
    if(dos->e_magic!='ZM'){printf("not PE\n");return 2;}
    g_nt=(IMAGE_NT_HEADERS64*)(g_buf.data()+dos->e_lfanew);
    if(g_nt->Signature!=0x00004550){printf("not PE2\n");return 2;}
    g_sec=IMAGE_FIRST_SECTION(g_nt); g_nsec=g_nt->FileHeader.NumberOfSections;
    printf("=== GameOverlayRenderer64.dll (%d sections) ===\n",g_nsec);

    // controle d'abord: ResizeBuffers (on sait que la fct est a 0x941A0)
    DumpEntry("ResizeBuffers [CONTROLE]", 0x120728, 0x941A0);
    // cible: Present
    DumpEntry("Present [CIBLE]", 0x1206E8, 0);
    return 0;
}
