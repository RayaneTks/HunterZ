# HUNT — V1 lobby GPS privé

## Objectif

Livrer une version de test mobile où un joueur crée un lobby privé, partage un code, puis voit en direct les positions réelles des membres qui ont autorisé la géolocalisation. La V1 valide le partage de position et la fiabilité du lobby; elle ne comporte ni rôles, ni objectif de capture, ni score.

## Parcours attendu

1. Le joueur entre un pseudo et obtient une session Supabase anonyme persistante.
2. L’hôte crée un lobby. Une opération SQL atomique crée le lobby et son adhésion propriétaire, puis retourne un code partageable.
3. Un autre joueur saisit ce code sur un second appareil et rejoint le même lobby. Les doublons, codes invalides et appartenances simultanées à plusieurs lobbies sont refusés avec un message compréhensible.
4. Dans le lobby, chaque joueur peut autoriser ou arrêter son partage de position. L’application demande le meilleur niveau de précision disponible au navigateur, publie latitude, longitude, précision mesurée et heure du point, puis affiche les positions reçues sur la carte et dans la liste d’escouade.
5. Realtime met les appareils à jour; un rafraîchissement de secours récupère l’état après une coupure réseau. Les positions âgées de plus de 45 secondes sont marquées périmées et ne sont plus présentées comme actives.
6. Un membre peut arrêter son partage sans quitter. Un membre non-hôte peut quitter; l’hôte peut fermer le lobby. Les anciennes positions deviennent alors inaccessibles ou sont supprimées selon les contraintes existantes.
7. Après rechargement ou réouverture, l’application restaure le lobby si la session en est encore membre; sinon elle revient proprement à l’accueil.

## Périmètre

### Inclus

- Expérience responsive et installable en PWA, priorité aux téléphones.
- Création, invitation par code, adhésion, restauration et sortie/fermeture du lobby.
- Carte commune, positions en direct, précision réellement mesurée, horodatage et état du signal.
- Permission refusée, GPS absent ou imprécis, réseau indisponible, session expirée et lobby fermé traités explicitement.
- Accès aux profils, membres et positions limité par RLS aux usages nécessaires; pas d’historique de déplacements.
- Migration SQL additive et tests reproductibles du contrat de base.
- Validation sur deux appareils mobiles réels en HTTPS avant mise en production.

### Exclu

- Règles de chasse, équipes chasseur/cible, capture, victoire, scores, chat et historique.
- Suivi GPS garanti lorsque le navigateur mobile est en arrière-plan ou fermé.
- Précision matérielle de type AirTag/UWB. HUNT ne peut demander que la meilleure précision que l’OS et l’appareil accordent; l’application doit afficher la précision reçue sans la présenter comme garantie.

## Architecture retenue

- **Interface :** application Next.js existante, parcours dans `app/page.tsx`, opérations Supabase dans `lib/hunt.ts`, suivi navigateur dans `hooks/use-geolocation.ts`, carte MapLibre dans `components/MapView.tsx`.
- **Identité :** session anonyme Supabase persistée côté navigateur; pseudo enregistré dans `public.profiles`.
- **État partagé :** tables existantes `public.rooms`, `public.room_members` et `public.positions`. Aucun nouveau service ni stockage d’historique.
- **Commandes :** RPC PostgreSQL `create_room`, `join_room`, `stop_sharing`, `leave_room`, `close_room`; mutations privées contrôlées par RLS et droits `authenticated`.
- **Synchronisation :** Postgres Changes pour membres et positions, avec polling de secours déjà présent.
- **Localisation :** `watchPosition` en haute précision, `maximumAge: 0`; publication limitée en fréquence afin de préserver batterie et quota, sans lisser artificiellement la précision. Les états demandant/refusant/perdant le signal restent visibles.

## Correction SQL et compatibilité

Le schéma actuel déclare `pgcrypto`, puis appelle `gen_random_bytes(6)` depuis `public.create_room()` avec `search_path = ''` (`supabase/schema.sql`). Supabase place généralement les extensions dans le schéma `extensions`; cet appel non qualifié est donc une cause très probable de l’échec de création. Une fonction `SECURITY DEFINER` avec chemin vide doit qualifier les objets qu’elle utilise.

