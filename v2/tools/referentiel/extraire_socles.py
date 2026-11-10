"""Socles de compétences : ce qui est attendu à la fin de la 2e secondaire (3e colonne « III » des tableaux).

Usage : python extraire_socles.py <pdf> <matière> <référentiel> <fusion.json>
Chaque tableau a une colonne de compétences puis les colonnes I, II et III (fin de P2, fin de P6, fin de S2).
On garde les compétences dont la colonne III n'est pas vide (« C » certifiée, « E » exercée, ou un descripteur).
Le titre de la rubrique est le dernier intitulé numéroté (« 3.1.1. Compter, dénombrer, classer ») au-dessus du tableau.
Les Socles ne s'appliquent plus à S2 dès la rentrée 2027 : les lignes portent n = S2 et le champ f = « SOC ».
Les lignes de ce référentiel déjà présentes dans <fusion.json> sont remplacées (relancer donne le même résultat).
"""
import json, os, re, sys
import pymupdf

PDF, MATIERE, REFERENTIEL, FUSION = sys.argv[1:5]
TITRE = re.compile(r'^(\d+(\.\d+){1,3})\.?\s+(\S.{3,})$', re.S)
clean = lambda s: re.sub(r'\s+', ' ', (s or '').replace('-\n', '')).replace(' .', '.').strip()
# La grosse lettre décorative (C, E) se glisse dans les mots du tableau : « nombCres ».
parasite = lambda s: re.sub(r'(?<=[a-zéèêàç])[CE](?=[a-zéèêàç])', '', s)

lignes = []
titre_courant = ''
doc = pymupdf.open(PDF)
for numero, page in enumerate(doc, 1):
    titres = []
    for bloc in page.get_text('blocks'):
        m = TITRE.match(bloc[4].strip())
        if m and not bloc[4].strip().endswith('.') or (m and len(bloc[4].strip()) < 90):
            titres.append((bloc[1], clean(m.group(3))))
    titres.sort()
    for tableau in page.find_tables().tables:
        rangees = tableau.extract()
        if not rangees or len(rangees[0]) < 4:
            continue
        haut = tableau.bbox[1]
        avant = [t for y, t in titres if y <= haut + 2]
        if avant:
            titre_courant = avant[-1]
        for rangee in rangees:
            competence = clean(rangee[0])
            dernier = clean(rangee[-1])
            if len(competence) < 8 or not dernier or competence in ('I', 'II', 'III') or competence.startswith(('Domaines du savoir', 'Savoir-faire')):
                continue
            lignes.append({'a': parasite(competence), 'u': titre_courant, 'p': numero})

vus, compact = set(), []
for e in lignes:
    cle = (e['a'], e['u'])
    if cle in vus:
        continue
    vus.add(cle)
    ligne = {'m': MATIERE, 'n': 'S2', 'f': 'SOC', 't': 'f', 'u': e['u'], 'i': e['u'], 'a': e['a'], 'p': e['p'], 'r': REFERENTIEL}
    compact.append({k: v for k, v in ligne.items() if v})
existantes = json.load(open(FUSION, encoding='utf-8')) if os.path.exists(FUSION) else []
gardees = [x for x in existantes if x.get('r') != REFERENTIEL] + compact
with open(FUSION, 'w', encoding='utf-8') as f:
    json.dump(gardees, f, ensure_ascii=False, separators=(',', ':'))
print(f'{MATIERE} ({REFERENTIEL}) : {len(compact)} lignes ; {FUSION} : {len(gardees)} entrées')
