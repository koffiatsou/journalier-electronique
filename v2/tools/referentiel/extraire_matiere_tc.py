"""Une matière du tronc commun lue avec extraire_tronc_commun.py puis mise au format compact de l'application.

Usage : python extraire_matiere_tc.py <pdf> <page début> <page fin> <matière> <référentiel> <sortie.json>
Exemples (pages de contenus seulement, sans visées ni glossaire) :
  éducation culturelle et artistique : pages 1-76 ; philosophie et citoyenneté : pages 1-76 ;
  latin (2e partie du référentiel de français) : pages 213-237.
Les astérisques (renvois au glossaire) sont retirés.
"""
import json, os, subprocess, sys, tempfile

PDF, P1, P2, MATIERE, REFERENTIEL, SORTIE = sys.argv[1:7]
ICI = os.path.dirname(os.path.abspath(__file__))
TYPE = {'savoir': 's', 'savoir-faire': 'f', 'compétence': 'c'}

with tempfile.TemporaryDirectory() as tmp:
    brut = os.path.join(tmp, 'brut.json')
    subprocess.run([sys.executable, os.path.join(ICI, 'extraire_tronc_commun.py'), PDF, P1, P2, MATIERE, brut], check=True)
    lignes = json.load(open(brut, encoding='utf-8'))

compact = []
for e in lignes:
    attendu = e['attendu'].replace('*', '').strip()
    if not attendu or attendu.startswith(('Focus sur', 'Cf.')):
        continue
    # Un intitulé de rubrique pris pour un attendu : court et sans ponctuation finale.
    if len(attendu.split()) < 5 and not attendu.endswith(('.', ';', ')')):
        continue
    item = (e.get('item') or e.get('rubrique') or '').replace('*', '').strip()
    ligne = {'m': MATIERE, 'n': e['niveau'], 'f': 'TC', 't': TYPE.get(e['type'], 'f'), 'u': item, 'i': item, 'a': attendu, 'p': e['page'], 'r': REFERENTIEL}
    compact.append({k: v for k, v in ligne.items() if v not in (None, '')})
with open(SORTIE, 'w', encoding='utf-8') as f:
    json.dump(compact, f, ensure_ascii=False, separators=(',', ':'))
print(SORTIE, len(compact), 'entrées')
