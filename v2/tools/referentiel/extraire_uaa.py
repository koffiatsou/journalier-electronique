"""Unités d'acquis d'apprentissage (UAA) lues avec PyMuPDF (`find_tables`), plus fiable que pdfplumber sur ces tableaux.

Usage : python extraire_uaa.py <pdf> <matière> <HGT|HPT> <référentiel> <fusion.json> [--sujet Géographie|Histoire] [--supprimer "ref1|ref2"]
Pour chaque UAA : l'intitulé et les compétences à développer, puis les colonnes « Appliquer » (savoir-faire),
« Transférer » (compétences), « Connaitre » et « Ressources » (savoirs). Une puce = une ligne. Le degré est lu dans
l'en-tête (« 2e degré » → S3-S4, « 3e degré » → S5-S6), à défaut S3-S6.
Les lignes de ce référentiel déjà présentes dans <fusion.json> sont remplacées (relancer donne le même résultat).
"""
import json, os, re, sys
import pymupdf

PDF, MATIERE, FORME, REFERENTIEL, FUSION = sys.argv[1:6]
SUJET = sys.argv[sys.argv.index('--sujet') + 1] if '--sujet' in sys.argv else ''
SUPPRIMER = sys.argv[sys.argv.index('--supprimer') + 1].split('|') if '--supprimer' in sys.argv else []
PUCE = re.compile(r'^[•▪•▪\-–o]\s+')
LONGUEUR_MAX = 320
# Les chiffres collés à un mot sont des renvois de bas de page.
clean = lambda s: re.sub(r'(?<=[a-zéèêàç])\d{1,2}(?=[\s.;,:]|$)', '', re.sub(r'\s+', ' ', s or '').replace(' .', '.').strip())


def puces(cellule):
    """Découpe une cellule en puces ; le texte avant la première puce est un chapeau, rendu à part."""
    chapeau, items = [], []
    for ligne in (cellule or '').split('\n'):
        l = ligne.strip()
        if not l:
            continue
        if PUCE.match(l):
            items.append(PUCE.sub('', l))
        elif items:
            items[-1] += ' ' + l
        else:
            chapeau.append(l)
    return clean(' '.join(chapeau)), [clean(x) for x in items]


SECTIONS = {'Pré-requis': None, 'Pre-requis': None, 'Savoirs disciplinaires': 's', 'Savoir-faire disciplinaires': 'f',
            'Savoirs transversaux': 's', 'Savoir-faire transversaux': 'f'}


def sections(cellule):
    """Cellule « Ressources » à rubriques : [(type, puces)] ; les pré-requis ne sont pas des contenus de l'unité."""
    sortie, type_, courant = [], None, []
    for ligne in (cellule or '').split('\n'):
        l = ligne.strip()
        nom = next((n for n in SECTIONS if l.startswith(n)), None)
        if nom:
            if courant and type_:
                sortie.append((type_, courant))
            type_, courant = SECTIONS[nom], []
        elif PUCE.match(l):
            courant.append(PUCE.sub('', l))
        elif courant and l:
            courant[-1] += ' ' + l
    if courant and type_:
        sortie.append((type_, courant))
    return sortie


def sections(cellule):
    """Cellule « Ressources » à rubriques : [(type, puces)] ; les pré-requis ne sont pas des contenus de l'unité."""
    sortie, type_, courant = [], None, []
    for ligne in (cellule or '').split('\n'):
        l = ligne.strip()
        nom = next((n for n in SECTIONS if l.startswith(n)), None)
        if nom:
            if courant and type_:
                sortie.append((type_, courant))
            type_, courant = SECTIONS[nom], []
        elif PUCE.match(l):
            courant.append(PUCE.sub('', l))
        elif courant and l:
            courant[-1] += ' ' + l
    if courant and type_:
        sortie.append((type_, courant))
    return sortie


def couper(texte):
    if len(texte) <= LONGUEUR_MAX:
        return [texte]
    morceaux, courant = [], ''
    for phrase in re.split(r'(?<=[.;])\s+', texte):
        if courant and len(courant) + len(phrase) > LONGUEUR_MAX:
            morceaux.append(courant)
            courant = phrase
        else:
            courant = (courant + ' ' + phrase).strip()
    return morceaux + ([courant] if courant else [])


lignes = []
etat = {'degre': ('S3', 'S6'), 'titre': '', 'sujet': SUJET}


def ajouter(type_, texte, page):
    for morceau in couper(clean(texte)):
        # Un chapeau qui annonce une liste (« Connaitre - … en prenant appui sur : ») n'est pas lui-même un contenu.
        if len(morceau.split()) >= 3 and not morceau.endswith(':') and not morceau.startswith('Connaitre -'):
            lignes.append({'t': type_, 'a': morceau, 'p': page, 'u': etat['titre'], 'n': etat['degre'][0], 'nf': etat['degre'][1], 's': etat['sujet']})


