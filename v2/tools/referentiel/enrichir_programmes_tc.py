"""Ajoute aux lignes du tronc commun (S1 à S3) le module du programme WBE auquel elles appartiennent (champ `sq`).

Pourquoi : le moteur de pistes peut alors nommer la séquence, ranger ses tâches dans l'ordre Connaître, Appliquer, Transférer
et compléter « Voir d'autres pistes » avec le reste du module. Les textes `a` ne sont jamais modifiés.

Usage (le PDF n'est pas dans le dépôt ; `--texte` lit un export texte `=====PAGE n=====` à la place du PDF) :
  python enrichir_programmes_tc.py mathematiques Programme_de_mathematiques_TC_secondaire....pdf ../../src/data/referentiel/mathematiques.json
Relancer donne le même résultat. Une ligne introuvable est signalée, jamais devinée.
"""
import argparse
import sys

from programmes_tc import commun, fhges, maths, sciences

MATIERES = {'mathematiques': maths, 'sciences': sciences, 'histoire-geographie': fhges}


def main(argv: list) -> int:
    parseur = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parseur.add_argument('matiere', choices=sorted(MATIERES))
    parseur.add_argument('programme', help='PDF du programme (ou export texte avec --texte)')
    parseur.add_argument('json', help='fichier de la matière dans src/data/referentiel/')
    parseur.add_argument('--texte', action='store_true', help='le programme est un export texte')
    parseur.add_argument('--essai', action='store_true', help="n'écrit rien, affiche seulement le rapport")
    args = parseur.parse_args(argv)
    module = MATIERES[args.matiere]
    pages = commun.lire_pages_texte(args.programme) if args.texte else commun.lire_pages(args.programme)
    unites = module.decouper(pages)
    lignes = commun.lire_json(args.json)
    textes_avant = [(x.get('r'), x.get('p'), x.get('a')) for x in lignes]
    rapport = commun.rattacher(lignes, unites, module.REFERENTIEL)
    assert textes_avant == [(x.get('r'), x.get('p'), x.get('a')) for x in lignes], 'le texte des lignes a changé'
    print(f'{len(unites)} modules ou sections lus')
    commun.afficher_rapport(rapport)
    if not args.essai:
        commun.ecrire_json(args.json, lignes)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
