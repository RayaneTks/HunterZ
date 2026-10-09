# HUNT V0.1 — lobby GPS multijoueur

Prototype mobile-first pour réunir plusieurs téléphones dans un lobby privé et partager une position GPS récente sur une carte MapLibre. Les modes de jeu, le chat, le classement et l’historique de déplacement ne font pas partie de cette version.

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
3. Vérifier que la publication Realtime contient `room_members` et `positions` (le script les ajoute).
4. En production, activer les limites de débit et/ou CAPTCHA pour les connexions anonymes.

Le schéma applique RLS sur toutes les tables : les positions ne sont lisibles que par les membres du lobby, et les écritures de position sont limitées à l’utilisateur courant. La création, l’adhésion, la sortie et la fermeture passent par des fonctions SQL `security definer` avec validation côté base. Un index unique limite un utilisateur à un seul lobby actif.

## Tests

```bash
npm test
npm run test:e2e
npm run typecheck
npm run build
```

Le test Playwright ouvre deux contextes mobiles isolés et simule Supabase via des routes mémoire : identités et positions n’atteignent jamais un projet Supabase, encore moins la production. Il couvre création, adhésion, visibilité des deux joueurs, précision GPS, refus puis reprise d’autorisation, position périmée, arrêt, départ, fermeture et rejet de l’ancien code. Au premier lancement, installer Chromium avec `npx playwright install chromium`.

## Test opérateur sur deux téléphones

À faire sur un déploiement HTTPS (localhost est accepté en développement, mais un téléphone réel doit accéder à une origine HTTPS ou à un tunnel HTTPS). Préparer deux téléphones, deux navigateurs et deux pseudos distincts.

1. Ouvrir la même URL HUNT sur les deux téléphones, garder les pages au premier plan et laisser les écrans actifs pendant le test.
2. Sur le premier, saisir un pseudo puis créer une chasse. Transmettre le code à six caractères au second téléphone.
3. Sur le second, saisir un autre pseudo, entrer le code et rejoindre. Vérifier que chaque écran montre les deux membres.
4. Autoriser la localisation précise dans la demande du navigateur. Sur iPhone : activer `Réglages > Confidentialité et sécurité > Service de localisation`, puis autoriser la localisation pour Safari et laisser `Position exacte` activée. Dans Safari, une permission refusée se corrige aussi depuis le menu de page > `Réglages du site web` > `Localisation` > `Demander` ou `Autoriser`. Sur Android : activer `Paramètres > Localisation`, puis dans Chrome ouvrir les informations du site > `Autorisations > Localisation` et autoriser la position précise; dans les permissions de Chrome, activer `Utiliser la position précise`. Les intitulés peuvent varier légèrement selon version/appareil.
5. Si la localisation est refusée, vérifier l’état « Balise bloquée/Signal indisponible », accorder l’autorisation, puis toucher l’interrupteur de partage pour réessayer.
6. Vérifier sur les deux écrans la carte, les marqueurs et la précision affichée. Marcher quelques mètres dehors et laisser le GPS stabiliser son signal avant d’évaluer la précision; HUNT affiche la mesure fournie par le téléphone, sans garantir une précision AirTag/UWB.
7. Arrêter le partage sur un téléphone : son marqueur doit disparaître. Tester ensuite `Quitter la chasse` côté invité, puis `Fermer la chasse` côté hôte. L’ancien code doit être rejeté.

La localisation web demande l’autorisation du navigateur et dépend des capacités du téléphone et de l’environnement. Le suivi HUNT est conçu pour la page au premier plan; iOS/Safari et les navigateurs mobiles peuvent suspendre l’activité en arrière-plan. Une position n’est plus active après 45 secondes sans nouvelle mesure et aucun historique de trajet n’est conservé. Voir aussi les guides [Apple sur la position précise iPhone](https://support.apple.com/en-us/102647), [Android sur les permissions de localisation précises](https://support.google.com/android/answer/6179507?hl=en) et [Chrome Android sur l’autorisation d’un site](https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DAndroid&hl=en).

## Déploiement Vercel

Importer le dossier dans Vercel, conserver la commande de build `npm run build`, puis ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les environnements Preview et Production. Après chaque changement de schéma, rejouer la migration SQL dans le projet Supabase concerné et refaire le test à deux appareils.
