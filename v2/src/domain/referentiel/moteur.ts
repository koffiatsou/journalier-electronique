import { developper } from './alias.ts';
import { racines, racinesAdministratives } from './texte.ts';
import { ANNEES } from './types.ts';
import type { Annee, Contexte, EntreeReferentiel, Piste } from './types.ts';

interface Ligne {
  entree: EntreeReferentiel;
  attendu: Set<string>;
  theme: Set<string>;
}

/** Index d'une matière : mots → poids (plus un mot est rare, plus il compte). */
/** Ce que la question « Fonctionnement observé » couvre déjà (consignes, concentration…) : inutile de le reproposer comme compétence. */
const DEJA_COUVERT = /\bconsignes?\b|ce qui est demand/i;

export class IndexReferentiel {
  private readonly lignes: Ligne[];
  private readonly poids = new Map<string, number>();

  constructor(toutes: readonly EntreeReferentiel[]) {
    const entrees = toutes.filter((x) => typeof x.a === 'string' && x.a.length > 0);
    const df = new Map<string, number>();
    this.lignes = entrees.map((entree) => {
      const attendu = new Set(racines(entree.a));
      const theme = new Set(racines(`${entree.i ?? ''} ${entree.u ?? ''}`));
      for (const t of new Set([...attendu, ...theme])) df.set(t, (df.get(t) ?? 0) + 1);
      return { entree, attendu, theme };
    });
    const n = entrees.length;
    for (const [t, c] of df) this.poids.set(t, Math.log((n + 1) / (c + 0.5)));
  }

  get taille(): number { return this.lignes.length; }

  /**
   * Propose au plus `k` pistes (une par intitulé et par année), les plus proches de l'objectif.
   * Aucune piste quand l'objectif est vague (« révisions », « interro »…).
   */
  suggerer(ctx: Contexte, k = 4): Piste[] {
    const mots = [...new Set(racines(developper(ctx.objectif)))].filter((t) => !racinesAdministratives.has(t));
    if (!mots.length) return [];
    const meilleures = new Map<string, Piste>();
    for (const { entree, attendu, theme } of this.lignes) {
      if (entree.l && ctx.langue && entree.l !== ctx.langue) continue;
      if (!formeCompatible(entree, ctx) || DEJA_COUVERT.test(entree.a)) continue;
      let score = 0;
      let touche = false;
      for (const t of mots) {
        const w = this.poids.get(t) ?? 0;
        if (attendu.has(t)) { score += w; touche = true; }
        else if (theme.has(t)) { score += w * 0.7; touche = true; }
      }
      if (!touche) continue;
      score *= facteurAnnee(entree.n, ctx.annee);
      const cle = `${entree.i ?? entree.a.slice(0, 40)}|${entree.n ?? ''}`;
      const actuelle = meilleures.get(cle);
      if (!actuelle || score > actuelle.score) {
        meilleures.set(cle, { entree, score, ecartAnnee: entree.n && ctx.annee && entree.n !== ctx.annee ? entree.n : null });
      }
    }
    const triees = [...meilleures.values()].sort((a, b) => b.score - a.score);
    const premier = triees[0];
    if (!premier) return [];
    return triees.filter((p) => p.score >= premier.score * 0.6).slice(0, k);
  }
}

function formeCompatible(e: EntreeReferentiel, ctx: Contexte): boolean {
  if (e.f === 'TC' || !ctx.forme) return true;
  return e.f === 'HGT' ? ctx.forme === 'G' || ctx.forme === 'TTR' : ctx.forme === 'TQ' || ctx.forme === 'P';
}

/** Même année : plein poids ; année voisine : légèrement moins ; plus loin : nettement moins (mais jamais exclu). */
function facteurAnnee(a: Annee | undefined, cible: Annee | undefined): number {
  if (!a || !cible) return 1;
  const d = ANNEES.indexOf(cible) - ANNEES.indexOf(a);
  if (d === 0) return 1;
  if (d === 1) return 0.85;
  if (d === -1) return 0.8;
  return d > 1 ? 0.6 : 0.4;
}
