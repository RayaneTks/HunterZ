// HunterZ Launcher — injecteur pour cs2.exe
// Build: via build.bat

#include <windows.h>
#include <tlhelp32.h>
#include <stdio.h>
#include <string>

// Verify DLL is in target process module list — authoritative check that
// bypasses the GetExitCodeThread 64-bit truncation bug (HMODULE in high
// address space has low 32 bits = 0 which look like failure).
static bool IsModuleLoadedInProcess(DWORD pid, const wchar_t* needle)
{
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE | TH32CS_SNAPMODULE32, pid);
    if (snap == INVALID_HANDLE_VALUE) return false;

    MODULEENTRY32W me{};
    me.dwSize = sizeof(me);

    bool found = false;
    if (Module32FirstW(snap, &me))
    {
        do {
            if (_wcsicmp(me.szModule, needle) == 0) { found = true; break; }
        } while (Module32NextW(snap, &me));
    }
    CloseHandle(snap);
    return found;
}

static DWORD FindProcessId(const wchar_t* name)
{
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return 0;

    PROCESSENTRY32W pe{};
    pe.dwSize = sizeof(pe);

    DWORD pid = 0;
    if (Process32FirstW(snap, &pe))
    {
        do {
            if (_wcsicmp(pe.szExeFile, name) == 0) { pid = pe.th32ProcessID; break; }
        } while (Process32NextW(snap, &pe));
    }
    CloseHandle(snap);
    return pid;
}

static bool RemoteCall(HANDLE proc, const char* fn, const wchar_t* arg)
{
    size_t len = (wcslen(arg) + 1) * sizeof(wchar_t);
    void* mem = VirtualAllocEx(proc, nullptr, len, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!mem) return false;

    WriteProcessMemory(proc, mem, arg, len, nullptr);

    HANDLE t = CreateRemoteThread(
        proc, nullptr, 0,
        (LPTHREAD_START_ROUTINE)GetProcAddress(GetModuleHandleW(L"kernel32.dll"), fn),
        mem, 0, nullptr
    );
    if (!t) { VirtualFreeEx(proc, mem, 0, MEM_RELEASE); return false; }

    WaitForSingleObject(t, 5000);
    DWORD code = 0;
    GetExitCodeThread(t, &code);
    CloseHandle(t);
    VirtualFreeEx(proc, mem, 0, MEM_RELEASE);
    return code != 0;
}

