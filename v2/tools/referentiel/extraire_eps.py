"""Éducation physique et à la santé (EP&S), tronc commun P1-S3.

Usage : python extraire_eps.py <2022_REF_Edu-physique-EPS.pdf> <sortie.json>
Les pages de contenus ont deux colonnes sans traits : à gauche ce que l'élève connait ou sait faire, à droite
l'attendu. On lit la colonne de droite, après chaque en-tête « Attendu(s) », jusqu'au code de l'unité suivante
(HME2, GSS3…). L'année est le premier mot de la page (P1…S3), le champ et l'unité sont lus dans les titres.
"""
import json, re, sys
import pdfplumber

PDF, SORTIE = sys.argv[1:3]
NIVEAU = re.compile(r'^(P[1-6]|S[1-3])$')
CODE = re.compile(r'^[A-Z]{2,4}\d$')
TYPES = {'savoir': 's', 'savoirs': 's', 'savoir-faire': 'f', 'compétence': 'c', 'compétences': 'c'}
clean = lambda s: re.sub(r'\s+', ' ', s).replace(' .', '.').replace(' ,', ',').strip()


def lignes_droite(page, largeur):
    """Lignes de la colonne de droite, avec leur hauteur sur la page."""
    mots = [w for w in page.extract_words() if w['x0'] >= largeur * 0.5 - 4]
    rangees = []
    for w in sorted(mots, key=lambda w: (round(w['top']), w['x0'])):
        if rangees and abs(rangees[-1][0] - w['top']) <= 3:
            rangees[-1][1].append(w)
        else:
            rangees.append([w['top'], [w]])
    return [(t, ' '.join(x['text'] for x in sorted(ws, key=lambda x: x['x0']))) for t, ws in rangees]


def attendus(lignes_brutes):
    sortie = []
    for l in lignes_brutes:
        if re.match(r'^[A-ZÉÈÀÂÊÎÔÛÇ]', l) and not (sortie and sortie[-1].rstrip().endswith((':', ',', ';', '-'))):
            sortie.append(l)
        elif sortie:
            sortie[-1] += ' ' + l
    return [clean(x) for x in sortie]


res = []
with pdfplumber.open(PDF) as pdf:
    for pn, page in enumerate(pdf.pages, 1):
        texte_lignes = (page.extract_text() or '').split('\n')
        niveau = next((l.strip() for l in texte_lignes[:3] if NIVEAU.match(l.strip())), None)
        if not niveau:
            continue
        champ = next((l.strip() for l in texte_lignes if l.strip().startswith('CHAMP')), '')
        code = next((l.strip() for l in texte_lignes if CODE.match(l.strip())), '')
        titre_i = texte_lignes.index(next((l for l in texte_lignes if CODE.match(l.strip())), '')) if code else -1
        unite = clean(texte_lignes[titre_i + 1]) if titre_i >= 0 and titre_i + 1 < len(texte_lignes) else ''
        evenements = []
        for ligne in page.extract_text_lines():
            txt = ligne['text'].strip()
            m = re.match(r'^(Savoirs?|Savoir-faire|Compétences?)\s+Attendus?$', txt)
            if m:
                evenements.append((ligne['top'], 'type', TYPES[m.group(1).lower()]))
            elif CODE.match(txt):
                evenements.append((ligne['top'], 'code', ''))
        for top, txt in lignes_droite(page, page.width):
            evenements.append((top + 0.1, 'ligne', txt))
        type_courant, collecte, groupe = None, False, []
        for _, genre, valeur in sorted(evenements):
            if genre == 'type':
                type_courant, collecte = valeur, True
            elif genre == 'code':
                collecte = False
            elif collecte and type_courant and valeur not in ('À renforcer', 'Sommaire', 'Attendu', 'Attendus') and not CODE.match(valeur):
                groupe.append((type_courant, valeur))
        if re.match(r'^(P[1-6]|S[1-3])$', unite):
            unite = ''
        for t in 'sfc':
            for a in attendus([l for tt, l in groupe if tt == t]):
                a = re.sub(r'\s\d{1,3}$', '', a)
                if len(a) > 8 and 'RÉFÉRENTIEL D' not in a:
                    res.append({'m': 'Éducation physique', 'n': niveau, 'f': 'TC', 't': t, 'u': champ.title() or unite, 'i': unite or code, 'a': a, 'p': pn,
                                'r': 'Référentiel d’éducation physique et à la santé 2022'})
with open(SORTIE, 'w', encoding='utf-8') as f:
    json.dump([{k: v for k, v in r.items() if v} for r in res], f, ensure_ascii=False, separators=(',', ':'))
print(SORTIE, len(res), 'entrées')
