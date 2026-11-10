"""Compétences terminales rédigées en paragraphes et puces (1999-2004), lues par blocs avec PyMuPDF.

Usage : python extraire_ct_blocs.py <pdf> <matière> <HGT|HPT> <référentiel> <fusion.json>
Un bloc de texte du PDF est un paragraphe : on garde
- les énoncés de compétence (paragraphe qui suit « 1re compétence », ou titre numéroté « 2.2.1. Effectuer … ») ;
- chaque puce, rattachée au dernier énoncé (u = énoncé abrégé).
Les lignes de ce référentiel déjà présentes dans <fusion.json> sont remplacées (relancer donne le même résultat).
"""
import json, os, re, sys
import pymupdf

PDF, MATIERE, FORME, REFERENTIEL, FUSION = sys.argv[1:6]
PUCE = re.compile('^[•▪●\\-–]\\s*')
ENTETE = re.compile(r'COMP[ÉE]TENCES TERMINALES|HUMANIT[ÉE]S|^\s*\d{1,3}\s*$|^page\s+\d', re.I)
NUMEROTE = re.compile(r'^(\d+(\.\d+)+)\.?\s+(\S.*)$', re.S)
ORDINAL = re.compile(r'^(\d+)\s*(re|ère|e|ème|er)?\s*compétence', re.I)
clean = lambda s: re.sub(r'(?<=[a-zéèêàç])\d{1,2}$', '', re.sub(r'\s+', ' ', s or '').replace(' .', '.').strip())


def abreger(texte, n=70):
    t = clean(texte)
    return t if len(t) <= n else t[:n].rsplit(' ', 1)[0] + '…'


lignes = []
enonce = ''
suite_ordinal = False
doc = pymupdf.open(PDF)
for numero, page in enumerate(doc, 1):
    page_texte = page.get_text()[:600]
    for bloc in page.get_text('blocks'):
        texte = bloc[4].strip()
        # Table des matières : lignes terminées par un numéro de page, sans contenu.
        if re.search(r'table des mati|sommaire', page_texte, re.I) or sum(1 for l in texte.split(chr(10)) if re.search(r'\s\d{1,2}$', l.strip())) >= 2:
            continue
        if not texte or ENTETE.search(texte.split('\n')[0]) or len(texte) < 4:
            continue
        premiere = clean(texte.split('\n')[0])
        if ORDINAL.match(premiere):
            reste = clean(' '.join(texte.split('\n')[1:]))
            suite_ordinal = not reste
            if reste:
                enonce = abreger(reste)
                lignes.append({'t': 'c', 'a': reste, 'u': enonce, 'p': numero})
            continue
        if suite_ordinal:
            suite_ordinal = False
            enonce = abreger(texte)
            lignes.append({'t': 'c', 'a': clean(texte), 'u': enonce, 'p': numero})
            continue
        m = NUMEROTE.match(texte)
        if m and len(clean(m.group(3)).split()) >= 4 and not PUCE.match(texte) and not clean(m.group(3)).isupper():
            corps = clean(m.group(3))
            enonce = abreger(corps)
            lignes.append({'t': 'c', 'a': corps, 'u': enonce, 'p': numero})
            continue
        morceaux = [x for x in re.split(r'\n(?=[•▪●]|-\s)', texte) if PUCE.match(x.strip())]
        for morceau in morceaux:
            item = clean(PUCE.sub('', morceau.strip()))
            if len(item.split()) >= 4 and item != '...' and not item.endswith(':'):
                lignes.append({'t': 'f', 'a': item, 'u': enonce, 'p': numero})

vus, compact = set(), []
for e in lignes:
    cle = (e['a'], e['u'])
    if cle in vus or len(e['a']) > 400:
        continue
    vus.add(cle)
    ligne = {'m': MATIERE, 'n': 'S3', 'nf': 'S6', 'f': FORME, 't': e['t'], 'u': e['u'], 'i': e['u'], 'a': e['a'], 'p': e['p'], 'r': REFERENTIEL}
    compact.append({k: v for k, v in ligne.items() if v})
existantes = json.load(open(FUSION, encoding='utf-8')) if os.path.exists(FUSION) else []
gardees = [x for x in existantes if x.get('r') != REFERENTIEL] + compact
with open(FUSION, 'w', encoding='utf-8') as f:
    json.dump(gardees, f, ensure_ascii=False, separators=(',', ':'))
print(f'{MATIERE} ({REFERENTIEL}) : {len(compact)} lignes ; {FUSION} : {len(gardees)} entrées')
