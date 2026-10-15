#include "Monitor.h"
#include <windows.h>
#include <winhttp.h>
#include <iostream>
#include <fstream>
#include <string>
#include <chrono>
#include <thread>
#include <atomic>
#include <filesystem>

#pragma comment(lib, "winhttp.lib")

// Contrôle du cycle de vie du thread
static std::atomic<bool> g_IsRunning(false);
static HANDLE g_WorkerThread = NULL;

// Configuration du serveur
constexpr wchar_t TARGET_SERVER[] = L"localhost";
constexpr INTERNET_PORT TARGET_PORT = 3000;
constexpr wchar_t TARGET_PATH[] = L"/api/heartbeat";
constexpr char LOG_PATH[] = "C:\\temp\\monitor_log.txt";
constexpr int INTERVAL_SECONDS = 30;

/**
 * Écrit un message horodaté dans le fichier journal local.
 */
void WriteLog(const std::string& message) {
    try {
        std::filesystem::create_directories("C:\\temp");
        std::ofstream logFile(LOG_PATH, std::ios::app);
        if (logFile.is_open()) {
            auto now = std::chrono::system_clock::now();
            auto in_time_t = std::chrono::system_clock::to_time_t(now);
            
            char timeBuffer[26];
            ctime_s(timeBuffer, sizeof(timeBuffer), &in_time_t);
            timeBuffer[24] = '\0'; // Supprime le saut de ligne généré par ctime

            logFile << "[" << timeBuffer << "] " << message << std::endl;
        }
    } catch (...) {
        // Gestion silencieuse des erreurs d'E/S fichier
    }
}

/**
 * Effectue une requête HTTP GET via l'API native WinHTTP.
 */
std::string SendHeartbeatRequest() {
    std::string responseData;

    // 1. Initialisation de la session WinHTTP
    HINTERNET hSession = WinHttpOpen(
        L"SystemPerformanceMonitor/1.0",
        WINHTTP_ACCESS_TYPE_DEFAULT_PROXY,
        WINHTTP_NO_PROXY_NAME,
        WINHTTP_NO_PROXY_BYPASS,
        0
    );

    if (!hSession) {
        WriteLog("Erreur: WinHttpOpen a échoué (Code: " + std::to_string(GetLastError()) + ")");
        return "";
    }

    // 2. Connexion au serveur cible
    HINTERNET hConnect = WinHttpConnect(hSession, TARGET_SERVER, TARGET_PORT, 0);
    if (!hConnect) {
        WriteLog("Erreur: WinHttpConnect a échoué (Code: " + std::to_string(GetLastError()) + ")");
        WinHttpCloseHandle(hSession);
        return "";
    }

    // 3. Création de la requête HTTP
    HINTERNET hRequest = WinHttpOpenRequest(
        hConnect,
        L"GET",
        TARGET_PATH,
        NULL,
        WINHTTP_NO_REFERRER,
        WINHTTP_DEFAULT_ACCEPT_TYPES,
        0 // Utiliser WINHTTP_FLAG_SECURE si HTTPS
    );

    if (!hRequest) {
        WriteLog("Erreur: WinHttpOpenRequest a échoué (Code: " + std::to_string(GetLastError()) + ")");
        WinHttpCloseHandle(hConnect);
        WinHttpCloseHandle(hSession);
        return "";
    }

    // 4. Envoi de la requête
    BOOL bResults = WinHttpSendRequest(
        hRequest,
        WINHTTP_NO_ADDITIONAL_HEADERS,
        0,
        WINHTTP_NO_REQUEST_DATA,
        0,
        0,
        0
    );

    // 5. Réception de la réponse
    if (bResults) {
        bResults = WinHttpReceiveResponse(hRequest, NULL);
    }

    if (bResults) {
        DWORD dwSize = 0;
        DWORD dwDownloaded = 0;

        // Lecture des données retournées
        do {
            dwSize = 0;
            if (!WinHttpQueryDataAvailable(hRequest, &dwSize)) {
                break;
            }

            if (dwSize == 0) {
                break;
            }

            char* buffer = new char[dwSize + 1];
            ZeroMemory(buffer, dwSize + 1);

            if (WinHttpReadData(hRequest, (LPVOID)buffer, dwSize, &dwDownloaded)) {
                responseData.append(buffer, dwDownloaded);
            }

            delete[] buffer;
        } while (dwSize > 0);
    } else {
        WriteLog("Erreur: Échec de l'envoi ou de la réception HTTP (Code: " + std::to_string(GetLastError()) + ")");
    }

    // Nettoyage des handles WinHTTP
    WinHttpCloseHandle(hRequest);
    WinHttpCloseHandle(hConnect);
    WinHttpCloseHandle(hSession);

    return responseData;
}

/**
 * Boucle d'exécution du heartbeat.
 */
void RunHeartbeat() {
    WriteLog("Démarrage de la boucle de monitoring.");

    while (g_IsRunning.load()) {
        std::string response = SendHeartbeatRequest();
        
        if (!response.empty()) {
            WriteLog("Réponse serveur : " + response);
        }

        // Attente périodique découpée pour permettre une interruption rapide
        for (int i = 0; i < INTERVAL_SECONDS && g_IsRunning.load(); ++i) {
            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
    }

    WriteLog("Arrêt de la boucle de monitoring.");
}

DWORD WINAPI WorkerThreadProc(LPVOID lpParam) {
    RunHeartbeat();
    return 0;
}

void StartMonitoring() {
    if (!g_IsRunning.exchange(true)) {
        g_WorkerThread = CreateThread(
            NULL,
            0,
            WorkerThreadProc,
            NULL,
            0,
            NULL
        );
    }
}

void StopMonitoring() {
    if (g_IsRunning.exchange(false)) {
        if (g_WorkerThread != NULL) {
            WaitForSingleObject(g_WorkerThread, 5000);
            CloseHandle(g_WorkerThread);
            g_WorkerThread = NULL;
        }
    }
}

// ==========================================
// Point d'entrée de la bibliothèque dynamique
// ==========================================
BOOL WINAPI DllMain(HINSTANCE hinstDLL, DWORD fdwReason, LPVOID lpReserved) {
    switch (fdwReason) {
    case DLL_PROCESS_ATTACH:
        DisableThreadLibraryCalls(hinstDLL);
        WriteLog("DLL attachée au processus hôte.");
        break;

    case DLL_PROCESS_DETACH:
        StopMonitoring();
        WriteLog("DLL détachée du processus hôte.");
        break;
    }
    return TRUE;
}
