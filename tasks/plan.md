# HUNT Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. User requested planning first; do not treat this document as proof of implemented functionality.

**Suivi réel :** [todo.md](todo.md), [progress.md](progress.md) et [validation](../docs/validation/2026-10-09/VALIDATION.md). Les étapes ci-dessous conservent le plan initial ; les écarts sont consignés dans ces rapports.

**Goal:** Transformer HUNT en expérience mobile distinctive, installable, puis en jeu La Piste complet et vérifiable.

**Architecture:** Réutiliser salon et lifecycle GPS existants. Extraire écrans sans changer contrats actuels, ajouter PWA légère, puis machine de match autoritaire Supabase avec stockage de positions privé par rôle. Chaque tâche produit une tranche vérifiable, jamais un ensemble de faux écrans de jeu.

**Tech Stack:** Next.js 15.5.27, React 19, TypeScript, CSS, Supabase, MapLibre, Lucide, Capacitor existants ; Playwright et Node tests. Pas de dépendance produit ajoutée par défaut.

**Spec:** `docs/superpowers/specs/2026-10-09-hunt-mobile-redesign.md`

## Global Constraints

- Logo existant conservé, sans altération de silhouette.
- Corps 16 px, opérationnel ≥14 px, secondaire ≥12 px, titres 28–40 px.
- Contrôles principaux 48×48 px minimum ; autres 44×44 px minimum.
- Contraste cible : 4,5:1 texte courant, 3:1 grand texte et contrôles utiles.
- Mobile : 320×568, 390×844, 430×932 ; tablette 768×1024 ; desktop 1440×900 ; paysage 844×390.
- GPS admissible pour départ/actions : mesure reçue depuis ≤45 s, accuracy ≤30 m, coordonnées valides.
- 4–10 joueurs, 1 cible volontaire choisie par hôte, autres chasseurs ; consentement et confirmation de chaque joueur.
- Mise à jour signalée discrètement ; appliquer volontairement hors manche.
- Pas de suivi GPS fiable écran verrouillé promis en PWA.
- Aucun abonnement IA nécessaire pour jouer.
- Sources ChatGPT read-only ; aucun push ou déploiement réalisé pendant étape plan.

## Review Focus

1. Nouveau joueur avec version Vercel et stockage bloqué : entrée toujours cliquable (T1).
2. Clavier ouvert, zoom 200 %, paysage : action primaire et sortie restent atteignables (T2–T4).
3. Invitation dans webview/iPadOS desktop : rejoindre reste possible, installation donne aide honnête (T3, T5).
4. Ancien client + REST direct + Realtime : rôle cible ne fuit pas ses coordonnées (T8–T9).
5. Requêtes rejouées/concurrentes, horloge client fausse, retour réseau : une seule transition/fin serveur (T10–T13).

## Dépendances et jalons

`T1 → T2 → T3 → T4 → [jalon mobile] → T5 → T6 → T7 → [jalon PWA] → T8 → T9 → T10 → T11 → T12 → T13 → [jalon jeu] → T14`.

Dépendances supplémentaires : T6 consomme release de T1 ; T11 consomme positions de T9 et clock de T10 ; T13 dépend de tous contrats serveur. Édits sur `app/page.tsx`, CSS global, schéma, hooks GPS et dépendances séquentiels. Méthode proposée : réalisation native dans session, relecture indépendante au jalon qualité selon gouvernance du dépôt.

## Capacité mobile-experience

### T1 — Entrée sans interruption

**Files (3):** `components/ReleaseNotes.tsx`, `tests/e2e/private-lobby.spec.ts`, `tests/e2e/release-entry.spec.ts` (nouveau).
**Interfaces:** garder export `ReleaseNotes()` ; le panneau s'ouvre uniquement sur action utilisateur. Détection nouvelle version ne modifie pas le parcours.
**Dépendances:** aucune. **Taille:** M.

