// HunterZ Menu — modern dark UI, rewritten.
// Layout: 920x560 window. Left sidebar (160px) with pill-shaped tabs.
// Content area with section headers + card groups. Custom switch toggles,
// animated accent, status footer with FPS/uptime/hook state.

#include "CAndromedaMenu.hpp"

#include <ImGui/imgui.h>
#include <ImGui/imgui_internal.h>

#include <AndromedaClient/Settings/Settings.hpp>
#include <AndromedaClient/CAndromedaGUI.hpp>

#include <cmath>
#include <cstdio>

static CAndromedaMenu g_CAndromedaMenu{};

namespace Hz
{
    // Palette — modern dark + violet/cyan accent
    static constexpr ImVec4 Bg          = { 0.055f, 0.059f, 0.078f, 1.00f };
    static constexpr ImVec4 BgDeep      = { 0.035f, 0.039f, 0.055f, 1.00f };
    static constexpr ImVec4 Sidebar     = { 0.043f, 0.047f, 0.063f, 1.00f };
    static constexpr ImVec4 Card        = { 0.075f, 0.082f, 0.106f, 1.00f };
    static constexpr ImVec4 CardHover   = { 0.090f, 0.098f, 0.126f, 1.00f };
    static constexpr ImVec4 Border      = { 0.133f, 0.141f, 0.173f, 1.00f };
    static constexpr ImVec4 Accent      = { 0.408f, 0.459f, 0.902f, 1.00f }; // indigo-500
    static constexpr ImVec4 AccentHi    = { 0.510f, 0.561f, 0.969f, 1.00f };
    static constexpr ImVec4 AccentDim   = { 0.408f, 0.459f, 0.902f, 0.25f };
    static constexpr ImVec4 Text        = { 0.925f, 0.933f, 0.957f, 1.00f };
    static constexpr ImVec4 TextDim     = { 0.549f, 0.561f, 0.624f, 1.00f };
    static constexpr ImVec4 TextMute    = { 0.388f, 0.400f, 0.459f, 1.00f };
    static constexpr ImVec4 Success     = { 0.212f, 0.741f, 0.467f, 1.00f };
    static constexpr ImVec4 Warning     = { 0.957f, 0.675f, 0.263f, 1.00f };
    static constexpr ImVec4 Danger      = { 0.937f, 0.325f, 0.325f, 1.00f };

    static ImU32 Col( ImVec4 c ) { return ImGui::GetColorU32( c ); }

    // Modern switch — rounded rail + sliding thumb, animated.
    static bool Toggle( const char* label, bool& v )
    {
        ImGui::PushID( label );
        ImGuiIO& io = ImGui::GetIO();
        ImDrawList* dl = ImGui::GetWindowDrawList();

        const float h = ImGui::GetFrameHeight() * 0.90f;
        const float w = h * 1.9f;
        const float r = h * 0.5f;

        ImVec2 pos = ImGui::GetCursorScreenPos();
        ImGui::InvisibleButton( "##sw", { w, h } );
        bool clicked = ImGui::IsItemClicked();
        if ( clicked ) v = !v;

        float t = v ? 1.f : 0.f;
        static float anim[64] = { 0 };
        const int id = (int)( ImGui::GetID( label ) & 63 );
        const float step = ( io.DeltaTime * 14.f < 1.f ) ? io.DeltaTime * 14.f : 1.f;
        anim[id] += ( t - anim[id] ) * step;

        ImVec4 railCol = v ? Accent : ImVec4( 0.145f, 0.157f, 0.196f, 1.0f );
        ImVec4 thumbCol = { 1.f, 1.f, 1.f, 1.f };

        dl->AddRectFilled( pos, { pos.x + w, pos.y + h }, Col( railCol ), r );
        if ( ImGui::IsItemHovered() )
            dl->AddRect( pos, { pos.x + w, pos.y + h }, Col( AccentHi ), r, 0, 1.5f );

        const float cx = pos.x + r + anim[id] * ( w - 2 * r );
        dl->AddCircleFilled( { cx, pos.y + r }, r - 3.f, Col( thumbCol ), 24 );

        ImGui::PopID();
        return clicked;
    }

