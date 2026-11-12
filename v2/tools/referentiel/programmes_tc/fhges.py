"""Programme de formation historique, géographique, économique et sociale (FHGES) WBE du tronc commun, S1 à S3.

Trois disciplines, trois découpages :
- formation historique : les « moments clés » de chaque année (tableaux Savoirs / Attendus) ;
- formation géographique : les « parcours d'apprentissage » (savoirs, savoir-faire et compétences obligatoires) ;
- formation économique et sociale : les « objets d'étude » (sections 3.2.x, 4.2.x, 5.2.x).
Source : « Programme FHGES WBE TC secondaire » (version validée par la CDRP).
"""
import re

from .commun import Unite, nettoyer_titre

REFERENTIEL = 'Référentiel de formation historique, géographique, économique et sociale 2022'

# Pages (début, fin comprises) des tableaux de moments clés, par année.
PAGES_HISTOIRE = {'S1': (58, 59), 'S2': (69, 72), 'S3': (83, 87)}
MOMENT_CLE = re.compile(r'^MOMENT\s+CL[EÉ]\s*(\d)\s*:\s*(.+)$', re.MULTILINE)
# Géographie : du premier parcours (page 142) à la veille des visées transversales (page 207).
PAGES_GEOGRAPHIE = (142, 206)
PARCOURS = re.compile(r'^S(\d)\s*[-–]\s*Parcours d’apprentissage\s*(\d)\s*:\s*(.*)$', re.MULTILINE)
FIN_DE_TITRE_DE_PARCOURS = re.compile(r'^(Savoirs et attendus|Prérequis)', re.IGNORECASE)
# Économie et sociale : les objets d'étude de S1 (3.2.x), S2 (4.2.x) et S3 (5.2.x), pages 262 à 348 ; x.2.1 = « Repères pour la mise en œuvre ».
PAGES_ECONOMIE = (262, 348)
OBJET_D_ETUDE = re.compile(r'^([345])\.2\.([2-9])\.\s+(.+)$', re.MULTILINE)
ANNEE_DE_SECTION = {'3': 'S1', '4': 'S2', '5': 'S3'}
NOTE_COLLEE = re.compile(r'(?<=[a-zé])\d{1,2}(?=\s)')


def texte_des_pages(pages: dict, debut: int, fin: int) -> str:
    return '\n'.join(pages.get(p, '') for p in range(debut, fin + 1))


def decouper_en_unites(texte: str, motif, fabriquer) -> list:
    """Une unité par titre trouvé par `motif`, avec le texte qui le suit jusqu'au titre suivant ; `fabriquer(match)` renvoie (année, titre)."""
    trouves = list(motif.finditer(texte))
    unites = []
    for rang, m in enumerate(trouves):
        fin = trouves[rang + 1].start() if rang + 1 < len(trouves) else len(texte)
        annee, titre = fabriquer(m)
        unite = Unite(annee, titre)
        unite.ajouter(0, texte[m.start():fin])
        unites.append(unite)
    return unites


def fusionner(unites: list) -> list:
    """Un titre répété (en-tête recopié en haut de la page suivante) ne fait qu'une unité : on en réunit les textes."""
    par_titre: dict = {}
    for u in unites:
        existante = par_titre.setdefault((u.annee, u.titre), u)
        if existante is not u:
            existante.pages += u.pages
    return list(par_titre.values())


def moments_cles(pages: dict) -> list:
    unites = []
    for annee, (debut, fin) in PAGES_HISTOIRE.items():
        texte = texte_des_pages(pages, debut, fin)
        unites += decouper_en_unites(
            texte, MOMENT_CLE,
            lambda m, a=annee: (a, f'Histoire, moment clé {m.group(1)} : {nettoyer_titre(m.group(2))}'),
        )
    return fusionner(unites)


def titre_de_parcours(texte: str, m) -> str:
    """Le titre d'un parcours peut continuer sur la ligne suivante (« …étalement urbain / et mutations du secteur agricole »)."""
    titre = [m.group(3)]
    for ligne in texte[m.end():].split('\n')[1:3]:
        if not ligne.strip() or FIN_DE_TITRE_DE_PARCOURS.match(ligne.strip()):
            break
        titre.append(ligne)
    return nettoyer_titre(' '.join(titre))


def parcours_de_geographie(pages: dict) -> list:
    texte = texte_des_pages(pages, *PAGES_GEOGRAPHIE)
    return decouper_en_unites(
        texte, PARCOURS,
        lambda m: (f'S{m.group(1)}', f'Géographie, parcours {m.group(2)} : {titre_de_parcours(texte, m)}'),
    )


def objets_d_etude(pages: dict) -> list:
    texte = texte_des_pages(pages, *PAGES_ECONOMIE)
    return decouper_en_unites(
        texte, OBJET_D_ETUDE,
        lambda m: (ANNEE_DE_SECTION[m.group(1)], f'Économie et sociale : {nettoyer_titre(NOTE_COLLEE.sub("", m.group(3)))}'),
    )


def decouper(pages: dict) -> list:
    unites = moments_cles(pages) + fusionner(parcours_de_geographie(pages)) + fusionner(objets_d_etude(pages))
    attendu = {'S1': (5, 2, 6), 'S2': (4, 2, 4), 'S3': (5, 3, 5)}
    for annee, (moments, parcours, objets) in attendu.items():
        trouves = (
            sum(1 for u in unites if u.annee == annee and u.titre.startswith('Histoire')),
            sum(1 for u in unites if u.annee == annee and u.titre.startswith('Géographie')),
            sum(1 for u in unites if u.annee == annee and u.titre.startswith('Économie')),
        )
        if trouves != (moments, parcours, objets):
            raise SystemExit(f'{annee} : {trouves} (moments, parcours, objets d’étude) au lieu de {(moments, parcours, objets)} ; ce n’est pas la version du programme attendue.')
    return unites
