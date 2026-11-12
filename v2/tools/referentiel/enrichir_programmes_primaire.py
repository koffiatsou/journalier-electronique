"""Ajoute `sq` et `cd` aux lignes du primaire (P1 à P5) d'une matière, d'après les séquences didactiques des programmes WBE.

Usage (les PDF ne sont pas dans le dépôt ; `--texte` lit des exports texte `=====PAGE n=====`) :
  python enrichir_programmes_primaire.py mathematiques ../../src/data/referentiel/mathematiques.json P1.pdf P2.pdf P3.pdf P4.pdf P5.pdf [--essai]
L'année se lit dans le nom de chaque fichier (P1 à P6). Les lignes des années non fournies sont laissées telles quelles.
"""
import argparse
import sys

from programmes_tc import commun, primaire


def main(argv: list) -> int:
    parseur = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parseur.add_argument('matiere', choices=sorted(primaire.DISCIPLINES))
    parseur.add_argument('json')
    parseur.add_argument('programmes', nargs='+')
    parseur.add_argument('--texte', action='store_true')
    parseur.add_argument('--essai', action='store_true')
    args = parseur.parse_args(argv)
    unites = []
    for chemin in args.programmes:
        pages = commun.lire_pages_texte(chemin) if args.texte else commun.lire_pages(chemin)
        trouvees = primaire.sequences_de_la_discipline(pages, primaire.annee_du_fichier(chemin), primaire.DISCIPLINES[args.matiere])
        print(f'{primaire.annee_du_fichier(chemin) or "P1 à P6"} : {len(trouvees)} séquences')
        unites += trouvees
    annees = tuple(sorted({u.annee for u in unites}))
    lignes = commun.lire_json(args.json)
    textes_avant = [(x.get('r'), x.get('p'), x.get('a')) for x in lignes]
    rapport = commun.rattacher(lignes, unites, None, annees)
    assert textes_avant == [(x.get('r'), x.get('p'), x.get('a')) for x in lignes], 'le texte des lignes a changé'
    commun.afficher_rapport(rapport)
    if not args.essai:
        commun.ecrire_json(args.json, lignes)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
