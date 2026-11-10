"""Histoire et géographie du secondaire supérieur (S3-S6).

Usage : python extraire_sciences_humaines_superieur.py histoire <1999_CT_HGT_Histoire.pdf> HGT <sortie.json> [fusion.json]
        python extraire_sciences_humaines_superieur.py uaa <pdf> HGT|HPT <sortie.json> [Géographie|Histoire] [fusion.json]
- histoire : moments-clés, compétences terminales et savoir-faire du document de 1999 (listes à puces).
- uaa : pour chaque unité d'acquis d'apprentissage (2014/2017), l'intitulé de l'unité, la compétence à développer
  et les thèmes en capitales ; la matière est lue dans le titre de la page (« HISTOIRE » ou « GÉOGRAPHIE »),
  le degré dans « 2e DEGRÉ » ou « 3e DEGRÉ ». Les tableaux de ressources (colonnes) ne sont pas lus.
Écrit les lignes compactes dans <sortie.json> ; avec un dernier argument (histoire-geographie.json), les ajoute à ce fichier
en remplaçant celles du même référentiel : relancer le script donne toujours le même résultat.
"""
import json, re, sys
import pdfplumber

MODE, PDF, FORME, SORTIE = sys.argv[1:5]
# Les chiffres collés en fin de phrase sont des renvois de bas de page.
clean = lambda s: re.sub(r'(?<=[a-zéèêàç])\d{1,2}$', '', re.sub(r'\s+', ' ', s).replace(' .', '.').strip())
BUL = re.compile(r'^[•▪\u2022\uf0b7\-–]\s*')
REF = {'HGT': "Compétences terminales HGT", 'HPT': "Compétences terminales HPT"}
res = []


def ligne(n, nf, t, u, i, a, p, ref):
    return {'m': 'Histoire-géographie', 'n': n, 'nf': nf, 'f': FORME, 't': t, 'u': u, 'i': i, 'a': clean(a), 'p': p, 'r': ref}


def histoire():
    section, groupe = '', ''
    with pdfplumber.open(PDF) as pdf:
        for pn, page in enumerate(pdf.pages, 1):
            for brut in (page.extract_text() or '').split('\n'):
                l = brut.strip()
                if not l or 'COMPETENCES TERMINALES ET SAVOIRS' in l or 'HUMANITES GENERALES' in l or re.fullmatch(r'\d{1,2}', l):
                    continue
                m = re.match(r'^(\d)\.\s+(.+)$', l)
                if m and m.group(2).isupper():
                    section, groupe = m.group(2), ''
                    continue
                if section.startswith('MOMENTS'):
                    if BUL.match(l):
                        res.append(ligne('S3', 'S6', 's', groupe, groupe, BUL.sub('', l), pn, 'Compétences terminales HGT 1999'))
                    elif res and res[-1]['p'] == pn and not re.match(r'^[A-ZÉ]', l) and groupe:
                        res[-1]['a'] = clean(res[-1]['a'] + ' ' + l)
                    elif len(l) < 60 and not l.endswith('.'):
                        groupe = l
                elif section.startswith('COMP'):
                    if re.match(r'^Comp[ée]tence n', l):
                        res.append(ligne('S3', 'S6', 'c', 'Compétences terminales', l, '', pn, 'Compétences terminales HGT 1999'))
                    elif res and res[-1]['t'] == 'c':
                        res[-1]['a'] = clean(res[-1]['a'] + ' ' + l)
                elif section.startswith('ATTITUDES'):
                    if re.match(r'^\d\.\s', l):
                        groupe = re.sub(r'^\d\.\s*', '', l).rstrip('.')
                    elif BUL.match(l):
                        res.append(ligne('S3', 'S6', 'f', groupe, groupe, BUL.sub('', l), pn, 'Compétences terminales HGT 1999'))
                    elif res and res[-1]['t'] == 'f' and not re.match(r'^[A-ZÉ0-9]', l):
                        res[-1]['a'] = clean(res[-1]['a'] + ' ' + l)
    return [r for r in res if r['a']]


def uaa():
    matiere = sys.argv[5] if len(sys.argv) > 5 and not sys.argv[5].endswith('.json') else ''
    with pdfplumber.open(PDF) as pdf:
        for pn, page in enumerate(pdf.pages, 1):
            texte = page.extract_text() or ''
            m = re.search(r'COMP[ÉE]TENCE À D[ÉE]VELOPPER\s*:\s*(.+)', texte)
            if not m:
                continue
            lignes = [x.strip() for x in texte.split('\n')]
            idx = next(k for k, x in enumerate(lignes) if 'COMPÉTENCE À DÉVELOPPER' in x or 'COMPETENCE À DEVELOPPER' in x)
            titre = clean(' '.join(x for x in lignes[max(0, idx - 3):idx] if x and not re.match(r'^(UAA\s*\d*|Annexe)', x) and 'gras' not in x and 'DEGRÉ' not in x))
            suite = ''
            if idx + 1 < len(lignes) and lignes[idx + 1] and not lignes[idx + 1].startswith(('Processus', 'Appliquer')):
                suite = ' ' + lignes[idx + 1]
            comp = clean(m.group(1) + suite)
            comp = comp.capitalize() if comp.isupper() else comp
            sujet = matiere or ('Géographie' if 'GÉOGRAPHIE' in texte[:400].upper() else 'Histoire')
            degre = ('S3', 'S4') if re.search(r'2e DEGR', texte) else (('S5', 'S6') if re.search(r'3e DEGR', texte) else ('S3', 'S6'))
            u = f'{sujet} : {titre}' if titre else sujet
            ref = f'{REF[FORME]} 2014-2017'
            if titre:
                res.append(ligne(degre[0], degre[1], 'c', sujet, u, titre, pn, ref))
            res.append(ligne(degre[0], degre[1], 'c', sujet, u, comp, pn, ref))
            for x in lignes:
                if len(x) > 12 and x.isupper() and not x.startswith(('COMP', 'PROCESS', 'ANNEXE', 'HISTOIRE', 'GÉOGRAPHIE', 'UAA')) and len(x) < 70:
                    res.append(ligne(degre[0], degre[1], 's', sujet, u, x.capitalize(), pn, ref))
    vus, uniques = set(), []
    for r in res:
        cle = (r['a'], r['n'], r['u'])
        if cle not in vus:
            vus.add(cle)
            uniques.append(r)
    return uniques


lignes = histoire() if MODE == 'histoire' else uaa()
with open(SORTIE, 'w', encoding='utf-8') as f:
    json.dump([{k: v for k, v in r.items() if v not in (None, '')} for r in lignes], f, ensure_ascii=False, separators=(',', ':'))
print(SORTIE, len(lignes), 'lignes')

if sys.argv[-1].endswith('.json') and sys.argv[-1] != SORTIE:
    cible = sys.argv[-1]
    existantes = json.load(open(cible, encoding='utf-8'))
    refs = {r['r'] for r in lignes}
    pdf_pages = {(r['r'], r['u']) for r in lignes}
    gardees = [e for e in existantes if not (e['r'] in refs and e.get('f') == FORME and (e['r'], e.get('u', '')) in pdf_pages)]
    gardees += [{k: v for k, v in r.items() if v not in (None, '')} for r in lignes]
    with open(cible, 'w', encoding='utf-8') as f:
        json.dump(gardees, f, ensure_ascii=False, separators=(',', ':'))
    print(cible, len(gardees), 'entrées')
