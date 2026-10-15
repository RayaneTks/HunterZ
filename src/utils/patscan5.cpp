// patscan5.cpp - Suit les thunks (jmp) pour trouver Present via la vtable du swapchain.
// 1) thunks vers 0x941A0 (ResizeBuffers) -> 2) vtables les contenant -> 3) thunk index10 (Present std) -> fct.
#include <windows.h>
#include <vector>
#include <string>
#include <cstdint>
#include <cstdio>
#include <cstring>

static std::vector<uint8_t> g_buf;
static IMAGE_NT_HEADERS64* g_nt=nullptr;
static IMAGE_SECTION_HEADER* g_sec=nullptr;
static int g_nsec=0;
static DWORD textVA=0, textSize=0;

static bool RvaToFile(DWORD rva,size_t&o){for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(rva>=s.VirtualAddress&&rva<s.VirtualAddress+s.Misc.VirtualSize){o=(size_t)(rva-s.VirtualAddress+s.PointerToRawData);return true;}}return false;}
static bool FileToRva(size_t off,DWORD&r){for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(off>=s.PointerToRawData&&off<(size_t)s.PointerToRawData+s.SizeOfRawData){r=(DWORD)(off-s.PointerToRawData+s.VirtualAddress);return true;}}return false;}
static bool InCode(DWORD rva){return rva>=textVA&&rva<textVA+textSize;}

// suit un thunk (jmp) a l'adresse RVA A. retourne la cible ou 0.
static DWORD FollowThunk(DWORD A){
    size_t off; if(!RvaToFile(A,off))return 0;
    if(off+6>g_buf.size())return 0;
    uint8_t b0=g_buf[off],b1=g_buf[off+1];
    if(b0==0xE9){ int32_t rel=*(int32_t*)(g_buf.data()+off+1); return A+5+rel; }
    if(b0==0xFF&&b1==0x25){ int32_t disp=*(int32_t*)(g_buf.data()+off+2); size_t p; if(!RvaToFile(A+6+disp,p))return 0; if(p+8>g_buf.size())return 0; return *(uint32_t*)(g_buf.data()+p); }
    if(b0==0xEB){ int8_t rel=*(int8_t*)(g_buf.data()+off+1); return A+2+rel; }
    return 0;
}
static void DumpPrologue(const char*tag,DWORD fct){
    size_t off; if(!RvaToFile(fct,off)){printf("    %s: RvaToFile fail 0x%llX\n",tag,(unsigned long long)fct);return;}
    char hex[200]="";int p=0;
    for(int k=0;k<28&&off+k<g_buf.size();k++)p+=sprintf(hex+2*p,"%02X",g_buf[off+k]);
    printf("    %s -> RVA 0x%llX  prologue: %s\n",tag,(unsigned long long)fct,hex);
}

