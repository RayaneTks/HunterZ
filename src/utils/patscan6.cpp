// patscan6.cpp - Trouve les pointeurs de DONNEES vers les strings "DXGISwapChain_Present" /
// "DXGISwapChain_ResizeBuffers" (table de registres), dumptable le contexte (le pointeur de
// fonction doit etre a cote). Controle: pour ResizeBuffers, 0x941A0 doit apparaitre a cote.
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

    printf("=== table des sections ===\n");
    for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];
        printf("  [%d] %-10s VA 0x%08X VSize 0x%08X raw 0x%08X rawSize 0x%08X chars 0x%08X\n",
            i,s.Name,s.VirtualAddress,s.Misc.VirtualSize,s.PointerToRawData,s.SizeOfRawData,s.Characteristics);}
    for(int i=0;i<g_nsec;i++){auto&s=g_sec[i];if(s.Characteristics&0x20000000){textVA=s.VirtualAddress;textSize=s.Misc.VirtualSize;}}

    const char* targets[2]={"DXGISwapChain_Present","DXGISwapChain_ResizeBuffers"};
    for(int t=0;t<2;t++){
        const char* s=targets[t]; size_t n=strlen(s);
        printf("\n### string \"%s\" ###\n",s);
        for(size_t off=0;off+n+1<=g_buf.size();off++){
            if(memcmp(g_buf.data()+off,s,n)==0&&g_buf[off+n]==0){
                DWORD strRva; FileToRva(off,strRva);
                printf("  occurrence @ file 0x%llX -> RVA 0x%llX\n",(unsigned long long)off,(unsigned long long)strRva);

                // 1) tous les QWord == strRva dans le fichier (pointeurs de donnees)
                for(size_t q=0;q+8<=g_buf.size();q+=8){
                    uint64_t val=*(uint64_t*)(g_buf.data()+q);
                    if(val==(uint64_t)strRva){
                        DWORD pRva; FileToRva(q,pRva);
                        printf("  [ptr] QWord @ file 0x%llX -> RVA 0x%llX vaut 0x%llX\n",(unsigned long long)q,(unsigned long long)pRva,(unsigned long long)strRva);
                        // dump 8 qwords avant / 8 apres
                        size_t a=(q>64)?q-64:0;
                        for(size_t d=a;d+8<=q+72;d+=8){
                            uint64_t v=*(uint64_t*)(g_buf.data()+d);
                            DWORD vr; FileToRva(d,vr);
                            bool code=InCode((DWORD)v);
                            bool expect=(v==0x941A0);
                            printf("           [%c] file 0x%08llX  val 0x%016llX  rva 0x%llX%s%s\n",
                                (d<q?'-':(d>q?'+':'=')),(unsigned long long)d,(unsigned long long)v,(unsigned long long)vr,
                                code?" [CODE]":"", expect?" <== 0x941A0 RESIZE (validation!)":"");
                            if(code){
                                size_t to; if(RvaToFile((DWORD)v,to)){
                                    char hex[200]="";int p2=0;
                                    for(int k=0;k<20&&to+k<g_buf.size();k++)p2+=sprintf(hex+2*p2,"%02X",g_buf[to+k]);
                                    printf("                prologue: %s\n",hex);
                                }
                            }
                        }
                        // xrefs lea vers ce pointeur
                        for(size_t co=0;co+6<=g_buf.size();co++){
                            uint8_t b0=g_buf[co],b1=g_buf[co+1],b2=g_buf[co+2];
                            if(b0>=0x40&&b0<=0x4F&&b1==0x8D&&(b2&0xC7)==0x05){
                                int32_t disp=*(int32_t*)(g_buf.data()+co+3);
                                DWORD ir; if(!FileToRva(co,ir))continue;
                                if(ir+6+disp==pRva){
                                    size_t io; RvaToFile(ir,io);
                                    printf("          [xref] lea @ RVA 0x%llX (file 0x%llX) ; contexte avant:\n",(unsigned long long)ir,(unsigned long long)io);
                                    char hex[512]="";int p2=0;
                                    for(int k=(int)io-32;k<io+16&&k<(int)g_buf.size();k++) if(k>=0) p2+=sprintf(hex+2*p2,"%02X",g_buf[k]);
                                    printf("             %s\n",hex);
                                }
                            }
                        }
                    }
                }
                off+=n;
            }
        }
    }
    return 0;
}
