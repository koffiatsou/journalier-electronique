import { sansAccents } from './texte.ts';
import { ANNEES } from './types.ts';
import type { Annee, FormeEnseignement } from './types.ts';

export type Jeu = 'mathematiques' | 'francais' | 'langues';

export interface Cible {
  jeu: Jeu;
  /** Nom de la matière dans le référentiel (inutile pour le filtrage, utile pour l'affichage). */
  langue?: string;
}

/** Retrouve le jeu de données à partir de la matière saisie librement (« Maths », « Néerlandais »…). null = pas de référentiel disponible. */
export function cibleDeMatiere(matiere: string): Cible | null {
  const m = sansAccents(matiere);
  if (/\bmath/.test(m)) return { jeu: 'mathematiques' };
  if (/\bfran[cç]/.test(m)) return { jeu: 'francais' };
  if (/neerland|\bnl\b/.test(m)) return { jeu: 'langues', langue: 'Néerlandais' };
  if (/anglais/.test(m)) return { jeu: 'langues', langue: 'Anglais' };
  if (/allemand/.test(m)) return { jeu: 'langues', langue: 'Allemand' };
  return null;
}

/** « S3 », « 3e secondaire », « 3ème »… → S3. */
export function anneeDeNiveau(texte: string): Annee | undefined {
  const t = sansAccents(texte).replace(/\s+/g, '');
  const direct = /\b([ps])([1-6])\b/.exec(sansAccents(texte));
  if (direct) {
    const a = `${direct[1]!.toUpperCase()}${direct[2]}` as Annee;
    if ((ANNEES as readonly string[]).includes(a)) return a;
  }
  const n = /^([1-6])(e|eme|re|ere)?(sec|secondaire)?$/.exec(t);
  return n ? (`S${n[1]}` as Annee) : undefined;
}

export function formeDeTexte(texte: string): FormeEnseignement | undefined {
  const t = sansAccents(texte).trim();
  if (!t) return undefined;
  if (/^(g|general)/.test(t)) return 'G';
  if (/^(ttr|transition)/.test(t)) return 'TTR';
  if (/^(tq|technique|qualification)/.test(t)) return 'TQ';
  if (/^(p|prof)/.test(t)) return 'P';
  return undefined;
}
