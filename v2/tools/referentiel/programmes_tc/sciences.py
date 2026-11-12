"""Programme de sciences WBE du tronc commun (S1 à S3) : 18 thèmes, six par année, chacun avec son tableau
« Articulation des savoirs, savoir-faire et compétences ».

Source : « Programme de sciences WBE TC secondaire » (version provisoire validée par la CDRP). La table des matières (page 27 à 29) répartit les
thèmes par année : S1 = thèmes 1 à 6, S2 = 7 à 12, S3 = 13 à 18.
"""
import re
from collections import OrderedDict

from .commun import Unite, nettoyer_titre, recoller_cesures

REFERENTIEL = 'Référentiel de sciences 2022'
PREMIERE_PAGE_DE_THEME = 60
THEMES_PAR_ANNEE = 6
ANNEES = ('S1', 'S2', 'S3')
TITRE_DE_THEME = re.compile(r'^5\.(\d+)\.\s+TH[ÈE]ME\s+\d+\s*[–-]\s*(.+)$', re.MULTILINE)
ENTETE_DE_PAGE = re.compile(r'^.*?Version provisoire[^\n]*\n', re.DOTALL)
RUBRIQUE_ARTICULATION = re.compile(r'ARTICULATION DES SAVOIRS, SAVOIR-FAIRE ET COMPÉTENCES')
ANNEXES = re.compile(r'5\.\d+\.\d+\.\s+ANNEXES?', re.IGNORECASE)
MARQUEUR_DE_FIN = 'BIBLIOGRAPHIE'


def en_phrase(titre: str) -> str:
    """« LES ÉCOSYSTÈMES » -> « Les écosystèmes » (le PDF écrit les titres en capitales)."""
    t = re.sub(r'\s+', ' ', titre).strip().lower()
    return t[:1].upper() + t[1:]


LIGNE_DE_TITRE_DE_LA_TABLE = re.compile(r'^5\.(\d+)\.\s+Th[èe]me\s+\d+\s*[–-]\s*(.+)$', re.IGNORECASE)
COMPETENCE_DU_THEME = re.compile(r'ARTICULATION DES SAVOIRS, SAVOIR-FAIRE ET COMPÉTENCES\s*\n(?:Compétences?\s*\n)(.*?)\nSavoirs', re.DOTALL)
PAGES_DE_LA_TABLE = range(20, 31)


def titres_de_la_table(pages: dict) -> dict:
    """Numéro de thème -> titre tel qu'écrit dans la table des matières (casse normale, noms propres compris)."""
    titres = {}
    for page in PAGES_DE_LA_TABLE:
        lignes = [x.strip() for x in pages.get(page, '').split('\n')]
        for i, ligne in enumerate(lignes):
            m = LIGNE_DE_TITRE_DE_LA_TABLE.match(ligne)
            if not m or int(m.group(1)) in titres:
                continue
            titre = m.group(2).strip()
            suite = lignes[i + 1] if i + 1 < len(lignes) else ''
            if suite and suite[0].islower():
                titre = f'{titre} {suite}'
            titre = nettoyer_titre(titre)
            titres[int(m.group(1))] = titre[:1].upper() + titre[1:]
    return titres


def competence_du_theme(texte: str) -> str:
    """Compétence écrite sous « Articulation des savoirs, savoir-faire et compétences » (une ou deux phrases), ou une chaîne vide."""
    m = COMPETENCE_DU_THEME.search(texte)
    return recoller_cesures(re.sub(r'\s+', ' ', m.group(1))).strip() if m else ''


def debuts_de_themes(pages: dict) -> list:
    """(numéro de thème, page, titre) dans l'ordre du programme, d'après les pages de titre en capitales."""
    trouves = OrderedDict()
    for page in sorted(pages):
        if page < PREMIERE_PAGE_DE_THEME:
            continue
        m = TITRE_DE_THEME.search(pages[page])
        if m and m.group(2).upper() == m.group(2) and int(m.group(1)) not in trouves:
            trouves[int(m.group(1))] = (page, en_phrase(m.group(2)))
    return [(numero, page, titre) for numero, (page, titre) in trouves.items()]


def decouper(pages: dict) -> list:
    """Un thème = ses pages depuis « Articulation des savoirs… » jusqu'à ses annexes (figures, schémas) ou au thème suivant."""
    themes = debuts_de_themes(pages)
    if len(themes) != THEMES_PAR_ANNEE * len(ANNEES):
        raise SystemExit(f'{len(themes)} thèmes trouvés au lieu de {THEMES_PAR_ANNEE * len(ANNEES)} : ce n’est pas la version du programme attendue.')
    bibliographie = next((p for p in sorted(pages) if p > themes[-1][1] and ENTETE_DE_PAGE.sub('', pages[p], count=1).lstrip().startswith(MARQUEUR_DE_FIN)), max(pages) + 1)
    titres = titres_de_la_table(pages)
    unites = []
    for rang, (numero, debut, titre) in enumerate(themes):
        titre = titres.get(numero, titre)
        fin = themes[rang + 1][1] - 1 if rang + 1 < len(themes) else bibliographie - 1
        unite = Unite(ANNEES[(numero - 1) // THEMES_PAR_ANNEE], titre)
        for page in range(debut, fin + 1):
            texte = ENTETE_DE_PAGE.sub('', pages.get(page, ''), count=1)
            if ANNEXES.match(texte.lstrip()):
                break
            if unite.pages or RUBRIQUE_ARTICULATION.search(texte):
                unite.competence = unite.competence or competence_du_theme(texte)
                unite.ajouter(page, texte)
        if unite.pages:
            unites.append(unite)
    return unites
