# HUNT — publication du 9 octobre 2026

La refonte `bf165b804a98e99ce2b6cbfc4c2e7eef3fca91c7` a été poussée sur main et publiée sur https://hunt-lobby.vercel.app. Vercel : `dpl_DhoWq47czrp2yWdTsMLsMN5KbbL1`, READY, production, alias confirmé.

Supabase : publish_location, terrain partagé et La Piste appliqués dans une transaction après test annulé. Les cinq migrations du dépôt sont enregistrées. Les deux salons existants et leurs deux positions ont été conservés.

Contrôles réels : quatre identités temporaires, Auth/REST/RPC, rôle GPS, départ, pause/reprise, capture confirmée, purge, revanche et rejet d’action retardée. Événement Realtime d’adhésion reçu via souscription authentifiée. Les comptes et salons de test ont ensuite été supprimés ; aucune manche de test restante.

Contrôle Chromium sur URL publique : entrée, règles, manifeste, identité, salon, carte et fermeture réussis. Une sauvegarde des définitions du schéma a été conservée hors dépôt. L’export des données joueurs/GPS, refusé par revue automatique, a été remplacé par le schéma sans données.

Premier run CI `37995302738` : compilation/types/41 tests réussis ; neuf parcours réussis et deux tests de nouveautés échoués. Cause : ils dépendaient du fichier .env local pour annoncer une version Vercel ; ce fichier est absent du runner. La configuration Playwright fournit désormais une version de test explicite, sans secret. Les deux régressions passent 2/2. Cette correction ne change aucun code produit. Une nouvelle CI est lancée par le commit portant ce rapport.

Essais physiques iPhone/Android et GPS terrain restent distincts des vérifications navigateur et serveur ci-dessus. Retour arrière : conserver les protections serveur et revenir à l’interface précédente si nécessaire ; voir le guide de livraison.

Reprise du 10 octobre : CI `37996392362` confirme 41 tests/types/compilation et 10 parcours sur 11. Le dernier échec révèle un débordement de l’avis de nouveautés à 320 px avec texte à 200 %. L’avis place désormais ses actions sur une seconde ligne, avec une colonne de texte réductible et des mots pouvant revenir à la ligne. Le test attend explicitement l’avis et vérifie aussi que les deux commandes restent dans l’écran. Les cinq contrôles locaux ciblés passent ; le push suivant déclenche la validation complète sur Ubuntu.
