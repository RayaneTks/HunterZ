#pragma once
// HzLog — simple file logger that writes to %USERPROFILE%\Desktop\HunterZ.log.
// Thread-safe. Flushes every line. Visible to the user without a console.

#include <Windows.h>
#include <cstdio>
#include <cstdarg>
#include <mutex>
#include <string>
#include <shlobj.h>

inline std::string HzLog_Path()
{
    char path[MAX_PATH] = { 0 };
    if ( SUCCEEDED( SHGetFolderPathA( nullptr, CSIDL_DESKTOPDIRECTORY, nullptr, 0, path ) ) )
    {
        std::string p = path;
        p += "\\HunterZ.log";
        return p;
    }
    return "C:\\HunterZ.log";
}

inline void HzLog( const char* fmt, ... )
{
    static std::mutex s_mtx;
    static HANDLE s_h = INVALID_HANDLE_VALUE;

    std::lock_guard<std::mutex> lk( s_mtx );

    if ( s_h == INVALID_HANDLE_VALUE )
    {
        const std::string p = HzLog_Path();
        s_h = CreateFileA( p.c_str(), GENERIC_WRITE, FILE_SHARE_READ, nullptr,
            CREATE_ALWAYS, FILE_ATTRIBUTE_NORMAL, nullptr );
    }
    if ( s_h == INVALID_HANDLE_VALUE ) return;

    SYSTEMTIME st; GetLocalTime( &st );
    char ts[64];
    const int tlen = std::snprintf( ts, sizeof( ts ),
        "[%02d:%02d:%02d.%03d] ", st.wHour, st.wMinute, st.wSecond, st.wMilliseconds );

    char body[2048];
    va_list ap; va_start( ap, fmt );
    const int blen = std::vsnprintf( body, sizeof( body ) - 2, fmt, ap );
    va_end( ap );

    DWORD w = 0;
    WriteFile( s_h, ts,   (DWORD)tlen, &w, nullptr );
    WriteFile( s_h, body, (DWORD)( blen > 0 ? blen : 0 ), &w, nullptr );
    const char nl = '\n';
    WriteFile( s_h, &nl, 1, &w, nullptr );
    FlushFileBuffers( s_h );
}
