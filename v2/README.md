# Journalier V2 — React + TypeScript

Journalier électronique des Pôles territoriaux WBE (React + TypeScript). **La V2 est la seule version : elle occupe l'adresse principale du site.** Le site publié est le dossier `v2/dist`, tel que compilé par `npm run check`. L'ancienne version (V75) a été retirée du dépôt le 11/11/2026 (étiquette Git `v75-archive` pour la retrouver).

## Pourquoi une réécriture
La première version (V75) est née par ajouts successifs (≈ 33 000 lignes de JavaScript sans structure imposée). La V2 repart d'une architecture claire, vérifiée par le compilateur et par des tests, avec un design soigné et fluide.

## Principes
- **Domaine pur** (`src/domain`) : types du Journalier et règles de rédaction. Aucune dépendance au navigateur, entièrement testé.
- **Données locales** (`src/data`) : une interface `Depot` ; IndexedDB chiffré (AES-GCM, lot 7), mémoire pour les tests.
- **Interface** (`src/ui`, `src/features`) : composants React accessibles, un seul style (jetons CSS), mouvement réduit respecté.
- **Sécurité** : aucun HTML construit à la main (React échappe le texte), politique CSP stricte (`script-src 'self'`), aucun script intégré.
- **Garde-fous** : TypeScript strict, tests automatiques, `npm run check` obligatoire avant fusion (typecheck + tests + build).

## Commandes
Prérequis : Node 26 (version LTS) ou plus récent, comme la CI et le déploiement.
```bash
cd v2
npm install
npm run dev        # compile puis sert http://localhost:5173
npm run check      # typecheck + tests + build (utilisé par la CI)
npm run navigateur # rejoue TOUS les parcours dans un vrai navigateur (Playwright à installer : voir ci-dessous) ; utilisé par la CI
LANG=C.UTF-8 node tools/navigateur/accessibilite.mjs # audit d'accessibilité de tous les écrans (clavier, contrastes, mouvement réduit…) (lot Q)
LANG=C.UTF-8 node tools/navigateur/journalier.mjs   # parcours dans un vrai navigateur (Playwright, serveur sur le port 5199)
LANG=C.UTF-8 node tools/navigateur/eleves.mjs       # idem pour l'écran Élèves (cartes, archivage, passage d'année, suppression)
LANG=C.UTF-8 node tools/navigateur/avatars.mjs      # idem pour les avatars dessinés
LANG=C.UTF-8 node tools/navigateur/pia.mjs          # idem pour l'écran PIA (onglets, enregistrement, export Word)
LANG=C.UTF-8 node tools/navigateur/pia-4b.mjs       # idem pour le PV 2, l'export par partie, dé-identifié, impression
LANG=C.UTF-8 node tools/navigateur/agenda-5.mjs     # idem pour l'agenda : mois, jours fériés, vacances scolaires, horaires réglables
LANG=C.UTF-8 node tools/navigateur/agenda-6.mjs     # idem : glisser pour créer, semaine type, impression
LANG=C.UTF-8 node tools/navigateur/theme.mjs     # bouton de thème Automatique / Clair / Sombre
LANG=C.UTF-8 node tools/navigateur/accueil.mjs     # accueil : ma journée, séances à encoder, mémos (conservés après rechargement), état de la synchro, téléphone (lot A)
LANG=C.UTF-8 node tools/navigateur/accueil-suite.mjs # de bout en bout : objectif, observation, aide et « Suite » saisis dans l'écran Séance sont repris sur l'accueil (lot A)
LANG=C.UTF-8 node tools/navigateur/captures.mjs    # captures de tous les écrans (4 tailles × clair/sombre) pour relire l'habillage (lot F)
LANG=C.UTF-8 node tools/navigateur/ameliorations-u.mjs # lot U : panneau de l'agenda, horaire libre, enseignants, évolution
LANG=C.UTF-8 node tools/navigateur/lot-v.mjs # lot V : matière en pastilles, points de vigilance, menu réductible
LANG=C.UTF-8 node tools/navigateur/lot1-donnees.mjs # audit lot 1 : brouillon de séance, suppressions confirmées, « Annuler »
LANG=C.UTF-8 node tools/navigateur/lot2-defilement.mjs # audit lot 2 : défilement natif (rubriques, focus, bande, dialogues)
LANG=C.UTF-8 node tools/navigateur/lot4-clavier.mjs # audit lot 4 : vraies touches (Tab, Échap), tiroirs, grille, noms, erreurs, mouvement réduit
LANG=C.UTF-8 node tools/navigateur/lot5-coherence.mjs # audit lot 5 : capitales, graisses, jetons, vocabulaire, ordre des noms
LANG=C.UTF-8 node tools/navigateur/lot6-naissance.mjs # audit lot 6 : date de naissance (aussi lot6-annee, lot6-apres-seance, lot6-premier-eleve, lot6-sorties, lot6-doublon, lot6-agenda, lot6-pia, lot6-brouillons, lot6-fiche, lot6-vide, lot6-adresse-fiche, lot6-couleurs, lot6-pia-entete, lot6-seance-colonnes, lot6-agenda-protege, retours-agents)
LANG=C.UTF-8 node tools/navigateur/lot3-tactile.mjs # audit lot 3 : zones de 44 px, textes de 12 px, survols, contrastes (contexte tactile à 390 et 768 px)
LANG=C.UTF-8 node tools/navigateur/lot2b-tactile.mjs # audit lot 2b : gestes tactiles (profil iPad), position au retour, WebKit si installé
LANG=C.UTF-8 node tools/navigateur/seance-sp.mjs     # lot SP : barre d'étapes, jauge, résumés, « Étape suivante », zones de texte
LANG=C.UTF-8 node tools/navigateur/site.mjs      # la V2 servie sous /journalier-electronique/ comme sur GitHub Pages : connexion, adresse de retour Microsoft, modèles Word (lot S)
LANG=C.UTF-8 node tools/navigateur/coffre.mjs    # coffre chiffré : verrou, mode essai, rien en clair, clé perdue, migration, copie avec mot de passe
# Depuis le lot 7, ces parcours passent par le mode essai (aide commune : tools/navigateur/_coffre.mjs).
LANG=C.UTF-8 node --import tsx tools/navigateur/synchro.mjs   # synchronisation : démonstration, conflits, Outlook, copie de secours, connexion Microsoft (faux Microsoft)
```

