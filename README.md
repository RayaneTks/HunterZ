# HUNT — Jeu de poursuite GPS en plein air

Application web mobile avec coque Capacitor pour organiser des parties en extérieur. La version actuelle propose des lobbies privés, des invitations par code ou lien et une carte des positions récentes des participants.

## Fonctionnalités

- Création et adhésion à un lobby privé.
- Invitations par lien ou code.
- Carte des membres et indication de la précision GPS.
- Partage de position activé explicitement et arrêté à la sortie.
- Gestion des positions périmées et fermeture du lobby.

## Technologies

Next.js 15 · React 19 · TypeScript · Supabase (PostgreSQL, authentification et Realtime) · MapLibre GL · Capacitor 8.

## État du projet

Le mode de poursuite principal, **La Piste**, est en développement. La direction produit et le périmètre à livrer sont décrits dans [`docs/product-direction.md`](docs/product-direction.md).

Le suivi natif en arrière-plan, les Live Activities iOS et les Live Updates Android ne sont pas validés comme fonctionnalités complètes. Garder l’application ouverte pour le partage de position. Une zone GPS ne garantit pas la sécurité des déplacements.

## Organisation

| Chemin | Rôle |
|---|---|
| `app/` | Pages et interface principale. |
| `components/` | Carte, installation et composants partagés. |
| `hooks/` et `lib/` | Géolocalisation, gestion des lobbies et utilitaires. |
| `supabase/` | Schéma, migrations et contrôles de base. |
| `android/` et `ios/` | Projets natifs Capacitor. |
| `tests/` | Tests unitaires et parcours Playwright. |

## Documentation

[Direction produit](docs/product-direction.md) · [Organisation du projet](docs/project-governance.md) · [Veille juridique initiale](docs/legal/veille-juridique-initiale-2026-10-09.md)

## Installation

