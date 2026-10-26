# Plan de travail de la V2 (un lot = une conversation)

Mis à jour le 26 octobre 2026 (lots 1, 2, 2b et 3 terminés). Ce fichier est la **liste des lots**. Pour démarrer : ouvrir une nouvelle conversation, écrire « Lot N » (ou « le lot suivant ») ; Claude lit `AGENTS.md`, ce plan et `docs/etat-des-lieux.md`, puis travaille uniquement sur ce lot.

## Principe
- Une conversation = un lot. Pas de dérive vers un autre lot : toute idée en plus va dans « Idées en attente » ci‑dessous.
- Un lot est **fini** quand sa liste « Critères de fin » est vraie ET que la **fin de lot** (ci‑dessous) est faite.
- Si un lot est trop gros pour une conversation, on le coupe (ex. 5a / 5b) et on met le plan à jour.

## Fin de lot (obligatoire, dans cet ordre)
1. `cd v2 && npm run check` vert (typecheck + tests + build). Si le registre npm est bloqué, relier les paquets déjà présents sur la machine dans `v2/node_modules` (voir README, « Sans accès au registre »).
2. Vérification dans un vrai navigateur : scripts Playwright dans `v2/tools/navigateur/` (en ajouter un par lot) ; aucune erreur console.
3. Mettre à jour : `docs/etat-des-lieux.md` (Fait / Reste), ce plan (statut du lot, lot suivant conseillé), `AGENTS.md` (décisions durables, nouveaux dossiers), `docs/decisions.md` (une ligne par décision), `README.md` (tableau d'avancement).
4. Commit + push sur `v2/react-ts` (jamais `main`), PR #37 mise à jour.
5. Dire à l'utilisateur en français simple : ce qui marche, ce qui reste, **quel lot lancer ensuite**.

## Statuts
✅ fait · 🔜 conseillé ensuite · ⏳ à faire · ⏸ en pause

## Déjà fait (avant le plan par lots)
✅ Socle (React/TS, domaine, données locales, CI) · ✅ Séance en 5 étapes + moteur de rédaction · ✅ Référentiel (partiel, voir lots R) · ✅ Écran Élèves (fiche, historique) · ✅ Export Word du Journalier (modèle papier) · ✅ Agenda (semaine/jour, couleurs, glisser-déplacer, répétition, Encoder).

## Lots

### Cœur du produit (priorité)
| Lot | Contenu | Critères de fin | Statut |
|---|---|---|---|
| 1 — Journalier (écran) | Écran « Journalier » : séances d'un élève ou de tous, période (année scolaire, état à ce jour, dates libres), modification/suppression d'une séance, export Word par période (identifié / dé‑identifié) depuis cet écran | Parcours séance → Journalier → Word sans passer par Élèves ; période respectée dans le fichier | ✅ (24/10/2026) |
| 2 — Élèves complets | Page Élèves en cartes (initiales sur pastille de couleur), recherche, matière libre, plusieurs langues modernes, archivage, suppression complète (séances et agenda compris, confirmation), passage d'année scolaire ; recherche d'une séance au Journalier | Suppression testée ; aucune séance orpheline (vérifié dans la base du navigateur) | ✅ (24/10/2026) |
| 2b — Avatars dessinés | **Pas de photo** : avatar dessiné au choix, personnalisable (teint, coiffure, couleur des cheveux, visage, accessoire) en cinq styles génériques (manga, bande dessinée, dessin animé, pixel, minimaliste), dessins originaux, sans personnage ni marque existants ; sans avatar, les initiales | Dessins relus sur écran par l'utilisateur ; choix conservé après rechargement ; initiales si aucun avatar | ✅ (26/10/2026, dans la même conversation que le lot 2) — **à relire par l'utilisateur** |
| 3 — Réunion | Vue réunion en langage simple par matière (points d'appui, à travailler, compétence, aides), choix de la période, propositions d'objectifs à valider | Synthèse correcte sur des séances réelles ; textes relus par l'utilisateur | ✅ (26/10/2026) — **textes à relire par l'utilisateur** |
| 4a — PIA : écran, profil, PV 1 | Écran **PIA** par élève et par année scolaire, parties dans l'ordre du modèle officiel : identité (préremplie), **profil** (tableau Aspect / Ressources / Difficultés / Objectifs), **PV 1** (présents, axe, objectifs et critères, ressources, retours) et **aménagements** (une ligne = un aménagement, cases P / O / M). La page Réunion du lot 3 devient l'onglet « Préparer » de cet écran (ses objectifs retenus alimentent le profil et le PV 1). Brouillon enregistré. Propositions d'aménagements tirées des aides. Export Word du PIA entier (modèle `public/modeles/PIA_modele_officiel_2025-09-11.docx`, structure : `docs/PIA_MODELE_STRUCTURE.md` à la racine du dépôt) | PIA complet rempli, fichier comparé au modèle officiel (conversion PDF relue) ; objectifs retenus enregistrés | ✅ 26/10/2026 |
| 4b — PIA : PV 2 et exports | PV 2 de fin d'année : évaluation des objectifs du PV 1 (atteint / en partie / pas atteint) avec rappel des séances depuis le PV 1, mise à jour des aménagements pour la rentrée ; export de chaque partie à part ; version dé-identifiée ; option PDF | PIA de fin d'année complet ; chaque partie exportable | ✅ 26/10/2026 |

### Agenda
| Lot | Contenu | Statut |
|---|---|---|
| 5 — Agenda : calendrier | Vue mois, jours fériés et vacances scolaires FWB, horaires des périodes réglables | ⏳ |
| 6 — Agenda : confort | « Semaine type », glisser pour créer sur plusieurs périodes, impression | ⏳ |

### Données et sécurité
| Lot | Contenu | Statut |
|---|---|---|
| 7 — Coffre chiffré | Chiffrement AES‑GCM local (voir `docs/STOCKAGE_LOCAL_V74.md`), mot de passe, verrouillage, export/import de secours | ⏸ abandonné pour l'instant (26/10/2026) : la connexion au compte professionnel Outlook protège l'accès |
| 8 — OneDrive / Outlook | Synchronisation Microsoft (Entra ID, Graph), conflits, repli manuel ; liaison Outlook (agenda) | 🔜 |
| 9 — Reprise V75 | Import des données de la V75 vers la V2, vérification élève par élève, plan de bascule et d'information de l'équipe | ⏳ |

### Référentiel (« R »), à reprendre quand l'utilisateur le décide
| Lot | Contenu | Statut |
|---|---|---|
| R1 — Histoire‑géographie et technique | Extraction (2022, 1999, HPT 2014) puis technique manuel/technologique ; droit détaillé | ⏳ |
| R2 — Langues | Anglais/allemand du tronc commun ; correspondance CECRL ↔ année ; grammaire par langue | ⏳ |
| R3 — Qualité des pistes | Relecture par échantillon, lignes tronquées, alias de terrain, regroupement des formulations proches, essai sur de vrais objectifs (journaux réels) | ⏳ |

### Qualité
| Lot | Contenu | Statut |
|---|---|---|
| Q — Finitions | Schémas zod, `package-lock.json` (quand le registre est accessible), accessibilité (lecteur d'écran, clavier), performance, tests navigateur dans la CI | ⏳ |

### Habillage
| Lot | Contenu | Statut |
|---|---|---|
| F — Finition visuelle (dernier lot) | Habillage de l'application : couleurs, logo, vocabulaire du menu, icônes, espacements, tablette ; relecture écran par écran avec l'utilisateur. Le style « Bleu encre » reste la base (décision validée) sauf demande contraire. | ⏳ (à faire en tout dernier) |

## Ordre conseillé
1 → 2 → 2b → 3 → 4a → 4b ✅ (le fil séance → Journalier → réunion → PIA est complet) → 8 → 9 (mise en service ; lot 7 en pause) ; les lots 5, 6, R et Q s'intercalent selon les retours de l'équipe. Le lot F (finition visuelle) vient en tout dernier. L'utilisateur peut changer l'ordre à tout moment : on met alors ce fichier à jour.

## Cadrage du PIA (validé avec l'utilisateur le 26/10/2026)
- Le PIA = le document entier ; il doit être disponible à la fin de la réunion. Deux réunions par an = deux procès-verbaux (PV 1 en cours d'année, PV 2 en fin d'année qui évalue les objectifs du PV 1).
- L'agent écrit le PV. L'axe de difficulté et le profil peuvent être posés avant la réunion et complétés pendant (CPMS, enseignants, parents, collègues apportent des informations).
- Le tableau de la page 2 est le **profil** : une fois par PIA, avant le PV 1 ; il peut évoluer en cours d'année.
- Aménagements : une ligne = un aménagement, on coche le type — P pédagogique (méthodes d'enseignement, d'évaluation, d'apprentissage), O organisationnel (temps, espace, déroulement), M matériel (outils, mobilier, logiciels).
- Comme pour le Journalier : l'écran visualise chaque partie ; on peut exporter par partie, mais le PIA est le document entier.
- **Profil (tableau page 2) : décisions du 26/10.** Le tableau décrit l'élève dans son ensemble (pas matière par matière) ; textes courts et généraux ; une partie vient d'ailleurs que des séances (pathologie, diagnostic, CPMS). **Rien n'est complété automatiquement** : l'agent écrit librement chaque case. L'application donne des **indices** (cliquer pour ajouter, jamais imposés) : des phrases génériques par aspect et par colonne (ex. « Renforcer la persévérance », « Automatiser l'usage de l'outil numérique »), et des rapprochements tirés des séances pour **Cognitif, Lié à l'autonomie et Comportemental et affectif** (ce qui revient sur plusieurs séances ou plusieurs matières). Rangement de départ des rubriques d'observation (modifiable) : Compréhension et Réalisation → Cognitif ; Organisation / fonctions exécutives → Lié à l'autonomie ; Rapport à l'aide / engagement → Comportemental et affectif. « Physique et psychomoteur » et « Communication » : saisie libre et phrases génériques seulement. Deux niveaux d'objectifs distincts : objectifs généraux du profil, et objectifs de la période du PV 1 (avec critères d'évaluation), préparés par l'onglet « Préparer ». Les informations de santé du profil restent sur l'appareil (coffre chiffré au lot 7).
- Fait au lot 4a (à relire avec l'utilisateur) : l'utilisateur a demandé des exemples concrets (« j'ai du mal à savoir quoi écrire, quels sont les attendus ») : prévoir pour chaque case un exemple affiché en indice, à relire avec lui. Correspondance aide → P/O/M à valider (proposition de départ : reformulation, explicitation, décomposition, modélisation, guidage → P ; aide à l'organisation, environnement → O ; matériel, outil numérique, gabarit → M ; support visuel → P, sauf problème de vue de l'élève, ce qui est rare : décision du 26/10).
- Le code PIA de la V75 (`src/v74/pia-*.js`, `v74-docx-pia-pv.js`, tests `tests/pia-*.mjs`) peut servir de référence, pas de copie.

## Idées en attente (non planifiées)
- PIA (lot 4b) : PDF fidèle au modèle officiel (aujourd'hui : Word puis « Enregistrer en PDF » ; l'impression du navigateur est une mise en page simple) ; exporter aussi la version dé-identifiée de plusieurs élèves d'un coup (.zip) ; effacer les données de l'exemple fictif d'un seul bouton.
- PIA (lot 4a) : choisir la matière d'un objectif ajouté à la main au PV 1 ; ajouter des rapprochements pour les autres aspects si l'équipe en demande ; importer un PIA existant (lot 9) ; rappel dans l'agenda de la date du PV 2.
- Journalier : en-tête du document Word avec la période choisie (aujourd'hui elle n'est que dans le nom du fichier) — à valider avec l'équipe (le modèle papier n'a pas de case prévue).
- Accueil : rendre les « Dernières séances » cliquables vers le Journalier.
- Menu : un second clic sur « Élèves » depuis un dossier ouvert ne ramène pas à la liste (seul « ← Tous les élèves » le fait).
- Archivage : les activités d'agenda (séries hebdomadaires) d'un élève archivé restent visibles ; à voir avec l'équipe si elles doivent se masquer ou s'arrêter à l'archivage.
- Avatars : afficher aussi l'avatar au Journalier, dans l'agenda et dans l'écran Séance ; ajouter des coiffures/accessoires si l'équipe en demande ; avatar choisi au hasard à la création d'un élève.
- Réunion : afficher aussi les remarques libres et la question « Utilisé ailleurs ? » (transfert) dans le résumé ; objectif retenu en zone de texte (un long texte est coupé sur téléphone) ; choisir la matière d'un objectif ajouté à la main.
- Thème sombre : le bouton secondaire (`.btn`) manque de contraste dans toute l'application — à traiter au lot F.
- Élèves : tri au choix des cartes (nom, classe, dernière séance) et filtre par classe, si la liste devient longue.
