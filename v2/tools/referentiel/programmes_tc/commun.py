"""Briques communes : lire un programme WBE du tronc commun (PDF) et rattacher chaque ligne du référentiel à son module.

Pourquoi : le référentiel 2022 liste des attendus ligne par ligne ; le programme WBE les range par module ou section, avec pour chacun
des Savoirs, des Savoir-faire et des Compétences (ce que l'application appelle Connaître, Appliquer, Transférer). Ce rangement
donne à l'agent une séquence cohérente plutôt que des lignes isolées.

Principe : le JSON du dépôt fait foi, on ne le régénère pas. Chaque ligne du tronc commun (S1 à S3) est retrouvée par son texte dans
les tableaux du programme et reçoit `sq` (titre du module) et, quand le programme l'écrit, `cd` (compétence à développer). Une ligne
introuvable est signalée, jamais devinée ; le texte `a` ne change jamais.
"""
import json
import re
import unicodedata
from collections import OrderedDict

ANNEES_DU_PROGRAMME = ('S1', 'S2', 'S3')
# Début d'un attendu long : assez de mots pour ne pas confondre deux attendus qui commencent pareil.
LONGUEUR_DEBUT = 50
# Un attendu qui revient dans plus d'unités que cela est transversal (démarche scientifique, vocabulaire…) : il n'appartient à aucun module.
MAX_UNITES_PAR_LIGNE = 3
# Lignes du référentiel qui ne sont pas des attendus (extraction des « visées transversales », exemples de contribution) : jamais rattachées.
SIGNES_DE_BRUIT = re.compile(r"^exemples d[e’' ]+(?:opportunit|attendus|contenus)|\((?:ch\d|c1)\b", re.IGNORECASE)
CARACTERES_DE_CONTROLE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f]')


def nfc(texte: str) -> str:
    """Le PDF écrit les accents en deux caractères (a + accent) ; le JSON en un seul : on compare en forme composée."""
    return unicodedata.normalize('NFC', texte)


LIGATURES = {'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl'}
LIGATURE_SUIVIE_D_ESPACE = re.compile('([' + ''.join(LIGATURES) + r'])[  ](?=[a-zàâçéèêëîïôûù])')


def corriger_ligatures(texte: str) -> str:
    """Les PDF des programmes primaires écrivent « ﬁgures » avec une ligature, parfois suivie d'une espace en trop (« ﬂ eurs »)."""
    sans_espace = LIGATURE_SUIVIE_D_ESPACE.sub(lambda m: LIGATURES[m.group(1)], texte)
    return ''.join(LIGATURES.get(c, c) for c in sans_espace)


def normaliser(texte: str) -> str:
    """Texte comparable : forme composée, apostrophes et guillemets unifiés, césures recollées, espaces et casse neutralisées."""
    t = CARACTERES_DE_CONTROLE.sub('', corriger_ligatures(nfc(texte)))
    t = t.replace('’', "'").replace('\xa0', ' ').replace('•', ' ')
    t = t.replace('«', '"').replace('»', '"').replace('–', '-')
    t = re.sub(r'-\s*\n\s*', '', t)
    return re.sub(r'\s+', ' ', t).strip().lower()


def nettoyer_titre(titre: str) -> str:
    """Titre sans caractères de contrôle ni espaces en trop (la table des matières du PDF en laisse)."""
    return ' '.join(CARACTERES_DE_CONTROLE.sub(' ', corriger_ligatures(titre)).split())


def recoller_cesures(texte: str) -> str:
    """« chloro- phylliens » -> « chlorophylliens » : une césure de fin de ligne laisse un tiret suivi d'une espace."""
    return re.sub(r'(\w)-\s+(?=[a-zàâçéèêëîïôûù])', r'\1', texte)


def lire_pages(chemin_pdf: str) -> dict:
    """Numéro de page (à partir de 1) -> texte, lu avec PyMuPDF."""
    import pymupdf
    with pymupdf.open(chemin_pdf) as doc:
        return {i + 1: nfc(page.get_text()) for i, page in enumerate(doc)}


def lire_pages_texte(chemin_txt: str) -> dict:
    """Même résultat depuis un export texte (`=====PAGE n=====`), pour les essais hors PDF."""
    with open(chemin_txt, encoding='utf-8') as f:
        brut = f.read()
    return {int(c.split('=====', 1)[0]): nfc(c.split('=====', 1)[1]) for c in brut.split('=====PAGE ')[1:]}


