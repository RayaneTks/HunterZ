# Sprint 02 — Terrain partagé et carnet de modes

**Objectif :** donner à l’escouade un terrain commun visible et un endroit pour explorer plusieurs idées de jeu, sans faire croire qu’un mode complet existe déjà.

## Livrable lobby

- L’hôte peut placer le centre de la zone sur la carte, utiliser sa position actuelle ou choisir un rayon de 250, 500, 800 ou 1 200 m.
- La zone est enregistrée dans le salon, partagée avec ses membres, et dessinée comme un cercle distinct des halos de précision GPS.
- Les membres voient un état par joueur : dans la zone, hors de la zone, près de la limite, signal imprécis ou balise en attente.
- Une position doit être récente. Si sa précision est supérieure à 100 m, ou si le halo GPS chevauche le bord, le statut reste incertain.
- Le statut est indicatif : le périmètre n’est pas une barrière ni une garantie de sécurité. Aucune pénalité, capture ou fin de partie ne découle de ce statut.
- Seul l’hôte peut enregistrer ou retirer le périmètre; l’autorité est vérifiée par le RPC `set_hunt_zone`.

## Carnet de concepts

Chaque fiche est consultable dans le lobby. La sélection sert uniquement à afficher une description; elle n’enregistre pas un mode de salon, ne déclenche aucune règle et ne démarre aucune partie.

1. **La Piste** — indices progressifs, cible mobile et interception à définir.
2. **Cibles secrètes** — chaque joueur traque une personne et se fait traquer.
3. **Butin de terrain** — exploration de points accessibles, caches virtuelles et capacités à imaginer.
4. **Balises** — équipes qui se déplacent et se disputent des points du terrain.
5. **Éclaireurs** — objectifs d’exploration coopératifs.

Le carnet porte le badge « À explorer » et explique que ces modes ne sont pas encore jouables. La prochaine revue Produit doit choisir 1–2 concepts à prototyper, définir leurs règles et confronter les versions en partie terrain.

## Dépendance de mise en production

Le code requiert la migration `supabase/migrations/20261009170000_add_shared_hunt_zone.sql`. La CI/Vercel ne l’applique pas. Avant de déclarer la zone partagée opérationnelle en production, vérifier son application sur Supabase puis confirmer que deux clients voient le même périmètre après enregistrement, actualisation et reconnexion.

Le panneau de nouveautés présente un titre et des changements concrets pour les joueurs, plus la date de génération du build et sa cible (production ou préproduction). Les identifiants et sujets bruts de commit ne sont pas affichés. La CI exige `Release-Title` et au moins une `Release-Note` sur chaque push vers `main`; les builds Vercel de production échouent si ces notes manquent.

## Limites de validation

- Les statuts dedans/dehors sont des indices calculés à partir des dernières positions reçues; ils ne font pas une validation serveur de la manche et ne déclenchent pas encore d’alerte de franchissement.
- Les rayons, le seuil de précision et la lisibilité du cercle sont des paramètres de départ à essayer dehors, pas des distances de sécurité validées.
- Aucun mode de jeu, butin, capacité, capture, géorepérage d’objectif ou score n’est activé par ce livrable.