int main(){
    const char* path="E:\\Steam\\GameOverlayRenderer64.dll";
    FILE*f=fopen(path,"rb");if(!f){printf("open fail\n");return 2;}
    fseek(f,0,SEEK_END);long len=ftell(f);fseek(f,0,SEEK_SET);
    g_buf.resize((size_t)len);size_t rd=fread(g_buf.data(),1,(size_t)len,f);fclose(f);
    if(rd!=(size_t)len){printf("read fail\n");return 2;}
    auto*dos=(IMAGE_DOS_HEADER*)g_buf.data();
    if(dos->e_magic!='ZM'){printf("not PE\n");return 2;}
    g_nt=(IMAGE_NT_HEADERS64*)(g_buf.data()+dos->e_lfanew);
    if(g_nt->Signature!=0x00004550){printf("not PE2\n");return 2;}
    g_sec=IMAGE_FIRST_SECTION(g_nt);g_nsec=g_nt->FileHeader.NumberOfSections;
    // .text
    for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(s.Characteristics&0x20000000){textVA=s.VirtualAddress;textSize=s.Misc.VirtualSize;break;}}
    printf("=== .text RVA 0x%llX .. 0x%llX ===\n",(unsigned long long)textVA,(unsigned long long)(textVA+textSize));
    const DWORD resize=0x941A0;

    // 1) thunks vers resize
    printf("\n--- 1) thunks (jmp) vers 0x%llX ---\n",(unsigned long long)resize);
    std::vector<DWORD> thunks;
    for(DWORD rva=textVA;rva+5<textVA+textSize;rva++){
        DWORD t=FollowThunk(rva);
        if(t==resize){ thunks.push_back(rva); printf("    thunk @ RVA 0x%llX\n",(unsigned long long)rva); }
    }
    if(thunks.empty()){printf("    (aucun thunk direct) - essayer les thunks de 2nd niveau / le vtable est peut-etre dans le process\n");return 3;}

    // 2) vtables contenant ces thunks
    printf("\n--- 2) vtables contenant les thunks ---\n");
    int vtCount=0;
    for(DWORD T:thunks){
        for(int si=0;si<g_nsec;si++){
            auto&s=g_sec[si];
            if(s.Characteristics&0x20000000)continue;
            if(s.SizeOfRawData==0)continue;
            size_t base=s.PointerToRawData;
            for(size_t off=base;off+8<=base+s.SizeOfRawData;off+=8){
                uint64_t val=*(uint64_t*)(g_buf.data()+off);
                if(val==T){
                    DWORD slotRva;FileToRva(off,slotRva);
                    // expand vtable
                    size_t lo=off;
                    while(lo>=base+8){size_t p=lo-8;uint64_t v=*(uint64_t*)(g_buf.data()+p);if(InCode((DWORD)v))lo=p;else break;}
                    size_t hi=off;
                    while(hi+8<=base+s.SizeOfRawData){uint64_t v=*(uint64_t*)(g_buf.data()+hi);if(InCode((DWORD)v))hi+=8;else break;}
                    DWORD vtRva;FileToRva(lo,vtRva);
                    int count=(int)((hi-lo)/8);
                    int idx=(int)((off-lo)/8);
                    printf("\n### vtable @ RVA 0x%llX  %d entrees  [slot ResizeThunk index %d] ###\n",(unsigned long long)vtRva,count,idx);
                    for(int e=0;e<count&&e<64;e++){
                        uint64_t v=*(uint64_t*)(g_buf.data()+lo+e*8);
                        char tag[128]="";
                        if(v==T) strcpy(tag," <== RESIZE THUNK");
                        if(idx>=0&&e==idx-5) strcat(tag," <== CIBLE Present (idx std 10 = resize-5)");
                        printf("  [%2d] +0x%03X  0x%012llX%s\n",e,e*8,(unsigned long long)v,tag);
                    }
                    // 3) suivre les thunks: index resize (valide) et index resize-5 (Present)
                    if(idx>=0){
                        printf("  --- validation: suivre thunk[index %d] (doit -> 0x%llX) ---\n",idx,(unsigned long long)resize);
                        uint64_t rv=*(uint64_t*)(g_buf.data()+lo+idx*8);
                        DumpPrologue("  [resize-thunk target]",(DWORD)rv);
                        if(idx-5>=0){
                            printf("  --- CIBLE: suivre thunk[index %d] = Present (layout std) ---\n",idx-5);
                            uint64_t pv=*(uint64_t*)(g_buf.data()+lo+(idx-5)*8);
                            DWORD pfct=FollowThunk((DWORD)pv);
                            if(pfct) DumpPrologue("  [PRESENT target]",pfct);
                            else printf("    (le slot %d n'est pas un jmp thunk direct: 0x%llX)\n",idx-5,(unsigned long long)pv);
                        }
                    }
                    vtCount++;
                    if(vtCount>=4)break;
                }
            }
            if(vtCount>=4)break;
        }
    }
    if(vtCount==0)printf("\n(aucune vtable n'a ete associee aux thunks)\n");
    return 0;
}
