# Outils du référentiel (hors application)

Ces scripts Python transforment les PDF officiels de la FWB en données lues par l'application.
Les PDF ne sont **pas** dans le dépôt (fournis par l'utilisateur ; sources : ifpc.cfwb.be).

1. `extraire_tronc_commun.py` — référentiels 2022 (P1–S3), tableaux lus avec pdfplumber.
2. `extraire_secondaire_superieur.py` — compétences terminales 2014 (unités d'acquis d'apprentissage).
3. `extraire_grammaire_neerlandais.py` — grammaire du néerlandais (langues modernes 2022).
4. `convertir.py` — fusionne le tout en `src/data/referentiel/*.json`.

Exemples : `python3 extraire_tronc_commun.py 2022_REF_Mathematiques.pdf 25 150 Mathématiques maths_all.json`.
5. `extraire_francais_secondaire_superieur.py` — français 2014 (HGT, HPT) : unités, colonnes lues grâce aux traits verticaux du tableau.
6. `extraire_langues_secondaire_superieur.py` — langues 2017 (HGT, HPT) : compétences, fonctions langagières, grammaire par langue.
7. `extraire_sciences_secondaire_superieur.py` — sciences 2014 (HGT, HPT) et sciences économiques 2000.
8. `extraire_grammaire_langue.py` — grammaire d'une langue du tronc commun (néerlandais, allemand, anglais) ; avec le 4e argument, met à jour `langues.json` sans rien d'autre.
9. `extraire_fhges.py` — histoire, géographie, formation économique et sociale (tronc commun) → `histoire-geographie.json`.
10. `extraire_technique.py` — FMTTN (tronc commun) → `technique.json`.
11. `extraire_sciences_humaines_superieur.py` — histoire 1999, géographie et histoire-géographie 2014 (S3–S6), fusionnés dans `histoire-geographie.json`.
12. `extraire_eps.py` — éducation physique et à la santé (tronc commun, deux colonnes sans traits) → `education-physique.json`.
13. `extraire_matiere_tc.py` — une matière du tronc commun au format compact (arts, philosophie et citoyenneté, latin).
14. `extraire_ct_liste.py` — compétences terminales en listes à puces (éducation physique, artistique, technique, technologie, informatique, cirque, philosophie, latin-grec, formation économique et sociale) ; seul le tableau « champs / compétences à développer / niveaux » est lu (éducation physique 2000), pas les autres tableaux à colonnes.
15. `extraire_uaa.py` — tableaux d'unités d'acquis d'apprentissage lus avec **PyMuPDF** (`pip install pymupdf`), bien plus fiables que pdfplumber sur ces mises en page : géographie, histoire-géographie HPT, philosophie, formation économique et sociale, informatique, sciences 2014 (générales, de base, qualifiantes). Colonnes « Appliquer / Transférer » entremêlées dans les sciences : seules les ressources et les « Connaitre » sont gardées.
16. `extraire_ct_blocs.py` — documents de 1999 à 2004 en paragraphes et puces (latin-grec, éducation technique et technologique, technologie, éducation artistique), lus par blocs avec PyMuPDF : énoncés de compétence + puces rattachées à leur énoncé, table des matières écartée. (Arts du cirque reste en listes à puces.)
Le skill « PDF → Excel » utilise le même moteur que pdfplumber : il n'apporte rien de plus sur ces documents. Les documents sans tableaux passent par `extraire_ct_blocs.py`.
Mesure du moteur : `node --import tsx tools/referentiel/mesurer.ts --echecs` (corpus dans `tests/corpus-referentiel.ts`).
Scripts Python : `python` simple (pdfplumber installé pour l'utilisateur), pas `python -I`.
Limites connues : voir AGENTS.md (histoire-géographie, technique et anglais/allemand du tronc commun non extraits).
