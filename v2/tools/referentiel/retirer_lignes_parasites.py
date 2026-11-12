"""Retire des fichiers du référentiel les lignes du tronc commun qui ne sont pas des attendus.

Pourquoi : l'extraction des tableaux a lu aussi, dans la section « visées transversales » des référentiels 2022, des en-têtes
(« Exemples de contenus ou d’attendus contributifs », « Exemples d’opportunités offertes par le référentiel »), des renvois du type
« Situer, placer un objet… (Ch1, SF, P1 à P6) » et, en maths, des paragraphes d'explication. Proposées comme compétence, elles trompent l'agent.

Règles (volontairement étroites ; chaque ligne retirée vient d'un motif écrit ci-dessous) :
  1. en-têtes « Exemples d… » et renvois « (Ch1, SF, P…) » : toutes matières, tronc commun ;
  2. mathématiques, pages 139 à 146 du référentiel : paragraphes de visées (liste de débuts ci-dessous) et le fragment « S2) ».
Les autres lignes de ces pages (français, sciences, arts, latin : « Se construire une identité de lecteur. »…) sont gardées : à relire à part.
Relancer ne change plus rien. Usage : python retirer_lignes_parasites.py ../../src/data/referentiel [--essai]
"""
import json
import os
import re
import sys

RENVOI_OU_ENTETE = re.compile(r"^exemples d[e’' ]+(?:opportunit|attendus|contenus)|\((?:ch\d|c\d)[^)]*\b(?:p\d|s\d)", re.IGNORECASE)
PAGES_MATHS_VISEES = range(139, 147)
DEBUTS_DE_PARAGRAPHES = (
    'S2)',
    'Les contenus suivants seront des occasions',
    'Les apprentissages et découvertes des élèves',
    'Tout au long du tronc commun, les mathématiques',
    'En ce sens, ces apprentissages',
    'Le domaine de l’organisation de données',
    'L’évolution des métiers à caractère scientifique',
    'En suscitant la réflexion, l’esprit critique',
)
# Attendu : nombre de lignes retirées par fichier (un écart arrête tout : le fichier ou les règles ont changé).
ATTENDU = {'arts': 1, 'francais': 10, 'langues-anciennes': 4, 'mathematiques': 66, 'sciences': 8}


def est_parasite(ligne: dict, fichier: str) -> bool:
    if ligne.get('f') != 'TC':
        return False
    if RENVOI_OU_ENTETE.search(ligne['a']):
        return True
    return fichier == 'mathematiques' and ligne.get('p') in PAGES_MATHS_VISEES and ligne['a'].startswith(DEBUTS_DE_PARAGRAPHES)


def main(dossier: str, essai: bool) -> None:
    for nom in sorted(os.listdir(dossier)):
        if not nom.endswith('.json'):
            continue
        fichier = nom[:-5]
        chemin = os.path.join(dossier, nom)
        with open(chemin, encoding='utf-8') as f:
            lignes = json.load(f)
        gardees = [x for x in lignes if not est_parasite(x, fichier)]
        retirees = len(lignes) - len(gardees)
        if retirees:
            print(f'{fichier} : {retirees} ligne(s) retirée(s)')
        if retirees and not essai:
            if retirees != ATTENDU.get(fichier):
                raise SystemExit(f'{fichier} : {retirees} lignes à retirer au lieu de {ATTENDU.get(fichier)} ; vérifier les règles.')
            with open(chemin, 'w', encoding='utf-8') as f:
                json.dump(gardees, f, ensure_ascii=False, separators=(',', ':'))


if __name__ == '__main__':
    main(sys.argv[1], '--essai' in sys.argv)
