import type { Eleve } from '../types.ts';
import type { Activite, TypeActivite } from './types.ts';

/** Dix teintes distinctes, y compris pour les daltoniens (les classes CSS .c-0 … .c-9 portent les couleurs). */
export const NB_COULEURS = 10;
export const NOMS_COULEURS = ['Bleu', 'Orange', 'Vert', 'Rose', 'Violet', 'Turquoise', 'Jaune', 'Rouge', 'Indigo', 'Marron'] as const;

function empreinte(texte: string): number {
  let h = 5381;
  for (let i = 0; i < texte.length; i++) h = ((h << 5) + h + texte.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Couleur de chaque élève : celle choisie dans son dossier, sinon une couleur stable déduite de son identifiant
 * (décalée si un autre élève la prend déjà, tant qu'il reste des couleurs libres).
 */
export function couleursEleves(eleves: readonly Eleve[]): Map<string, number> {
  const res = new Map<string, number>();
  const prises = new Set<number>();
  for (const e of eleves) if (typeof e.couleur === 'number') { res.set(e.id, e.couleur); prises.add(e.couleur); }
  for (const e of [...eleves].filter((x) => typeof x.couleur !== 'number').sort((a, b) => a.id.localeCompare(b.id))) {
    let c = empreinte(e.id) % NB_COULEURS;
    for (let i = 0; i < NB_COULEURS && prises.has(c); i++) c = (c + 1) % NB_COULEURS;
    res.set(e.id, c);
    prises.add(c);
  }
  return res;
}

/** Couleur la moins utilisée : proposée à la création d'un élève. */
export function couleurLibre(eleves: readonly Eleve[]): number {
  const n = new Array<number>(NB_COULEURS).fill(0);
  for (const [, c] of couleursEleves(eleves)) n[c] = (n[c] ?? 0) + 1;
  return n.indexOf(Math.min(...n));
}

export type Teinte = { kind: 'couleur'; index: number } | { kind: 'type'; type: TypeActivite };

/** Une couleur d'élève pour un accompagnement, une couleur de type pour le reste. */
export function teinteDe(a: Activite, couleurs: ReadonlyMap<string, number>): Teinte {
  if (typeof a.couleur === 'number') return { kind: 'couleur', index: a.couleur };
  if (a.type === 'eleve') {
    if (a.eleveId && couleurs.has(a.eleveId)) return { kind: 'couleur', index: couleurs.get(a.eleveId)! };
    return { kind: 'couleur', index: empreinte(a.nomLibre ?? a.titre) % NB_COULEURS };
  }
  return { kind: 'type', type: a.type };
}
