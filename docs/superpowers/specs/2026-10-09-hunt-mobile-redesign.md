# HUNT — refonte mobile 2026, contrat de conception

Statut : conception acceptée puis réalisée localement sur `codex/hunt-mobile-redesign`. Logo conservé. Validation navigateur et PostgreSQL locale documentée dans `docs/validation/2026-10-09/VALIDATION.md`. Publication, migration Supabase distante et essais physiques restent ouverts.

## Intention et décisions

HUNT doit donner envie de sortir jouer avec ses amis, puis permettre une manche compréhensible sans rester les yeux sur écran. Conserver marque et multijoueur GPS. Première boucle : La Piste, escouade de 4 à 10, marche, préparation courte, manche de 15 minutes, résultat privé, revanche.

Trois directions comparées : « carnet de terrain » (cohérent mais trop éditorial pour ressenti jeu), « néon arcade » (expressif mais bruit et faible lisibilité dehors), **« radar urbain ludique » retenu** (logo traduit en repères, proximité et coordination ; fond sobre, surfaces tactiles franches, carte centrale). La modernité vient des interactions, de la densité et du soin des états, pas d'une liste de tendances.

## Carte des capacités

| Identifiant | Responsabilité | Dépend de |
|---|---|---|
| mobile-experience | Entrée, accueil, escouade, terrain, lisibilité | Salon/GPS existants |
| pwa-installation | Installation, shell hors ligne, mise à jour | mobile-experience |
| la-piste | Briefing, rôles, indices, capture, extraction, résultat | mobile-experience, contrat serveur privé |

Ordre : expérience mobile → PWA → La Piste. Plans détaillés par lots dans `../../../tasks/plan.md`. Chaque capacité livrable et vérifiable séparément ; seuls jalons incluant La Piste peuvent être qualifiés de jeu complet.

## Contrat de direction artistique

Logo existant conservé, sans altération de silhouette. Réticule repris en coins de sélection, point corail pour « toi », lignes de piste comme motif discret sur entrée/résultat. Aucun décor animé derrière informations GPS.

| Élément | Valeur |
|---|---|
| Fond | Charbon `#111416` |
| Surface sombre | `#1b1e20` |
| Surface de lecture | Ivoire `#f3efe6` |
| Texte sur surface claire | `#111416` |
| Texte principal sombre | `#f3efe6` |
| Texte secondaire sombre | `#b5b8b4` |
| Action | Corail `#f05a50`, texte charbon (contraste à mesurer) |
| Confirmation | Sauge `#a4c5a8` + texte/icône |
| Attention | Ambre `#f4cb76` + texte/icône |
| Espacement | 4, 8, 12, 16, 24, 32, 48 px |
| Rayons | 8 px contrôles, 16 px panneaux, 24 px feuilles |
| Typographie | Sans système pour corps ; graisse 700/800 pour titres, chiffres tabulaires |
| Tailles | Corps 16 px, opérationnel ≥14 px, secondaire ≥12 px, titres 28–40 px |
| Toucher | Contrôles principaux 48×48 px minimum ; autres 44×44 px minimum |
| Mouvement | Retour visuel dès pression ; transitions simples 140–220 ms ; feuille gestuelle à ressort amorti, réponse initiale 0,3 s (pas durée fixe) ; mouvement réduit respecté |

Pas de gradients omniprésents, badges inventés, XP fictif, statistiques fabriquées, grille de cartes uniforme ou grosses phrases marketing. Icônes Lucide existantes, labels visibles. Contraste cible : 4,5:1 texte courant, 3:1 grand texte et contrôles utiles. Ces valeurs sont exigences de validation, pas résultats mesurés.

## Détails d'interaction — Apple Design