    // Row with label on left + toggle on right.
    static bool ToggleRow( const char* label, bool& v )
    {
        ImGui::PushID( label );
        ImVec2 start = ImGui::GetCursorScreenPos();
        const float rowH = ImGui::GetFrameHeight() * 1.1f;
        ImGui::Dummy( { 0, 2 } );

        ImDrawList* dl = ImGui::GetWindowDrawList();
        if ( ImGui::IsMouseHoveringRect( start, { start.x + ImGui::GetContentRegionAvail().x, start.y + rowH } ) )
            dl->AddRectFilled( start, { start.x + ImGui::GetContentRegionAvail().x, start.y + rowH }, Col( CardHover ), 4.f );

        ImGui::AlignTextToFramePadding();
        ImGui::PushStyleColor( ImGuiCol_Text, Text );
        ImGui::TextUnformatted( label );
        ImGui::PopStyleColor();

        ImGui::SameLine( ImGui::GetContentRegionAvail().x - ImGui::GetFrameHeight() * 1.9f );
        bool r = Toggle( label, v );
        ImGui::Dummy( { 0, 2 } );
        ImGui::PopID();
        return r;
    }

    static bool SliderFloatRow( const char* label, float& v, float mn, float mx, const char* fmt = "%.1f" )
    {
        ImGui::PushID( label );
        ImGui::AlignTextToFramePadding();
        ImGui::PushStyleColor( ImGuiCol_Text, Text );
        ImGui::TextUnformatted( label );
        ImGui::PopStyleColor();

        char val[32]; std::snprintf( val, sizeof( val ), fmt, v );
        ImVec2 ts = ImGui::CalcTextSize( val );
        ImGui::SameLine( ImGui::GetContentRegionAvail().x - ts.x - 4 );
        ImGui::PushStyleColor( ImGuiCol_Text, AccentHi );
        ImGui::TextUnformatted( val );
        ImGui::PopStyleColor();

        ImGui::PushStyleColor( ImGuiCol_FrameBg,          { 0.098f, 0.110f, 0.141f, 1.f } );
        ImGui::PushStyleColor( ImGuiCol_FrameBgHovered,   { 0.129f, 0.141f, 0.173f, 1.f } );
        ImGui::PushStyleColor( ImGuiCol_FrameBgActive,    { 0.145f, 0.157f, 0.196f, 1.f } );
        ImGui::PushStyleColor( ImGuiCol_SliderGrab,       Accent );
        ImGui::PushStyleColor( ImGuiCol_SliderGrabActive, AccentHi );
        ImGui::PushStyleVar( ImGuiStyleVar_GrabMinSize, 14.f );
        ImGui::SetNextItemWidth( -1 );
        bool r = ImGui::SliderFloat( "##slf", &v, mn, mx, "" );
        ImGui::PopStyleVar();
        ImGui::PopStyleColor( 5 );
        ImGui::PopID();
        return r;
    }

    static bool SliderIntRow( const char* label, int& v, int mn, int mx, const char* fmt = "%d" )
    {
        ImGui::PushID( label );
        ImGui::AlignTextToFramePadding();
        ImGui::PushStyleColor( ImGuiCol_Text, Text );
        ImGui::TextUnformatted( label );
        ImGui::PopStyleColor();

        char val[32]; std::snprintf( val, sizeof( val ), fmt, v );
        ImVec2 ts = ImGui::CalcTextSize( val );
        ImGui::SameLine( ImGui::GetContentRegionAvail().x - ts.x - 4 );
        ImGui::PushStyleColor( ImGuiCol_Text, AccentHi );
        ImGui::TextUnformatted( val );
        ImGui::PopStyleColor();

        ImGui::PushStyleColor( ImGuiCol_FrameBg,          { 0.098f, 0.110f, 0.141f, 1.f } );
        ImGui::PushStyleColor( ImGuiCol_FrameBgHovered,   { 0.129f, 0.141f, 0.173f, 1.f } );
        ImGui::PushStyleColor( ImGuiCol_FrameBgActive,    { 0.145f, 0.157f, 0.196f, 1.f } );
        ImGui::PushStyleColor( ImGuiCol_SliderGrab,       Accent );
        ImGui::PushStyleColor( ImGuiCol_SliderGrabActive, AccentHi );
        ImGui::PushStyleVar( ImGuiStyleVar_GrabMinSize, 14.f );
        ImGui::SetNextItemWidth( -1 );
        bool r = ImGui::SliderInt( "##slider", &v, mn, mx, "" );
        ImGui::PopStyleVar();
        ImGui::PopStyleColor( 5 );
        ImGui::PopID();
        return r;
    }

