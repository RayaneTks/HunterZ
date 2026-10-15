// patscan2.cpp - Repere la fonction Present dans GameOverlayRenderer64.dll via la
// chaine "DXGISwapChain_Present" (xrefs lea RIP) + controle sur ResizeBuffers.
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
    // .text = 1ere section generalement
    for (int i=0;i<g_nsec;i++){
        auto& s = g_sec[i];
        if (s.Characteristics & 0x20000000){ // IMAGE_SCN_MEM_EXECUTE
            if (rva >= s.VirtualAddress && rva < s.VirtualAddress + s.Misc.VirtualSize) return true;
        }
    }
    return false;
}

// cherche tous les lea RIP vers targetRva; pour chaque, scanne une fenetre et
// rapporte les lea RIP vers des adresses CODE (candidats) + prologue.
static void AnalyzeString(const char* str, DWORD ctrlRva /*0=none*/){
    printf("\n##### chaine: \"%s\" #####\n", str);
    size_t n = strlen(str);
    int occ = 0;
    for (size_t off=0; off + n + 1 <= g_buf.size(); off++){
        if (memcmp(g_buf.data()+off, str, n)==0 && g_buf[off+n]==0){
            DWORD strRva; if(!FileToRva(off,strRva)){ off+=n; continue; }
            occ++;
            printf("  occurrence @ file 0x%llX -> RVA 0x%X\n", (unsigned long long)off, strRva);

            // 1) trouver les xrefs (lea RIP) vers strRva dans le code
            std::vector<DWORD> xrefs;
            for (size_t co=0; co + 6 <= g_buf.size(); co++){
                uint8_t b0=g_buf[co], b1=g_buf[co+1], b2=g_buf[co+2];
                if (b0>=0x40 && b0<=0x4F && b1==0x8D && (b2&0xC7)==0x05){
                    int32_t disp = *(int32_t*)(g_buf.data()+co+3);
                    DWORD instrRva; if(!FileToRva(co,instrRva)) continue;
                    DWORD target = instrRva + 6 + (DWORD)disp;
                    if (target==strRva) xrefs.push_back(instrRva);
                }
            }
            printf("  -> %d xref(s) lea vers la chaine\n", (int)xrefs.size());

            // 2) pour chaque xref, fenetre +-120 octets: lea RIP vers code
            for (DWORD xr : xrefs){
                size_t xrOff; if(!RvaToFile(xr,xrOff)) continue;
                size_t lo = xrOff>120? xrOff-120:0;
                size_t hi = xrOff+120 < g_buf.size()? xrOff+120 : g_buf.size();
                printf("  --- xref @ RVA 0x%X (file 0x%llX), fenetre code-targets ---\n", xr, (unsigned long long)xrOff);
                for (size_t co=lo; co+6<=hi; co++){
                    uint8_t b0=g_buf[co], b1=g_buf[co+1], b2=g_buf[co+2];
                    if (b0>=0x40 && b0<=0x4F && b1==0x8D && (b2&0xC7)==0x05){
                        int32_t disp = *(int32_t*)(g_buf.data()+co+3);
                        DWORD instrRva; if(!FileToRva(co,instrRva)) continue;
                        DWORD target = instrRva + 6 + (DWORD)disp;
                        if (InCode(target)){
                            long long dist = (long long)instrRva - (long long)xr;
                            size_t tOff; if(!RvaToFile(target,tOff)) continue;
                            printf("      [cand] lea @RVA 0x%X (dist %+lld) -> FCT RVA 0x%X\n", instrRva, dist, target);
                            // prologue 24 octets
                            char hex[128]=""; int p=0;
                            for (int k=0;k<24 && tOff+k<g_buf.size();k++)
                                p += sprintf(hex+p, "%02X ", g_buf[tOff+k]);
                            printf("           prologue: %s\n", hex);
                            if (ctrlRva && target==ctrlRva)
                                printf("           ** MATCH controle (0x%X) -> methode validee **\n", ctrlRva);
                        }
                    }
                }
            }
            if (occ>3) break;
        }
    }
    if (occ==0) printf("  (chaine non trouvee)\n");
}

int main(){
    const char* path = "E:\\Steam\\GameOverlayRenderer64.dll";
    FILE* f = fopen(path,"rb");
    if(!f){ printf("open fail\n"); return 2; }
    fseek(f,0,SEEK_END); long len=ftell(f); fseek(f,0,SEEK_SET);
    g_buf.resize((size_t)len);
    size_t rd = fread(g_buf.data(),1,(size_t)len,f); fclose(f);
    if (rd!=(size_t)len){ printf("read fail\n"); return 2; }
    auto* dos=(IMAGE_DOS_HEADER*)g_buf.data();
    if (dos->e_magic!='ZM'){ printf("not PE\n"); return 2; }
    g_nt=(IMAGE_NT_HEADERS64*)(g_buf.data()+dos->e_lfanew);
    if (g_nt->Signature!=0x00004550){ printf("not PE2\n"); return 2; }
    g_sec=IMAGE_FIRST_SECTION(g_nt);
    g_nsec=g_nt->FileHeader.NumberOfSections;

    printf("=== GameOverlayRenderer64.dll  (%d sections) ===\n", g_nsec);

    // controle: ResizeBuffers pattern OK trouve a RVA 0x941A0
    AnalyzeString("DXGISwapChain_ResizeBuffers", 0x941A0);
    // cible: Present
    AnalyzeString("DXGISwapChain_Present", 0);

    return 0;
}
