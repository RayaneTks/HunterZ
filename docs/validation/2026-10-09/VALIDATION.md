# HUNT — validation de refonte, 9 octobre 2026

## État livré

Refonte locale sur `codex/hunt-mobile-redesign`, base `c8fa9141367c5a4c8ae36a0eba529800a2b4e3dd`, implémentation principale `da110004bccc92732034287a735433f144935188`, suivie du commit de corrections de revue portant ce rapport. Rien publié ; migration Supabase distante non appliquée. Sources du projet ChatGPT inchangées.

Logo conservé. Direction radar urbain ludique. Accueil, salon, briefing, carte de manche, pause, capture, extraction, résultat et revanche réalisés. GPS consenti, positions privées selon rôle, serveur autoritaire. PWA : installation guidée, shell hors ligne, mise à jour volontaire coordonnée entre onglets.

## Preuves finales

| Contrôle | Résultat | Portée |
|---|---|---|
| `npm test` | 41/41 | Node et PostgreSQL PGlite, règles, projections RLS, installation, contrats existants |
| `npm run typecheck` | Réussi | TypeScript |
| `npm run build` | Réussi | Next.js 15.5.27, export statique ; 194 kB First Load JS |
| `npx playwright test` | 11/11 | Chromium ; entrée, consentement GPS, salon à deux, manche à quatre et revanche |
| `npx playwright test --config playwright.production.config.ts` | 11/11 | Export production local ; six formats, cache, hors ligne, installation initiale, update multi-onglets |
| `node scripts/check-postgres-concurrency.cjs` | 2/2 | PostgreSQL natif 18.4, connexions séparées, arrivée/départ concurrents avec création non validée |
| `git diff --check` | Réussi | Aucun défaut de patch |

Captures : [320](entry-320.png), [390](entry-390.png), [430](entry-430.png), [768](entry-768.png), [1440](entry-1440.png), [paysage 844](entry-844.png). Inspectées visuellement. Écrans de jeu supplémentaires : [salon](lobby.png), [briefing](briefing.png), [manche](match.png), [résultat](result.png). Fond de carte réseau remplacé par un style vide dans ces captures de test ; disposition et états visibles, pas cartographie terrain certifiée. Tests de corps à 200 % sans débordement horizontal sur 320/390/844 ; action principale de 48 px ; entrée disponible même stockage bloqué. Cela ne certifie pas tous les écrans avec lecteurs d’écran ni clavier virtuel réel.

Performance observée, une exécution Chromium localhost sans ralentissement réseau : LCP 188 ms, CLS 0, durées d’événements mesurées 24 ms. Mesure synthétique de l’accueil, pas INP terrain ni résultat sur téléphone. Auth/REST interceptés dans ces tests pour éviter toute écriture distante.

Le parcours à quatre navigateurs exécute les RPC réels sur PostgreSQL PGlite avec identités et rôles SQL distincts derrière des routes PostgREST interceptées. Ce n’est pas une certification du transport Auth/Realtime Supabase réel. Capture et revanche couvertes en navigateur ; extraction et temps écoulé couverts côté SQL.

## Revue indépendante et corrections

Une revue distincte de l’ensemble de la branche a relevé quatre défauts importants. Aucun défaut critique ou mineur rapporté. Une passe de correction, tests de régression puis suites finales ; pas de seconde revue indépendante. Audit visuel complémentaire : couleurs des couches cartographiques conservées, annonce de nouveautés masquée pendant briefing/manche, présence du canvas vérifiée avant capture.

| Défaut reproduit | Correction | Preuve |
|---|---|---|
| Action retardée de l’ancienne manche appliquée à la nouvelle | Identifiant de manche attendu obligatoire hors création ; reçu idempotent lié au contenu | Rejet SQL avant changement d’état ; tests Node |
| Signal GPS imprécis maintenait l’horloge active | Dernier signal admissible stocké séparément ; délai de pause basé dessus, avant timeout | Signal précision 100 m et lecture tardive : RED → GREEN |
| Arrivée/départ pendant création non validée contournait roster figé | Verrou de salon avant vérification et mutation du roster | PostgreSQL natif : deux échecs reproduits, deux passages après correction |
| Revanche réutilisait ancien roster figé | Préparation reçoit membres actuels ; historique du résultat conservé séparément | Quatrième joueur parti : 3/4–10, préparation désactivée, parcours navigateur |

Contrôle de revue : aucune autre fuite directe GPS établie via politiques SQL, helper privé ou anciennes écritures. Résultats et transitions restent côté serveur. Realtime distant, lifecycle natif, reprise PWA sur appareils réels, clavier virtuel et lecteurs d’écran non certifiés. Ces limites sont des gates externes explicites, pas des tests considérés réussis.

## Décisions et coûts

- Dépôt imbriqué non reconnu par outil natif : worktree Git local isolé. Coût : gestion manuelle du checkout ; original conservé.
- Scripts de plan Unix remplacés par journal et commandes Windows. Coût : équivalence documentée, pas scripts Unix exécutés.
- T8–T13 regroupées dans migration atomique et RPC d’action validée. Coût : migration plus concentrée ; évite états intermédiaires où GPS cible serait public.
- Changement d’escouade annule la manche. Coût : nouveau briefing complet et consentements.
- Extraction choisie explicitement au centre du terrain. Coût : pas de second point arbitraire.
- Feuille contrôlée par boutons accessibles. Coût : geste de glissement optionnel non livré.
- Pas de publication distante ni de validation terrain présumée. Coût : mise en ligne après migration et essais externes.

## Outillage demandé

Ponytail : réemploi, audit par preuves, suppression des écrans d’idées devenus obsolètes. Addy Osmani : spec, découpage, revue correction/simplicité/accessibilité/performance/sécurité. Apple Design : surfaces opaques, cibles tactiles, modales natives, zoom, mouvement réduit ; aucun geste obligatoire.

Graphify réellement exécuté : extraction finale 662 nœuds / 1018 relations, contre 483/708 au départ ; trois limites de parse Gradle inchangées. Aucune génération LLM nécessaire.

OmniRoute 3.8.51 préparé hors app, `127.0.0.1:20128`, dashboard et health HTTP 200 au contrôle. Aucun fournisseur connecté, aucune inférence exécutée, aucune donnée GPS envoyée. L’app n’en dépend pas. Versions et sources dans [tooling](../../audits/2026-10-09-mobile/tooling.md).

## Gates avant publication

1. Appliquer migration dans Supabase de test isolé, contrôler Auth/REST/Realtime et anciens clients.
2. Installer réellement sur iPhone/Safari, Android/Chrome et desktop visés.
3. Jouer à quatre téléphones : soleil, GPS faible, refus/reprise, écran verrouillé, arrêt/retour réseau, lecteur d’écran et clavier.
4. Vérifier preview HTTPS et notes de release servies ; autoriser publication ensuite.

[Guide migration, publication et retour arrière](../../work/2026-10-mobile-release.md). Journal de réalisation : [tasks/progress.md](../../../tasks/progress.md).