    static bool ComboRow( const char* label, int& v, const char* const items[], int count )
    {
        ImGui::PushID( label );
        ImGui::AlignTextToFramePadding();
        ImGui::PushStyleColor( ImGuiCol_Text, Text );
        ImGui::TextUnformatted( label );
        ImGui::PopStyleColor();

        ImGui::SameLine( ImGui::GetContentRegionAvail().x * 0.5f );
        ImGui::PushStyleColor( ImGuiCol_FrameBg,        { 0.098f, 0.110f, 0.141f, 1.f } );
        ImGui::PushStyleColor( ImGuiCol_FrameBgHovered, { 0.129f, 0.141f, 0.173f, 1.f } );
        ImGui::PushStyleColor( ImGuiCol_PopupBg,        BgDeep );
        ImGui::PushStyleColor( ImGuiCol_Border,         Border );
        ImGui::SetNextItemWidth( -1 );
        bool r = ImGui::Combo( "##c", &v, items, count );
        ImGui::PopStyleColor( 4 );
        ImGui::PopID();
        return r;
    }

    static bool ColorRow( const char* label, ImVec4& c )
    {
        ImGui::PushID( label );
        ImGui::AlignTextToFramePadding();
        ImGui::PushStyleColor( ImGuiCol_Text, Text );
        ImGui::TextUnformatted( label );
        ImGui::PopStyleColor();

        ImGui::SameLine( ImGui::GetContentRegionAvail().x - 44 );
        bool r = ImGui::ColorEdit4( "##col", &c.x, ImGuiColorEditFlags_NoLabel | ImGuiColorEditFlags_NoInputs | ImGuiColorEditFlags_AlphaBar );
        ImGui::PopID();
        return r;
    }

    // Section header — label + accent underline bar.
    static void Section( const char* title )
    {
        ImGui::Dummy( { 0, 4 } );
        ImDrawList* dl = ImGui::GetWindowDrawList();
        ImVec2 p = ImGui::GetCursorScreenPos();

        ImGui::PushStyleColor( ImGuiCol_Text, TextDim );
        ImGui::PushFont( ImGui::GetFont() );
        ImGui::TextUnformatted( title );
        ImGui::PopFont();
        ImGui::PopStyleColor();

        ImVec2 ts = ImGui::CalcTextSize( title );
        dl->AddRectFilled( { p.x, p.y + ts.y + 2 }, { p.x + ts.x + 20, p.y + ts.y + 4 }, Col( Accent ) );
        ImGui::Dummy( { 0, 4 } );
    }

    // Card container — rounded dark panel wrapping grouped controls.
    static void BeginCard( const char* id, float minHeight = 0.f )
    {
        ImGui::PushStyleColor( ImGuiCol_ChildBg, Card );
        ImGui::PushStyleColor( ImGuiCol_Border, Border );
        ImGui::PushStyleVar( ImGuiStyleVar_ChildRounding, 8.f );
        ImGui::PushStyleVar( ImGuiStyleVar_ChildBorderSize, 1.f );
        ImGui::PushStyleVar( ImGuiStyleVar_WindowPadding, { 12, 10 } );
        ImGui::BeginChild( id, { 0, minHeight }, true, ImGuiWindowFlags_NoScrollbar );
    }