- [ ] Écrire scénario première visite avec release Vercel inconnue : pseudo puis entrée sans fermer dialogue ; même scénario si localStorage jette une erreur ; vérifier invitation non masquée.
- [ ] Exécuter `npx playwright test tests/e2e/release-entry.spec.ts` ; constater échec sur backdrop actuel.
- [ ] Retirer ouverture automatique, préserver consultation volontaire et retour de focus ; aucune obligation de lire journal avant jouer.
- [ ] Exécuter scénario ciblé puis E2E lobby existant ; s'il existe second échec, diagnostiquer avant changer fixture. Commit limité à T1.

**Acceptation:** entrée première visite cliquable ; nouveautés réouvrables ; aucune invitation bloquée.

### T2 — Système visuel et lisibilité

**Files (4):** `app/globals.css`, `app/layout.tsx`, `components/Brand.tsx` (nouveau), `tests/e2e/mobile-layout.spec.ts` (nouveau).
**Interfaces:** `Brand({compact?: boolean})` fournit logo actuel ; variables CSS sémantiques pour fond, texte, action, état. Palette et échelle exactes dans spec.
**Dépendances:** T1. **Taille:** M.

- [ ] Écrire assertions layout pour 320×568/paysage, taille de texte 200 %, absence de scroll horizontal et actions touchables.
- [ ] Vérifier échec sur zoom verrouillé/tailles opérationnelles actuelles ; relever contrastes avant modifications.
- [ ] Appliquer tokens et hiérarchie, autoriser zoom de page ; préserver gestes carte dans conteneur ; extraire logo sans modifier silhouette.
- [ ] Valider contrôles, contraste mesuré, réduit mouvement, clavier/focus ; `npm run typecheck`, tests ciblés, build. Commit T2.

**Acceptation:** contrôles respectent tailles ; contenu zoomable ; palette cohérente, tracking et interligne adaptés aux tailles.

### T3 — Accueil orienté jeu

**Files (4):** `components/HomeScreen.tsx` (nouveau), `app/page.tsx`, `tests/e2e/home-flow.spec.ts` (nouveau), `tests/e2e/private-lobby.spec.ts`.
**Interfaces:** `HomeScreen` reçoit identité, actions create/join et états busy/error existants ; garder `createRoom`, `joinRoom`, `restoreActiveRoom` et storage actuels. `/?action=create`, `/?action=join` et invitation restent supportés.
**Dépendances:** T2. **Taille:** M.

- [ ] Tester pseudo 2–24 caractères, invitation entrante, code erroné puis corrigé, retour/reprise après reload ; aucune fausse statistique.
- [ ] Exécuter tests et confirmer échec des attentes du nouveau parcours avant refonte.
- [ ] Remplacer page marketing par entrée et accueil décrits dans spec ; motif radar léger en CSS/SVG local ; CTA créer dominant, rejoindre secondaire.
- [ ] Tester création/jonction réelles simulées à deux clients, persistance indisponible, clavier ouvert ; commit T3 après validations.

**Acceptation:** rôle de chaque écran immédiat ; invitation mène au salon ; erreur corrigible sans perdre pseudo/code.

### T4 — Salon lisible et carte prioritaire

**Files (6):** `hooks/use-sheet-gesture.ts` (nouveau, uniquement si prototype gestuel retenu), `components/LobbyScreen.tsx` (nouveau), `app/page.tsx`, `app/globals.css`, `components/MapView.tsx`, `tests/e2e/lobby-layout.spec.ts` (nouveau).
**Interfaces:** garder props actuelles de MapView et API terrain ; `useSheetGesture({snapPoints, reducedMotion, onSnap})` fournit position visible et handlers pointerdown/move/up/cancel si besoin confirmé. Contrat complet dans section Apple Design de spec ; écran compose feuille `compact | intermediate | expanded`, callbacks GPS et room sans store global.
**Dépendances:** T3. **Taille:** M.

- [ ] Prototyper et tester feuille interactive avant figer pixels : drag lent/flick, inversion pendant animation, pointercancel, séparation carte/liste, activation annulée hors bouton et alternatives clavier. Puis tester carte visible en compact, ouvrabilité par bouton, états GPS refusé/ancien/off, membre sélectionné puis revenir à soi, annulation du centre ; alternatives sans geste.
- [ ] Exécuter scénario ciblé et comparer aux contraintes de spec.
- [ ] Extraire salon, organiser résumé/escouade/préparation, réduire compact ≤25 % hauteur à texte normal ; concepts secondaires ; attribution toujours visible ; saisie de centre accessible.
- [ ] Vérifier consentement avant prompt OS, stop/leave/close et ancienne position jamais live ; captures toutes tailles ; revue animation au ralenti, surfaces solides en reduced transparency/contrast, état statique en reduced motion ; commit T4.

