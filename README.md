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

## Vérifications

```bash
npm run typecheck
npm run build
```

Le projet ne possède pas encore de test navigateur automatisé : la partie qui dépend d’un vrai GPS et de Realtime doit être validée sur deux appareils.

## Test à deux téléphones

1. Déployer sur Vercel ou un autre hébergement HTTPS.
2. Ajouter les deux variables `NEXT_PUBLIC_*` dans l’environnement de déploiement.
3. Ouvrir la même URL sur deux téléphones, avec deux pseudos.
4. Sur le premier téléphone, créer un lobby et transmettre le code à six caractères.
5. Sur le second, rejoindre le lobby avec ce code.
6. Sur chaque appareil, activer la localisation et accepter l’autorisation précise.
7. Vérifier les participants, les marqueurs, la précision affichée, le recentrage et la mise à jour après déplacement.
8. Arrêter le partage sur un téléphone puis vérifier que sa position disparaît ; tester ensuite la sortie ou la fermeture du lobby.

La géolocalisation exige HTTPS sur téléphone (localhost est accepté en développement). Le suivi dépend de l’onglet ouvert et n’est pas garanti en arrière-plan sur iOS. Une position est considérée comme expirée après 45 secondes dans l’interface ; aucun historique n’est stocké.

## Déploiement Vercel

Importer le dossier dans Vercel, conserver la commande de build `npm run build`, puis ajouter `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` dans les environnements Preview et Production. Après chaque changement de schéma, rejouer la migration SQL dans le projet Supabase concerné et refaire le test à deux appareils.
