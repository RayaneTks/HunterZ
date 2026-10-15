// patscan9.cpp - recherche du fragment DISTINCTIF de l'ancien Present :
// push rsi,rdi,r12,r14,r15  (56 57 41 54 41 56 41 57)  -- SANS r13.
// + version plus longue (avec les mov [rsp],rbx / rbp precedents).
#include <windows.h>
#include <vector>
#include <cstdint>
#include <cstdio>
#include <cstring>

static std::vector<uint8_t> g_buf;
static IMAGE_NT_HEADERS64* g_nt=nullptr;
static IMAGE_SECTION_HEADER* g_sec=nullptr;
static int g_nsec=0;
static DWORD textVA=0,textSize=0;
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
static void DumpCtx(const char*tag,DWORD center,int before=20,int after=24){
    size_t off;if(!RvaToFile(center,off)){printf("    %s: rva fail\n",tag);return;}
    size_t lo=(off>=(size_t)before)?off-before:0;
    size_t hi=off+after;if(hi>g_buf.size())hi=g_buf.size();
    char hex[512]="";int p=0;
    for(size_t k=lo;k<hi;k++){ if(k==off){p+=sprintf(hex+p,"|");} p+=sprintf(hex+p,"%02X",g_buf[k]); }
    printf("    %s @RVA 0x%llX:\n      %s\n",tag,(unsigned long long)center,hex);
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

    printf("=== (1) '56 57 41 54 41 56 41 57' (push rsi,rdi,r12,r14,r15) ===\n");
    std::vector<DWORD>h1;FindPat("56 57 41 54 41 56 41 57",textVA,textSize,h1);
    printf("  %d occurrence(s)\n",(int)h1.size());
    for(DWORD h:h1)DumpCtx("cand",h,20,24);

    printf("\n=== (2) prefix complet: mov[rsp],rbx; mov[rsp],rbp; push rsi,rdi,r12,r14,r15 ===\n");
    std::vector<DWORD>h2;FindPat("48 89 5C 24 ? 48 89 6C 24 ? 56 57 41 54 41 56 41 57",textVA,textSize,h2);
    printf("  %d occurrence(s)\n",(int)h2.size());
    for(DWORD h:h2)DumpCtx("cand",h,8,32);
    return 0;
}