    static void EndCard()
    {
        ImGui::EndChild();
        ImGui::PopStyleVar( 3 );
        ImGui::PopStyleColor( 2 );
    }
}

// --- Tabs ---------------------------------------------------------------

static int s_ActiveTab = 0;

static void TabAimbot()
{
    using namespace Hz;

    Section( "AIMBOT" );
    BeginCard( "##aim-main", 0 );
    ToggleRow( "Enable aimbot", Settings::Aimbot::Active );
    if ( Settings::Aimbot::Active )
    {
        ToggleRow( "Visible only",       Settings::Aimbot::OnlyVisible );
        ToggleRow( "Target teammates",   Settings::Aimbot::Team );
        const char* bones[] = { "Head", "Chest", "Pelvis" };
        ComboRow( "Target bone", Settings::Aimbot::Bone, bones, IM_ARRAYSIZE( bones ) );
        SliderFloatRow( "FOV",       Settings::Aimbot::Fov,    1.f, 180.f, "%.1f\xC2\xB0" );
        SliderFloatRow( "Smoothing", Settings::Aimbot::Smooth, 1.f, 100.f, "%.1f" );
    }
    EndCard();

    Section( "SILENT AIM" );
    BeginCard( "##aim-silent", 0 );
    ToggleRow( "Enable silent aim", Settings::SilentAim::Active );
    if ( Settings::SilentAim::Active )
        SliderIntRow( "Backtrack ticks", Settings::SilentAim::BacktrackTicks, 0, 12 );
    EndCard();
}

static void TabVisuals()
{
    using namespace Hz;

    Section( "ESP" );
    BeginCard( "##v-esp", 0 );
    ToggleRow( "Enable ESP",       Settings::Visual::Active );
    if ( Settings::Visual::Active )
    {
        ToggleRow( "Show enemies",   Settings::Visual::Enemy );
        ToggleRow( "Show teammates", Settings::Visual::Team );
        ToggleRow( "Visible only",   Settings::Visual::OnlyVisible );
    }
    EndCard();

    Section( "BOX" );
    BeginCard( "##v-box", 0 );
    ToggleRow( "Player box", Settings::Visual::PlayerBox );
    if ( Settings::Visual::PlayerBox )
    {
        const char* types[] = { "Filled", "Outline", "Corner", "Outline + Corner" };
        ComboRow( "Style", Settings::Visual::PlayerBoxType, types, IM_ARRAYSIZE( types ) );
    }
    EndCard();

    Section( "SKELETON" );
    BeginCard( "##v-skel", 0 );
    ToggleRow( "Bone ESP", Settings::Visual::BoneESP );
    if ( Settings::Visual::BoneESP )
    {
        ToggleRow( "  Enemies",   Settings::Visual::BoneESPEnemy );
        ToggleRow( "  Teammates", Settings::Visual::BoneESPTeam );
    }
    EndCard();

    Section( "GLOW" );
    BeginCard( "##v-glow", 0 );
    ToggleRow( "Glow", Settings::Visual::Glow );
    if ( Settings::Visual::Glow )
    {
        ToggleRow( "  Enemies",   Settings::Visual::GlowEnemy );
        ToggleRow( "  Teammates", Settings::Visual::GlowTeam );
    }
    EndCard();

    Section( "COLORS" );
    BeginCard( "##v-colors", 0 );
    ColorRow( "Box — T",            Settings::Colors::Visual::PlayerBoxTT );
    ColorRow( "Box — T (visible)",  Settings::Colors::Visual::PlayerBoxTT_Visible );
    ColorRow( "Box — CT",           Settings::Colors::Visual::PlayerBoxCT );
    ColorRow( "Box — CT (visible)", Settings::Colors::Visual::PlayerBoxCT_Visible );
    ColorRow( "Glow — T",           Settings::Colors::Visual::GlowTT );
    ColorRow( "Glow — CT",          Settings::Colors::Visual::GlowCT );
    EndCard();
}

