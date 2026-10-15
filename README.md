# HunterZ â€” CS2 External Cheat

A clean, modular CS2 external cheat base built on BlackBone + ImGui + DirectX 11.

## Project Structure

```
HunterZ/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ core/           # Cheat core: client, GUI, menu, injector, loaders
â”‚   â”œâ”€â”€ features/
â”‚   â”‚   â”œâ”€â”€ aimbot/     # CAimbot, CSilentAim
â”‚   â”‚   â”œâ”€â”€ visuals/    # CVisual, CRadar
â”‚   â”‚   â””â”€â”€ inventory/  # Inventory changer, econ items, GC cache
â”‚   â”œâ”€â”€ hooks/          # Hook_*.cpp â€” all vtable/detour hooks
â”‚   â”œâ”€â”€ sdk/
â”‚   â”‚   â”œâ”€â”€ cs2/        # CS2 SDK: entities, schema, interfaces, protobuf
â”‚   â”‚   â””â”€â”€ math/       # Math, Vector2/3/4, QAngle, Matrix
â”‚   â”œâ”€â”€ render/         # CRender, CRenderStackSystem, CFont, CFontManager, ImageNET
â”‚   â”œâ”€â”€ utils/          # XorStr, StringHelper, DevLog, CrashLog, globals, CSettingsJson
â”‚   â””â”€â”€ dllmain.cpp     # DLL entry point
â”œâ”€â”€ third_party/
â”‚   â”œâ”€â”€ imgui/          # Dear ImGui + freetype + backends
â”‚   â””â”€â”€ blackbone/      # BlackBone library (process injection, memory)
â”œâ”€â”€ backend/            # Node.js backend server (server.js, package.json)
â”œâ”€â”€ monitor/            # Monitor.cpp/.h â€” external process monitor
â”œâ”€â”€ config/             # Config.hpp, Settings.hpp
â”œâ”€â”€ offsets/            # CS2 offsets (auto-generated, volatile)
â””â”€â”€ HunterZ.sln         # Visual Studio 2022 solution
```

## Build Requirements

- **Visual Studio 2022** (v143 toolset)
- **Windows SDK 10.0** or later
- **Configuration**: Release | x64
- BlackBone, Dear ImGui, and FreeType are bundled in 	hird_party/

## Dependencies

| Library | Location | Notes |
|---------|----------|-------|
| [Dear ImGui](https://github.com/ocornut/imgui) | 	hird_party/imgui/ | With DX11 + Win32 backends |
| [BlackBone](https://github.com/DarthTon/Blackbone) | 	hird_party/blackbone/ | Process injection framework |
| [FreeType](https://freetype.org/) | 	hird_party/imgui/freetype/ | Font rendering |
| DirectX 11 | Windows SDK | Via d3d11.lib |
| Protobuf | 	hird_party/blackbone/ | CS2 game messages |

## Updating CS2 Offsets

Offsets are in offsets/ and are **volatile** â€” update them after each CS2 patch:

1. Download latest dumps from [cs2-dumper](https://github.com/a2x/cs2-dumper/tree/main/output)
2. Replace offsets/offsets.hpp, offsets/client_dll.hpp, offsets/buttons.hpp, etc.
3. Rebuild the project.

> [!WARNING]
> Never commit live offsets to a public repository.

## How to Build

1. Open HunterZ.sln in Visual Studio 2022
2. Select **Release | x64**
3. Build â†’ Build Solution (Ctrl+Shift+B)
4. Output DLL will be in x64/Release/HunterZ.dll

## Injection

Use the bundled HunterZ-Injector project or any compatible DLL injector targeting cs2.exe.
