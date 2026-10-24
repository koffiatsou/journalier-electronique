import type { Jeu } from './contexte.ts';
import { IndexReferentiel } from './moteur.ts';
import type { EntreeReferentiel } from './types.ts';

const memoire = new Map<Jeu, Promise<IndexReferentiel>>();

/** Charge à la demande (un fichier par matière, jamais dans le bundle principal) et garde l'index en mémoire. */
export function indexDe(jeu: Jeu): Promise<IndexReferentiel> {
  let p = memoire.get(jeu);
  if (!p) {
    p = lire(jeu).then((e) => new IndexReferentiel(e));
    memoire.set(jeu, p);
  }
  return p;
}

async function lire(jeu: Jeu): Promise<EntreeReferentiel[]> {
  switch (jeu) {
    case 'mathematiques': return (await import('../../data/referentiel/mathematiques.json')).default as EntreeReferentiel[];
    case 'francais': return (await import('../../data/referentiel/francais.json')).default as EntreeReferentiel[];
    case 'sciences': return (await import('../../data/referentiel/sciences.json')).default as EntreeReferentiel[];
    case 'economie': return (await import('../../data/referentiel/economie.json')).default as EntreeReferentiel[];
    case 'langues': return (await import('../../data/referentiel/langues.json')).default as EntreeReferentiel[];
  }
}
