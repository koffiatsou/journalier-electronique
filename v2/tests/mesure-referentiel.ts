import { readFileSync } from 'node:fs';
import { IndexReferentiel } from '../src/domain/referentiel/index.ts';
import type { EntreeReferentiel } from '../src/domain/referentiel/index.ts';
import { sansAccents } from '../src/domain/referentiel/texte.ts';
import { CORPUS } from './corpus-referentiel.ts';
import type { CasCorpus, JeuCorpus } from './corpus-referentiel.ts';

export type Lot = 'reglage' | 'controle';

export interface Mesure {
  /** Cas avec une réponse attendue ET une ligne du référentiel qui la contient. */
  repondables: number;
  /** Parmi eux, ceux dont une des 4 premières pistes correspond. */
  trouves: number;
  /** Cas sans ligne correspondante dans les données (matière pas encore extraite) : à ne pas compter comme échec du moteur. */
  hors_donnees: number;
  vagues: number;
  vagues_sans_piste: number;
  echecs: string[];
}

const NOMBRE_PISTES = 4;
const cache = new Map<JeuCorpus, EntreeReferentiel[]>();

export function chargerJeu(jeu: JeuCorpus): EntreeReferentiel[] {
  let donnees = cache.get(jeu);
  if (!donnees) {
    donnees = JSON.parse(readFileSync(new URL(`../src/data/referentiel/${jeu}.json`, import.meta.url), 'utf8')) as EntreeReferentiel[];
    cache.set(jeu, donnees);
  }
  return donnees;
}

const texteDe = (x: EntreeReferentiel): string => sansAccents(`${x.a} ${x.i ?? ''} ${x.u ?? ''}`);

function lotDe(indice: number): Lot {
  return indice % 2 === 0 ? 'reglage' : 'controle';
}

function existe(cas: CasCorpus, donnees: readonly EntreeReferentiel[]): boolean {
  const attendu = cas.attendu;
  if (!attendu) return false;
  return donnees.some((x) => (!x.l || !cas.langue || x.l === cas.langue) && attendu.test(texteDe(x)));
}

export function mesurer(lot: Lot, rentree?: number, construire: (donnees: EntreeReferentiel[]) => IndexReferentiel = (d) => new IndexReferentiel(d)): Mesure {
  const resultat: Mesure = { repondables: 0, trouves: 0, hors_donnees: 0, vagues: 0, vagues_sans_piste: 0, echecs: [] };
  const index = new Map<JeuCorpus, IndexReferentiel>();
  CORPUS.forEach((cas, i) => {
    if (lotDe(i) !== lot) return;
    const donnees = chargerJeu(cas.jeu);
    let idx = index.get(cas.jeu);
    if (!idx) {
      idx = construire(donnees);
      index.set(cas.jeu, idx);
    }
    const pistes = idx.suggerer({ objectif: cas.objectif, annee: cas.annee, forme: cas.forme, langue: cas.langue, rentree }, NOMBRE_PISTES);
    if (!cas.attendu) {
      resultat.vagues += 1;
      if (pistes.length === 0) resultat.vagues_sans_piste += 1;
      else resultat.echecs.push(`vague « ${cas.objectif} » : ${pistes.length} piste(s) proposée(s)`);
      return;
    }
    if (!existe(cas, donnees)) {
      resultat.hors_donnees += 1;
      return;
    }
    resultat.repondables += 1;
    const attendu = cas.attendu;
    if (pistes.some((p) => attendu.test(texteDe(p.entree)))) resultat.trouves += 1;
    else resultat.echecs.push(`${cas.jeu} ${cas.annee ?? ''} « ${cas.objectif} » : ${pistes.map((p) => (p.entree.i ?? p.entree.a).slice(0, 40)).join(' | ') || 'aucune piste'}`);
  });
  return resultat;
}
