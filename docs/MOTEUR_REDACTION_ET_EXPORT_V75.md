# Moteur de rédaction et export Word du Journalier — V75

## Rôle

Transformer une séance encodée en texte français prêt à être lu à l'écran ou écrit dans le Word, **sans IA générative ni réseau** : même séance, même texte (déterministe).

Fichiers :

| Fichier | Rôle |
| :--- | :--- |
| `src/app/redaction-engine.js` | Moteur (`window.JournalierRedaction`) |
| `src/app/journalier-seances-docx.js` | Remplissage du modèle Word papier (`window.JournalierSeancesDocx`) |
| `src/app/session-levels.js` | Contrôle de niveau de la page séance (`window.JournalierLevels`) |
| `src/app/reunion-view.js` | Vue « Réunion » et export du PIA visible |
| `public/modeles/Journalier_modele_papier.docx` | Modèle Word (un tableau prototype par séance) |
| `tests/redaction-engine.test.cjs`, `tests/journalier-seances-docx.test.cjs` | Tests |

Ce sont des **scripts classiques** (UMD) : ils doivent figurer dans `index.html` **et** dans la liste `copyClassicAppScripts()` de `vite.config.js`, sinon ils manquent au build.

## Chaîne de traitement

`séance enregistrée` → **faits** (`normaliser`) → **constats** (évolution, regroupement par niveau) → **texte** (`construireBloc`) → **contrôles** (`controler`) → Word ou écran.

Règles d'écriture :

- Voix neutre : « l'élève », jamais de genre.
- Niveaux regroupés et nommés (« Totalement : … ; Partiellement : … »), jamais de comptage (« six points »).
- Une ligne d'**évolution** n'apparaît que pour le même élève, la même matière et un niveau qui a changé.
- Un champ vide n'est jamais affiché ; une séance sans observation reçoit la mention « Séance sans observation particulière ».
- Transfert « non pertinent » : absent de l'export.
- Absences : une ligne (voir `PARCOURS_V75.md`) ; le co-enseignement garde la partie pédagogique.

## Fonctions exposées

| Fonction | Usage |
| :--- | :--- |
| `normaliser(entrée)` | Faits normalisés d'une séance |
| `construireBloc(entrée, précédentes)` | Bloc `{type, entete, peda, ortho}` |
| `blocEnTexte(bloc)` | Texte brut (aperçu, tests) |
| `controler(bloc)` | Liste de défauts (valeur technique visible, comptage, ligne vide…) |
| `deIdentifier(texte, noms)` | Remplace les noms par « l'élève » (accents et casse ignorés) |
| `statsPresence(entrées)` | Comptes par statut de présence |
| `synthese(entrées)` | Synthèse par matière pour la réunion |

## Export Word

`JournalierSeancesDocx.exporter({seances, eleve, deidentifie})` :

1. Charge le modèle papier et le décompresse (archive ZIP lue et écrite sans dépendance).
2. Remplit le tableau d'identité (nom, classe, titulaire, école) ; la date de naissance reste vide si inconnue.
3. Clone le tableau prototype pour chaque séance, dans l'ordre chronologique (un fichier par élève et par année scolaire).
4. Échappe le XML, neutralise les métadonnées et, si demandé, dé-identifie tout le texte.

Le nom du fichier est `Journalier - <élève> - <année scolaire>.docx`.

## Modèle de données des séances

Les clés de stockage historiques `q2` à `q6` sont conservées (compatibilité avec les données et la synchronisation). Correspondance avec l'écran V75 :

| Clé | Écran | Contenu |
| :--- | :--- | :--- |
| `contexte` | Créneau et partie pédagogique | matière, niveau, forme, `typeIntervention`, `presenceStatus`, `classNotes` |
| `objectif` | idem | `objectifLecon` (objectif de la leçon), `objectifProfessionnel` (mon objectif) |
| `q2` | Fonctionnement observé | `observations[{categorie, observation, niveau 0–2}]`, `precision` (remarque) |
| `q3` | Compétence travaillée | `precision` (texte libre) ; `indicateurs` et `repereWBE` conservés pour les anciennes séances |
| `q4` | Ce qui a aidé | `types`, `effets{type: 0–2}`, `precision` |
| `q5` | Transfert | `statut`, `precision` |
| `q6` | Suite | `actions`, `modalite`, `objectif`, `collaborations`, `precision` |

`presenceStatus` : `present`, `absent_eleve`, `absent_eleve_coteach`, `absent_prof`, `absent_agent`.

## Vérifier une modification

1. `npm test` (les deux suites du moteur et du Word tournent en premier).
2. Générer un Journalier depuis l'application, le convertir en PDF (LibreOffice) et le regarder.
3. Ne jamais déclarer testé ce qui n'a pas été exécuté (règle d'AGENTS.md).
