import { ajouterJours, ecartJours, indexJour, lundiDe } from './dates.ts';
import { infosJour } from './calendrier.ts';
import { NB_PERIODES } from './horaires.ts';
import { creer } from './planning.ts';
import type { Changement } from './planning.ts';
import { TYPES_LIBELLES } from './types.ts';
import type { Activite, Occurrence, TypeActivite } from './types.ts';

/**
 * Semaine type : le modèle d'une semaine habituelle (qui, quel jour, quelles périodes), enregistré une fois
 * puis appliqué à une ou plusieurs semaines. Domaine pur : rien ici ne touche au stockage.
 */

/** Une activité du modèle : un jour de la semaine (0 = lundi … 4 = vendredi) et des périodes, sans date. */
export interface ElementType {
  jour: number;
  debut: number;
  fin: number;
  type: TypeActivite;
  eleveId?: string;
  nomLibre?: string;
  titre: string;
  matiere?: string;
  lieu: string;
  note: string;
  couleur?: number;
}

export interface SemaineType {
  elements: ElementType[];
  /** Date (AAAA-MM-JJ) à laquelle le modèle a été enregistré. */
  enregistreeLe: string;
}

/** Identifiant de réglage dans la base. */
export const REGLAGE_SEMAINE_TYPE = 'agenda-semaine-type';

const MAX_ELEMENTS = 200;

const trier = (a: ElementType, b: ElementType): number => a.jour - b.jour || a.debut - b.debut || a.fin - b.fin || (a.eleveId ?? a.nomLibre ?? a.titre).localeCompare(b.eleveId ?? b.nomLibre ?? b.titre);

/**
 * Le modèle d'une semaine : toutes les occurrences du lundi au vendredi de la semaine de `date`, sauf les annulées.
 * Les états (annulé, réalisé), les répétitions et les exceptions ne sont pas reprises : le modèle décrit une semaine « normale ».
 */
export function semaineTypeDepuis(occ: readonly Occurrence[], date: string, aujourdhui: string): SemaineType {
  const lundi = lundiDe(date);
  const elements: ElementType[] = [];
  for (const o of occ) {
    const jour = ecartJours(lundi, o.date);
    if (jour < 0 || jour > 4 || o.statut === 'annule') continue;
    const a = o.activite;
    elements.push({
      jour, debut: o.debut, fin: o.fin, type: a.type, titre: a.titre, lieu: a.lieu, note: a.note,
      ...(a.eleveId ? { eleveId: a.eleveId } : {}), ...(a.nomLibre ? { nomLibre: a.nomLibre } : {}),
      ...(a.matiere ? { matiere: a.matiere } : {}), ...(typeof a.couleur === 'number' ? { couleur: a.couleur } : {})
    });
  }
  return { elements: elements.sort(trier), enregistreeLe: aujourdhui };
}

const entier = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null);
const texte = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Relit une semaine type enregistrée ; un élément illisible est écarté, rien d'exploitable donne `null`. */
export function normaliserSemaineType(brut: unknown): SemaineType | null {
  if (!brut || typeof brut !== 'object') return null;
  const b = brut as { elements?: unknown; enregistreeLe?: unknown };
  if (!Array.isArray(b.elements)) return null;
  const elements: ElementType[] = [];
  for (const x of b.elements.slice(0, MAX_ELEMENTS) as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object') continue;
    const jour = entier(x.jour, 0, 4);
    const debut = entier(x.debut, 0, NB_PERIODES - 1);
    const fin = entier(x.fin, 0, NB_PERIODES - 1);
    const type = typeof x.type === 'string' && x.type in TYPES_LIBELLES ? (x.type as TypeActivite) : null;
    if (jour === null || debut === null || fin === null || type === null) continue;
    const e: ElementType = { jour, debut, fin: Math.max(debut, fin), type, titre: texte(x.titre), lieu: texte(x.lieu), note: texte(x.note) };
    if (typeof x.eleveId === 'string' && x.eleveId) e.eleveId = x.eleveId;
    if (typeof x.nomLibre === 'string' && x.nomLibre) e.nomLibre = x.nomLibre;
    if (typeof x.matiere === 'string' && x.matiere) e.matiere = x.matiere;
    const couleur = entier(x.couleur, 0, 9);
    if (couleur !== null) e.couleur = couleur;
    elements.push(e);
  }
  if (!elements.length) return null;
  return { elements: elements.sort(trier), enregistreeLe: texte(b.enregistreeLe) };
}

