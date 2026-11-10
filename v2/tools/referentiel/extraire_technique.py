"""Formation manuelle, technique, technologique et numérique (FMTTN), tronc commun P1-S3.

Usage : python extraire_technique.py <2022_REF_Manu-techn-FMTTN.pdf> <sortie.json>
Pages 20 à 82 : contenus d'apprentissage et attendus ; ce qui suit (visées transversales, croisements, glossaire)
n'est pas fait d'attendus. Les astérisques renvoient au glossaire du PDF : ils sont retirés du texte.
"""
import json, os, subprocess, sys, tempfile

PDF, SORTIE = sys.argv[1:3]
ICI = os.path.dirname(os.path.abspath(__file__))
PREMIERE_PAGE, DERNIERE_PAGE = 20, 82
TYPE = {'savoir': 's', 'savoir-faire': 'f', 'compétence': 'c'}

with tempfile.TemporaryDirectory() as tmp:
    brut = os.path.join(tmp, 'fmttn.json')
    subprocess.run([sys.executable, os.path.join(ICI, 'extraire_tronc_commun.py'), PDF, str(PREMIERE_PAGE), str(DERNIERE_PAGE), 'Technique', brut], check=True)
    lignes = json.load(open(brut, encoding='utf-8'))

compact = []
for e in lignes:
    attendu = e['attendu'].replace('*', '').strip()
    if not attendu or attendu.startswith(('Focus sur', 'Cf.')):
        continue
    item = (e.get('item') or e.get('rubrique') or '').replace('*', '').strip()
    ligne = {'m': 'Technique', 'n': e['niveau'], 'f': 'TC', 't': TYPE.get(e['type'], 'f'), 'u': item, 'i': item, 'a': attendu, 'p': e['page'],
             'r': 'Référentiel de formation manuelle, technique, technologique et numérique 2022'}
    compact.append({k: v for k, v in ligne.items() if v not in (None, '')})
with open(SORTIE, 'w', encoding='utf-8') as f:
    json.dump(compact, f, ensure_ascii=False, separators=(',', ':'))
print(SORTIE, len(compact), 'entrées')
