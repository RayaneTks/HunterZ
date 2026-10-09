# HUNT — audit et direction de refonte mobile

**Statut :** direction arbitrée pour le prochain cycle UI/UX. Ce document décrit l’audit du produit actuel et les critères de la refonte; il ne présente pas les écrans de partie comme déjà développés.

## Décision produit

HUNT doit se comporter comme un jeu de traque en plein air, pas comme un site web rétréci sur téléphone. La carte reste la scène du jeu. Les écrans de préparation et de résultat privilégient des panneaux lisibles; pendant une manche, l’interface demande peu d’attention et réserve toute action tactique à un joueur arrêté.

La boucle cible est **Accueil → Salon → Briefing → Partie → Pause ou incident → Résultat → Revanche**. Seuls l’accueil, la création/reprise de profil, l’invitation, le salon, la carte du salon, le partage GPS et le réglage du périmètre (sous réserve de la migration serveur) sont présents aujourd’hui. Les rôles, le briefing, les objectifs, la capture, la pause de manche, le résultat et la revanche sont à concevoir et construire.

## Audit du produit livré

### Acquis à conserver

- Entrée courte par pseudo, création/rejoindre un salon et lien d’invitation.
- Carte plein écran, navigation cartographique familière, recentrage et centrage sur un joueur depuis son pseudo.
- Panneau d’escouade, états GPS distincts, prise en compte d’une position ancienne/imprécise et préférence de mouvement réduit.
- Retours haptiques sobres, zones sûres iOS, cibles tactiles souvent autour de 44 px ou plus.
- Idées de modes clairement non jouables; le réglage de zone dit explicitement qu’un cercle n’est ni une barrière ni une garantie de sécurité.

### Problèmes qui empêchent aujourd’hui une expérience de jeu aboutie

1. **Le lobby concentre trop de tâches dans un seul panneau.** La feuille basse fait environ 48 % de l’écran repliée et peut atteindre environ 78 % ouverte. Elle mélange GPS, membres, terrain, concepts et sortie; la carte devient secondaire.
2. **La hiérarchie dehors est trop petite.** Plusieurs informations fonctionnelles sont en 9–12 px, avec des gris faibles sur les panneaux clairs. Elles perdent en lisibilité sur un téléphone tenu à bout de bras ou en plein soleil.
3. **Les états carte/action ne sont pas toujours explicites.** Le bouton de recentrage existe, mais son résultat est silencieux si la position manque; toucher un joueur déplace la carte sans marquer assez clairement la sélection ni proposer une action distincte pour revenir à soi; poser un centre de zone entre en concurrence avec le déplacement normal de la carte.
4. **Le contenu « modes » occupe le parcours principal du salon alors qu’il est éditorial.** Il faut le garder accessible sans le faire passer pour une sélection de partie.
5. **La promesse de « chasse » dépasse la boucle réellement livrée.** Le dépôt n’a pas d’état de manche, rôle, briefing, objectif, interaction de capture ou résultat. Ajouter un bouton de départ avant ces systèmes donnerait une fausse impression d’achèvement.
6. **Le comportement de localisation n’est pas cohérent entre Web/PWA et natif.** Dans la version auditée, le Web/PWA appelle `gps.start()` dès l’entrée dans un salon; le navigateur peut demander l’autorisation et partager la position sans action préalable du joueur. Sur Capacitor, le partage commence via le contrôle du salon et le code demande l’autorisation de localisation sans déclarer la permission iOS « Always » ni le mode d’arrière-plan dans `Info.plist`. Dans les deux cas, avant tout dialogue système, HUNT doit expliquer qui voit la position, quand le partage est actif et comment l’arrêter. Le partage doit être opt-in sur toutes les plateformes et ne jamais démarrer à l’arrivée dans un salon; le premier lot retire l’activation automatique et ajoute une étape de consentement. Le suivi en arrière-plan reste à concevoir et valider séparément sur iOS et Android avant toute promesse.
7. **Les retours haptiques n’ont pas de réglage HUNT.** Les petits retours actuels sont déclenchés directement par quelques actions; aucun choix dans l’application ne permet de les couper. Garder le système discret et ajouter une préférence explicite avant d’élargir son usage.

La localisation native dispose d’un chemin d’écriture authentifié par le JWT courant et contrôlé côté serveur par l’appartenance au salon. Le code lance le service `BackgroundGeolocation` et passe les positions reçues par callback JavaScript vers une RPC authentifiée. Cela ne prouve pas un suivi fiable en tâche de fond : iOS ne déclare actuellement que l’usage « pendant l’utilisation », aucun mode d’arrière-plan n’est configuré dans `Info.plist`, et le chemin de permissions/service Android doit être validé dans l’application assemblée. Renouvellement de session, suspension/reprise du callback, consommation batterie et arrêt effectif restent à éprouver sur appareils iOS et Android. Le Web/PWA ne doit pas promettre un suivi arrière-plan équivalent au natif.

## Direction artistique et langage d’interface