class Unite:
    """Un module ou une section du programme : année, titre affiché, compétence éventuelle, textes de ses tableaux (une entrée par page)."""

    def __init__(self, annee: str, titre: str, competence: str = ''):
        self.annee = annee
        self.titre = titre
        # Compétence à développer, quand le programme l'écrit en tête du module ; sinon vide (le moteur la déduit alors des lignes « compétence »).
        self.competence = competence
        self.pages: list = []

    def ajouter(self, page: int, texte: str) -> None:
        self.pages.append((page, normaliser(texte)))

    def contient(self, attendu: str) -> bool:
        return any(attendu in texte for _, texte in self.pages)


def est_du_bruit(attendu: str) -> bool:
    return bool(SIGNES_DE_BRUIT.search(attendu))


def trouver_unites(ligne: dict, unites: list) -> list:
    """Unités de l'année de la ligne dont les tableaux contiennent son texte (ou son début, pour un attendu très long)."""
    attendu = normaliser(ligne['a'])
    de_l_annee = [u for u in unites if u.annee == ligne['n']]
    trouvees = [u for u in de_l_annee if u.contient(attendu)]
    if not trouvees and len(attendu) > LONGUEUR_DEBUT:
        trouvees = [u for u in de_l_annee if u.contient(attendu[:LONGUEUR_DEBUT])]
    return trouvees


def departager(ligne: dict, trouvees: list) -> list:
    """Parmi plusieurs unités, garde celles dont les tableaux contiennent aussi l'intitulé (`i`) de la ligne ; sinon toutes."""
    intitule = normaliser(ligne.get('i') or '')
    if len(trouvees) < 2 or not intitule:
        return trouvees
    avec_intitule = [u for u in trouvees if u.contient(intitule)]
    return avec_intitule or trouvees


def rattacher(lignes: list, unites: list, referentiel=None, annees=ANNEES_DU_PROGRAMME) -> dict:
    """Pose `sq` (et `cd`) sur les lignes du tronc commun des années données (S1-S3 par défaut) du référentiel (tous, si `referentiel` est None) ; renvoie un rapport (comptes et listes à relire).

    Une ligne présente dans plusieurs unités (le programme répète certains attendus d'une section à l'autre) va dans celle qui contient aussi
    son intitulé, sinon dans la première du programme : c'est signalé dans `ambigues`. Une ligne présente dans plus de trois unités est
    transversale : aucun module.
    """
    ordre = {id(u): i for i, u in enumerate(unites)}
    rapport = {'rattachees': 0, 'ambigues': [], 'absentes': [], 'bruit': [], 'transversales': []}
    for ligne in lignes:
        concerne = (referentiel is None or ligne.get('r') == referentiel) and ligne.get('f') == 'TC' and ligne.get('n') in annees
        if not concerne:
            continue
        ligne.pop('sq', None)
        ligne.pop('cd', None)
        if est_du_bruit(ligne['a']):
            rapport['bruit'].append(ligne['a'])
            continue
        trouvees = trouver_unites(ligne, unites)
        if not trouvees:
            rapport['absentes'].append((ligne['n'], ligne['a']))
            continue
        if len(trouvees) > MAX_UNITES_PAR_LIGNE:
            rapport['transversales'].append((ligne['n'], ligne['a']))
            continue
        trouvees = departager(ligne, trouvees)
        if len(trouvees) > 1:
            rapport['ambigues'].append((ligne['n'], ligne['a'], [u.titre for u in trouvees]))
        choisie = min(trouvees, key=lambda u: ordre[id(u)])
        ligne['sq'] = choisie.titre
        if choisie.competence:
            ligne['cd'] = choisie.competence
        rapport['rattachees'] += 1
    return rapport


def lire_json(chemin: str) -> list:
    with open(chemin, encoding='utf-8') as f:
        return json.load(f)


def ecrire_json(chemin: str, lignes: list) -> None:
    """Même forme compacte que les autres fichiers du dépôt (une seule ligne)."""
    with open(chemin, 'w', encoding='utf-8') as f:
        json.dump(lignes, f, ensure_ascii=False, separators=(',', ':'))


def afficher_rapport(rapport: dict, avec_listes: bool = True) -> None:
    print(
        f"rattachées : {rapport['rattachees']} | ambiguës : {len(rapport['ambigues'])} | absentes : {len(rapport['absentes'])}"
        f" | transversales : {len(rapport['transversales'])} | bruit ignoré : {len(rapport['bruit'])}"
    )
    if not avec_listes:
        return
    for annee, attendu in rapport['absentes']:
        print(f'   absente ({annee}) : {attendu[:90]}')


def regrouper(unites: list) -> 'OrderedDict[str, list]':
    """Titres d'unités par année, dans l'ordre du programme (pour les affichages de contrôle)."""
    res: OrderedDict = OrderedDict()
    for u in unites:
        res.setdefault(u.annee, []).append(u.titre)
    return res