/** Les lundis des semaines entre deux dates (incluses) ; vide si la fin précède le début. */
export function lundisEntre(du: string, au: string): string[] {
  if (au < du) return [];
  const out: string[] = [];
  for (let l = lundiDe(du); l <= au; l = ajouterJours(l, 7)) out.push(l);
  return out;
}

export interface OptionsApplication {
  /** Ne rien placer les jours fériés, de congé ou de vacances. */
  ignorerSansClasse: boolean;
  /** Élèves du dossier : un élément qui renvoie à un élève supprimé n'est pas placé. */
  eleveIds: ReadonlySet<string>;
}

export interface PlanApplication {
  aCreer: Activite[];
  /** Éléments non placés parce que le jour est férié, de congé ou de vacances. */
  joursIgnores: number;
  /** Éléments déjà présents à l'identique (même élève ou titre, même jour, mêmes périodes). */
  dejaPresents: number;
  /** Éléments dont l'élève n'existe plus. */
  elevesIntrouvables: number;
}

/** Même activité : mêmes périodes et même type, puis même élève (ou même nom libre) pour un accompagnement, même titre pour le reste. */
const memeActivite = (a: Activite, e: ElementType): boolean =>
  a.type === e.type && a.debut === e.debut && a.fin === e.fin &&
  (e.type === 'eleve' ? (e.eleveId ? a.eleveId === e.eleveId : (a.nomLibre ?? '') === (e.nomLibre ?? '')) : a.titre === e.titre);

/**
 * Ce qu'il faut créer pour appliquer le modèle aux semaines données.
 * `existantes` = les occurrences déjà visibles sur ces semaines (pour ne pas créer de doublons).
 * Chaque élément devient une activité simple (sans répétition) à sa date : on peut ensuite la déplacer ou la supprimer seule.
 */
export function planifierSemaineType(modele: SemaineType, lundis: readonly string[], existantes: readonly Occurrence[], options: OptionsApplication): PlanApplication {
  const plan: PlanApplication = { aCreer: [], joursIgnores: 0, dejaPresents: 0, elevesIntrouvables: 0 };
  for (const lundi of lundis) {
    for (const e of modele.elements) {
      const date = ajouterJours(lundi, e.jour);
      if (indexJour(date) > 4) continue;
      if (e.type === 'eleve' && e.eleveId && !options.eleveIds.has(e.eleveId)) { plan.elevesIntrouvables++; continue; }
      if (options.ignorerSansClasse && infosJour(date).sansClasse) { plan.joursIgnores++; continue; }
      if (existantes.some((o) => o.date === date && o.statut !== 'annule' && memeActivite(o.activite, e))) { plan.dejaPresents++; continue; }
      plan.aCreer.push(creer({
        type: e.type, date, debut: e.debut, fin: e.fin, titre: e.titre, lieu: e.lieu, note: e.note,
        ...(e.eleveId ? { eleveId: e.eleveId } : {}), ...(e.nomLibre ? { nomLibre: e.nomLibre } : {}),
        ...(e.matiere ? { matiere: e.matiere } : {}), ...(typeof e.couleur === 'number' ? { couleur: e.couleur } : {})
      }));
    }
  }
  return plan;
}

export const changementDepuisPlan = (plan: PlanApplication): Changement => ({ enregistrer: plan.aCreer, supprimer: [] });
