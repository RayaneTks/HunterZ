# Gouvernance de projet HUNT

Cette charte organise le travail humain et assisté par IA autour de HUNT. Elle sépare les décisions produit, la conception technique, la réalisation, l'intégration, la vérification, les obligations légales et la publication. Elle complète la [direction produit](product-direction.md) et ne remplace ni une revue humaine, ni les règles de sécurité du dépôt.

## Pilotage

Le responsable de projet (agent principal dans cette équipe) porte la cohérence de bout en bout : il transforme les demandes en résultats vérifiables, arbitre les propositions, nomme un pilote par bloc, maintient les dépendances et décide si le résultat est acceptable. Les agents apportent une expertise bornée; ils ne redéfinissent pas seuls la promesse du jeu, ne fusionnent pas leur travail sans revue et ne considèrent pas leur propre livraison comme validée.

Le propriétaire humain reste l'autorité finale sur la vision, le périmètre public et les arbitrages majeurs. Les décisions réversibles et les détails d'exécution sont pris par le responsable de projet sans solliciter inutilement le propriétaire.

## Pôles et mandats

| Pôle | Mandat | Livrables attendus | Frontière explicite |
| --- | --- | --- | --- |
| **Produit & expérience joueur** | Transformer la promesse HUNT en parcours, règles, modes, états et priorités testables. Inclut game design, UX et direction artistique comme expertises spécialisées. | Brève produit, critères d'acceptation, flux/maquettes textuelles, décisions consignées. | Ne change pas seul l'architecture ou les règles de confidentialité; signale les hypothèses à valider. |
| **Architecture & ingénierie** | Concevoir les contrats, modules, modèle de données, sécurité, clients iOS/Android/web et pratiques de code. | Note d'architecture, interfaces, migrations/API, code limité au bloc assigné. | Ne redessine pas la boucle de jeu ou la politique de données sans revue Produit, Légal et Intégration concernée. |
| **Réalisation par bloc** | Construire un seul module cohérent à partir d'un brief accepté et de contrats stables. | Changements ciblés, tests appropriés au bloc, limites connues et instructions de reprise. | N'élargit pas la portée, ne modifie pas les fichiers transverses partagés sans accord du pilote d'intégration. |
| **Qualité & sécurité** | Vérifier les critères, cas limites, accessibilité, confidentialité, erreurs et régressions de manière indépendante de l'auteur. | Rapport avec preuve reproductible, sévérité, périmètre vérifié et anomalies bloquantes. | Ne déclare pas une fonctionnalité testée sur appareil si elle n'a été vérifiée qu'en simulateur ou par compilation. |
| **Intégration & architecture de livraison** | Découper le travail, maintenir les contrats entre blocs, contrôler migrations/dépendances/conflits et coordonner la revue croisée. | Carte des dépendances, propriétaire de bloc, checklist de merge, plan de rollback. | Ne certifie ni la qualité métier seule, ni la disponibilité production; recueille les validations correspondantes. |
| **Juridique, vie privée & confiance** | Tenir une veille évolutive sur localisation, sécurité physique, mineurs, stores, données, contenus et marchés. | Mémo sourcé, hypothèses/juridictions, risques, décisions produit à prendre et déclencheurs de révision. | Recherche produit interne seulement : ne donne pas d'avis juridique définitif et ne contacte aucun tiers sans mandat explicite. |
| **Release & opérations** | Préparer CI/CD, builds, notes de version, observabilité, vérification après publication et retour arrière. | État CI, artefact/version, preuve de déploiement, migration, procédure de reprise. | Distingue toujours code poussé, CI réussie, site servi, migration appliquée, binaire natif signé et publication dans les stores. |

Un agent peut contribuer comme expert à un autre pôle seulement si le pilote du bloc le demande et que cette contribution est explicitement limitée. Le même agent ne valide jamais seul son propre travail.

## Protocole de découpage et d'affectation

Chaque bloc prêt à démarrer possède une fiche courte, conservée dans `docs/work/` quand plusieurs blocs sont actifs :

1. **Résultat joueur** et hors-périmètre explicite.
2. **Périmètre technique** : modules/fichiers assignés et fichiers partagés à ne pas modifier.
3. **Dépendances et contrats** : API, schéma, permission, événements ou décision préalable.
4. **Pilote unique**, expert(s) consulté(s), intégrateur et relecteur qualité distincts.
5. **Critères d'acceptation observables**, vérifications autorisées et limites d'environnement.
6. **Stratégie d'intégration/rollback**, migrations ou configuration externe éventuelles.

Le pilote signale d'abord les fichiers qu'il prévoit de toucher. L'intégrateur découpe ou sérialise les tâches si elles se recouvrent. Les modifications aux contrats communs (`app/page.tsx`, navigation/layout global, schéma partagé, configuration Capacitor, dépendances, CI) sont coordonnées et ne sont pas attribuées en parallèle à plusieurs agents.

## Cycle de validation