**Acceptation:** carte priorité ; aucun geste obligatoire ; setup terrain conserve fonctionnement actuel.

**Checkpoint mobile:** T1–T4 validées + revue visuelle et accessibilité ; publier seulement comme refonte salon, sans prétendre mode La Piste jouable.

## Capacité pwa-installation

### T5 — Installer selon appareil

**Files (5):** `components/InstallPrompt.tsx`, `lib/pwa-install.js`, `lib/pwa-install.d.ts`, `tests/pwa-install.test.cjs`, `tests/e2e/pwa-install.spec.ts` (nouveau).
**Interfaces:** ajouter `getInstallHelp({userAgent, maxTouchPoints, standalone, hasPrompt})` avec discriminant `installed | prompt | ios-help | browser-help | webview-help`. Garder helpers existants.
**Dépendances:** T4. **Taille:** M.

- [ ] Tester iPhone, iPadOS UA Mac avec touchpoints, Chromium avec prompt et sans prompt, webview, standalone, refus et `appinstalled`.
- [ ] Constater échec des cas actuels puis implémenter détection capacité et aide réouvrable via réglages existants.
- [ ] Tester prompt natif uniquement quand disponible ; help sans faux bouton « installation réussie » ; jouer demeure accessible après refus.
- [ ] `npm test`, E2E ciblé et contrôle iOS/Android physique au jalon T14 ; commit T5.

**Acceptation:** aide accessible partout ; succès/refus cohérents ; invitation jamais perdue.

### T6 — Démarrage hors ligne et mise à jour sûre

**Files (5):** `public/sw.js` (nouveau), `components/PwaLifecycle.tsx` (nouveau), `app/layout.tsx`, `components/ReleaseNotes.tsx`, `tests/e2e/pwa-offline.spec.ts` (nouveau).
**Interfaces:** registration `/sw.js` ; message SW `{type:'APPLY_UPDATE'}` uniquement sur choix utilisateur hors match ; attente de nouveau worker signalée sans rechargement automatique. Consommer état manche via interface lecture minimale après T10.
**Dépendances:** T1, T5. **Taille:** M.

- [ ] Sur export production servi HTTP local, tester visite puis coupure réseau ; shell visible, actions réseau désactivées/retry, aucun cache de données joueurs ; simuler upgrade durant session.
- [ ] Confirmer échec sans SW puis écrire cache versionné du shell public, fallback HTML et réseau/no-store pour release.
- [ ] Vérifier caches ne contiennent aucun JWT/profil/position/REST Supabase ; supprimer caches de versions anciennes à activation validée ; carte hors ligne annoncée indisponible si tuiles manquent.
- [ ] E2E avec `serviceWorkers: 'allow'`, reload offline, retour réseau ; pas worker artificiellement bloqué par fixture. Commit T6.

**Acceptation:** démarrage hors ligne après visite initiale ; zéro donnée privée en cache ; mise à jour volontaire.

### T7 — Identité installée et mesure production

**Files (5):** `public/manifest.webmanifest`, `public/icon-maskable-512.png` (nouveau), `public/screenshots/hunt-mobile.png` (nouveau), `public/screenshots/hunt-wide.png` (nouveau), `tests/e2e/pwa-manifest.spec.ts` (nouveau).
**Interfaces:** manifeste `id: /`, icônes any/maskable distinctes, screenshots issus de vrai écran. Icône maskable respecte safe zone et logo original.
**Dépendances:** T6. **Taille:** M.

- [ ] Tester propriétés manifeste, URLs d'assets et rendu sans découpe de logo.
- [ ] Produire assets à partir du logo source et captures effectives T4 ; aucun screenshot fictif.
- [ ] Build et contrôle Lighthouse/browser production : LCP≤2,5 s, CLS≤0,1, INP≤200 ms selon scénario documenté ; stocker résultat et conditions dans audit.
- [ ] Installation réelle iOS/Android/desktop prévue T14 ; commit assets seulement après vérification visuelle.

