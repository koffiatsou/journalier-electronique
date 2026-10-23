"""Fusionne les extractions en fichiers compacts lus par l'application (src/data/referentiel/*.json).

Usage : python3 convertir.py <dossier des extractions JSON>
Les PDF officiels ne sont pas dans le dépôt : voir README.md de ce dossier.
"""
import json, re, sys, os
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'data', 'referentiel')
ORDRE = ['P1','P2','P3','P4','P5','P6','S1','S2','S3','S4','S5','S6']
TYPE = {'savoir':'s','savoir-faire':'f','compétence':'c'}
DEGRES = {'Deuxième et troisième degrés':('S3','S6'),'Deuxième degré':('S3','S4'),'Troisième degré':('S5','S6')}
def niveau(e):
    if e.get('niveau') in ORDRE: return e['niveau']
    for k,v in DEGRES.items():
        if e.get('cadre','').startswith(k): return v[0]
    m = re.search(r'\((\d)e année', e.get('cadre',''))
    return 'S'+m.group(1) if m else None
def compact(e, matiere, forme, ref, langue=None):
    d = {'m':matiere,'n':niveau(e),'f':forme,'t':TYPE.get(e.get('type'),'f'),
         'u':(e.get('theme') or e.get('uaa_titre') or e.get('rubrique') or e.get('uaa') or ''),
         'i':(e.get('item') or e.get('rubrique') or ''),'a':e['attendu'],'p':e.get('page'),'r':ref}
    if langue: d['l']=langue
    for k,v in DEGRES.items():
        if e.get('cadre','').startswith(k): d['nf']=v[1]; break
    if e.get('niveau_max') and e.get('niveau_max')!=d['n']: d['nf']=e['niveau_max']
    if e.get('niveau_cecrl'): d['u']=(e['niveau_cecrl']+' - '+(e.get('habilete') or e.get('rubrique') or '')).strip(' -')
    if e.get('langue') and not langue: d['l']=e['langue']
    return {k:v for k,v in d.items() if v not in (None,'')}
def charger(nom): return [e for e in json.load(open(os.path.join(SRC,nom),encoding='utf-8')) if not str(e.get('attendu','')).startswith(('Focus sur','Cf.','Selon l’élément grammatical'))]
def ecrire(nom, lignes):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT,nom),'w',encoding='utf-8') as f: json.dump(lignes,f,ensure_ascii=False,separators=(',',':'))
    print(nom, len(lignes), 'entrées', os.path.getsize(os.path.join(OUT,nom))//1024, 'Ko')
maths  = [compact(e,'Mathématiques','TC','Référentiel de mathématiques 2022') for e in charger('maths_all.json')]
maths += [compact(e,'Mathématiques','HGT','Compétences terminales HGT 2014') for e in charger('maths_hgt.json')]
maths += [compact(e,'Mathématiques','HPT','Compétences minimales qualification 2014') for e in charger('maths_qualif.json')]
ecrire('mathematiques.json', maths)
fr  = [compact(e,'Français','TC','Référentiel de français 2022') for e in charger('fr_all.json')]
fr += [compact(e,'Français','HGT','Compétences terminales HGT 2014') for e in charger('fr_hgt.json')]
fr += [compact(e,'Français','HPT','Compétences terminales HPT 2014') for e in charger('fr_hpt.json')]
ecrire('francais.json', fr)
langues  = [compact(e,'Langues modernes','TC','Référentiel de langues modernes 2022') for e in charger('lm_all.json')]
langues += [compact(e,'Langues modernes','TC','Référentiel de langues modernes 2022',langue='Néerlandais') for e in charger('nl_gram.json')]
langues += [compact(e,'Langues modernes','HGT','Compétences terminales HGT 2017') for e in charger('lm_sup_hgt.json')]
langues += [compact(e,'Langues modernes','HPT','Compétences terminales HPT 2017') for e in charger('lm_sup_hpt.json')]
ecrire('langues.json', langues)
sci  = [compact(e,'Sciences','TC','Référentiel de sciences 2022') for e in charger('sci_tc.json')]
sci += [compact(e,'Sciences','HGT','Compétences terminales HGT 2014') for f in ('sci_base.json','sci_gen.json') for e in charger(f)]
sci += [compact(e,'Sciences','HPT','Formation scientifique qualifiant 2014') for e in charger('sci_hpt.json')]
ecrire('sciences.json', sci)
ecrire('economie.json', [compact(e,'Sciences économiques','HGT','Compétences terminales HGT 2000') for e in charger('sci_eco.json')])