1. **Cadrage** : Produit décrit le problème et l'expérience attendue; Légal et Qualité signalent tôt les contraintes pertinentes.
2. **Conception** : Architecture et Intégration stabilisent les contrats et les dépendances avant toute réalisation qui les touche.
3. **Réalisation** : un pilote par bloc, portée figée; le pilote remonte les écarts au lieu de les résoudre en élargissant silencieusement le périmètre.
4. **Revue indépendante** : Qualité vérifie exigences, cas d'erreur et effets sur les parcours voisins; intégrateur vérifie cohérence, sécurité des données et migrations.
5. **Décision de livraison** : le responsable de projet accepte, demande des corrections ciblées ou rejette avec preuves et nouvelle affectation. Une approbation d'agent n'est pas une preuve de fonctionnement.
6. **Publication** : Release ne publie qu'un bloc accepté et vérifié par les contrôles pertinents. La confirmation de production requiert une preuve observable depuis la cible (URL/version ou store), et non seulement un push.
7. **Apprentissage** : noter incidents, décisions réutilisables et révisions de veille; réaffecter les agents quand un jalon modifie les hypothèses.

Les gates s'adaptent au bloc : parcours web, migration, GPS en arrière-plan, haptique et Live Activity ne partagent pas le même moyen de preuve. Aucun résultat « natif », « sécurisé », « légalement conforme » ou « en production » n'est annoncé au-delà de ce qui a été réellement vérifié.

## Discipline d'équipe IA

- Fournir à chaque agent uniquement le contexte utile, le mandat, les fichiers autorisés, les dépendances et une définition de fini; inclure la direction produit et les décisions récentes lorsqu'elles s'appliquent.
- Demander des sources officielles pour la veille juridique/plateforme et différencier faits, interprétations, recommandations et inconnues.
- Exiger des comptes rendus avec fichiers modifiés, preuves lancées, limites, décisions prises et questions restantes. Pas de récit non vérifiable.
- Un agent ne doit pas créer d'autres agents, élargir sa mission ou modifier la feuille de route sans instruction du responsable de projet.
- Revue contradictoire pour les changements à risque élevé : un auteur, un relecteur Qualité et un intégrateur; les décisions de produit sont arbitrées séparément du code.
- Réduire la taille des lots, garder la CI comme gate et éviter les réécritures transverses. Toute anomalie découverte est enregistrée puis soit corrigée dans le bloc, soit isolée comme dépendance explicitement bloquante.
- Le responsable de projet relance les pôles concernés quand une décision, un changement d'architecture, de données, d'audience, de plateforme ou de modèle économique rend leur avis périmé.

## Relance continue des expertises

| Déclencheur | Pôles à réactiver |
| --- | --- |
| Changement de mode, règle de chasse, récompense ou onboarding | Produit & expérience, Qualité; Architecture si modèle serveur/API touché |
| Nouvelle permission, GPS hors premier plan, visibilité ou conservation de position | Architecture, Qualité & sécurité, Juridique/vie privée, Release mobile |
| Nouveau marché, public mineur, UGC public, partage social, monétisation ou nouveau SDK | Juridique/vie privée, Produit, Architecture, Qualité & sécurité |
| Changement de schéma, événements temps réel ou module partagé | Architecture, Intégration, Qualité, Release/migration |
| Nouveau système visuel ou parcours critique | Produit & expérience, accessibilité/Qualité, intégration UI |
| Préparation d'un jalon, store ou lancement public | Tous les pôles; veille légale mise à jour selon marchés et fonctionnalités effectivement retenus |
| Incident ou échec de CI/déploiement | Qualité, Intégration, Release; auteur du bloc seulement après diagnostic borné |

À chaque relance, le responsable transmet au pôle : direction actuelle, changements depuis son dernier rapport, question précise, sources/artefacts à examiner et date/condition de révision suivante. Une veille continue signifie des déclencheurs explicites et des mises à jour aux jalons; ce n'est pas une surveillance automatique ou juridique en temps réel.

## État des pôles au 9 octobre 2026

- Les premières orientations Produit, game design, rétention, UX mobile et direction visuelle sont synthétisées dans `docs/product-direction.md`; ce sont des hypothèses de conception à valider par prototypes et tests joueurs.
- L'audit architecture, l'audit intégration et la revue qualité ont repéré des limites natives non résolues, en particulier la compilation réelle iOS/Android, le suivi verrouillé et les surfaces Live Activity/Dynamic Island.
- La veille juridique initiale, sourcée au 9 octobre 2026, est dans [`legal/veille-juridique-initiale-2026-10-09.md`](legal/veille-juridique-initiale-2026-10-09.md). Elle doit être revue à chaque déclencheur ci-dessus et avant toute mise à disposition publique.
- La CI et l'outillage de release sont des moyens de livraison, pas une preuve que les migrations de production, Vercel ou les stores ont été configurés et vérifiés.
- Aucun mode complet La Piste, géorepérage serveur, Widget iOS/Dynamic Island ni distribution de binaire mobile n'est déclaré livré par cette charte.
