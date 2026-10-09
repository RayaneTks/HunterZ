# Outillage Hunt — provenance et état

## Sources officielles utilisées

| Outil | Source | Révision lue | Usage effectué |
|---|---|---|---|
| Ponytail | https://github.com/DietrichGebert/ponytail | `9cc65d03aa2da1db7121b912d03596409ee340b8` | Skill principal et audit lus ; réemploi de stack, pas de store/framework gratuit, défauts avec preuve |
| Addy Osmani Agent Skills | https://github.com/addyosmani/agent-skills | `1401c8b8030e023baeebb31781a6653fe8e93026` | Spec-driven, planning, frontend UI, code review, Definition of Done ; spec + tâches + checkpoints |
| Graphify | https://github.com/Graphify-Labs/graphify | `cf5978e4fb88bf4d86784346d36264e71d576802` | Runtime 0.9.83 installé dans environnement isolé, extraction locale code/docs structurées/SQL, clustering, graphe et diagnostic |
| OmniRoute | https://github.com/diegosouzapw/OmniRoute | `2591176f2d6a91b6049d2abb3ce6a323fd6b0497` | Skills CLI health/serve/setup/inference lus, runtime npm 3.8.51 installé séparément, serveur local démarré et HTTP vérifié |

Sources copiées dans `.hunt-tools/` à la racine du workspace ChatGPT, hors dépôt de l'application. Ces skills sont lus et appliqués dans cette session ; ce n'est pas une installation globale de tous les skills dans Codex. Graphify a rafraîchi automatiquement sa copie Claude préexistante 0.9.73 → 0.9.83, en conservant `SKILL.md.bak` ; commandes suivantes lancées avec `GRAPHIFY_NO_AUTO_REFRESH=1`.

## Résultats Graphify

`graphify-out/graph.html`, `graphify-out/graph.json`, `graphify-out/GRAPH_REPORT.md` dans dépôt Hunt. 483 nœuds, 708 relations brutes, 660 liens regroupés, 35 communautés. `Home()` a 36 liens ; `requireClient()` 13 ; `getRoom()` 9. Pas de cycle d'imports détecté.

Limites : trois fichiers Gradle avec erreur de parsing ; cinq fichiers sans symbole ; 2 self-loops et 48 relations de même paire fusionnées par graphe simple (ex. contains/calls). Aucun endpoint manquant ou pendant. 31 relations inférées : vérifier la source avant décision. Noms de communautés automatiques génériques, pas classification métier vérifiée. Aucun appel LLM externe pour extraction.

Relations utiles vérifiées : `Home()` → `useGeolocation()`, `loadLobby()`, `create/join`, `getRoom()`, `saveHuntZone()`, `closeRoom()/leaveRoom()` ; préserver ces contrats pendant extraction des écrans. Les liens documentaires vers freshness et lifecycle sont inférés, confirmés par lecture de leurs fichiers dans audit.

## OmniRoute local

- Dashboard : http://127.0.0.1:20128
- API : http://127.0.0.1:20128/v1
- Vérification réelle : `/api/health` HTTP 200 et `/` HTTP 200 après initialisation.
- Bind vérifié : `127.0.0.1:20128`, accès local uniquement.
- Données isolées : `.hunt-tools/omniroute-data/` ; clés générées stockées localement, jamais copiées dans dépôt Hunt ni affichées.
- Lancement : `.hunt-tools/start-omniroute.ps1` depuis workspace ChatGPT.
- Fournisseur connecté : aucun. Aucun prompt de conception/code envoyé via OmniRoute. Connecter fournisseur depuis dashboard puis vérifier réponse effective avant revendiquer usage de modèle via gateway.
- Pas de modification de configuration globale Codex, pas d'autostart ni tunnel public.

`doctor --no-liveness` a rapporté 6 OK, 43 avertissements, 0 échec avant premier lancement. L'avertissement de binaire SQLite et tentative de rebuild Windows n'ont pas constitué preuve de panne : compilation échouait faute Visual Studio, mais serveur a ensuite chargé son binaire distribué, initialisé SQLite et répondu HTTP 200. Aucune installation de compilateur système faite. Première health a expiré pendant warmup ; nouvelle requête directe après initialisation a passé.

OmniRoute reste outillage de développement. HUNT doit fonctionner sans gateway, compte IA ou clé fournisseur. Réservation d'usage : relecture/variantes de conception sur corpus public ou explicitement autorisé, pas positions ni tokens joueurs.

## Apple Design ajouté au cadrage

Skill officiel Emil Kowalski : https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md . Copie de référence dans `.hunt-tools/apple-design/SKILL.md`, identique au skill local déjà disponible (SHA256 `77BB63B7043BB93ACA2FF4AB040C249484EEF35682BB6FF7163433C31D30ADC7`). Aucune nouvelle installation globale nécessaire.

Application : retour visuel dès pression, action au relâchement valide, drag de feuille 1:1 et interruptible, chemins spatiaux cohérents, sobriété de matières, typo adaptative, retours utiles, reduced motion/transparency/contrast. Spec et T2/T4/T14 affinés. Prototype interactif et vérification appareils prévus à réalisation ; aucun comportement produit modifié pendant cadrage.
