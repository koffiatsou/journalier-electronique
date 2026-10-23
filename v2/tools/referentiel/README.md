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
Limites connues : voir AGENTS.md (histoire-géographie, technique et anglais/allemand du tronc commun non extraits).