**Acceptation:** nom/logo cohérents ; assets valides ; budgets mesurés, pas déduits du build.

**Checkpoint PWA:** scénarios install et offline passent ; aucune mise à jour interrompant jeu ; statut appareils physiques distinct.

## Capacité la-piste

### T8 — Briefing privé et contrat serveur

**Files (5):** `supabase/migrations/20261009210000_match_preparation.sql` (nouveau), `supabase/schema.sql`, `lib/match.ts` (nouveau), `components/MatchBriefing.tsx` (nouveau), `tests/integration/match-preparation.test.cjs` (nouveau).
**Interfaces:** `createMatch(roomId: string, targetId: string): Promise<MatchSnapshot>`, `getMatch(matchId: string): Promise<MatchSnapshot>` ; `MatchSnapshot` définit id, roomId, revision, state, role, roster, terrain, serverNow, elapsedSeconds, remainingSeconds ; aucun champ de position cible publique. Types exportés depuis `lib/match.ts` et enrichis seulement au lot responsable.
**Dépendances:** T4. **Taille:** M.

- [ ] Préparer Supabase isolé (configuration CLI hors dépôt si nécessaire), appliquer migrations puis tests réels : non-membre refusé, non-hôte refusé, 3/11 joueurs refusés, 4/10 acceptés, cible proposée puis confirmation volontaire obligatoire avant start ; terrain figé.
- [ ] Ajouter état preparing/briefing, roster et choix rôle transactionnels ; briefing accessible derrière mode réellement disponible côté serveur.
- [ ] Réduire lecture publique de positions dès briefing ; DELETE positions publiques atomique ; anciens clients ne peuvent réinsérer ni lire données de match via table historique. Dans T8, publication match refusée explicitement tant que stockage T9 absent ; feature reste réservée aux tests, lobby hors match conservé.
- [ ] Vérifier RLS avec JWT hôte/cible/chasseur/intrus, REST direct et Realtime ; tests statiques de texte SQL ne comptent pas comme preuve. Commit T8.

**Acceptation:** briefing cohérent ; aucun match illégal ; zéro coordonnée cible accessible hors rôle.

### T9 — GPS de match par rôle

**Files (5):** `supabase/migrations/20261009210100_match_positions.sql` (nouveau), `supabase/schema.sql`, `hooks/use-geolocation.ts`, `lib/match.ts`, `tests/integration/match-privacy.test.cjs` (nouveau).
**Interfaces:** conserver RPC `publish_location` et signature publique actuelle ; routage serveur lobby/match. `getMatch` fournit positions visibles autorisées et aucun raw payload secret ; stop_sharing/leave/close purgent stockage de match.
**Dépendances:** T8. **Taille:** M.

- [ ] Tester lecture directe/Realtime : chasseur voit chasseurs, cible voit seulement soi ; intrus rien ; anciens INSERT/UPDATE de public.positions refusés pendant match.
- [ ] Ajouter table privée `match_positions`, policies de rôle, publication contrôlée, suppression via stop/leave/close ; préserver ordre et invalidation lifecycle existants.
- [ ] Tester expiration 45 s, accuracy 30 m, faux timestamps, changement salon et requête en cours au stop ; aucune position privée dans caches/logs.
- [ ] Tests intégration réels + unitaires GPS + E2E lobby ; commit T9.

**Acceptation:** visibilité serveur correcte ; stop réel ; ancien client ne contourne pas nouveaux contrats.

### T10 — Départ, pause et horloge

**Files (5):** `supabase/migrations/20261009210200_match_transitions.sql` (nouveau), `supabase/schema.sql`, `lib/match.ts`, `components/MatchBriefing.tsx`, `tests/integration/match-transitions.test.cjs` (nouveau).
**Interfaces:** `setReady(matchId: string, ready: boolean, actionId: string): Promise<MatchSnapshot>` ; `transitionMatch(matchId: string, action: 'start'|'pause'|'resume'|'cancel', actionId: string): Promise<MatchSnapshot>`.
**Dépendances:** T9. **Taille:** M.

