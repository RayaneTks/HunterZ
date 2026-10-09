# HUNT — direction produit et plan de livraison

## Promesse

HUNT est un jeu d’escouade en plein air, en ville comme en forêt. L’hôte définit un terrain de partie visible de tous. Le groupe suit sa position et reçoit un avertissement clair quand il approche du bord ou le dépasse. Cette limite aide à garder le groupe sur le terrain choisi; elle ne garantit pas qu’un joueur ne peut pas se perdre et ne remplace pas le jugement, la signalétique ou une carte adaptée au lieu.

## Mode phare : La Piste

Pour 4 à 10 personnes, une escouade suit des indices progressifs pendant qu’une cible choisit un itinéraire vers une extraction. La cible garde des choix actifs; les chasseurs ne reçoivent jamais sa coordonnée GPS exacte. Partie visée : 15–20 minutes, parcourue en marchant, sans prime de vitesse.

Déroulé envisagé :

1. Briefing partagé : terrain, état GPS, durée, règles et rôles.
2. Départ : un court délai permet au groupe de se placer.
3. Piste : des objectifs atteints à pied révèlent ou resserrent une zone de recherche.
4. Interception ou extraction : présence confirmée dans une zone avec tolérance à l’incertitude GPS.
5. Récap privé : résultat, moments marquants et progression collective; revanche ou invitation.

Des modes « Balises d’équipe » et « Éclaireurs » seront testés après la première partie complète.

## Périmètre : première version à concevoir

- L’hôte choisit un centre sur la carte et un rayon via quelques presets et un curseur. Les propositions initiales sont à tester, pas à présenter comme des limites sûres : ville, 4–5 joueurs 250–400 m, 6–8 joueurs 350–550 m, 9–10 joueurs 450–700 m; espaces ouverts 400–700 m, 600–900 m, 800–1 200 m.
- Le lobby affiche la forme, le rayon, le terrain connu et une confirmation collective avant de commencer. Une modification après le départ est annoncée et acceptée par le groupe.
- États lisibles en texte, pictogramme et couleur : « dans la zone », « proche de la limite », « hors zone », « position imprécise ».
- L’incertitude du GPS est prise en compte. Départ de conception : alerte d’approche dans une bande d’environ 20–40 m, confirmée par plusieurs mesures cohérentes; les valeurs se calibrent sur le terrain.
- L’état incertain suspend les conclusions de frontière. Une sortie n’impose jamais un raccourci ni une pénalité; elle oriente vers le centre de la zone et permet pause/sortie.
- Aucun score pour la distance, la vitesse, l’activité quotidienne ou le suivi hors partie. Pas de trajectoire GPS conservée après le récap.
- L’haptique est rare, réglable et doublée d’un signal visuel/texte. Le retour dans la zone n’émet pas une vibration répétée.

## Direction visuelle et sensation

Carnet de terrain urbain et cartographie de poursuite : interface sombre et lisible, fond ivoire pour les cartes de mission, corail pour l’action personnelle, ambre pour l’incertitude et sauge pour la confirmation. Les cartes sont fonctionnelles, sans décorer la précision GPS. Animation courte, haptique intentionnelle, aucune pulsation anxiogène. Le ton est aventure et complicité, pas simulation militaire.

## Gamification et retour des joueurs

Commencer par célébrer une partie partagée : récap privé, progression d’escouade et petits éléments cosmétiques attribués à la coopération et à la participation. Missions hebdomadaires facultatives ensuite. Pas de séries quotidiennes, bonus de connexion, pénalité d’absence, classement public de position ou historique de trajet. La revanche et l’invitation de ses amis sont les principaux appels à revenir.

Le lobby présente aussi un carnet consultable de concepts — **La Piste**, **Cibles secrètes**, **Butin de terrain**, **Balises**, **Éclaireurs**. Choisir une fiche ne configure ni ne lance une partie : cela permet à l’escouade de discuter des idées. **Butin de terrain** explore notamment une boucle d’exploration cartographique avec caches virtuelles, ressources et capacités à concevoir; les récompenses et affrontements restent ouverts. Ce sont des hypothèses de brainstorming, pas des modes livrés.

Le premier réglage partagé de terrain propose des rayons de 250, 500, 800 et 1 200 m. Ils aident à cadrer une zone sur la carte; les équipes devront encore les essayer en ville et en espace ouvert avant de fixer des recommandations.

## Architecture et blocs indépendants

Les responsabilités devront évoluer progressivement vers des modules : lobby/invitations, match et machine d’états, périmètre/GPS, modes et objectifs, récap/progression, adaptateurs iOS/Android, service de release. Le serveur fait autorité sur les membres et transitions de partie; les capacités de l’appareil sont isolées derrière des adaptateurs. Aucune position reçue n’est traitée comme fraîche si elle est ancienne ou trop imprécise.

| Bloc | Résultat visible | Dépendances | Gate de livraison |
| --- | --- | --- | --- |
| 0. Livraison continue | CI sur PR et main, build, historique de release explicite | règles de branche et cible Vercel | vérifier l’état réellement servi; rollback clair |
| 1. Terrain partagé | choix de zone, aperçu/confirmation, états de frontière | modèle match et type spatial côté serveur | incertitude représentée honnêtement; villes et espaces ouverts |
| 2. Partie La Piste | rôles, objectifs, indices, extraction/interception, pause/fin | terrain partagé + serveur autoritaire | session complète à 4 joueurs simulés puis appareil |
| 3. Retour escouade | récap, revanche/invitation, progression collective simple | résultat de match stable | aucun historique GPS dans la progression |
| 4. Surfaces natives | suivi en manche arrière-plan, haptique, Live Activities iOS et Android | token GPS limité à la manche, widget Xcode, permissions/signature | build natif et appareils physiques par OS |
| 5. Publication publique | documents, protection, support, distribution | veille juridique actualisée, politique de conservation et comptes stores | critères des stores et revue sécurité/privacy |

## Rituels d’intégration

Chaque bloc a un périmètre, un propriétaire de fichier/module, une dépendance, un résultat d’acceptation et un rollback. L’équipe d’intégration révise l’API et les fichiers communs avant fusion; un bloc autonome est intégré sur `main` après revue et CI verte, puis son déploiement est confirmé à partir de la production. Les assets/build natifs générés ne sont pas la preuve d’une app signée distribuable. Le statut doit distinguer code fusionné, build terminé, deployment disponible, migration Supabase appliquée et build mobile natif.

## Veille à rafraîchir

- Après toute modification de localisation, consentement, visibilité de position, durée/rétention ou lancement à des mineurs, mettre à jour l’analyse vie privée/juridictions.
- Avant décision d’âge minimal, marché, partage public, contenu joueur, monétisation ou comptes permanents, actualiser l’analyse store/loi avec sources officielles.
- Avant l’ajout de points réels, consignes d’itinéraire, récompenses de déplacement, partage social ou notifications en arrière-plan, réévaluer risques physiques, règles des stores et impacts privacy.
