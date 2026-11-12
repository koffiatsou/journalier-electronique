"""Programmes WBE de l'enseignement primaire (un PDF par année, P1 à P5) : séquences didactiques.

Chaque discipline y développe des séquences. La première page d'une séquence contient l'encadré « Le dispositif amène les élèves à… » :
titre de la séquence, compétence visée (« Au niveau disciplinaire »), puis les attendus rangés en Contenu | Savoir, Savoir-faire et Compétence,
avec leur code du référentiel (OEG130…). C'est la séquence que l'enseignante appelle Connaître, Appliquer, Transférer.
"""
import re

from .commun import Unite, nettoyer_titre

# En-tête de page : « MATHÉMATIQUES  I  SÉQUENCES DIDACTIQUES » (le « I » est une barre verticale dans le PDF).
ENTETE_DE_SEQUENCE = re.compile(r'^(.+?)\s+[I|]\s+SÉQUENCES DIDACTIQUES\s*$', re.MULTILINE)
DEBUT_DE_ENCADRE = 'LE DISPOSITIF AMÈNE LES ÉLÈVES À'
FIN_DE_ENCADRE = 'LECTURES ASSOCIÉES'
NIVEAU_DISCIPLINAIRE = 'AU NIVEAU DISCIPLINAIRE'
DEBUT_DE_CONTENU = re.compile(r'^Contenu\s+[I|]\s+', re.MULTILINE)
PAGES_SUIVANTES_MAX = 2
# Mot qui identifie la discipline dans l'en-tête, par fichier de la matière.
DISCIPLINES = {
    'mathematiques': 'MATHÉMATIQUES',
    'francais': 'FRANÇAIS',
    'sciences': 'SCIENCES',
    'technique': 'FORMATION MANUELLE',
    'histoire-geographie': 'FORMATION HISTORIQUE',
    'arts': 'ÉDUCATION CULTURELLE',
    'philosophie': 'ÉDUCATION À LA PHILOSOPHIE',
    'education-physique': 'ÉDUCATION PHYSIQUE',
}


def annee_du_fichier(nom: str):
    """« P4 » pour un programme d'une année ; None pour un programme de P1 à P6 (l'année se lit alors sur chaque page)."""
    if re.search(r'P1[-_]P6', nom):
        return None
    m = re.search(r'P([1-6])', nom)
    if not m:
        raise SystemExit(f'Année introuvable dans le nom du fichier : {nom}')
    return f'P{m.group(1)}'


# Une compétence est une courte phrase : pas un en-tête de tableau (« Contenus | Savoirs… », « Savoir-faire (liés aux démarches… »), que certaines disciplines mettent à cet endroit.
COMPETENCE_ACCEPTABLE = re.compile(r'^(?!Contenus?|Savoirs?|Savoir-faire).{1,160}$')
LIGNE_DE_DOMAINE = re.compile(r'\s[I|]\s*$')


def titre_et_competence(encadre: str) -> tuple:
    """Titre de la séquence (lignes entre le domaine, « DES OBJETS DE L'ESPACE… I », et « Le dispositif amène… ») et compétence (« Au niveau disciplinaire »)."""
    avant, _, apres = encadre.partition(DEBUT_DE_ENCADRE)
    lignes_avant = [x.strip() for x in avant.split('\n') if x.strip()]
    domaines = [i for i, x in enumerate(lignes_avant) if LIGNE_DE_DOMAINE.search(x)]
    entetes = [i for i, x in enumerate(lignes_avant) if 'SÉQUENCES DIDACTIQUES' in x]
    debut_du_titre = max(domaines[-1:] + entetes[-1:], default=len(lignes_avant) - 1) + 1
    lignes_du_titre = lignes_avant[debut_du_titre:]
    titre = nettoyer_titre(' '.join(lignes_du_titre))
    titre = titre[:1].upper() + titre[1:]
    competence = ''
    if NIVEAU_DISCIPLINAIRE in apres:
        suite = apres.split(NIVEAU_DISCIPLINAIRE, 1)[1]
        coupe = DEBUT_DE_CONTENU.search(suite)
        competence = nettoyer_titre(suite[:coupe.start()] if coupe else '')
    return titre, competence if COMPETENCE_ACCEPTABLE.match(competence) else ''


ANNEE_EN_HAUT_DE_PAGE = re.compile(r'^P([1-6])\s*$', re.MULTILINE)


def sequences_de_la_discipline(pages: dict, annee, mot_de_discipline: str) -> list:
    """Séquences d'une discipline dans le programme d'une année : une unité par encadré « Le dispositif amène… »."""
    unites = []
    for numero in sorted(pages):
        texte = pages[numero]
        m = ENTETE_DE_SEQUENCE.search(texte)
        if not m or not m.group(1).strip().upper().startswith(mot_de_discipline) or DEBUT_DE_ENCADRE not in texte:
            continue
        corps = texte[:texte.index(FIN_DE_ENCADRE)] if FIN_DE_ENCADRE in texte else texte
        suivante = numero
        while FIN_DE_ENCADRE not in pages.get(suivante, '') and suivante < numero + PAGES_SUIVANTES_MAX:
            suivante += 1
            extrait = pages.get(suivante, '')
            corps += '\n' + (extrait[:extrait.index(FIN_DE_ENCADRE)] if FIN_DE_ENCADRE in extrait else extrait)
        titre, competence = titre_et_competence(corps)
        if not titre:
            continue
        de_la_page = ANNEE_EN_HAUT_DE_PAGE.search(texte[:300])
        annee_de_l_unite = annee or (f'P{de_la_page.group(1)}' if de_la_page else None)
        if annee_de_l_unite is None:
            continue
        unite = Unite(annee_de_l_unite, titre, competence)
        unite.ajouter(numero, corps.split(DEBUT_DE_ENCADRE, 1)[1])
        unites.append(unite)
    return unites
