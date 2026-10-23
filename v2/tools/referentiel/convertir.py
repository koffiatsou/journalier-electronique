"""Fusionne les extractions en fichiers compacts lus par l'application (src/data/referentiel/*.json).

Usage : python3 convertir.py <dossier des extractions JSON>
Les PDF officiels ne sont pas dans le dépôt : voir README.md de ce dossier.
"""
import json, re, sys, os
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'referentiel')
ORDRE = ['P1','P2','P3','P4','P5','P6','S1','S2','S3','S4','S5','S6']
TYPE = {'savoir':'s','savoir-faire':'f','compétence':'c'}
def niveau(e):
    if e.get('niveau') in ORDRE: return e['niveau']
    m = re.search(r'\((\d)e année', e.get('cadre',''))
    return 'S'+m.group(1) if m else None
def compact(e, matiere, forme, ref, langue=None):
    d = {'m':matiere,'n':niveau(e),'f':forme,'t':TYPE.get(e.get('type'),'f'),
         'u':(e.get('theme') or e.get('uaa_titre') or e.get('rubrique') or e.get('uaa') or ''),
         'i':(e.get('item') or e.get('rubrique') or ''),'a':e['attendu'],'p':e.get('page'),'r':ref}
    if langue: d['l']=langue
    return {k:v for k,v in d.items() if v not in (None,'')}
def charger(nom): return json.load(open(os.path.join(SRC,nom),encoding='utf-8'))
def ecrire(nom, lignes):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT,nom),'w',encoding='utf-8') as f: json.dump(lignes,f,ensure_ascii=False,separators=(',',':'))
    print(nom, len(lignes), 'entrées', os.path.getsize(os.path.join(OUT,nom))//1024, 'Ko')
maths  = [compact(e,'Mathématiques','TC','Référentiel de mathématiques 2022') for e in charger('maths_all.json')]
maths += [compact(e,'Mathématiques','HGT','Compétences terminales HGT 2014') for e in charger('maths_hgt.json')]
maths += [compact(e,'Mathématiques','HPT','Compétences minimales qualification 2014') for e in charger('maths_qualif.json')]
ecrire('mathematiques.json', maths)
ecrire('francais.json', [compact(e,'Français','TC','Référentiel de français 2022') for e in charger('fr_all.json')])
langues  = [compact(e,'Langues modernes','TC','Référentiel de langues modernes 2022') for e in charger('lm_all.json')]
langues += [compact(e,'Langues modernes','TC','Référentiel de langues modernes 2022',langue='Néerlandais') for e in charger('nl_gram.json')]
ecrire('langues.json', langues)
