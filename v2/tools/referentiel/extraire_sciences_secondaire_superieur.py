"""Sciences (2014, HGT sciences de base/générales, HPT formation scientifique) et sciences économiques (2000, HGT).

Lit les « compétences à développer » de chaque unité d'acquis d'apprentissage.
Usage : python3 extraire_sciences_secondaire_superieur.py hgt|hpt|eco <pdf> <sortie.json>
"""
import pdfplumber, re, json, sys
from collections import Counter
MODE, PDF, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
clean = lambda s: re.sub(r'\s+', ' ', s).replace(' .', '.').replace(' ,', ',').strip()
BUL = re.compile(r'^[•▪•▪\-–]\s*')
res = []

def puces(lignes):
    out = []
    for l in lignes:
        l = l.strip()
        if not l: continue
        if BUL.match(l): out.append(clean(BUL.sub('', l)))
        elif out and not re.match(r'^[A-ZÉÈÀ][A-ZÉÈÀ\s’\'\-]{6,}$', l): out[-1] = clean(out[-1] + ' ' + l)
    return out

def niveaux_hgt(t):
    if 'Troisième degré' in t: return 'S5', 'S6'
    if re.search(r'Troisième année', t): return 'S3', 'S3'
    if re.search(r'Quatrième année', t): return 'S4', 'S4'
    return 'S3', 'S4'

with pdfplumber.open(PDF) as pdf:
    for pn, p in enumerate(pdf.pages, 1):
        txt = p.extract_text() or ''
        L = txt.split('\n')
        if MODE == 'hgt' and re.search(r'Compétences? à développer', txt) and re.match(r'^Sciences', L[0]):
            m = re.search(r'(Sciences [\w ]+?) – (.+?) - ?(Biologie|Chimie|Physique)? ?–? ?Unité d’acquis d’apprentissage (\d+)', L[0] + ' ' + L[0])
            disc = next((d for d in ('Biologie', 'Chimie', 'Physique') if d in L[0]), '')
            num = re.search(r'apprentissage (\d+)', L[0]); titre = clean(L[1]).strip('«» ') if len(L) > 1 else ''
            n, nf = niveaux_hgt(L[0])
            debut = next(i for i, l in enumerate(L) if re.search(r'Compétences? à développer', l))
            fin = next((i for i, l in enumerate(L) if i > debut and l.startswith('Processus')), len(L))
            sous = ''
            for l in L[debut + 1:fin]:
                l = l.strip()
                if l and not BUL.match(l) and len(l) < 40 and not l.endswith('.'): sous = l; continue
            for a in puces(L[debut + 1:fin]):
                res.append({'matiere': 'Sciences', 'forme': 'HGT', 'niveau': n, 'niveau_max': nf, 'discipline': disc,
                            'uaa': f'UAA {num.group(1)}' if num else '', 'uaa_titre': titre, 'type': 'compétence', 'attendu': a, 'page': pn})
        elif MODE == 'hpt' and re.search(r'COMPÉTENCES? À DÉVELOPPER', txt) and re.match(r'^FORMATION SCIENTIFIQUE', L[0]):
            n, nf = ('S5', 'S6') if re.search(r'3e DEGRÉ', L[0], re.I) else ('S3', 'S4')
            theme = clean(re.sub(r'^.*THÈME \d+\s*:\s*', '', L[0]))
            titre = clean(re.sub(r'^UNITÉ D’ACQUIS D’APPRENTISSAGE \d+\s*:\s*', '', L[1]))
            debut = next(i for i, l in enumerate(L) if re.search(r'COMPÉTENCES? À DÉVELOPPER', l))
            fin = next((i for i, l in enumerate(L) if i > debut and re.match(r'^(PROCESSUS|RESSOURCES|Processus)', l)), len(L))
            for a in puces(L[debut + 1:fin]):
                res.append({'matiere': 'Sciences', 'forme': 'HPT', 'niveau': n, 'niveau_max': nf, 'theme': theme,
                            'uaa_titre': titre, 'type': 'compétence', 'attendu': a, 'page': pn})
        elif MODE == 'eco' and pn >= 4:
            rub = ''; bloc = []
            def vider():
                for a in puces(bloc):
                    res.append({'matiere': 'Sciences économiques', 'forme': 'HGT', 'theme': rub, 'type': 'compétence' if 'COMPETENCES' in cadre else 'savoir', 'attendu': a, 'page': pn})
            cadre = next((l for l in L if 'COMPETENCES' in l and 'SCIENCES' in l and 'TERMINALES' not in l), 'COMPETENCES')
            for l in L[2:]:
                if re.match(r'^\d+\.\s+[A-ZÉÈ]', l) or (l.isupper() and len(l) > 8) or re.match(r'^[A-ZÉ][\wéèêàç’\' ]+$', l) and not BUL.match(l) and len(l) < 40:
                    vider(); bloc = []; rub = clean(re.sub(r'^\d+\.\s*', '', l)).rstrip(':')
                else: bloc.append(l)
            vider()
json.dump(res, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(res), dict(Counter(r['type'] for r in res)))