La correction doit éviter de dépendre du schéma d’installation de `pgcrypto`: générer le code avec `pg_catalog.gen_random_uuid()` (disponible sur les versions PostgreSQL prises en charge par Supabase), convertir en hexadécimal et conserver le format six caractères attendu, tout en gardant la boucle de nouvelle tentative sur collision. Toutes les tables et fonctions appelées dans les fonctions `SECURITY DEFINER` doivent être qualifiées par schéma. Garder le chemin vide et les restrictions d’exécution; ne pas élargir les privilèges.

Livrer ce changement via une migration forward-only, réexécutable sans supprimer de données. Ne pas exécuter à nouveau le script initial complet sur la base de production: il contient des suppressions/recréations de fonctions et n’est pas l’artefact de déploiement des changements futurs. Vérifier d’abord que le projet Supabase ciblé correspond au projet utilisé par Hunt.

## Confidentialité et sécurité

- Le code d’invitation est le seul moyen d’entrer; le RPC exige une session authentifiée anonyme.
- Les positions ne sont écrites que pour l’utilisateur courant et son lobby actif.
- Seuls les membres du lobby peuvent lire ses positions et sa liste de membres.
- `stop_sharing` retire la position persistée; `leave_room` et `close_room` retirent les données dépendantes par les relations en cascade prévues.
- Aucun secret `service_role` dans le navigateur, le dépôt ou les variables `NEXT_PUBLIC_*`.
- Ne jamais stocker un historique de coordonnées pour cette V1.

## Gestion des erreurs et états

- Création : désactiver le bouton pendant la requête; en cas d’erreur SQL, afficher le message utilisateur et laisser réessayer sans prétendre que le lobby existe.
- Éviter qu’une erreur locale de persistance après une création réussie soit présentée comme un échec RPC; si la restauration locale échoue, garder le lobby affiché en mémoire et proposer une récupération claire.
- Permission GPS refusée : expliquer comment l’autoriser et fournir une action de nouvelle tentative.
- Position imprécise : montrer l’incertitude mesurée et l’état « précision faible »; ne pas refuser arbitrairement un appareil qui ne peut pas mieux faire.
- Réseau/Realtime indisponible : conserver l’écran utilisable, indiquer la perte de synchronisation et récupérer l’état à la reconnexion.
- Signal ancien : indiquer l’heure du dernier point et son caractère périmé; ne pas l’afficher comme position actuelle.
- Sortie/fermeture : ne pas annoncer le succès avant la confirmation serveur; en cas d’échec réseau, laisser un chemin de récupération.

## Validation et critères d’acceptation

1. `npm test`, `npm run typecheck` et `npm run build` passent.
2. Les tests DB prouvent création atomique du lobby + hôte, retour du code au format prévu, adhésion par code, refus des cas invalides, refus des lectures/écritures par non-membre et séparation des droits hôte/membre.
3. Sur deux appareils réels en HTTPS, A crée le lobby et transmet le code; B rejoint; les deux voient exactement les mêmes membres et leurs marqueurs.
4. En donnant l’autorisation de localisation, les positions des deux appareils évoluent sans recharger la page; l’interface affiche la précision et l’heure réelles.
5. Refus GPS, perte réseau, reprise réseau, actualisation et réouverture donnent des états explicites, sans faux membre actif ni faux succès.
6. Arrêter le partage cesse les mises à jour et retire le signal; quitter retire le membre; fermer par l’hôte rend le code inutilisable.
7. Une revue de sécurité vérifie les politiques RLS, les droits RPC et l’absence de coordonnées dans tout accès anonyme/non-membre.
8. Après application vérifiée de la migration ciblée, déployer la version validée sur Vercel Production et contrôler le domaine `https://hunt-lobby.vercel.app`.

## Procédure de livraison

1. Ajouter tests de régression avant correction; confirmer l’échec causé par l’appel cryptographique du RPC.
2. Ajouter migration SQL additive et tests DB, puis corriger les transitions UI/GPS/session révélées par les tests et audits.
3. Exécuter tests automatisés, build et revue indépendante des changements.
4. Appliquer uniquement la migration de compatibilité au projet Supabase confirmé; valider le RPC et les politiques sur les comptes de test.
5. Tester le flux à deux téléphones en HTTPS, puis déployer directement sur Vercel Production conformément à la demande.

## Hypothèses explicites

- Le schéma installé est celui de `supabase/schema.sql` dans ce dépôt; il faut comparer le catalogue Supabase réel avant toute migration.
- Les variables Vercel `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` existent déjà en production, constat fait le 9 octobre 2026.
- « Précis » signifie la meilleure précision mesurée et accordée par l’appareil, pas une garantie centimétrique.
