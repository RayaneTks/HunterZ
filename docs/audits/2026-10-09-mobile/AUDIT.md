# HUNT — audit de refonte, 9 octobre 2026

## Périmètre et méthode

Dépôt https://github.com/RayaneTks/HunterZ, récupéré par `git pull --ff-only origin main`, HEAD `c8fa9141367c5a4c8ae36a0eba529800a2b4e3dd`. Branche locale `feat/hunt-private-gps-lobby-v1`. Sources synchronisées du projet ChatGPT laissées intactes.

Charge de référence : une escouade privée de 4 à 10 joueurs. Audit centré sur entrée, salon, carte, GPS, installation et contrats serveur ; aucune certification de charge globale, de sécurité exhaustive ou de fonctionnement natif.

Instructions appliquées : Ponytail (réemploi, audit par preuves), Addy Osmani (spec, découpage, UI accessible), Graphify (dépendances AST/SQL), OmniRoute (préparation d'outillage local). Sources officielles et versions dans `tooling.md`.

## Preuves exécutées

| Contrôle | Résultat |
|---|---|
| `npm ci` | Dépendances verrouillées synchronisées ; 3 alertes modérées rapportées par npm, sans correction forcée |
| `npm test` | 30/30 passent |
| `npm run typecheck` | Passe |
| `npm run build` | Passe ; export statique, Next 15.5.27 ; entrée annoncée 190 kB First Load JS |
| `npx playwright test` | 1 passe, 1 échoue ; scénario à deux joueurs bloqué avant connexion |
| Captures navigateur Chromium | 390×844 et 320×568 ; journal nouveautés masque l'accueil |
| Graphify | 483 nœuds, 708 relations brutes, 660 liens après regroupement, 35 communautés |

Les sessions de développement et de build ont brièvement partagé `.next` pendant cet audit. L'échec E2E est néanmoins corroboré par capture séparée, trace explicite d'interception et code `setOpen(unseenRelease)` ; répéter les contrôles séquentiellement lors de la réalisation.

## À corriger avant livraison

1. **Entrée masquée par nouveautés.** `components/ReleaseNotes.tsx` ouvre le dialogue automatiquement au premier chargement d'une version déclarée Vercel. Le test attend « Entrer dans HUNT » mais `release-backdrop` intercepte le clic jusqu'au timeout de 120 s. Correction : nouveautés consultables volontairement, aucune modale automatique sur accueil, invitation ou manche. Test de non-régression sur première ouverture et stockage indisponible.
2. **Pas de manche jouable.** `lib/types.ts` décrit profil, salon, terrain et positions ; `supabase/schema.sql` ne définit ni match, ni rôle, ni objectif, ni résultat. Une refonte cosmétique ne crée pas le jeu demandé. Concevoir puis construire une boucle complète avant d'afficher « Jouer ».
3. **Hors ligne non prévu.** Aucun service worker ni enregistrement trouvé dans `app/`, `components/`, `lib/`, `public/`. Installation via manifeste reste possible selon navigateur ; cela ne fournit pas un démarrage hors ligne. Ajouter shell hors ligne et erreurs réseau honnêtes.
4. **Accessibilité limitée.** `app/layout.tsx` impose `maximumScale: 1` et `userScalable: false`. CSS contient des informations à 9–12 px. Autoriser zoom de page, conserver gestes carte dans son conteneur, tester texte à 200 % et contraste mesuré.
5. **Préparation trop dense.** `app/page.tsx` assemble profil, entrée, salon, carte, consentement, terrain, concepts et erreurs. Graphify mesure 36 liens pour `Home()`. Extraire écrans par responsabilité, conserver chemins GPS et RPC testés ; éviter nouveau framework ou store global gratuit.
6. **Installation incomplète.** `InstallPrompt` disparaît hors iOS si événement navigateur absent ; détection iPad dépend uniquement du user-agent ; événement `appinstalled` non traité. Ajouter aide persistante adaptée à la capacité disponible, détection iPadOS, refus et succès.
7. **Confidentialité à changer avant La Piste.** Aujourd'hui les membres du salon peuvent lire les positions du salon. Ce contrat convient au lobby, pas à une cible secrète. Masquer dans l'UI seul serait insuffisant : lecture directe REST et événements temps réel doivent être filtrés côté serveur.

## À préserver

Logo réticule et point corail ; pseudo sans compte complexe ; salon privé, invitation, restauration ; RPC authentifiées ; lifecycle GPS ordonné et stoppable ; fraîcheur de position ; consentement explicite ; MapLibre et attribution ; terrain partagé ; labels d'incertitude ; mouvement réduit.

`android/gradlew.bat` apparaît modifié après pull : 94 lignes remplacées, diff ignorant fins de ligne vide. Ne pas inclure ce changement de format dans refonte, ne pas écraser sans vérifier origine.

## Limites de preuve

E2E utilise backend simulé : ne prouve pas Supabase production. GPS des tests simulé. Aucun essai iPhone/Android physique, soleil, batterie, écran verrouillé, VoiceOver/TalkBack ni installation réelle effectué. Graphify signale 3 fichiers Gradle partiellement/non extraits, 5 fichiers sans symbole, 2 boucles et 48 relations fusionnées ; 31 liens du rapport sont inférés. Utiliser graphe comme navigation, puis vérifier source. Aucun endpoint manquant dans diagnostic du graphe.

## Décision

Version actuelle refusée comme « bon jeu mobile livré » : entrée bloquée et boucle de partie absente. Réalisation à découper en expérience mobile, installation fiable et La Piste. Chaque jalon exige preuves distinctes ; échec critique ramène à conception du bloc concerné, pas à retouche décorative.
