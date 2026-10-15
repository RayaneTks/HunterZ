#pragma once

// Project Configuration:

#define LOG_FILE					"debug.log"
#define GUI_FILE					"gui.ini"
#define CONFIG_FILE					"config.json"

#define CHEAT_NAME					"HunterZ"
#define CHEAT_VERSION				"2.0.0"

// Project Buid Config:

#ifdef RELEASE_BUILD

// Stealth release — no console, no plaintext strings, no SDK log spam.
#define ENABLE_CONSOLE_DEBUG		0
#define ENABLE_CPP_EH_EXCEPTION		0

#define LOG_SDK						0
#define LOG_SDK_PATTERN				0

#define ENABLE_XOR_STR				1
#define ENABLE_XOR_VMP_STR			0

#define DUMP_SCHEMA_SCOPE_LIST		0
#define DUMP_SCHEMA_ALL_OFFSET		0

#else // Debug

#define ENABLE_CONSOLE_DEBUG		1
#define ENABLE_CPP_EH_EXCEPTION		1

#define LOG_SDK						1
#define LOG_SDK_PATTERN				0

#define ENABLE_XOR_STR				0
#define ENABLE_XOR_VMP_STR			0

#define DUMP_SCHEMA_SCOPE_LIST		0
#define DUMP_SCHEMA_ALL_OFFSET		0

#endif // RELEASE_BUILD