- [ ] Tester confirmations de tous, GPS admissible, compte à rebours d'avance 30 s inclus dans 900 s, pause n'écoulant pas temps, requêtes répétées et horloge téléphone falsifiée.
- [ ] RPC transactionnelles verrouillent match, enregistrent actionId unique et revision monotone ; `getMatch` évalue échéances et signal avant retourner snapshot ; clients demandent snapshot chaque 5 s en foreground et après reprise.
- [ ] Stop GPS/perte signal cible de 90 s mène pause technique ; arrivée/départ après briefing suspend et nécessite nouvelle préparation ; propriétaire parti annule.
- [ ] Démontrer même état sur 4 clients après réseau interrompu, délai serveur et double clic ; commit T10.

**Acceptation:** temps et transitions serveur ; aucune avancée locale arbitraire ; reprise fiable.

### T11 — Carte de manche et indices

**Files (6):** `supabase/migrations/20261009210300_match_clues.sql` (nouveau), `supabase/schema.sql`, `lib/match.ts`, `components/MatchScreen.tsx` (nouveau), `components/MapView.tsx`, `tests/integration/match-clues.test.cjs` (nouveau).
**Interfaces:** `MatchSnapshot` ajoute clue grossier `{cells, generatedAt, ageBucket}` et objectif visible selon rôle. MapView accepte couche polygone sans coordonnée source privée. Cellules grille 200 m, origine terrain fixe.
**Dépendances:** T10. **Taille:** M.

- [ ] Tester cadence 90 s après avance, cellule aux frontières et avec incertitude, absence de nouvel indice si GPS expiré ; payloads jamais coordonnée exacte ou row privée.
- [ ] Produire indice côté serveur sur même grille et filtrer snapshot ; HUD temps/objectif/GPS sans éléments marketing ; aucune animation continue en reduced motion.
- [ ] Vérifier API et réseau avec JWT distincts ; captures deux rôles, texte 200 %, liste accessible hors carte.
- [ ] Intégration réelle, types, E2E role views ; commit T11.

**Acceptation:** indices jouables et grossiers ; HUD lisible ; confidentialité démontrée.

### T12 — Une fin de manche réelle

**Files (6):** `supabase/migrations/20261009210400_match_finish.sql` (nouveau), `supabase/schema.sql`, `lib/match.ts`, `components/MatchScreen.tsx`, `components/MatchResult.tsx` (nouveau), `tests/integration/match-finish.test.cjs` (nouveau).
**Interfaces:** `requestCapture(matchId: string, actionId: string): Promise<MatchSnapshot>` ; `confirmCapture(matchId: string, requestId: string, actionId: string): Promise<MatchSnapshot>` ; `requestExtraction(matchId: string, actionId: string): Promise<MatchSnapshot>` ; result `{winner:'target'|'hunters', reason:'extraction'|'interception'|'timeout', durationSeconds}`.
**Dépendances:** T11. **Taille:** M.

- [ ] Tester capture double consentement en 30 s, extraction après 600 s avec 2 fixes espacés de 5 s et distance+accuracy≤50 m ; mauvais rôle/données périmées refusés.
- [ ] Tester extraction/capture/timeout simultanés : première transaction valide gagne une seule fois ; seuils 599/600/899/900 s selon horloge serveur.
- [ ] Ajouter fin/récap, purger positions/indices dans transaction ; résultat sans coordonnées ; action « Rejouer » via contrat T13.
- [ ] Parcours réels des trois issues + lecture directe après purge ; commit T12.

**Acceptation:** issue calculée réellement ; résultat unique ; données GPS supprimées.

### T13 — Revanche et session complète

**Files (6):** `supabase/migrations/20261009210500_match_rematch.sql` (nouveau), `supabase/schema.sql`, `lib/match.ts`, `components/MatchResult.tsx`, `app/page.tsx`, `tests/e2e/la-piste.spec.ts` (nouveau).
**Interfaces:** `rematch(roomId: string, targetId: string, actionId: string): Promise<MatchSnapshot>` ; nouveau match id et nouvelles confirmations. App choisit vue selon snapshot autoritaire, jamais state de rôle local libre.
**Dépendances:** T12. **Taille:** M.

