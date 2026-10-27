import { blocEnTexte } from './bloc.ts';
import type { Bloc } from './types.ts';

const MOTS_NOMBRES = /\b(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(points?|items?|éléments?|aspects?|critères?|observations?)\b/i;

/** Garde-fou final : liste les défauts visibles du texte produit (vide = tout va bien). */
export function controler(bloc: Bloc): string[] {
  const t = blocEnTexte(bloc);
  const erreurs: string[] = [];
  if (/undefined|null|\[object|NaN/.test(t)) erreurs.push('valeur technique visible');
  if (MOTS_NOMBRES.test(t) || /\b\d+\s+(points?|items?|observations?)\b/i.test(t)) erreurs.push('comptage interdit');
  if (/\*\*|\[Fait\]/.test(t)) erreurs.push('marqueur parasite');
  if (/(^|\n)\s*[:;–]\s*(\n|$)/.test(t)) erreurs.push('ligne vide');
  if (/\s{2,}/.test(t.replace(/\n {2}/g, '\n'))) erreurs.push('espaces doubles');
  return erreurs;
}