static void TabInventory()
{
    using namespace Hz;

    Section( "INVENTORY CHANGER" );
    BeginCard( "##inv", 0 );
    ToggleRow( "Enable inventory changer", Settings::Inventory::Active );
    ImGui::Dummy( { 0, 4 } );
    ImGui::PushStyleColor( ImGuiCol_Text, TextDim );
    ImGui::PushTextWrapPos( ImGui::GetContentRegionAvail().x );
    ImGui::TextWrapped( "Changes apply client-side only. If pattern drift is detected in logs, keep this off until offsets are refreshed." );
    ImGui::PopTextWrapPos();
    ImGui::PopStyleColor();
    EndCard();
}

static void TabSettings()
{
    using namespace Hz;

    Section( "APPEARANCE" );
    BeginCard( "##s-app", 0 );
    SliderIntRow( "Menu opacity", Settings::Menu::MenuAlpha, 100, 255 );
    const char* styles[] = { "Indigo", "Vermillion", "Classic Steam", "HunterZ Dark" };
    if ( ComboRow( "Theme preset", Settings::Menu::MenuStyle, styles, IM_ARRAYSIZE( styles ) ) )
        GetHzGUI()->UpdateStyle();
    EndCard();

    Section( "BUILD" );
    BeginCard( "##s-build", 0 );
    const ImGuiIO& io = ImGui::GetIO();
    ImGui::PushStyleColor( ImGuiCol_Text, TextDim );
    ImGui::Text( "Version   HunterZ v2.0.0" );
    ImGui::Text( "Compiled  " __DATE__ "  " __TIME__ );
    ImGui::Text( "Framerate %.0f fps  (%.2f ms)", io.Framerate, 1000.0f / io.Framerate );
    ImGui::PopStyleColor();
    EndCard();
}

// --- Main render --------------------------------------------------------