Source appliquée : [skill Apple Design d'Emil Kowalski](https://github.com/emilkowalski/skills/blob/main/skills/apple-design/SKILL.md). Version liée identique au skill déjà disponible localement, SHA256 `77BB63B7043BB93ACA2FF4AB040C249484EEF35682BB6FF7163433C31D30ADC7`.

L'émotion visée reste aventure et complicité. Ces principes affinent comportement HUNT ; ils ne remplacent pas DA radar urbain par copie d'iOS.

- **Appui immédiat, action relâchée.** Bouton réagit visuellement dès pointerdown ; mutation seulement au clic/relâchement valide. Sortir de cible annule activation. Ne pas confondre retour tactile local avec succès réseau ; confirmation de salon, partage transmis et résultat attendent serveur.
- **Feuille sous doigt.** Drag réservé à poignée, seuil directionnel de 10 CSS px ; Pointer Events avec capture, conservation du point de saisie et suivi 1:1. Scroll liste et gestes carte restent indépendants. `pointercancel`, interruption système et rotation reviennent à un état stable sans activer commande.
- **Reprise pendant mouvement.** Feuille peut être saisie et inversée avant fin de transition, sans saut ni blocage d'entrée. Relâchement choisit position parmi résumé/escouade/préparation selon déplacement et vitesse mesurés. Ressort démarre sur position et vitesse visibles ; amortissement 1,0 et réponse 0,3 s comme point de départ, à éprouver. Pas de rebond décoratif près de contrôles sensibles. Aucun délai maximal arbitraire confondu avec temps de stabilisation.
- **Origines prévisibles.** Feuille basse entre et sort par bas ; menu profil reste ancré à avatar. Ouverture d'un formulaire conserve contexte, annulation restaure centre carte initial et focus de déclencheur. Éditeur terrain garde confirmer/annuler à même endroit.
- **Matières lisibles dehors.** Transparence limitée aux petits contrôles flottants si contraste mesuré reste correct sur carte dense. Panneaux de lecture restent opaques. `prefers-reduced-transparency` ou `prefers-contrast: more` impose surface solide ; ne pas empiler vitrages. Pas de blur animé plein écran, afin de préserver batterie et rendu.
- **Typographie qui accompagne réglages.** Titres : interligne 1,05–1,15 et tracking modérément négatif ; corps : 1,45–1,6 et tracking proche de zéro. Espacements de lecture en rem/em ; aucune hauteur de carte/panneau tronquant texte agrandi. Police système conservée.
- **Retours utiles.** Distinguer attente, succès, avertissement et erreur avec texte/icône ; haptique rare, réglable, déclenchée sur événement effectivement confirmé. Absence de support haptique n'empêche aucune fonction. Pas de son automatique ni vibration à chaque fix GPS.
- **Mouvement réduit.** Remplacer grand déplacement, ressort et parallax par changement statique ou fondu bref ; garder état final clair. Alternatives bouton/clavier à tout geste. Aucun objet mobile plein écran en boucle.

### Prototype et gate d'interaction

Avant figer salon T4, éprouver prototype interactif dans branche de réalisation : feuille manipulable, carte, liste, centre terrain et annulation. Prototype utilise vrai contenu, pas backend fictif annoncé livré. Comparer drag lent, flick rapide, inversion à mi-course, interruption pointercancel, clavier, zoom 200 %, rotation et reduced motion. Vérifier au ralenti absence de saut ; performance sur téléphone réel séparée de test desktop.

Les tests vérifient résultats observables : doigt et panneau restent liés, interruption garde commandes utilisables, listes défilent sans déplacement involontaire de feuille, aucun geste ne confirme sortie/partage. Ils ne se contentent pas d'asserter constantes de ressort. Chaque état a bouton équivalent et retour de focus.

Réemployer mécanismes existants et plateforme. Si une petite implémentation focalisée ne permet pas continuité et interruption robustes, justifier bibliothèque de mouvement limitée par comparaison de prototype et coût bundle ; aucun moteur d'animation générique ajouté préventivement.

## Architecture des écrans

1. **Entrée.** Logo, promesse « Une chasse dehors, avec tes amis. », pseudo, bouton « Continuer ». Invitation entrante explicitement rappelée et reprise après identité. Aucune nouveauté ou permission bloquante. Premier affichage utile avant réponse Supabase ; erreurs avec réessai.
2. **Accueil.** Identité discrète, une grande action « Créer une chasse », action secondaire « Rejoindre avec un code », reprise de salon seulement après membership validé. Motif radar illustrant jeu, pas fausse carte live. Profil/aide/installation accessibles depuis réglages ; invitation reste partage système ou copie.
3. **Salon.** Carte visible, barre courte avec code et invitation. Feuille basse compacte ≤25 % de hauteur disponible à taille de texte normale ; feuilles Escouade et Préparation distinctes. Texte à 200 % : feuille peut grandir, défilement préserve chaque action. GPS opt-in, membres avant réglages, fermeture de salon confirmée. Concepts déplacés hors chemin principal, jamais présentés comme modes jouables.
4. **Terrain.** Hôte choisit centre par réticule fixe ; actions confirmer/annuler visibles ; presets 250/500/800/1200 m conservés. Alternative accessible : latitude/longitude saisissables et « utiliser ma position » si disponible. Attribution carte visible. Terrain gelé en manche ; changer terrain exige retour à préparation et nouvelle confirmation collective.
5. **Briefing.** Résumé en trois points, rôle individuel, carte de terrain, nombre prêts. GPS frais, partage volontaire et confirmation individuelle exigés. Un hôte seul ne peut lancer. État serveur fait autorité.
6. **Partie.** Carte, temps restant, objectif utile, état GPS, accès pause. Trois informations prioritaires maximum. Chasseurs voient leur escouade et zone d'indice, cible voit sa position et extraction. Liste/texte fournit alternative à carte. Aucun classement de vitesse ou de distance.
7. **Incident/pause.** Cause et prochaine action visibles : autorisation, position trop ancienne, connexion, app suspendue. Pas de progression ni coordonnées prétendument live hors ligne. Pause conserve temps restant côté serveur. Retour réseau recharge snapshot avant toute action.
8. **Résultat.** Issue réelle, durée, membres, sans trajet GPS. « Rejouer » recrée briefing ; rôle cible tourne parmi joueurs volontaires. Nouvelle invitation secondaire. Pas de progression cosmétique avant boucle stable.

Mobile : 320×568, 390×844, 430×932 ; tablette 768×1024 ; desktop 1440×900 ; paysage 844×390. Safe areas, clavier ouvert, zoom 200 %, thèmes de carte lisibles dehors. Desktop conserve carte et panneau latéral, sans étirer interface de téléphone sur toute largeur.

## PWA

Installation basée sur capacités, pas promesse universelle : prompt natif quand événement disponible ; aide menu/partage pour iPhone/iPad et autres navigateurs ; instructions ouvrir navigateur compatible pour webview. Aide réouvrable ; installation refusée n'empêche jamais jeu. Événement `appinstalled` et standalone mettent état à jour. iPadOS desktop user-agent pris en compte.

Manifeste avec `id: /`, scope/start_url, icônes any et maskable séparées, captures réelles portrait et large, métadonnées cohérentes. Source : https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable et https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing .

Service worker natif léger, adapté à export statique Next. Cache par version du shell public ; jamais Supabase, JWT, positions, profils ou trajets. GET navigation network-first avec fallback hors ligne après installation initiale ; assets statiques immuables cache-first. `release.json` toujours réseau/no-store. Pas de téléchargement massif de tuiles ni de promesse de carte complète hors ligne.

Mise à jour signalée discrètement ; appliquer volontairement hors manche. Pas de `skipWaiting` automatique pendant jeu. Échec première visite sans réseau = message navigateur possible, aucune promesse avant shell déjà chargé. Pas de suivi GPS fiable écran verrouillé promis en PWA.

## Règles proposées : La Piste V1

Règles réglées ici pour rendre plan exécutable ; calibrage terrain encore requis.

- 4–10 joueurs, 1 cible volontaire choisie par hôte, autres chasseurs ; consentement et confirmation de chaque joueur. Mode inaccessible si contrat serveur absent. La préparation du match ne doit pas couper le lobby existant : avant stockage privé opérationnel, réserver le mode aux tests isolés et refuser toute publication publique après affectation des rôles.
- États : `preparing → briefing → running → paused → running → finished`; abandon mène à `cancelled`. `preparing → briefing` fige participants, rôle et terrain. Démarrage après confirmations, puis avance cible de 30 s incluse dans durée de 900 s. Chronologie serveur.
- GPS admissible pour départ/actions : mesure reçue depuis ≤45 s, accuracy ≤30 m, coordonnées valides. Imprécision suspend action concernée ; aucune conclusion de proximité fondée sur position inconnue. Seuils configurés côté serveur et à calibrer, pas garantie de précision réelle.
- Indice automatique toutes les 90 s après avance : cellule de grille locale de 200×200 m contenant dernier fix admissible de cible, élargie aux cellules intersectées par incertitude GPS. Grille orientée au nord et origine égale au centre du terrain ; indices sur même grille toute manche. Révéler seulement surface grossière, âge arrondi et texte ; jamais position exacte ni trajectoire. Fix expiré = « indice indisponible », aucune nouvelle zone présentée comme fraîche.
- Extraction : centre choisi par hôte dans terrain, validé explicitement par cible comme atteignable ; cercle de 50 m, utilisable seulement après 600 s. Cible demande validation en étant arrêtée ; serveur exige deux fixes admissibles espacés de ≥5 s dont distance au centre + accuracy ≤50 m. Aucun POI automatiquement supposé accessible.
- Interception : rencontre confirmée par chasseur puis cible dans 30 s, à l'arrêt, sans contact imposé. Deux validations serveur idempotentes, aucun sondage de distance à cible. Confirmation volontaire comme mécanisme V1, pas promesse anti-triche.
- À 900 s : victoire chasseurs si pas extraction ; extraction validée avant échéance = victoire cible ; interception validée = victoire chasseurs. Transaction verrouillée décide première fin ; timestamp serveur, pas horloge téléphone.
- Perte de signal cible >45 s : état attente clairement affiché ; à 90 s sans signal admissible, pause technique décidée côté serveur. Départ d'un participant ou nouvelle arrivée après briefing : partie suspendue ; revenir à préparation pour réviser roster, jamais rôle ajouté discrètement. Hôte parti : match annulé, salon ferme selon comportement existant.
- Pas de pénalité physique pour sortie du terrain. État incertain distinct ; demander pause et retour choisi par joueur. Pas d'instruction de raccourci. Partie annulable à tout moment par hôte ; joueur peut arrêter partage et quitter.
- Fin/annulation : positions de manche et derniers indices purgés ; récap garde résultat, durée et participants, pas coordonnées. Récap attaché au salon et supprimé à fermeture du salon. Aucun historique GPS de progression.

## Contrat de confiance

Backend Supabase fait autorité. Les données de match exactes vivent dans stockage privé séparé ; accès direct REST, RPC et Realtime filtrés par rôle, pas seulement affichage carte. À entrée en briefing, supprimer atomiquement positions publiques du roster et router toutes publications vers positions privées de match ; ancien client ne doit pas réexposer cible. Chasseurs lisent leurs positions et celles des autres chasseurs ; cible lit sa propre position uniquement. Les indices publics n'exposent ni coordonnées source, ni identifiant de position privée.

Membership, hôte, rôle, timestamp et état contrôlés à chaque RPC. Transitions et fin atomiques, événements ordonnés avec révision, actionId unique pour répétitions. Validation contre horloge serveur ; client n'envoie jamais winner, nouveau rôle arbitraire ou temps restant comme autorité.

Aucun abonnement IA nécessaire pour jouer. OmniRoute reste outil de production/conception indépendant de runtime HUNT. Ne pas injecter clés fournisseur dans `NEXT_PUBLIC_*` ni router GPS/joueurs vers IA.

## Réemploi et limites

Conserver Next/React/Supabase/MapLibre/Lucide/Capacitor, helpers GPS et lifecycle existants. React local state suffit pour vues ; pas nouveau store, framework CSS, outil de mouvement ou package PWA sans besoin démontré. Extraction de `Home` par écran et orchestration testée, pas architecture générique.

Pas de paiement, classements publics, nouveaux modes, notifications push, publication store ou suivi arrière-plan ajouté à ce lot. Emballages natifs existants conservés, compatibilité vérifiée séparément. Déploiement actuel et migrations serveur restent à inspecter au jalon concerné.

## Validation et boucle de conception

Chaque capacité : tests pertinents + build + parcours navigateur + captures + review. S'il reste blocage d'entrée, faux état live, fuite de rôle/position, action cachée ou manche impossible, refuser livraison et réviser conception du bloc. Toute décision modifiée revient dans spec avant code.

Critères techniques : LCP ≤2,5 s, CLS ≤0,1, INP ≤200 ms sur scénario mobile contrôlé et documenté ; mesure sur build production, pas serveur dev. Carte chargée à la demande. Audit accessibilité automatisé sans anomalie grave, puis clavier/lecteur d'écran. Tests SQL avec JWT distincts et Supabase réel isolé avant prod.

Critères de jeu : session à 4 clients jusqu'à extraction/interception/timeout, reconnection, pause, revanche ; essais ensuite sur vrais appareils. Validation terrain : installation iOS/Android, soleil, texte 200 %, signal faible, suspension/reprise et arrêt effectif. Preuves simulées et physiques séparées. Si accès appareils manque : livraison navigateur seulement, statut terrain « non validé ».


