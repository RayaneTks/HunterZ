// patscan7.cpp - Enumere les vtables COM statiques (.rdata/.data) et identifie la vtable
// IDXGISwapChain3 (18 entrees, entry[1]=AddRef). entry[10] = Present. Extract le prologue.
#include <windows.h>
#include <vector>
#include <string>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <set>

static std::vector<uint8_t> g_buf;
static IMAGE_NT_HEADERS64* g_nt=nullptr;
static IMAGE_SECTION_HEADER* g_sec=nullptr;
static int g_nsec=0;
static DWORD textVA=0, textSize=0;

static bool RvaToFile(DWORD rva,size_t&o){for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(rva>=s.VirtualAddress&&rva<s.VirtualAddress+s.Misc.VirtualSize){o=(size_t)(rva-s.VirtualAddress+s.PointerToRawData);return true;}}return false;}
static bool FileToRva(size_t off,DWORD&r){for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(off>=s.PointerToRawData&&off<(size_t)s.PointerToRawData+s.SizeOfRawData){r=(DWORD)(off-s.PointerToRawData+s.VirtualAddress);return true;}}return false;}
static bool InCode(uint64_t v){return v>=(uint64_t)textVA && v<(uint64_t)textVA+(uint64_t)textSize;}

// cherche un pattern (wildcard ?) dans [va, va+size) ; retourne les RVA de match
static void FindPat(const char* pat, DWORD va, DWORD size, std::vector<DWORD>& hits){
    // parse
    std::vector<int> tok;
    const char*p=pat;
    auto ishex=[](char c){return (c>='0'&&c<='9')||(c>='A'&&c<='F')||(c>='a'&&c<='f');};
    auto hv=[](char c){c=(char)toupper(c);return (c>='A')?(c-'A'+10):(c-'0');};
    while(*p){ while(*p==' ')p++; if(!*p)break;
        if(*p=='?'){tok.push_back(-1);p++;while(*p==' ')p++;}
        else if(ishex(*p)&&p[1]&&ishex(p[1])){tok.push_back((hv(*p)<<4)|hv(p[1]));p+=2;while(*p==' ')p++;}
        else p++; }
    if(tok.empty())return;
    size_t psz=tok.size();
    size_t start,end; if(!RvaToFile(va,start))return;
    end=start+size; if(end>g_buf.size())end=g_buf.size();
    for(size_t off=start;off+psz<=end;off++){
        bool ok=true;
        for(size_t k=0;k<psz;k++){int w=tok[k];if(w>=0&&(int)g_buf[off+k]!=w){ok=false;break;}}
        if(ok){DWORD r;FileToRva(off,r);hits.push_back(r);}
    }
}
static void DumpPro(const char*tag,DWORD a){
    size_t off;if(!RvaToFile(a,off)){printf("    %s: rva fail\n",tag);return;}
    char hex[200]="";int p=0;
    for(int k=0;k<24&&off+k<g_buf.size();k++)p+=sprintf(hex+2*p,"%02X",g_buf[off+k]);
    printf("    %s RVA 0x%llX : %s\n",tag,(unsigned long long)a,hex);
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
    for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(s.Characteristics&0x20000000){textVA=s.VirtualAddress;textSize=s.Misc.VirtualSize;}}

    // 1) trouver AddRef : F0 FF (lock inc / lock dec, n'importe quelle forme)
    std::vector<DWORD> addrefs;
    FindPat("F0 FF", textVA, textSize, addrefs);
    std::set<DWORD> addrefSet(addrefs.begin(),addrefs.end());
    printf("=== AddRef candidats : %d ===\n",(int)addrefs.size());
    for(DWORD a:addrefs)printf("    0x%llX\n",(unsigned long long)a);

    // 2) enumerer les vtables (runs de >=10 pointeurs code consecutifs) en .rdata/.data
    struct VT{DWORD start;int len;};
    std::vector<VT> vts;
    for(int si=0;si<g_nsec;si++){
        auto&s=g_sec[si];
        DWORD ch=s.Characteristics;
        if(ch&0x20000000)continue; // pas le code
        if(!(ch&0x40000000))continue; // seulement READ (rdata) ; data est WRITABLE
        if(s.SizeOfRawData==0)continue;
        size_t base=s.PointerToRawData, end=base+s.SizeOfRawData;
        long long runStart=-1;
        for(size_t off=base;off+8<=end;off+=8){
            uint64_t val=*(uint64_t*)(g_buf.data()+off);
            bool code=InCode(val);
            if(code&&runStart<0)runStart=(long long)off;
            if(!code&&runStart>=0){
                int l=(int)((off-runStart)/8);
                if(l>=10){DWORD sr;FileToRva((size_t)runStart,sr);vts.push_back({sr,l});}
                runStart=-1;
            }
        }
        if(runStart>=0){int l=(int)((end-runStart)/8);if(l>=10){DWORD sr;FileToRva((size_t)runStart,sr);vts.push_back({sr,l});}}
    }
    printf("\n=== vtables (runs >=10) : %d ===\n",(int)vts.size());
    for(auto&vt:vts){
        // entry[0], entry[1]
        size_t e0off;RvaToFile(vt.start,e0off);
        uint64_t e0=*(uint64_t*)(g_buf.data()+e0off);
        uint64_t e1=*(uint64_t*)(g_buf.data()+e0off+8);
        bool isCom = addrefSet.count((DWORD)e1)>0;
        printf("  vtable RVA 0x%llX  len=%d  e0=0x%llX e1=0x%llX%s\n",
            (unsigned long long)vt.start,vt.len,(unsigned long long)e0,(unsigned long long)e1,
            isCom?"  <== COM (e1=AddRef)":"");
    }

    // 3) pour chaque vtable COM, si len==18 -> IDXGISwapChain3 -> Present = entry[10]
    printf("\n=== analyse des vtables COM ===\n");
    for(auto&vt:vts){
        size_t e0off;if(!RvaToFile(vt.start,e0off))continue;
        uint64_t e1=*(uint64_t*)(g_buf.data()+e0off+8);
        if(addrefSet.count((DWORD)e1)==0)continue;
        printf("\n### vtable COM @ 0x%llX len=%d ###\n",(unsigned long long)vt.start,vt.len);
        for(int i=0;i<vt.len&&i<40;i++){
            uint64_t v=*(uint64_t*)(g_buf.data()+e0off+i*8);
            const char*tag="";
            if(i==10&&vt.len==18)tag="  <== PRESENT (idx10, len18=IDXGISwapChain3)";
            if(i==15&&vt.len==18)tag="  <== ResizeBuffers (idx15)";
            if(i==0)tag="  <== QueryInterface (idx0)";
            printf("  [%2d] 0x%012llX%s\n",i,(unsigned long long)v,tag);
        }
        if(vt.len==18){
            uint64_t present=*(uint64_t*)(g_buf.data()+e0off+10*8);
            printf("  >>> PRESENT = 0x%llX ; prologue :\n",(unsigned long long)present);
            DumpPro("  [Present]",(DWORD)present);
            uint64_t resize=*(uint64_t*)(g_buf.data()+e0off+15*8);
            printf("  >>> ResizeBuffers = 0x%llX ; prologue :\n",(unsigned long long)resize);
            DumpPro("  [Resize]  ",(DWORD)resize);
        }
    }
    return 0;
}
