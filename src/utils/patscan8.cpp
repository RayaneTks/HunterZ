// patscan8.cpp - (A) stats vtables (runs) ; (B) recherche de la prologue "push r12-r15"
// (signature de l'ancien Present) + dump du contexte pour identifier la nouvelle fonction Present.
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
static DWORD textVA=0,textSize=0;
static bool InCode(uint64_t v){return v>=(uint64_t)textVA&&v<(uint64_t)textVA+(uint64_t)textSize;}
static bool RvaToFile(DWORD rva,size_t&o){for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(rva>=s.VirtualAddress&&rva<s.VirtualAddress+s.Misc.VirtualSize){o=(size_t)(rva-s.VirtualAddress+s.PointerToRawData);return true;}}return false;}
static bool FileToRva(size_t off,DWORD&r){for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(off>=s.PointerToRawData&&off<(size_t)s.PointerToRawData+s.SizeOfRawData){r=(DWORD)(off-s.PointerToRawData+s.VirtualAddress);return true;}}return false;}
static void FindPat(const char*pat,DWORD va,DWORD size,std::vector<DWORD>&hits){
    std::vector<int>tok;const char*p=pat;
    auto ishex=[](char c){return(c>='0'&&c<='9')||(c>='A'&&c<='F')||(c>='a'&&c<='f');};
    auto hv=[](char c){c=(char)toupper(c);return(c>='A')?(c-'A'+10):(c-'0');};
    while(*p){while(*p==' ')p++;if(!*p)break;
        if(*p=='?'){tok.push_back(-1);p++;while(*p==' ')p++;}
        else if(ishex(*p)&&p[1]&&ishex(p[1])){tok.push_back((hv(*p)<<4)|hv(p[1]));p+=2;while(*p==' ')p++;}
        else p++;}
    if(tok.empty())return;size_t psz=tok.size();size_t start,end;if(!RvaToFile(va,start))return;
    end=start+size;if(end>g_buf.size())end=g_buf.size();
    for(size_t off=start;off+psz<=end;off++){bool ok=true;
        for(size_t k=0;k<psz;k++){int w=tok[k];if(w>=0&&(int)g_buf[off+k]!=w){ok=false;break;}}
        if(ok){DWORD r;FileToRva(off,r);hits.push_back(r);}}
}
static void DumpCtx(const char*tag,DWORD center,int before=24,int after=16){
    size_t off;if(!RvaToFile(center,off)){printf("    %s: rva fail\n",tag);return;}
    size_t lo=(off>=(size_t)before)?off-before:0;
    size_t hi=off+after;if(hi>g_buf.size())hi=g_buf.size();
    char hex[512]="";int p=0;
    for(size_t k=lo;k<hi;k++){
        if(k==off){p+=sprintf(hex+p,"|");}
        p+=sprintf(hex+p,"%02X",g_buf[k]);
    }
    printf("    %s @RVA 0x%llX  [%d..%d]:\n      %s\n",tag,(unsigned long long)center,(int)lo,(int)hi,hex);
}

int main(){
    const char*path="E:\\Steam\\GameOverlayRenderer64.dll";
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

    // (A) stats vtables en .rdata
    for(int si=0;si<g_nsec;si++){
        auto&s=g_sec[si];
        if(s.Characteristics&0x20000000)continue;
        if(!(s.Characteristics&0x40000000))continue;
        if(s.SizeOfRawData==0)continue;
        if(strncmp((const char*)s.Name,".rdata",6)!=0&&strncmp((const char*)s.Name,".data",5)!=0)continue;
        size_t base=s.PointerToRawData,end=base+s.SizeOfRawData;
        long long runStart=-1;int maxRun=0;long codeSlots=0;
        std::vector<std::pair<DWORD,int>> runs;
        for(size_t off=base;off+8<=end;off+=8){
            uint64_t val=*(uint64_t*)(g_buf.data()+off);
            bool code=InCode(val);
            if(code){codeSlots++;if(runStart<0)runStart=(long long)off;}
            if(!code&&runStart>=0){int l=(int)((off-runStart)/8);if(l>maxRun)maxRun=l;if(l>=4){DWORD sr;FileToRva((size_t)runStart,sr);runs.push_back({sr,l});}runStart=-1;}
        }
        if(runStart>=0){int l=(int)((end-runStart)/8);if(l>maxRun)maxRun=l;if(l>=4){DWORD sr;FileToRva((size_t)runStart,sr);runs.push_back({sr,l});}}
        printf("=== %s : %ld slots-code, runMax=%d, runs(>=4)=%zu ===\n",s.Name,codeSlots,maxRun,runs.size());
        for(auto&r:runs)if(r.second>=8)printf("    run RVA 0x%llX len=%d\n",(unsigned long long)r.first,r.second);
    }

    // (B) recherche push r12-r15 (41 54 41 55 41 56 41 57) + contexte
    printf("\n=== (B) recherche prologue push r12..r15 ===\n");
    std::vector<DWORD>hits;
    FindPat("41 54 41 55 41 56 41 57",textVA,textSize,hits);
    printf("  %d occurrence(s) de 'push r12..r15'\n",(int)hits.size());
    for(DWORD h:hits){
        // on veut que c'est le DEBUT de la seq push ; dump 24 avant (prologue) + 20 apres
        DumpCtx("cand",h,24,20);
    }
    return 0;
}
