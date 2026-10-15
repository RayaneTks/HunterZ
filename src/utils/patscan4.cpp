// patscan4.cpp - Trouve la vtable contenant ResizeBuffers (0x941A0), la dumpttable,
// et extrait Present (index 10 du layout IDXGISwapChain3). Controle sur le layout standard.
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
static bool FileToRva(size_t off, DWORD& outRva){
    for (int i=0;i<g_nsec;i++){
        auto& s = g_sec[i];
        if (off >= s.PointerToRawData && off < (size_t)s.PointerToRawData + s.SizeOfRawData){
            outRva = (DWORD)(off - s.PointerToRawData + s.VirtualAddress);
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

    const uint64_t resizeRva = 0x941A0;
    printf("=== Recherche des vtables contenant 0x%llX (ResizeBuffers) ===\n", (unsigned long long)resizeRva);

    int vtables=0;
    // scanner les sections NON executables (rdata) pour les pointeurs vers resizeRva
    for (int si=0; si<g_nsec; si++){
        auto& s = g_sec[si];
        if (s.Characteristics & 0x20000000) continue; // skip code
        if (s.SizeOfRawData==0) continue;
        size_t base = s.PointerToRawData;
        for (size_t off = base; off + 8 <= base + s.SizeOfRawData; off += 8){
            uint64_t val = *(uint64_t*)(g_buf.data()+off);
            if (val == resizeRva){
                DWORD entryRva; if(!FileToRva(off,entryRva)) continue;
                // expand: run de pointeurs code consecutifs
                size_t lo = off;
                while (lo >= base+8){
                    size_t p = lo-8;
                    uint64_t v = *(uint64_t*)(g_buf.data()+p);
                    if (InCode((DWORD)v)) lo = p; else break;
                }
                size_t hi = off;
                while (hi + 8 <= base + s.SizeOfRawData){
                    uint64_t v = *(uint64_t*)(g_buf.data()+hi);
                    if (InCode((DWORD)v)) hi += 8; else break;
                }
                DWORD vtRva; if(!FileToRva(lo,vtRva)) continue;
                int count = (int)((hi-lo)/8);
                // verifier que l'entree a l'index (off-lo)/8 est resize
                int idxResize = (int)((off-lo)/8);
                printf("\n### vtable @ RVA 0x%X (file 0x%llX)  %d entrees  [ResizeBuffers a l'index %d] ###\n",
                       vtRva, (unsigned long long)lo, count, idxResize);
                for (int e=0; e<count && e<64; e++){
                    uint64_t v = *(uint64_t*)(g_buf.data()+lo+e*8);
                    DWORD er; if(!FileToRva(lo+e*8,er)) continue;
                    bool isResize = (v==resizeRva);
                    const char* tag="";
                    if (isResize) tag=" <== RESIZEBUFFERS (known)";
                    if (idxResize>=0 && e==idxResize-5) tag=" <== CIBLE Present (idx15-5=10) [layout standard]";
                    printf("  [%2d] +0x%03X  RVA 0x%llX%s\n", e, e*8, (unsigned long long)v, tag);
                    if (e==10){
                        size_t tOff; if(RvaToFile((DWORD)v,tOff)){
                            char hex[200]=""; int p2=0;
                            for (int k=0;k<28 && tOff+k<g_buf.size();k++) p2+=sprintf(hex+2*p2,"%02X",g_buf[tOff+k]);
                            printf("       prologue: %s\n", hex);
                        }
                    }
                }
                vtables++;
                if (vtables>=6) break;
            }
        }
        if (vtables>=6) break;
    }
    if (vtables==0) printf("\n(aucune vtable trouv 0x%llX trouvee)\n",(unsigned long long)resizeRva);
    return 0;
}
