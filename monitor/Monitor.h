#pragma once

#ifdef MONITOR_EXPORTS
#define MONITOR_API __declspec(dllexport)
#else
#define MONITOR_API __declspec(dllimport)
#endif

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Démarre le thread de monitoring / heartbeat en arrière-plan.
 */
MONITOR_API void StartMonitoring();

/**
 * Arrête proprement le thread de monitoring et libère les ressources réseau.
 */
MONITOR_API void StopMonitoring();

/**
 * Fonction exécutable directement (bloquante si appelée hors thread).
 */
MONITOR_API void RunHeartbeat();

#ifdef __cplusplus
}
#endif