auto CAndromedaMenu::OnRenderMenu() -> void
{
    using namespace Hz;

    const ImGuiIO& io = ImGui::GetIO();

    // Watermark — compact top-right pill.
    {
        const float pad = 8.f;
        ImGui::SetNextWindowPos( { io.DisplaySize.x - pad, pad }, ImGuiCond_Always, { 1.f, 0.f } );
        ImGui::SetNextWindowBgAlpha( 0.70f );
        ImGui::PushStyleVar( ImGuiStyleVar_WindowRounding, 20.f );
        ImGui::PushStyleVar( ImGuiStyleVar_WindowPadding,  { 10, 4 } );
        ImGui::PushStyleColor( ImGuiCol_WindowBg, BgDeep );
        ImGui::PushStyleColor( ImGuiCol_Border,   Accent );
        if ( ImGui::Begin( "##hz-wm", nullptr,
            ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_NoInputs | ImGuiWindowFlags_NoNav |
            ImGuiWindowFlags_NoMove | ImGuiWindowFlags_NoBringToFrontOnFocus | ImGuiWindowFlags_NoSavedSettings |
            ImGuiWindowFlags_AlwaysAutoResize ) )
        {
            ImDrawList* dl = ImGui::GetWindowDrawList();
            ImVec2 cp = ImGui::GetCursorScreenPos();
            dl->AddCircleFilled( { cp.x + 4, cp.y + 8 }, 3.f, Col( Accent ) );
            ImGui::SetCursorPosX( ImGui::GetCursorPosX() + 12 );
            ImGui::PushStyleColor( ImGuiCol_Text, AccentHi );
            ImGui::Text( "HunterZ" );
            ImGui::PopStyleColor();
            ImGui::SameLine();
            ImGui::PushStyleColor( ImGuiCol_Text, TextMute );
            ImGui::Text( "  %.0f fps", io.Framerate );
            ImGui::PopStyleColor();
        }
        ImGui::End();
        ImGui::PopStyleColor( 2 );
        ImGui::PopStyleVar( 2 );
    }

    // Main window
    const float alpha = (float)Settings::Menu::MenuAlpha / 255.f;
    ImGui::PushStyleVar( ImGuiStyleVar_Alpha,         alpha );
    ImGui::PushStyleVar( ImGuiStyleVar_WindowRounding, 10.f );
    ImGui::PushStyleVar( ImGuiStyleVar_WindowBorderSize, 1.f );
    ImGui::PushStyleVar( ImGuiStyleVar_WindowPadding, { 0, 0 } );
    ImGui::PushStyleColor( ImGuiCol_WindowBg, Bg );
    ImGui::PushStyleColor( ImGuiCol_Border,   Border );

    ImGui::SetNextWindowSize( { 920, 560 }, ImGuiCond_FirstUseEver );
    ImGui::SetNextWindowSizeConstraints( { 760, 460 }, { 1280, 820 } );

    if ( !ImGui::Begin( "##hz-main", nullptr, ImGuiWindowFlags_NoCollapse | ImGuiWindowFlags_NoScrollbar | ImGuiWindowFlags_NoTitleBar ) )
    {
        ImGui::End();
        ImGui::PopStyleColor( 2 );
        ImGui::PopStyleVar( 4 );
        return;
    }

    ImDrawList* dl = ImGui::GetWindowDrawList();
    ImVec2 wp = ImGui::GetWindowPos();
    ImVec2 ws = ImGui::GetWindowSize();

    // Title bar strip
    const float titleH = 48.f;
    dl->AddRectFilled( wp, { wp.x + ws.x, wp.y + titleH }, Col( Sidebar ) );
    dl->AddRectFilled( { wp.x, wp.y + titleH - 1 }, { wp.x + ws.x, wp.y + titleH + 1 }, Col( Border ) );

    ImGui::SetCursorPos( { 18, 14 } );
    dl->AddCircleFilled( { wp.x + 24, wp.y + 24 }, 5.f, Col( Accent ) );
    ImGui::SetCursorPos( { 40, 14 } );
    ImGui::PushStyleColor( ImGuiCol_Text, Text );
    ImGui::Text( "HunterZ" );
    ImGui::PopStyleColor();
    ImGui::SameLine();
    ImGui::PushStyleColor( ImGuiCol_Text, TextMute );
    ImGui::Text( "  CS2 Internal  ·  v2.0" );
    ImGui::PopStyleColor();

    // Footer status strip
    const float footH = 24.f;
    ImVec2 footStart = { wp.x, wp.y + ws.y - footH };
    dl->AddRectFilled( footStart, { wp.x + ws.x, wp.y + ws.y }, Col( Sidebar ) );
    dl->AddRectFilled( { footStart.x, footStart.y }, { footStart.x + ws.x, footStart.y + 1 }, Col( Border ) );

    ImGui::SetCursorPos( { 12, ws.y - footH + 4 } );
    ImGui::PushStyleColor( ImGuiCol_Text, Success );
    ImGui::Text( "●" );
    ImGui::PopStyleColor();
    ImGui::SameLine();
    ImGui::PushStyleColor( ImGuiCol_Text, TextDim );
    ImGui::Text( "Hooks live" );
    ImGui::PopStyleColor();

    ImGui::SameLine( ws.x * 0.5f - 50 );
    ImGui::PushStyleColor( ImGuiCol_Text, TextMute );
    ImGui::Text( "F1 toggle" );
    ImGui::PopStyleColor();

    char fps[32]; std::snprintf( fps, sizeof( fps ), "%.0f fps  ·  %.2f ms", io.Framerate, 1000.0f / io.Framerate );
    ImVec2 fs = ImGui::CalcTextSize( fps );
    ImGui::SameLine( ws.x - fs.x - 14 );
    ImGui::PushStyleColor( ImGuiCol_Text, TextDim );
    ImGui::TextUnformatted( fps );
    ImGui::PopStyleColor();

    // ── Sidebar ────────────────────────────────────────────────────────
    ImGui::SetCursorPos( { 0, titleH } );
    ImGui::PushStyleColor( ImGuiCol_ChildBg, Sidebar );
    ImGui::BeginChild( "##sb", { 180, ws.y - titleH - footH }, false, ImGuiWindowFlags_NoScrollbar );

    struct Tab { const char* label; const char* glyph; };
    static const Tab tabs[] = {
        { "Aimbot",    "A" },
        { "Visuals",   "V" },
        { "Inventory", "I" },
        { "Settings",  "S" },
    };

    ImGui::Dummy( { 0, 10 } );
    for ( int i = 0; i < IM_ARRAYSIZE( tabs ); i++ )
    {
        const bool sel = ( s_ActiveTab == i );
        ImGui::PushID( i );

        ImVec2 start = ImGui::GetCursorScreenPos();
        const float rowH = 42.f;
        const float rowW = 164.f;

        ImGui::InvisibleButton( "##tab", { rowW, rowH } );
        bool hovered = ImGui::IsItemHovered();
        if ( ImGui::IsItemClicked() ) s_ActiveTab = i;

        if ( sel )
        {
            dl->AddRectFilled( { start.x + 8, start.y }, { start.x + rowW, start.y + rowH }, Col( AccentDim ), 8.f );
            dl->AddRectFilled( { start.x + 8, start.y + 10 }, { start.x + 11, start.y + rowH - 10 }, Col( Accent ), 2.f );
        }
        else if ( hovered )
        {
            dl->AddRectFilled( { start.x + 8, start.y }, { start.x + rowW, start.y + rowH }, Col( ImVec4{ 1,1,1,0.03f } ), 8.f );
        }

        ImVec4 glyphCol = sel ? AccentHi : TextDim;
        ImVec4 labelCol = sel ? Text     : TextDim;

        dl->AddText( { start.x + 22, start.y + rowH * 0.5f - 8 }, Col( glyphCol ), tabs[i].glyph );
        dl->AddText( { start.x + 44, start.y + rowH * 0.5f - 7 }, Col( labelCol ), tabs[i].label );

        ImGui::PopID();
        ImGui::Dummy( { 0, 2 } );
    }

    ImGui::EndChild();
    ImGui::PopStyleColor();

    // ── Content ───────────────────────────────────────────────────────
    ImGui::SetCursorPos( { 180, titleH } );
    ImGui::PushStyleColor( ImGuiCol_ChildBg, Bg );
    ImGui::PushStyleVar( ImGuiStyleVar_WindowPadding, { 20, 16 } );
    ImGui::BeginChild( "##content", { ws.x - 180, ws.y - titleH - footH }, false );

    switch ( s_ActiveTab )
    {
        case 0: TabAimbot();    break;
        case 1: TabVisuals();   break;
        case 2: TabInventory(); break;
        case 3: TabSettings();  break;
    }

    ImGui::EndChild();
    ImGui::PopStyleVar();
    ImGui::PopStyleColor();

    ImGui::End();
    ImGui::PopStyleColor( 2 );
    ImGui::PopStyleVar( 4 );
}

// --- Legacy helpers kept for binary compat ------------------------------

auto CAndromedaMenu::RenderCheckBox( const char* szTitle, const char*, bool& v ) -> bool
{
    return Hz::ToggleRow( szTitle, v );
}

auto CAndromedaMenu::RenderComboBox( const char* t, const char*, int& v, const char* items[], int count ) -> bool
{
    return Hz::ComboRow( t, v, items, count );
}

auto CAndromedaMenu::RenderColorEdit( const char* t, const char*, float* color ) -> bool
{
    ImVec4 c{ color[0], color[1], color[2], color[3] };
    bool r = Hz::ColorRow( t, c );
    color[0] = c.x; color[1] = c.y; color[2] = c.z; color[3] = c.w;
    return r;
}

auto CAndromedaMenu::RenderSliderInt( const char* t, const char*, int& v, int mn, int mx ) -> bool
{
    return Hz::SliderIntRow( t, v, mn, mx );
}

auto GetHzMenu() -> CAndromedaMenu*
{
    return &g_CAndromedaMenu;
}