doc = pymupdf.open(PDF)
for numero, page in enumerate(doc, 1):
    # Le titre « HISTOIRE 2e DEGRÉ » est souvent hors tableau : on le cherche dans le texte de la page.
    entete = re.search(r'(HISTOIRE|G[ÉE]OGRAPHIE)\s+(\d)\s*e\s*DEGR', page.get_text())
    if entete:
        etat['degre'] = ('S3', 'S4') if entete.group(2) == '2' else ('S5', 'S6')
        if not SUJET:
            etat['sujet'] = 'Histoire' if entete.group(1) == 'HISTOIRE' else 'Géographie'
    for tableau in page.find_tables().tables:
        for rangee in tableau.extract():
            cellules = [(c or '') for c in rangee]
            if not any(c.strip() for c in cellules):
                continue
            tete = cellules[0].strip()
            haut = ' '.join(cellules)
            m = re.search(r'(\d)\s*e\s*degr', haut, re.I)
            if m and len(haut) < 200:
                etat['degre'] = ('S3', 'S4') if m.group(1) == '2' else (('S5', 'S6') if m.group(1) == '3' else ('S3', 'S6'))
                if not SUJET:
                    if re.search(r'G[ÉE]OGRAPHIE', haut, re.I):
                        etat['sujet'] = 'Géographie'
                    elif re.search(r'HISTOIRE', haut, re.I):
                        etat['sujet'] = 'Histoire'
            mu = re.search(r"Unité d.acquis d.apprentissage\s*(\d+)", tete)
            if mu and re.search(r'(Troisième|Quatrième)\s+année|(Deuxième|Troisième)\s+degré', tete):
                if re.search(r'Troisième\s+année', tete):
                    etat['degre'] = ('S3', 'S3')
                elif re.search(r'Quatrième\s+année', tete):
                    etat['degre'] = ('S4', 'S4')
                elif re.search(r'Troisième\s+degré', tete):
                    etat['degre'] = ('S5', 'S6')
                else:
                    etat['degre'] = ('S3', 'S4')
                disc = re.search(r'(Biologie|Chimie|Physique)', tete)
                etat['discipline'] = disc.group(1) if disc else ''
                etat['titre'] = ''
                etat['attente_titre'] = True
                continue
            if etat.get('attente_titre') and tete.startswith('«'):
                etat['titre'] = clean(tete.strip('«» '))
                etat['sujet'] = etat.get('discipline', '') or etat['sujet']
                etat['attente_titre'] = False
                ajouter('c', etat['titre'], numero)
                continue
            if tete == 'UAA' and len(cellules) == 3 and cellules[1].strip() == 'Titre':
                continue
            if tete.isdigit() and len(cellules) == 3 and cellules[1].strip() and cellules[2].strip():
                # Tableau « UAA / Titre / Concepts-clés » d'un thème : une compétence par unité.
                ajouter('c', clean(cellules[1]) + ' : ' + clean(cellules[2]), numero)
                continue
            if re.match(r'^Th[èe]me\s+\d', tete) and len(cellules) == 3 and not cellules[1].strip():
                etat['titre'] = clean(tete)
                continue
            if re.match(r'^UAA', tete):
                titre = clean(re.sub(r'^UAA\s*[-\d.\s]*', '', tete.replace('\n', ' ')))
                if titre:
                    etat['titre'] = titre
                    ajouter('c', titre, numero)
            elif re.match(r'^COMP[ÉE]TENCES?\b', tete, re.I):
                corps = re.sub(r'^COMP[ÉE]TENCES?( À D[ÉE]VELOPPER)?\s*:?', '', tete, flags=re.I)
                chapeau, items = puces(corps)
                for x in ([chapeau] if chapeau else []) + items:
                    ajouter('c', x, numero)
            elif tete.startswith('Processus') or tete.startswith('Ressources'):
                continue
            else:
                if len(cellules) == 2 and re.search(r'Savoirs? disciplinaires?|Savoir-faire disciplinaires?|Pré-requis', cellules[1]):
                    gauche_type = 's' if re.match(r'^Conna[iî]tre', cellules[0].strip()) else 'f'
                    # « Appliquer » et « Transférer » sont lus dans une seule cellule, colonnes entremêlées : phrases coupées, on ne les garde pas.
                    melange = 'Appliquer' in cellules[0] and 'Transférer' in cellules[0]
                    for x in ([] if melange else puces(cellules[0])[1]):
                        ajouter(gauche_type, x, numero)
                    for type_, items in sections(cellules[1]):
                        for x in items:
                            ajouter(type_, x, numero)
                    continue
                noms = ['f', 'c', 's'] if len(cellules) >= 3 else ['s', 's']
                for position, cellule in enumerate(cellules[:3]):
                    if not cellule.strip():
                        continue
                    type_ = noms[position] if position < len(noms) else 's'
                    if re.match(r'^Conna[iî]tre', cellule.strip()):
                        type_ = 's'
                    chapeau, items = puces(cellule)
                    for x in items:
                        ajouter(type_, x, numero)
                    if not items and len(chapeau.split()) >= 6 and not re.match(r'^(Appliquer|Transf|Strat)', chapeau):
                        ajouter(type_, chapeau, numero)

vus, uniques = set(), []
# Hors d'une unité (introduction, présentation du document) : pas de contenu disciplinaire.
for e in [x for x in lignes if x['u'] or x['s']]:
    cle = (e['a'], e['u'], e['n'])
    if cle not in vus:
        vus.add(cle)
        uniques.append(e)
compact = []
for e in uniques:
    intitule = f"{e['s']} : {e['u']}" if e['s'] and e['u'] else (e['s'] or e['u'])
    ligne = {'m': MATIERE, 'n': e['n'], 'nf': e['nf'], 'f': FORME, 't': e['t'], 'u': e['s'] or e['u'], 'i': intitule, 'a': e['a'], 'p': e['p'], 'r': REFERENTIEL}
    compact.append({k: v for k, v in ligne.items() if v})
existantes = json.load(open(FUSION, encoding='utf-8')) if os.path.exists(FUSION) else []
gardees = [x for x in existantes if x.get('r') != REFERENTIEL and x.get('r') not in SUPPRIMER] + compact
with open(FUSION, 'w', encoding='utf-8') as f:
    json.dump(gardees, f, ensure_ascii=False, separators=(',', ':'))
par_type = {t: sum(1 for x in compact if x['t'] == t) for t in 'fcs'}
print(f'{MATIERE} ({REFERENTIEL}) : {len(compact)} lignes {par_type} ; {FUSION} : {len(gardees)} entrées')
