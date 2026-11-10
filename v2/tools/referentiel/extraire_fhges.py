"""Formation historique, géographique, économique et sociale (FHGES), tronc commun P1-S3.

Usage : python extraire_fhges.py <2022_REF_Hist-geo-FHGES.pdf> <sortie.json>
Lit les attendus avec extraire_tronc_commun.py (pages 36 à 137 : contenus d'apprentissage ; le glossaire, les
visées et les croisements qui suivent ne sont pas des attendus) puis range chaque ligne dans sa discipline
d'après la page, et écrit le fichier compact lu par l'application.
"""
import json, os, subprocess, sys, tempfile

PDF, SORTIE = sys.argv[1:3]
ICI = os.path.dirname(os.path.abspath(__file__))
PREMIERE_PAGE, DERNIERE_PAGE = 36, 137
DEBUT_GEOGRAPHIE, DEBUT_ECO_SOCIAL = 77, 108
TYPE = {'savoir': 's', 'savoir-faire': 'f', 'compétence': 'c'}


def discipline(page: int) -> str:
    if page < DEBUT_GEOGRAPHIE:
        return 'Formation historique'
    return 'Formation géographique' if page < DEBUT_ECO_SOCIAL else 'Formation économique et sociale'


with tempfile.TemporaryDirectory() as tmp:
    brut = os.path.join(tmp, 'fhges.json')
    subprocess.run([sys.executable, os.path.join(ICI, 'extraire_tronc_commun.py'), PDF, str(PREMIERE_PAGE), str(DERNIERE_PAGE), 'Histoire-géographie', brut], check=True)
    lignes = json.load(open(brut, encoding='utf-8'))

compact = []
for e in lignes:
    if not e['attendu'] or e['attendu'].startswith(('Focus sur', 'Cf.')):
        continue
    ligne = {'m': 'Histoire-géographie', 'n': e['niveau'], 'f': 'TC', 't': TYPE.get(e['type'], 'f'),
             'u': discipline(e['page']), 'i': e.get('item') or e.get('rubrique') or '', 'a': e['attendu'], 'p': e['page'],
             'r': 'Référentiel de formation historique, géographique, économique et sociale 2022'}
    compact.append({k: v for k, v in ligne.items() if v not in (None, '')})
with open(SORTIE, 'w', encoding='utf-8') as f:
    json.dump(compact, f, ensure_ascii=False, separators=(',', ':'))
print(SORTIE, len(compact), 'entrées')
