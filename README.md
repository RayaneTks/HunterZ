# HUNT — jeu de poursuite GPS en plein air

Application web mobile et coque Capacitor pour réunir des escouades dehors. La base actuelle fournit un lobby privé, des invitations par lien/code et une carte de positions récentes. Le mode principal prévu est **La Piste**, dans une zone choisie ensemble. La zone de jeu, ses alertes de frontière et les règles de manche restent à construire; la direction et les critères sont dans [`docs/product-direction.md`](docs/product-direction.md). Le périmètre n’est jamais une garantie de sécurité.

L'organisation des pôles, leurs mandats et les gates de livraison sont décrits dans [`docs/project-governance.md`](docs/project-governance.md). La veille juridique initiale et ses déclencheurs sont dans [`docs/legal/veille-juridique-initiale-2026-10-09.md`](docs/legal/veille-juridique-initiale-2026-10-09.md).

## Démarrage local

Prérequis : Node.js 20.9+ (Node 22 recommandé) et un projet Supabase.

```bash
npm install
copy .env.example .env.local
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

Importer le dossier dans Vercel, conserver `npm run build`, puis ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les environnements Preview et Production. Les pushes sur `main` sont configurés pour lancer le build CI; Vercel doit publier depuis `main`. Après chaque changement de schéma, appliquer la migration SQL au bon projet Supabase puis vérifier le déploiement et tester deux appareils. L’avis Notes de version dans HUNT exige une vérification du cache Vercel et doit être considéré comme une information intégrée au build, pas comme une preuve serveur indépendante que le site est actuellement disponible.
