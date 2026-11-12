"""Ajoute à mathematiques.json le code de la séquence (UAA) et sa compétence à développer, pour les lignes
des compétences terminales HGT 2014 et des compétences minimales de qualification 2014.

Pourquoi : `extraire_secondaire_superieur.py` lit ces deux informations mais le fichier compact de l'application
ne les gardait pas ; le moteur de pistes en a besoin pour proposer les tâches d'une même séquence du programme.

Principe : le JSON du dépôt fait foi, on ne le régénère pas. Chaque ligne est retrouvée par (référentiel, page, texte)
dans la sortie de `extraire_secondaire_superieur.py`, puis reçoit :
  q  = code de la séquence (« 4UAA4 ») ; unique avec `f` (HGT ou HPT)
  cd = compétence à développer, en casse normale (le PDF l'écrit en majuscules)
Une ligne introuvable est signalée, jamais devinée. Relancer le script donne le même résultat.

Usage :
  python extraire_secondaire_superieur.py 2014_CT_HGT_Mathematiques.pdf Mathématiques HGT hgt.json
  python extraire_secondaire_superieur.py 2014_CM_Mathematiq_qualif.pdf Mathématiques HPT qualif.json
  python enrichir_sequences.py ../../src/data/referentiel/mathematiques.json hgt.json qualif.json
"""
import json
import sys
from collections import defaultdict

REFERENTIELS = (
    ('Compétences terminales HGT 2014', 'HGT', 412),
    ('Compétences minimales qualification 2014', 'HPT', 286),
)
SEPARATEUR_COMPETENCES = ' / '


def casse_normale(texte: str) -> str:
    """« S’APPROPRIER DIFFÉRENTS MODÈLES » → « S’approprier différents modèles » (première lettre en majuscule)."""
    minuscule = texte.strip().lower()
    return minuscule[:1].upper() + minuscule[1:]


def indexer(extraction: list) -> dict:
    """(page, texte de la tâche) → lignes extraites ; plusieurs lignes identiques à la même page doivent avoir la même séquence."""
    index = defaultdict(list)
    for ligne in extraction:
        index[(ligne['page'], ligne['attendu'])].append(ligne)
    return index


def enrichir(lignes: list, referentiel: str, extraction: list) -> tuple[int, list]:
    index = indexer(extraction)
    introuvables = []
    traitees = 0
    for ligne in lignes:
        if ligne.get('r') != referentiel:
            continue
        candidates = index.get((ligne.get('p'), ligne.get('a')), [])
        sequences = {c['uaa'] for c in candidates}
        if len(sequences) != 1:
            introuvables.append((ligne.get('p'), ligne.get('a')))
            continue
        modele = candidates[0]
        ligne['q'] = modele['uaa']
        ligne['cd'] = casse_normale(SEPARATEUR_COMPETENCES.join(modele['competences']))
        traitees += 1
    return traitees, introuvables


def main(chemin_json: str, chemin_hgt: str, chemin_qualif: str) -> None:
    with open(chemin_json, encoding='utf-8') as f:
        lignes = json.load(f)
    textes_avant = [(x.get('r'), x.get('p'), x.get('a')) for x in lignes]
    extractions = {'HGT': chemin_hgt, 'HPT': chemin_qualif}
    for referentiel, forme, attendu in REFERENTIELS:
        with open(extractions[forme], encoding='utf-8') as f:
            extraction = json.load(f)
        traitees, introuvables = enrichir(lignes, referentiel, extraction)
        total = sum(1 for x in lignes if x.get('r') == referentiel)
        assert total == attendu, f'{referentiel} : {total} lignes au lieu de {attendu}'
        print(f'{referentiel} : {traitees}/{total} lignes enrichies, {len(introuvables)} introuvable(s)')
        for page, texte in introuvables:
            print(f'   non enrichie : page {page}, « {texte} »')
    assert textes_avant == [(x.get('r'), x.get('p'), x.get('a')) for x in lignes], 'le texte des lignes a changé'
    with open(chemin_json, 'w', encoding='utf-8') as f:
        json.dump(lignes, f, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main(*sys.argv[1:4])
