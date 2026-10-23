# Outils du référentiel (hors application)

Ces scripts Python transforment les PDF officiels de la FWB en données lues par l'application.
Les PDF ne sont **pas** dans le dépôt (fournis par l'utilisateur ; sources : ifpc.cfwb.be).

1. `extraire_tronc_commun.py` — référentiels 2022 (P1–S3), tableaux lus avec pdfplumber.
2. `extraire_secondaire_superieur.py` — compétences terminales 2014 (unités d'acquis d'apprentissage).
3. `extraire_grammaire_neerlandais.py` — grammaire du néerlandais (langues modernes 2022).
4. `convertir.py` — fusionne le tout en `src/data/referentiel/*.json`.

Exemples : `python3 extraire_tronc_commun.py 2022_REF_Mathematiques.pdf 25 150 Mathématiques maths_all.json`.
Limites connues : français et langues du secondaire supérieur, sciences : pas encore extraits.