### « Carnet de terrain vivant »

Une cartographie d’enquête contemporaine, chaleureuse et nette. L’identité suggère la traque et la coordination sans codes militaires, danger artificiel ni surveillance spectaculaire.

| Rôle | Direction |
| --- | --- |
| Fond/scène | Charbon `#111416`; la carte est la scène centrale. |
| Lecture/décision | Panneaux ivoire, hiérarchie typographique forte, largeur de lecture courte. |
| Action importante | Corail réservé à l’action primaire et au repère de terrain. |
| État positif / attention | Sauge et ambre avec libellé, icône/forme et texte; jamais la couleur seule. |
| Typographie | Sans système; chiffres tabulaires pour distance, durée et rayon. Taille adaptable aux réglages d’accessibilité. |
| Icônes | Un seul trait visuel; les états importants gardent toujours un libellé. |
| Mouvement | Réponse brève et utile; aucun mouvement requis pour trouver une fonction, respect de Réduire les animations. |

Texte français en tutoiement cohérent, direct et calme. Une action primaire par écran. Ne pas utiliser de pression de série, de compte à rebours culpabilisant, de vitesse ou de distance courue comme récompense.

## Architecture d’écrans cible

### 1. Accueil

- Promesse en une phrase : une chasse GPS en plein air avec son escouade.
- Deux chemins nets : créer un salon ou rejoindre avec un code; reprendre un salon uniquement si sa restauration est fiable.
- Pseudo et profil restent modifiables, mais ne rivalisent pas avec l’action principale.
- Un journal de version reste lisible à l’ouverture d’une nouvelle livraison, mais l’invitation entrante et l’accès au compte ne doivent pas être bloqués derrière une longue lecture.

### 2. Salon — préparation de l’escouade

- Garder la carte visible. Refaire la feuille en trois positions compréhensibles : **résumé**, **escouade**, **préparation**. Son ouverture/fermeture a toujours un bouton; le glissement depuis la poignée est un raccourci.
- Résumé compact : nombre de membres, partage à soi (off/permission demandée/position obtenue/position transmise/ancienne ou imprécise) et terrain actif/inactif. La feuille réserve aussi la zone système basse pour que l’action de balise reste entièrement visible; sur un petit écran, son état compact occupe environ un quart de la hauteur.
- Escouade : membres et statut textuel; toucher un membre centre la carte et révèle une action claire **Revenir à ma position**.
- Préparation : terrain partagé et actions de l’hôte. Déplacer le centre avec un réticule fixe en déplaçant la carte, avec actions **Confirmer** et **Annuler**; garder une alternative accessible hors carte. La fonction reste signalée indisponible si le serveur n’a pas reçu la migration.
- Carnet de concepts consultable dans une destination secondaire dédiée, ou section repliée « Idées de modes ». Chaque fiche porte visiblement « Concept — pas encore jouable ».
- Inviter, copier le code, quitter/fermer sont trouvables sans fouiller un long panneau. Toute fermeture de salon a une confirmation proportionnée.

### 3. Briefing (proposition à valider avec les règles et la machine d’état)

Un écran court avant la demande de permission : mode actif, but de chaque rôle, durée indicative, terrain, prérequis GPS/réseau, visibilité de la position, règle de pause et règle de sécurité. Chaque joueur confirme qu’il est prêt; l’hôte lance quand les conditions sont remplies. Pas de suivi automatique pendant la lecture ou l’arrivée au salon.

### 4. Manche — « La Piste » comme première hypothèse à tester

- Carte au premier plan, rôle, objectif en une phrase et état de manche persistent.
- En déplacement : HUD passif à lecture instantanée, aucune action tactique. Les commandes tactiques sont proposées à l’arrêt; pause/sécurité reste toujours accessible. Une vibration peut signaler un état, jamais prendre une décision à la place du joueur.
- En cas d’action tactique, afficher **Arrête-toi pour jouer cette action**.
- Ne jamais livrer les coordonnées exactes d’une cible au poursuivant. Montrer des indices/secteurs dont la fraîcheur et l’incertitude sont compréhensibles.
- Une tentative d’interception se résout numériquement, à l’arrêt, sans contact physique. Distance, réponse de la cible, état incertain et validation serveur restent des décisions de règles, pas des choix d’interface.
- Aucun parcours ne demande de courir, bloquer quelqu’un, traverser un obstacle, entrer sur une propriété ou continuer malgré un doute.

### 5. Pause, incident et fin (à construire)

- Pause visible à chaque instant; partage GPS et reprise ont des états distincts. Une pause de sécurité ne provoque pas de pénalité.
- Récap privé : issue, coopération et moment marquant calculés à partir d’événements validés; ne pas rejouer ni conserver une trajectoire GPS inutile.
- **Rejouer avec l’escouade** et **Inviter** comme suites évidentes. Éviter le classement vitesse/distance et les mécaniques de retour culpabilisantes.

## Gestes et feedback mobiles

