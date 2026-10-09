# HUNT — publication de la refonte mobile

## État

Branche locale `codex/hunt-mobile-redesign`. Aucun push, fusion, déploiement ou SQL distant exécuté. Conserver cette branche pour review. Le checkout original reste sur sa branche initiale.

## Préparer une preview complète

1. Sauvegarder schéma et données du projet Supabase cible. Commencer sur un projet de test isolé.
2. Pour base existante, appliquer `supabase/migrations/20261009210000_la_piste.sql` dans une transaction. Pour base neuve, utiliser `supabase/schema.sql` une seule fois. Ne pas appliquer les deux ; ne pas relancer aveuglément la migration.
3. Vérifier rôles : anonyme/non-membre refusés, cible ne voit pas les chasseurs, chasseurs ne voient pas GPS exact cible ; accès direct aux tables/actions internes refusé ; anciennes écritures publiques bloquées après création de manche.
4. Vérifier Auth, RPC et Realtime sur ce projet : pause, départ concurrent, consentements, capture/extraction/timeout, purge et reprise réseau. Les suites locales ne prouvent pas les réglages Realtime distants.
5. Construire preview HTTPS avec URL et clé publique du projet de test. Ne pas servir cette interface contre une base sans migration pour valider La Piste.
6. Installer et jouer sur appareils physiques, puis publier seulement après validation de cette preview et autorisation.

## Contrôles locaux

```bash
npm ci
npm test
npm run typecheck
npx playwright install chromium
npm run test:e2e
npm run build
npx playwright test --config playwright.production.config.ts
node scripts/serve-preview.cjs
```

Le dernier serveur écoute uniquement `127.0.0.1:4180`. Le shell PWA se charge hors ligne après une première visite ; jouer requiert une connexion.

Test concurrence Windows facultatif : installer hors app `@embedded-postgres/windows-x64@18.4.0-beta.17` et `pg`, puis indiquer leur dossier via `HUNT_PG_TOOL_ROOT` et exécuter `node scripts/check-postgres-concurrency.cjs`. Par défaut : `../../.hunt-tools/pg-concurrency`. Le script utilise un cluster isolé, port loopback 20139, bases temporaires supprimées et arrêt du serveur en fin de test. Aucun service système installé. Le package natif n’est pas une dépendance du jeu ni du job Linux CI.

## Retour arrière

Avant diffusion : conserver le dernier build et commit validés. Si preview échoue, garder l’ancienne interface publiée et corriger sur cette branche.

Après diffusion : arrêter ou annuler les manches actives, puis revenir au build d’interface précédent. Conserver les protections serveur et les tables privées de cette migration : retirer ces protections pendant que des clients continuent d’envoyer du GPS pourrait réexposer des coordonnées. Les anciens clients resteront soumis au garde d’écriture ; un salon ayant eu une manche doit être fermé/recréé pour revenir au GPS public historique.

Pour désactiver temporairement les nouvelles parties, revenir à l’interface précédente sans supprimer les tables ni restaurer des données GPS. Une restauration de base exige sauvegarde vérifiée, fenêtre de maintenance et fermeture des salons ; aucune suppression destructive automatique prévue.

Les commits livrés contiennent `Release-Title` et `Release-Note`. Confirmer URL, version réellement servie et état de la migration après toute publication. Aucun push forcé.
