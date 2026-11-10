# Outils du référentiel (hors application)

Ces scripts Python transforment les PDF officiels de la FWB et de WBE en données lues par l'application (`src/data/referentiel/*.json`).
Les PDF ne sont **pas** dans le dépôt : ils sont dans le dossier de l'utilisateur `Référentiel-programmes TC` (et ses sous-dossiers `Socles`, `CT-complements`, `TC-complements`).
Sources : enseignement.be (page « Contenus d'apprentissage » du secondaire : référentiels du tronc commun, Socles de compétences, compétences terminales) et ifpc.cfwb.be.
Les programmes WBE du tronc commun (wbe.be, « Programmes et référentiels ») sont dans le même dossier mais **ne sont pas utilisés** : une recherche automatique de vocabulaire d'usage y a été essayée et abandonnée (programmes surtout pédagogiques).

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

## Mesure du moteur
`node --import tsx tools/referentiel/mesurer.ts --echecs [--rentree 2026]` (corpus gelé dans `tests/corpus-referentiel.ts`, planchers dans `tests/referentiel-corpus.test.ts`).

## Limites connues
Voir `docs/etat-des-lieux.md` (section Référentiel) : technique de qualification et droit détaillé non faits, tableaux de ressources de l'histoire-géographie et de l'éducation physique (niveaux) non lus, qualité des listes à puces à relire par échantillon.