**Playwright** (outil de vérification, jamais une dépendance de l'application) : en local, `npm install --no-save playwright@1.63.0` puis `npx playwright install chromium webkit` (WebKit : moteur de Safari, utilisé par le parcours `lot2b-tactile`, ignoré avec un avertissement s'il manque) dans `v2/` (ou la variable `PLAYWRIGHT=<chemin>/playwright/index.mjs`). La CI le fait toute seule (`.github/workflows/ci.yml`) : elle tourne dans l'image officielle de Playwright (`mcr.microsoft.com/playwright`, version et empreinte épinglées) qui contient déjà les navigateurs. Les parcours d'un autre nom que `_…` sont tous repris par `npm run navigateur`.

**Sans accès au registre npm** (environnement de travail de Claude) : les paquets aux bonnes versions (esbuild, zod, React, TypeScript, tsx) sont souvent déjà installés sur la machine ; on les relie dans `v2/node_modules` (liens symboliques, dossier ignoré par Git) et on ajoute `@types/react`, `@types/react-dom` (DefinitelyTyped) et `csstype` récupérés depuis GitHub.

## Organisation du travail
Un lot de travail par conversation : voir `docs/plan-de-travail.md` (liste des lots, fin de lot) et `docs/etat-des-lieux.md`.

## État d'avancement
| Domaine | État |
| --- | --- |
| Moteur de rédaction (blocs, synthèse, absences, dé-identification) | porté et testé |
| Écran Séance (5 étapes, feuille vivante) | disponible |
| Référentiel de compétences (pistes) | onze matières, tronc commun et S3–S6 (lots R1–R3 en partie : voir `docs/etat-des-lieux.md`) ; fusionné dans `main` le 10/11/2026 (demande #50) |
| Élèves (cartes, recherche, fiche, archivage, suppression, passage d'année, plusieurs langues) | disponible (lots 2 et 2b, avatars dessinés compris) |
| Écran Journalier (période, modifier/supprimer, export Word élève ou tous) | disponible (lot 1) |
| Agenda (semaine / jour / mois, couleurs, glisser‑déplacer, jours fériés et vacances scolaires FWB, horaires des périodes réglables) | disponible (lots 5 et 6 : + semaine type, création en glissant sur plusieurs périodes, impression) |
| Réunion (résumé par matière, objectifs à valider, texte à copier) | disponible (lot 3), maintenant onglet « Préparer » du PIA |
| PIA (profil, procès-verbaux 1 et 2, aménagements, export Word entier ou par partie ; onglet Préparer = ex-Réunion) | disponible (lots 4a et 4b : PV 2, export par partie, version dé-identifiée, impression / PDF) |
| OneDrive / Outlook (synchronisation sûre, conflits, copie de secours, mode démonstration) | disponible (lot 8) ; **première vraie connexion à essayer par l'utilisateur** |
| Données de démonstration (bouton sur l'accueil, effaçables) | disponible (lot 8) |
| Coffre chiffré (écran verrouillé, mode essai, migration de l'ancienne base, copie de secours avec mot de passe) | disponible (lot 7) |
| « Repartir de OneDrive » (nouvel ordinateur) | disponible (lot 9b) ; **à essayer avec un vrai compte par l'utilisateur** |
| Agenda : les séances réalisées (même non planifiées) apparaissent dans l'agenda | disponible (lot 9c) |
| Agenda : horaires par école (plusieurs écoles, heures réelles sur les cases, avertissement de chevauchement ou de trajet, heures réelles dans Outlook) | disponible (lot 10) ; **à essayer avec les vraies écoles par l'utilisateur** |
| Finition visuelle (palette « Encre et papier », menu adapté à la tablette en portrait, logo, icônes) | **lot F terminé** (palette, cadre, logo, icônes ; tous les écrans relus) ; reste le retour de l'utilisateur sur sa tablette |
| Finitions techniques : accessibilité (lien « Aller au contenu », titre et focus à chaque écran, cibles, mouvement réduit), vérification des données par schémas (zod), parcours navigateur dans la CI | **lot Q terminé** ; reste : première exécution du contrôle GitHub, essai au lecteur d'écran |
| Séance : barre d'étapes, jauge, résumés par rubrique, couleur par zone, « Étape suivante » | **lot SP terminé** et validé |
| Audit du 6-7 novembre, lot 1 (protéger les données) : brouillon de séance, confirmations, « Annuler » | **fait en local, en attente de validation** |
| Audit du 6-7 novembre, lot 2 (défilement natif) : atterrissage des rubriques, focus, bande, dialogues | **fait en local, en attente de validation** |
| Audit du 6-7 novembre, lot 2b (gestes tactiles de l'agenda, position au retour) | **fait en local, en attente de validation** |
| Audit du 6-7 novembre, lot 3 (tactile et lisibilité : 44 px, 12 px, contrastes) | **fait en local, en attente de validation** |
| Audit du 6-7 novembre, lot 4 (clavier, lecteur d'écran, mouvement réduit) | **fait en local, en attente de validation** |
| Audit du 6-7 novembre, lot 5 (cohérence : jetons, vocabulaire, ordre des noms) | **fait en local, en attente de validation** |
| Audit du 6-7 novembre, lot 6 (fonctionnel : date de naissance, nouvelle année PIA, premier élève…) | **fait en local, en attente de validation** |
| Retouches du 4 novembre (tablette) : matière en pastilles, points de vigilance, menu réductible, fiche élève | **lot V terminé** |
| Retouches du 3 novembre : encodage depuis l'agenda, horaire libre, enseignants par cours, évolution lisible | **lot U terminé** ; reste : référentiel (lots R) |
| Mise en service : la V2 à l'adresse principale (fusion de la demande #37, 27/10/2026) ; la V75 retirée du site et du dépôt (11/11/2026) | **terminé** ; reste à l'utilisateur : retirer l'adresse `/v75/` chez Entra |

## Outils de build
`esbuild` compile le TypeScript et React (script `scripts/build.mjs`). Pas de Vite : l'environnement de développement initial n'avait pas accès au registre npm, et `esbuild` suffit à ce stade.
