"""Programme de mathématiques WBE du tronc commun (S1 à S3) : modules et sections avec leurs tableaux Savoirs / Savoir-faire / Compétences.

Source : « Programme de mathématiques TC secondaire WBE » (version provisoire validée par la CDRP), pages 72 à 267.
Chaque année a, par champ (1 à 4), une page « Découpage du champ en modules et en sections » : c'est la liste ci-dessous.
"""
import re
from collections import OrderedDict

from .commun import Unite, normaliser

# Pages du programme : début de chaque année, fin de S3 ; les « Planification des apprentissages en Sx » servent de contrôle.
DEBUTS = (('S1', 72), ('S2', 150), ('S3', 211))
DERNIERE_PAGE = 267
PAGES_DE_CONTROLE = {'S1': 74, 'S2': 152, 'S3': 212}
PREMIERE_PAGE_DE_CONTENU = 74
REFERENTIEL = 'Référentiel de mathématiques 2022'

# (année, module, section) d'après les pages « Découpage du champ en modules et en sections ». Un module sans section n'a pas de nom de section.
UNITES = (
    ('S1', 'Les éléments du plan', None),
    ('S1', 'La géométrie plane', 'Les angles'),
    ('S1', 'La géométrie plane', 'Les figures planes (triangles, quadrilatères et polygones réguliers)'),
    ('S1', 'Les mouvements dans le plan', 'Les isométries'),
    ('S1', 'Les mouvements dans le plan', 'Axe(s) et centre de symétrie'),
    ('S1', 'Les mouvements dans le plan', 'Le repérage'),
    ('S1', 'Périmètres et aires de figures planes', None),
    ('S1', 'Périmètres et aires de figures planes', 'La fraction « grandeur »'),
    ('S1', 'Les grandeurs proportionnelles', None),
    ('S1', 'Le monde des nombres', 'Les nombres naturels'),
    ('S1', 'Le monde des nombres', 'Les puissances'),
    ('S1', 'Le monde des nombres', 'Les nombres entiers'),
    ('S1', 'Le monde des nombres', 'Les nombres décimaux et les fractions'),
    ('S1', 'Outils algébriques', 'Expressions algébriques'),
    ('S1', 'Outils algébriques', 'Équations du premier degré à une inconnue'),
    ('S1', 'De l’organisation des données à la statistique', None),
    ('S2', 'La géométrie plane', 'Les angles'),
    ('S2', 'Les mouvements dans le plan', 'Agrandissements et réductions de figures'),
    ('S2', 'Distances et lieux géométriques', None),
    ('S2', 'La géométrie dans l’espace', 'Les solides'),
    ('S2', 'La géométrie dans l’espace', 'Volume des solides'),
    ('S2', 'Les grandeurs proportionnelles', None),
    ('S2', 'Le monde des nombres', 'Les puissances'),
    ('S2', 'Le monde des nombres', 'Les nombres rationnels'),
    ('S2', 'Outils algébriques', 'Expressions algébriques'),
    ('S2', 'Outils algébriques', 'Équations du premier degré à une inconnue'),
    ('S2', 'De l’organisation des données à la statistique', None),
    ('S3', 'Figures semblables et théorème de Thalès', None),
    ('S3', 'Distances, lieux géométriques et théorème de Pythagore', None),
    ('S3', 'Les fonctions', 'Approche graphique des fonctions'),
    ('S3', 'Les fonctions', 'Les fonctions du premier degré'),
    ('S3', 'Le monde des nombres', 'Puissances de 10 et nombres irrationnels'),
    ('S3', 'Outils algébriques', 'Équations du premier degré à une inconnue'),
    ('S3', 'Outils algébriques', 'La factorisation et les équations « produit nul »'),
    ('S3', 'De l’organisation des données à la statistique', None),
)