Prérequis : Node.js 20.9+ (Node 22 recommandé) et un projet Supabase.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Dans `.env.local`, renseigner uniquement :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=la-cle-publishable-ou-anon
```

La clé `service_role` ne doit jamais être placée dans le navigateur ou dans Vercel.

## Configuration Supabase

1. Dans Authentication → Providers, activer **Anonymous sign-ins**.
2. Dans SQL Editor, exécuter [`supabase/schema.sql`](./supabase/schema.sql).
   Pour une base existante, appliquer les migrations de `supabase/migrations/` dans l’ordre; le dossier contient notamment le RPC `publish_location`.
3. Vérifier que la publication Realtime contient `room_members` et `positions` (le script les ajoute).
4. En production, activer les limites de débit et/ou CAPTCHA pour les connexions anonymes.

Le schéma applique RLS sur toutes les tables : les positions ne sont lisibles que par les membres du lobby, et les écritures de position sont limitées à l’utilisateur courant. La création, l’adhésion, la sortie et la fermeture passent par des fonctions SQL `security definer` avec validation côté base. L’application native et son suivi verrouillé ne sont pas publiables comme fonction complète tant que la session GPS de manche n’est pas liée à un jeton serveur limité au lobby et que les migrations n’ont pas été appliquées à Supabase.

## Applications mobiles natives

Capacitor 8 est configuré pour Android et iOS. Le partage de position se demande après un choix explicite; l’application doit expliquer le partage au groupe et l’arrêter à la sortie de partie. L’application iOS ne demande actuellement que l’accès à la localisation pendant son utilisation. Le suivi natif en arrière-plan et les notifications persistantes Android ne sont pas activés ni validés; garde HUNT ouverte pour partager une position. La compilation Xcode n’a pas été exécutée ici.

Les Live Activities et Live Updates ne sont pas encore intégrées : il manque la Widget Extension iOS, l’interface Dynamic Island et la configuration/validation de l’équivalent Android. Ne pas annoncer ces surfaces comme fonctionnelles avant leur intégration native, compilation signée et vérification sur appareils compatibles.

## Tests

```bash
npm test
npm run test:e2e
npm run typecheck
npm run build
```

Le test Playwright ouvre deux contextes mobiles isolés et simule Supabase via des routes mémoire : identités et positions n’atteignent jamais un projet Supabase, encore moins la production. Il couvre création, adhésion, visibilité des deux joueurs, précision GPS, refus puis reprise d’autorisation, position périmée, arrêt, départ, fermeture et rejet de l’ancien code. La CI GitHub Actions lance typecheck, build et parcours Playwright. Pour exécuter localement, installer Chromium avec `npx playwright install chromium`.

## Test opérateur sur deux téléphones

À faire sur un déploiement HTTPS (localhost est accepté en développement, mais un téléphone réel doit accéder à une origine HTTPS ou à un tunnel HTTPS). Préparer deux téléphones, deux navigateurs et deux pseudos distincts.

1. Ouvrir la même URL HUNT sur les deux téléphones, garder les pages au premier plan et laisser les écrans actifs pendant le test.
2. Sur le premier, saisir un pseudo puis créer une chasse. Transmettre le code à six caractères au second téléphone.
3. Sur le second, saisir un autre pseudo, entrer le code et rejoindre. Vérifier que chaque écran montre les deux membres.
4. Autoriser la localisation précise dans la demande du navigateur. Sur iPhone : activer `Réglages > Confidentialité et sécurité > Service de localisation`, puis autoriser la localisation pour Safari et laisser `Position exacte` activée. Dans Safari, une permission refusée se corrige aussi depuis le menu de page > `Réglages du site web` > `Localisation` > `Demander` ou `Autoriser`. Sur Android : activer `Paramètres > Localisation`, puis dans Chrome ouvrir les informations du site > `Autorisations > Localisation` et autoriser la position précise; dans les permissions de Chrome, activer `Utiliser la position précise`. Les intitulés peuvent varier légèrement selon version/appareil.
5. Si la localisation est refusée, vérifier l’état « Balise bloquée/Signal indisponible », accorder l’autorisation, puis toucher l’interrupteur de partage pour réessayer.
6. Vérifier sur les deux écrans la carte, les marqueurs et la précision affichée. Marcher quelques mètres dehors et laisser le GPS stabiliser son signal avant d’évaluer la précision; HUNT affiche la mesure fournie par le téléphone, sans garantir une précision AirTag/UWB.
7. Arrêter le partage sur un téléphone : son marqueur doit disparaître. Tester ensuite `Quitter la chasse` côté invité, puis `Fermer la chasse` côté hôte. L’ancien code doit être rejeté.

La localisation web demande l’autorisation du navigateur et dépend des capacités du téléphone et de l’environnement. iOS/Safari et les navigateurs mobiles peuvent suspendre l’activité en arrière-plan. Une position n’est plus active après 45 secondes sans nouvelle mesure et aucun historique de trajet n’est conservé. HUNT ne peut pas garantir qu’un périmètre GPS empêche de se perdre ni détecter tous les dangers/accès privés. Voir aussi les guides [Apple sur la position précise iPhone](https://support.apple.com/en-us/102647), [Android sur les permissions de localisation précises](https://support.google.com/android/answer/6179507?hl=en) et [Chrome Android sur l’autorisation d’un site](https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DAndroid&hl=en).

## Déploiement Vercel

Importer le dossier dans Vercel, conserver `npm run build`, puis ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les environnements Preview et Production. Les pushes sur `main` lancent la CI; Vercel doit publier depuis `main`. Après chaque changement de schéma, appliquer la migration SQL au bon projet Supabase puis vérifier le déploiement et tester deux appareils.

Chaque commit publié sur `main` doit inclure dans son corps un titre et au moins une note destinés aux joueurs. La CI vérifie leur présence; l’application affiche uniquement le titre et les changements concrets, jamais le SHA ou le sujet technique du commit. Exemple :

```text
feat: prepare shared outdoor play area

Release-Title: Préparez votre terrain de chasse
Release-Note: L’hôte peut tracer un périmètre commun et choisir son rayon directement depuis la carte.
Release-Note: Les statuts distinguent une position dans la zone, hors de la zone et trop imprécise pour conclure.
```

Les notes sont intégrées au build Vercel. Elles expliquent ce qui a changé, mais le statut réel de mise en ligne doit toujours être confirmé avec le déploiement et l’URL publique.
