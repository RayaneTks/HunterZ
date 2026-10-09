# Sprint 01 — Lobby mobile fiable

**Période :** 9 octobre 2026
**Pilote et intégrateur :** responsable de projet HUNT
**Résultat visé :** rendre la boucle lobby → invitation → escouade/carte fiable et compréhensible sur téléphone, avec une trace de version visible quand un build Vercel est effectivement servi.

## Périmètre

### Inclus

- Invitation privée par URL/code et arrivée dans le lobby après le pseudo.
- États de GPS et de fraîcheur cohérents, recentrage sur un membre qui a un point récent, retour compréhensible si son point manque ou est périmé.
- Gestes usuels du panneau d’escouade et fermeture du menu au toucher extérieur/Échap.
- Retours haptiques légers sur les actions volontaires lorsque la plateforme les prend en charge.
- Notes de version intégrées au build Vercel, avec commit, date et historique disponibles dans l’app.
- CI de PR et de `main` pour typage/build/parcours navigateur, plus documentation Produit, gouvernance et veille légale.

### Explicitement hors de ce sprint

- Partie complète **La Piste**, règles de capture/extraction et géorepérage de jeu.
- Promesse de géolocalisation transmise écran verrouillé / application suspendue. Le callback natif dépend encore du WebView et il manque le contrat de session d’upload côté serveur.
- Widget iOS, Dynamic Island ou Live Updates Android opérationnels.
- Migration `publish_location` appliquée au projet Supabase de production, publication Vercel ou binaire iOS/Android signé : aucun accès/preuve exploitable n’est disponible dans ce sprint.

## Critères d’acceptation

1. Un lien d’invitation ouvre la saisie du pseudo si nécessaire et mène directement au lobby.
2. La carte distingue signal récent, signal ancien et absence de signal; sélectionner un joueur récent centre la carte, sans faux déplacement si le point n’est plus frais.
3. L’interrupteur de position reflète le vrai état d’autorisation/suivi, y compris après refus; arrêt, sortie et fermeture désactivent le partage côté interface.
4. Le menu profil se ferme par toucher extérieur et Échap. Le panneau d’escouade ne s’ouvre/se replie qu’avec son contrôle ou un geste intentionnel sur sa poignée; un swipe ne déclenche pas un clic parasite.
5. Les retours d’état restent lisibles sans couleur seule et les actions accessibles ont un libellé; les animations respectent `prefers-reduced-motion`.
6. Les notes de version identifient le commit et l’environnement réellement encodés dans le build. Elles ne sont pas présentées comme preuve que la migration Supabase ou les surfaces natives sont actives.
7. `npm test`, `npm run typecheck` et `npm run build` passent. Le parcours Playwright passe dans CI; s’il ne peut pas être reproduit localement, la livraison attend son résultat CI avant d’être dite validée.
8. Les rapports des pôles Architecture, Intégration, Qualité, Juridique et Release sont examinés; chaque anomalie P0/P1 est corrigée ou exclue explicitement du bloc livré.

## Affectation des pôles

| Pôle | Travail de ce sprint | État |
| --- | --- | --- |
| Produit & expérience joueur | Définir la tranche lobby mobile et ses états; garder les règles La Piste en backlog produit. | Proposition reçue, intégrée aux critères. |
| Architecture & ingénierie | Auditer les contrats GPS natifs/RPC et isoler les courses de session; borner le natif hors promesse de continuité. | Audit reçu; annulation de démarrage, arrêt au démontage et expiration du signal intégrés. |
| Réalisation | Corrections UI, états GPS, haptique et release notes limitées au périmètre validé. | En cours sous le responsable de projet. |
| Qualité & sécurité | Relecture indépendante des parcours, états d’erreur, accessibilité et assertions natives. | P1 arrière-plan fermé par retrait des garanties, verdict web positif; aucun essai natif sur appareil. |
| Intégration | Contrôler recouvrement, migrations, configuration Capacitor, artefacts générés et portée de livraison. | Audit reçu; blockers natifs exclus du lot web. |
| Juridique/vie privée | Mettre à jour les sources et risques pour GPS partagé, invitations, zones et arrière-plan. | Mise à jour datée du 9 octobre versée au mémo légal. |
| Release & opérations | Vérifier l’écart entre CI, Vercel, Supabase et binaires; établir quelles preuves existent. | Audit reçu; workflow local n’est pas une preuve de déploiement. |

## Sortie du sprint

Le bloc n’est livrable qu’après acceptation par la Qualité et l’intégration du responsable de projet, vérifications locales et statut CI connu. L’intégration sur `main` n’entraîne pas à elle seule la déclaration « en production ». Après livraison, noter séparément CI, URL de production servie, migration Supabase et état des builds natifs.