- [ ] Quatre clients parcourent entrée → salon → briefing → départ → indice → fin → revanche ; choisir nouvelle cible volontaire.
- [ ] Même scénario avec offline/reconnect, annulation, hôte parti, rotation rôle et ancien snapshot reçu après nouveau ; revision empêche retour arrière.
- [ ] Brancher vues dans app et différer activation SW jusqu'à sortie ; inviter reste disponible hors manche ; mode indisponible si version serveur incompatible.
- [ ] Tests avec fixtures pour rapidité ET Supabase isolé réel pour contrats ; aucun « mock passe » présenté comme production validée. Commit T13.

**Acceptation:** boucle complète ; revanche remet consentements à zéro ; résultat/pause synchronisés.

**Checkpoint jeu:** trois issues démontrées à 4 clients, privacy prouvée, rapport de revue indépendant. Si fuite, temps divergent ou manche impossible : rejet et retour spec du lot concerné.

### T14 — Validation terrain et livraison

**Files (≤5):** `docs/audits/2026-10-09-mobile/VALIDATION.md` (nouveau), `README.md`, `.github/workflows/ci.yml`, `docs/product-direction.md`, `docs/work/2026-10-mobile-release.md` (nouveau).
**Dépendances:** T7, T13. **Taille:** M.

- [ ] Lancer séquentiellement `npm test`, `npm run typecheck`, `npx playwright test`, `npm run build`, `git diff --check` ; enregistrer commit et environnements exacts.
- [ ] Revue cinq axes Addy : conformité spec, correction, simplicité Ponytail, accessibilité/performance, sécurité. Chaque défaut a repro, sévérité, tâche propriétaire et preuve de correction.
- [ ] Essai installation iPhone/Android, partie à 4 appareils, soleil, clavier, zoom, VoiceOver/TalkBack, drag interrompu/inversé et défilement liste, transparence réduite/contraste fort, GPS faible, arrière-plan/reprise/stop. Si appareils indisponibles, laisser ces cases ouvertes et qualifier seulement navigateur.
- [ ] Preview vérifiée, migrations explicitement appliquées et RLS testées avant production ; rollback applicatif identifié, nouvelle partie désactivable sans supprimer données. Conserver endpoint GPS compatible avec ancien client.
- [ ] Notes destinées joueurs avec `Release-Title` et `Release-Note`, exigées par build production ; vérifier URL/version effectivement servies après déploiement autorisé. Aucun push forcé.

**Acceptation:** preuves au bon niveau ; zéro défaut critique ; rollback concret. Un build réussi seul n'autorise pas mention « jeu validé sur tous appareils ».

## Risques et réponses

- Position cible : contrat historique partagé ; T8/T9 avant HUD, tests REST/Realtime adversariaux.
- Géométrie terrain et GPS : paramètres calibrables, aucune zone déclarée sûre ; tests terrain T14.
- Export statique et SW : vérification sur artefact production, migrations réseau séparées, cache privé interdit.
- Extraction de Home : préserver lifecycle, signatures et erreurs ; E2E existants à chaque changement responsable.
- Validation téléphone : ne pas inventer preuves ; statut physique distinct de simulation.
- Outillage IA : OmniRoute hors runtime Hunt, clés locales seulement ; aucune dépendance à fournisseur pour jouer.

## Revue du plan

Auto-revue : chaque exigence de spec possède tâche, interfaces des tâches T8–T13 nommées, contraintes GPS et temporelles uniques, privacy traitée avant UI match, five failure modes affectés, tâches 3–6 fichiers (six lorsque migration et schéma canonique doivent rester synchronisés, ou quand prototype salon justifie hook gestuel focalisé) et checkpoints par capacité. Revue humaine de proposition reste à faire ; aucune tâche de réalisation cochée.

Questions opérationnelles au moment de livraison : disponibilité appareils physiques et environnement Supabase isolé ; fournisseur OmniRoute à connecter localement. Ces accès ne bloquent pas audit/plan actuel.