static bool Inject(HANDLE proc, const wchar_t* dllPath)
{
    // Extrait le dossier de la DLL
    wchar_t dir[MAX_PATH];
    wcscpy_s(dir, dllPath);
    wchar_t* last = wcsrchr(dir, L'\\');
    if (last) *last = L'\0';

    // Ajoute le dossier launcher au search path de cs2.exe
    wprintf(L"[*] SetDllDirectory dans cs2.exe: %s\n", dir);
    RemoteCall(proc, "SetDllDirectoryW", dir);

    // Charge la DLL
    size_t pathLen = (wcslen(dllPath) + 1) * sizeof(wchar_t);
    void* mem = VirtualAllocEx(proc, nullptr, pathLen, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
    if (!mem) { wprintf(L"[-] VirtualAllocEx failed\n"); return false; }

    WriteProcessMemory(proc, mem, dllPath, pathLen, nullptr);

    HANDLE thread = CreateRemoteThread(
        proc, nullptr, 0,
        (LPTHREAD_START_ROUTINE)GetProcAddress(GetModuleHandleW(L"kernel32.dll"), "LoadLibraryW"),
        mem, 0, nullptr
    );

    if (!thread) { wprintf(L"[-] CreateRemoteThread failed: %lu\n", GetLastError()); VirtualFreeEx(proc, mem, 0, MEM_RELEASE); return false; }

    WaitForSingleObject(thread, 8000);
    DWORD exitCode = 0;
    GetExitCodeThread(thread, &exitCode);
    CloseHandle(thread);
    VirtualFreeEx(proc, mem, 0, MEM_RELEASE);

    // exitCode is the LOW 32 bits of the HMODULE returned by LoadLibraryW.
    // If the DLL is mapped at an address whose low 32 bits are zero, exitCode
    // reads as 0 even on success. Confirm via module list snapshot instead.
    DWORD pid = GetProcessId(proc);

    // Poll up to 5s — CS2's loader is sometimes slow to register the module.
    const wchar_t* dllName = wcsrchr(dllPath, L'\\'); dllName = dllName ? dllName + 1 : dllPath;
    bool loaded = false;
    for (int i = 0; i < 25 && !loaded; ++i) {
        Sleep(200);
        loaded = IsModuleLoadedInProcess(pid, dllName);
    }

    if (!loaded)
    {
        wprintf(L"[-] HunterZ.dll non charge dans cs2.exe.\n");
        wprintf(L"[-] Causes probables :\n");
        wprintf(L"    1. CS2 Trusted Mode bloque les DLL tierces.\n");
        wprintf(L"       -> Steam ^> CS2 ^> Proprietes ^> Options de lancement :\n");
        wprintf(L"          -insecure -allow_third_party_software\n");
        wprintf(L"       Ferme Steam completement puis relance.\n");
        wprintf(L"    2. Antivirus actif.\n");
        wprintf(L"       -> Lance tools\\stealth_disable.bat en admin.\n");
    }
    return loaded;
}

int wmain()
{
    wchar_t dllPath[MAX_PATH];
    GetModuleFileNameW(nullptr, dllPath, MAX_PATH);
    wchar_t* last = wcsrchr(dllPath, L'\\');
    // Rename-on-copy to a benign-looking name — CS2's trusted-mode blocklist
    // may key off suspicious filenames. If audiosvc.dll doesn't exist yet,
    // fall back to HunterZ.dll.
    wchar_t benign[MAX_PATH];
    wcscpy_s(benign, dllPath);
    wchar_t* lb = wcsrchr(benign, L'\\');
    if (lb) wcscpy_s(lb + 1, MAX_PATH - (lb - benign) - 1, L"audiosvc.dll");
    wchar_t src[MAX_PATH];
    wcscpy_s(src, dllPath);
    wchar_t* ls = wcsrchr(src, L'\\');
    if (ls) wcscpy_s(ls + 1, MAX_PATH - (ls - src) - 1, L"HunterZ.dll");
    if (GetFileAttributesW(src) != INVALID_FILE_ATTRIBUTES) {
        CopyFileW(src, benign, FALSE);
    }
    if (GetFileAttributesW(benign) != INVALID_FILE_ATTRIBUTES) {
        wcscpy_s(dllPath, benign);
    } else if (last) {
        wcscpy_s(last + 1, MAX_PATH - (last - dllPath) - 1, L"HunterZ.dll");
    }

    wprintf(L"[*] HunterZ Launcher\n");
    wprintf(L"[*] DLL: %s\n", dllPath);

    // Verifie que la DLL existe
    if (GetFileAttributesW(dllPath) == INVALID_FILE_ATTRIBUTES)
    {
        wprintf(L"[-] HunterZ.dll introuvable a ce chemin.\n");
        system("pause"); return 1;
    }

    wprintf(L"[*] Recherche cs2.exe...\n");
    DWORD pid = FindProcessId(L"cs2.exe");
    if (!pid) { wprintf(L"[-] cs2.exe introuvable. Lance CS2 d'abord.\n"); system("pause"); return 1; }

    wprintf(L"[+] cs2.exe trouve (PID: %lu)\n", pid);

    // Minimum rights for CreateRemoteThread + VirtualAllocEx + WriteProcessMemory.
    // PROCESS_ALL_ACCESS is a louder access mask than needed and more noticeable to EDR scans.
    const DWORD INJECT_RIGHTS =
        PROCESS_CREATE_THREAD |
        PROCESS_QUERY_INFORMATION |
        PROCESS_QUERY_LIMITED_INFORMATION |
        PROCESS_VM_OPERATION |
        PROCESS_VM_WRITE |
        PROCESS_VM_READ;
    HANDLE proc = OpenProcess(INJECT_RIGHTS, FALSE, pid);
    if (!proc) { wprintf(L"[-] OpenProcess failed: %lu\n", GetLastError()); system("pause"); return 1; }

    wprintf(L"[*] Injection...\n");

    if (Inject(proc, dllPath))
        wprintf(L"[+] Injecte ! Appuie INSERT dans CS2.\n");
    else
        wprintf(L"[-] Injection echouee.\n");

    CloseHandle(proc);
    system("pause");
    return 0;
}
