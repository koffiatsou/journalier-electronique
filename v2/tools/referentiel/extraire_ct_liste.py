"""Compétences terminales rédigées en listes à puces (documents de 1999 à 2014, sans tableaux de ressources).

Usage : python extraire_ct_liste.py <pdf> <matière> <HGT|HPT> <référentiel> <début> <fin> <fusion.json>
Chaque puce devient une ligne ; son thème est le dernier titre (ligne en capitales ou numérotée) qui la précède.
Les lignes de ce référentiel déjà présentes dans <fusion.json> sont remplacées : relancer donne le même résultat.
Les tableaux à colonnes ne sont pas lus : un document fait surtout de tableaux donne peu de lignes (à relire).
"""
import json, re, sys
import pdfplumber

PDF, MATIERE, FORME, REFERENTIEL, DEBUT, FIN, FUSION = sys.argv[1:8]
BUL = re.compile(r'^[•▪\u2022\uf0b7\uf0a7\u25aa\-–o]\s+')
PIED = re.compile(r'COMPETENCES TERMINALES|COMPÉTENCES TERMINALES|HUMANITES|HUMANITÉS|^\s*page\s+\d|\bpage\s+\d+/\d+|^\d{1,3}$|^Annexe', re.I)
TITRE = re.compile(r'^(\d+(\.\d+)*\.?\s+)?[A-ZÉÈÀÂÊÎÔÛÇ][A-ZÉÈÀÂÊÎÔÛÇ\s’\'\-/&,:°0-9]{5,}$')
clean = lambda s: re.sub(r'(?<=[a-zéèêàç])\d{1,2}$', '', re.sub(r'\s+', ' ', s).replace(' .', '.').strip())
lignes = []
titre, courant = '', None
with pdfplumber.open(PDF) as pdf:
    for pn, page in enumerate(pdf.pages, 1):
        for brut in (page.extract_text() or '').split('\n'):
            l = brut.strip()
            if not l or PIED.search(l):
                continue
            if TITRE.match(l) and len(l) < 90:
                titre, courant = clean(re.sub(r'^\d+(\.\d+)*\.?\s+', '', l)).capitalize(), None
            elif BUL.match(l):
                courant = {'p': pn, 'u': titre, 'a': BUL.sub('', l)}
                lignes.append(courant)
            elif courant is not None and not re.match(r'^[A-ZÉ]{2,}', l):
                courant['a'] += ' ' + l
            else:
                courant = None
compact = []
for e in lignes:
    a = clean(e['a'])
    # Texte de tableau lu en une seule ligne (colonnes mélangées), table des matières, définitions : sans valeur pour une piste.
    melange = re.search(r'Processus|Ressources|Appliquer|Transférer|Prérequis|Connaitre|Transferer', a) or e['u'].lower().startswith(('table des mati', 'sommaire'))
    if len(a.split()) >= 4 and not melange and len(a) < 260:
        compact.append({'m': MATIERE, 'n': 'S3', 'nf': 'S6', 'f': FORME, 't': 'c', 'u': e['u'], 'i': e['u'], 'a': a, 'p': e['p'], 'r': REFERENTIEL})
compact = [{k: v for k, v in r.items() if v} for r in compact]
existantes = json.load(open(FUSION, encoding='utf-8')) if __import__('os').path.exists(FUSION) else []
gardees = [e for e in existantes if e.get('r') != REFERENTIEL] + compact
with open(FUSION, 'w', encoding='utf-8') as f:
    json.dump(gardees, f, ensure_ascii=False, separators=(',', ':'))
print(f'{MATIERE} ({REFERENTIEL}) : {len(compact)} lignes ; {FUSION} : {len(gardees)} entrées')