ENTETE_DE_PAGE = re.compile(r'Version provisoire[^\n]*\n')
DEBUT_DE_TITRE = re.compile(r'^(MODULE|SECTION)\b', re.IGNORECASE)
RUBRIQUES = re.compile(r'^(Enjeux|Savoirs?|Savoir-faire|Compétences?|CONSEILS|FLSco|DIFFÉRENCIATION|VISÉES|Repères|Référentiel|CONTEXTE|STRUCTURE)')
DEBUT_DE_TABLEAU = re.compile(r'^(Savoirs?|Savoir-faire|Compétences?)\s*(?:Attendus?.*)?$', re.MULTILINE)
PAGE_SANS_UNITE = re.compile(r'^(CHAMP|Pondération|Situation d)')
LIGNES_DU_HAUT = 8


def annee_de_page(page: int):
    courante = None
    for annee, debut in DEBUTS:
        if page >= debut:
            courante = annee
    return courante


def libelle(unite: tuple) -> str:
    _, module, section = unite
    return module if section is None else f'{module} / {section}'


def lignes_du_haut(texte: str) -> list:
    m = ENTETE_DE_PAGE.search(texte)
    reste = texte[m.end():] if m else texte
    return [x.strip() for x in reste.split('\n')]


def titre_de_page(texte: str) -> str:
    """Lignes « MODULE … / SECTION … » en haut d'une page (jusqu'à la première rubrique), ou une chaîne vide."""
    titre, lu = [], False
    for ligne in lignes_du_haut(texte)[:LIGNES_DU_HAUT]:
        if not lu:
            if not DEBUT_DE_TITRE.match(ligne):
                continue
            lu = True
        if RUBRIQUES.match(ligne) or ligne == '':
            break
        titre.append(ligne)
    return ' '.join(titre)


def unite_du_titre(titre: str, annee: str):
    """Unité de l'année dont le nom (section sinon module) figure dans le titre ; le nom le plus long l'emporte (« Les puissances » / « Puissances de 10… »)."""
    t = normaliser(titre)
    meilleure = None
    for unite in UNITES:
        if unite[0] != annee:
            continue
        nom = normaliser(unite[2] or unite[1])
        if nom in t and (meilleure is None or len(nom) > meilleure[0]):
            meilleure = (len(nom), unite)
    if meilleure is None and 'volume' in t and annee == 'S2':
        return ('S2', 'La géométrie dans l’espace', 'Volume des solides')
    return meilleure[1] if meilleure else None


def verifier_pages(pages: dict) -> None:
    """Arrête tout si le PDF n'a pas la pagination attendue (une autre version du programme)."""
    for annee, page in PAGES_DE_CONTROLE.items():
        if annee not in pages.get(page, ''):
            raise SystemExit(f'Page {page} : « {annee} » introuvable ; ce n’est pas la version du programme attendue.')


def decouper(pages: dict) -> list:
    """Unités dans l'ordre du programme, chacune avec le texte de ses tableaux (une page = une entrée)."""
    verifier_pages(pages)
    unites: OrderedDict = OrderedDict()
    courante, dans_tableau = None, False
    for page in range(PREMIERE_PAGE_DE_CONTENU, DERNIERE_PAGE + 1):
        texte = pages.get(page, '')
        annee = annee_de_page(page)
        if PAGE_SANS_UNITE.match(' '.join(lignes_du_haut(texte)[:3])):
            courante, dans_tableau = None, False
        titre = titre_de_page(texte)
        unite = unite_du_titre(titre, annee) if titre else None
        if unite is not None and unite != courante:
            courante, dans_tableau = unite, False
        if courante is None:
            continue
        debut = DEBUT_DE_TABLEAU.search(texte)
        if debut and not dans_tableau:
            dans_tableau, corps = True, texte[debut.start():]
        elif dans_tableau:
            corps = texte
        else:
            continue
        if 'VISÉES TRANSVERSALES' in corps:
            corps, dans_tableau = corps.split('VISÉES TRANSVERSALES')[0], False
        corps = re.split(r'\nRepères', corps)[0]
        unites.setdefault(courante, Unite(courante[0], libelle(courante))).ajouter(page, corps)
    return [unites[u] for u in UNITES if u in unites]
