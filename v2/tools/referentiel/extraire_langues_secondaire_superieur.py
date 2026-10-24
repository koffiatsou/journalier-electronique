"""Langues modernes, secondaire supérieur (compétences terminales 2017, HGT et HPT).

Trois sortes de lignes :
- compétence par niveau du CECRL et par habileté (écouter, parler, lire, écrire) ;
- fonctions langagières (« demander et donner des informations »…) ;
- ressources grammaticales par langue (annexes néerlandais, anglais, allemand).
Usage : python3 extraire_langues_secondaire_superieur.py <pdf> <HGT|HPT> <sortie.json>
"""
import pdfplumber, re, json, sys
from collections import Counter
PDF, FORME, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
clean = lambda s: re.sub(r'\s+', ' ', s).replace(' .', '.').replace(' ,', ',').strip()
NIV = re.compile(r'\b(A1\+?|A2[+-]?|B1[+-]?|B2[+-]?|C1)\b')
res = []
with pdfplumber.open(PDF) as pdf:
    niveau = habilete = None
    pages = pdf.pages
    for pn, p in enumerate(pages, 1):
        txt = p.extract_text() or ''
        W, H = p.width, p.height
        m = re.search(r'^(?:LANGUES MODERNES\n)?(A1\+?|A2|B1|B2-?)\s+UAA\s*[-–]\s*([^\n]+)', txt, re.M)
        if m and 'Compétence à développer' in txt:
            niveau = m.group(1); habilete = clean(m.group(2))
            gauche = p.crop((0, 0, W * 0.58, H)).extract_text() or ''
            avant = re.split(r'\nAttendus', gauche)[0].split('\n')
            k = next((i for i, l in enumerate(avant) if 'Conformément' in l), 2)
            corps = '\n'.join(l for l in avant[k + 1:] if l.strip())
            lignes = [clean(l.lstrip('•- ')) for l in corps.split('\n') if clean(l)]
            # première ligne = verbe d'action ; les puces complètent
            if lignes:
                debut = re.sub(r'\s*Caract.*$', '', lignes[0]); suite = ''
                res.append({'forme': FORME, 'niveau_cecrl': niveau, 'habilete': habilete, 'item': habilete, 'type': 'compétence',
                            'attendu': clean(f'{debut} {suite}'), 'page': pn})
        if 'Fonctions langagières' in txt and niveau:
            bloc = txt.split('Fonctions langagières', 1)[1].split('GRAMMATICALES')[0]
            rub = ''
            for l in bloc.split('\n')[1:]:
                l = clean(l.lstrip('•-  '))
                if not l: continue
                if re.match(r'^(établir|\(s\)|\(faire\)|exprimer|structurer|comprendre|argumenter|débattre)', l, re.I) and len(l) < 60:
                    rub = l; continue
                if len(l) > 70 or l.startswith(('Un nombre', 'Répertoire', 'Fonctions')): continue
                res.append({'forme': FORME, 'niveau_cecrl': niveau, 'habilete': habilete or '', 'type': 'savoir-faire',
                            'rubrique': 'Fonctions langagières' + (f' : {rub}' if rub else ''), 'attendu': l, 'page': pn})
        mg = re.search(r'Ressources grammaticales par niveau du CECRL\s*:\s*(\w+)', txt)
        if mg:
            langue = mg.group(1).capitalize()
            for q in range(pn, min(pn + 16, len(pages) + 1)):
                pg = pages[q - 1]; t = pg.extract_text() or ''
                if q > pn and re.search(r'Ressources grammaticales par niveau du CECRL\s*:\s*(\w+)', t) and langue.lower() not in t.split('CECRL')[1][:20].lower(): break
                rubr = elem = ''
                for tb in pg.find_tables():
                    for row in tb.extract():
                        cells = [clean(c or '') for c in row]
                        if cells[0]: rubr = cells[0]
                        if len(cells) > 1 and cells[1]: elem = cells[1]
                        detail = cells[2] if len(cells) > 2 else ''
                        niv = next((n.group(1) for c in cells[3:] for n in [NIV.search(c)] if n), None)
                        if not (elem and (niv or detail)) or elem.startswith(':'): continue
                        if re.match(r'^(Initiation|Moment|Réception|Niveau)', cells[1]): continue
                        res.append({'forme': FORME, 'niveau_cecrl': niv or '', 'habilete': '', 'type': 'savoir', 'langue': langue,
                                    'rubrique': rubr, 'item': elem, 'attendu': clean((f'{rubr} : ' if rubr else '') + elem + (f' ({detail})' if detail else '')), 'page': q})
seen=set(); uniq=[]
for r in res:
    k=(r['type'],r.get('langue'),r['niveau_cecrl'],r['attendu'])
    if k not in seen: seen.add(k); uniq.append(r)
res=uniq
json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(res), dict(Counter(r['type'] for r in res)), dict(Counter(r.get('langue', '-') for r in res)))