| Geste/action | Règle retenue |
| --- | --- |
| Carte | Pan et pinch/zoom servent à la carte seulement. Le zoom de la page reste désactivé comme demandé; préserver le grossissement système/texte accessible. |
| Membre / pseudo | Un tap centre la carte; une action explicitement annoncée ouvre le détail. Afficher la sélection et proposer de revenir à soi. |
| Feuille | Tap sur poignée/en-tête toujours disponible; swipe uniquement depuis la poignée. Faire défiler son contenu ne doit jamais fermer la feuille. Garder l’état et le contrôle GPS visibles avec l’inset système; réduire la hauteur compacte seulement après validation réelle sans couper ces éléments. |
| Menus / dialogues | Fermer par bouton visible; tap extérieur et Échap en compléments quand cela ne ferait pas perdre une action. Focus restauré à la fermeture. |
| Placement du terrain | Mode de placement visuellement distinct, réticule ou équivalent accessible, validation explicite et annulation toujours visible. |
| Haptique | Courte et liée aux actions confirmées/événements rares; jamais à chaque fix GPS. Toujours doublée de texte/visuel. Ajouter un réglage HUNT pour la couper avant d’élargir son usage. |
| Bords système | Ne pas intercepter Retour iOS/Android; pas de geste critique caché, double-tap ou appui long. |

## Garde-fous d’accessibilité et d’usage dehors

- Minimum tactile **44 × 44 CSS px** (viser 48 × 48 CSS px pour les contrôles principaux; vérifier les équivalents natifs d’environ 44 pt iOS et 48 dp Android); séparation suffisante pour les gants.
- Texte opérationnel **≥14 px**, secondaire rarement sous 12 px; contraste WCAG AA (4,5:1 texte courant), pas d’état transmis par couleur seule.
- Réglage de taille système jusqu’à 200 % sans recouvrement; VoiceOver, TalkBack et clavier ont accès aux actions carte/feuille/placement.
- États explicites pour permission refusée, GPS désactivé, recherche, imprécision, position ancienne, échec de transmission, hors ligne, suspension/reprise, partage arrêté et sortie du salon.
- Annoncer seulement les changements d’état utiles, pas chaque mise à jour de position.
- Personne ne doit lire ou viser l’écran en marchant. Donner une consigne courte et une confirmation à l’arrêt pour les interactions sensibles.

## Découpage proposé

### Bloc A — Fondations et lobby (premier lot UI)

Tokens/typo/contrastes, feuille à trois positions, réorganisation membres→terrain→réglages, recentrage/retour à soi, placement annulationnable, carnet secondaire, erreurs et états réseau/GPS plus explicites, consentement avant demande OS. Aucun écran ne fait croire qu’une partie est jouable.

### Bloc B — Contrat de partie avant HUD

Arbitrer règles de La Piste, rôles/visibilité, transitions serveur, prérequis GPS, pause/reprise, capture numérique et fin. Définir les états et événements avec intégration/qualité avant de créer des écrans de partie.

### Bloc C — Briefing et manche

Construire le parcours multi-joueur de bout en bout; HUD carte, consignes à l’arrêt, pause, déconnexion/reconnexion et retours clairs. Déployer seulement quand le serveur est autoritaire sur rôles, positions visibles et actions.

### Bloc D — Résultat et fidélisation

Récap, revanche/invitation, progression d’escouade facultative, privacy/expiration de données. Puis enrichissements natifs tels que Live Activities/widget/son après validation plateforme et cadrage légal.

## Porte de qualité de la refonte

Le lot UI ne sera déclaré prêt que si les points suivants passent sur iOS et Android réels, en plus de la CI et des tests de flux existants :

1. Portrait **320 × 568**, téléphones actuels et paysage; aucun CTA/carte caché par feuille, clavier, encoche ou indicateur système.
2. Usage à une main et plein soleil; taille texte augmentée; contrastes vérifiés, pas seulement « à l’œil ».
3. VoiceOver/TalkBack et clavier : tous les gestes ont une alternative; ordre de focus, retour de focus et annonces sont cohérents.
4. GPS autorisé/refusé/imprécis/périmé, réseau coupé/rétabli, app suspendue/reprise, arrêt manuel et changement de salon; aucune donnée périmée présentée comme live. Toute alerte de zone est stabilisée par hystérésis/confirmation ou équivalent; le bruit GPS ne répète ni annonces ni vibrations.
5. Gestes système Retour conservés, carte indépendante du zoom de page, mouvement réduit et aucun feedback haptique répétitif. Puisque le zoom de page est désactivé, vérifier explicitement magnification système et texte natif à 200 % en portrait/paysage et clavier ouvert.
6. Aucune promesse de suivi en arrière-plan, capture, géorepérage ou sécurité au-delà de la plateforme et des fonctions réellement vérifiées.

La validation visuelle et terrain exige une prévisualisation à plusieurs tailles, ainsi qu’une session multi-appareils réelle avant de qualifier la refonte d’aboutie.
