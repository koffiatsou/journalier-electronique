# Outils du référentiel (hors application)

Ces scripts Python transforment les PDF officiels de la FWB et de WBE en données lues par l'application (`src/data/referentiel/*.json`).
Les PDF ne sont **pas** dans le dépôt : ils sont dans le dossier de l'utilisateur `Référentiel-programmes TC` (et ses sous-dossiers `Socles`, `CT-complements`, `TC-complements`).
Sources : enseignement.be (page « Contenus d'apprentissage » du secondaire : référentiels du tronc commun, Socles de compétences, compétences terminales) et ifpc.cfwb.be.
Les programmes WBE du tronc commun (wbe.be, « Programmes et référentiels ») sont dans le même dossier (`Programme_*.pdf`) : depuis le 12/11/2026 ils servent à ranger les lignes du tronc commun en modules (voir « Modules du programme WBE » plus bas). Une recherche de vocabulaire d'usage y avait été abandonnée.

Dépendances (hors dépôt, sur le poste de l'utilisateur) : `pip install pdfplumber pymupdf`. Lancer avec `python` (pas `python -I`, qui ignore les paquets de l'utilisateur).

## Tronc commun (2022, P1–S3)
- `extraire_tronc_commun.py` — tableaux d'un référentiel (pdfplumber) : `python extraire_tronc_commun.py 2022_REF_Mathematiques.pdf 25 150 Mathématiques maths_all.json`.
- `extraire_grammaire_langue.py` — grammaire d'une langue (néerlandais, allemand, anglais) ; avec le 4e argument, met à jour `langues.json`.
- `extraire_fhges.py` — histoire, géographie, formation économique et sociale → `histoire-geographie.json`.
- `extraire_technique.py` — FMTTN → `technique.json`.
- `extraire_eps.py` — éducation physique et à la santé (deux colonnes sans traits) → `education-physique.json`.
- `extraire_matiere_tc.py` — une matière au format compact (arts, philosophie et citoyenneté, latin).
- `convertir.py` — ancien assemblage de maths, français, langues, sciences et économie à partir de fichiers intermédiaires qui ne sont plus dans le dépôt : ne plus le relancer tel quel ; les JSON du dépôt font foi.

## Socles de compétences (fin de S2, jusqu'à la rentrée 2026)
- `extraire_socles.py` — 3e colonne « III » des tableaux ; cadre `SOC` ; mathématiques, français, éveil scientifique, éveil historique et géographique.

## Secondaire supérieur (S3–S6, compétences terminales 1999–2017)
- `extraire_secondaire_superieur.py`, `extraire_francais_secondaire_superieur.py`, `extraire_langues_secondaire_superieur.py`, `extraire_sciences_secondaire_superieur.py` — premières extractions (maths, français, langues, économie 2000), pdfplumber.
- `extraire_uaa.py` — tableaux d'unités d'acquis d'apprentissage lus avec **PyMuPDF** (`find_tables`), bien plus fiables : géographie, histoire-géographie HPT, philosophie, formation économique et sociale, informatique, sciences 2014 (générales, de base, qualifiantes). Dans les sciences, les colonnes « Appliquer / Transférer » sont lues dans une seule cellule, entremêlées : seules les ressources et les « Connaitre » sont gardées.
- `extraire_ct_blocs.py` — documents en paragraphes et puces (latin-grec 1999, éducation technique et technologique, technologie, éducation artistique 2004), lus par blocs avec PyMuPDF.
- `extraire_ct_liste.py` — listes à puces (arts du cirque, éducation physique 2000 : tableau « champs / compétences » seulement).
- `extraire_sciences_humaines_superieur.py` — histoire 1999.

Chaque script remplace ses propres lignes (même référentiel) dans le fichier cible : le relancer donne le même résultat.
Le skill « PDF → Excel » utilise le même moteur que pdfplumber : il n'apporte rien de plus ici.

## Séquences du programme (maths S3–S6)
- `enrichir_sequences.py` — ajoute aux lignes des compétences terminales HGT 2014 et des compétences minimales de qualification 2014 (dans `mathematiques.json`) le code de séquence `q` et la compétence à développer `cd` (casse normale). Retrouve chaque ligne par (référentiel, page, texte) dans la sortie de `extraire_secondaire_superieur.py` ; signale une ligne introuvable, ne devine rien ; relancer donne le même fichier. Commandes dans l'en-tête du script.
- Le moteur (`domain/referentiel/moteur.ts`) regroupe aussi en séquences, sans champ supplémentaire, les unités (`i`, sinon `u`) des autres compétences terminales HGT/HPT (4 à 60 lignes) ; seulement pour les élèves de S3 à S6.

## Modules du programme WBE (tronc commun S1 à S3)
- `enrichir_programmes_tc.py <matière> <programme.pdf> <fichier.json> [--essai]` — ajoute `sq` (module ou section, thème en sciences) aux lignes du tronc commun S1 à S3 et, quand le programme l'écrit en tête du module, `cd` (compétence à développer). Retrouve chaque ligne par son texte dans les tableaux « Savoirs / Savoir-faire / Compétences » du programme ; ne change jamais `a` ; signale les lignes absentes, ambiguës (première unité du programme, de préférence celle qui contient aussi l'intitulé `i`) et transversales (présentes dans plus de 3 unités : aucun module) ; relancer donne le même fichier.
- `programmes_tc/commun.py` (lecture, normalisation, rattachement), `programmes_tc/maths.py` (35 modules et sections, pages 72 à 267 ; contrôle de la pagination), `programmes_tc/sciences.py` (18 thèmes, six par année, table des matières pages 27 à 29). Lancer depuis ce dossier ; `--texte` lit un export texte `=====PAGE n=====` à la place du PDF.
- Résultat (12/11/2026) : maths 318 lignes rangées sur 328 (S1–S3), sciences 305.
- `retirer_lignes_parasites.py <dossier des JSON> [--essai]` — retire 89 lignes du tronc commun qui n'étaient pas des attendus (en-têtes « Exemples de contenus… », renvois « (Ch1, SF, P…) », paragraphes de visées en maths pp. 139–146) : arts 1, français 10, latin 4, maths 66, sciences 8. Règles étroites, nombre attendu vérifié, relancer ne change plus rien. Gardé pour relecture à part : les autres lignes des pages de visées transversales (ex. « Se construire une identité de lecteur. », environ 150 lignes en français, sciences, arts et latin).
- `programmes_tc/fhges.py` (matière `histoire-geographie`) — moments clés de l'histoire (5, 4 et 5 par année), parcours de géographie (2, 2 et 3) et objets d'étude de l'économie et sociale (6, 4 et 5) : 36 unités, 148 lignes rangées en S1–S3.
- **Primaire (P1 à P5)** : `enrichir_programmes_primaire.py <matière> <fichier.json> <programme(s)> [--texte] [--essai]` avec `programmes_tc/primaire.py`. Chaque discipline des programmes WBE du primaire développe des « séquences didactiques » dont la première page a l'encadré « Le dispositif amène les élèves à… » : titre, compétence, attendus Savoir / Savoir-faire / Compétence avec leur code (OEG130…). Les attendus sont retrouvés par leur texte (ligatures « ﬁ » corrigées). Maths 285 lignes rangées, français 433, sciences 211, histoire-géographie 189, éducation physique 93, technique 84, arts 89, philosophie 120. Les séquences ne couvrent qu'une partie du référentiel : les autres lignes restent proposées une à une. Pas de programme P6 publié (le site WBE s'arrête à P5, plus l'éducation physique et la philosophie de P1 à P6).
- Programmes téléchargeables : page « Programmes d'étude » de wbe.be (Ressources > Ressources pédagogiques > programmes et référentiels pour l'enseignement fondamental), aussi pour le secondaire. Le site n'a pas bloqué le téléchargement direct (`curl`) ; le navigateur intégré a servi à repérer les liens.
- Classement par verbe et thèmes de repli (12/11/2026, validé par l'utilisateur) : pour les matières sans modules ci-dessous, le moteur (`domain/referentiel/processus.ts`, `moduleDeRepli`) déduit Connaître / Appliquer / Transférer du verbe quand les types ne distinguent rien (arts, technique, éducation physique, latin des compétences terminales, Socles) et groupe les lignes du tronc commun par thème du référentiel. Aucune donnée n'est modifiée.
- Pas de modules à tirer dans les programmes (structure par compétences, genres de textes ou progression des attendus, non par séquences) : français et langues modernes du secondaire, philosophie, éducation physique, éducation culturelle et artistique et langues anciennes du secondaire (programmes téléchargés le 12/11/2026, lus en diagonale).

## Mesure du moteur
`node --import tsx tools/referentiel/mesurer.ts --echecs [--rentree 2026]` (corpus gelé dans `tests/corpus-referentiel.ts`, planchers dans `tests/referentiel-corpus.test.ts`).

## Limites connues
Voir `docs/etat-des-lieux.md` (section Référentiel) : technique de qualification et droit détaillé non faits, tableaux de ressources de l'histoire-géographie et de l'éducation physique (niveaux) non lus, qualité des listes à puces à relire par échantillon.
