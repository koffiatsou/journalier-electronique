/*
 * Réunion : propositions d'objectifs tirées de la synthèse par matière.
 * Rien n'est décidé ici : on propose, l'agent retient, reformule ou ajoute les siens.
 * Les propositions ne reposent que sur ce qui a été noté dans les séances (aucune invention).
 */
import type { SuiviAide, SuiviCompetence, SuiviObservation, Synthese, SyntheseMatiere } from '../redaction/index.ts';
import { NBSP, dateCourte, majusculePremiere as Maj, minusculePremiere as min } from '../redaction/langue.ts';

export type GenreObjectif = 'progresser' | 'consolider' | 'competence' | 'garder-aide' | 'revoir-aide';

export interface Proposition {
  /** Stable d'un calcul à l'autre (matière + genre + texte d'origine) : un choix déjà fait est retrouvé. */
  id: string;
  matiere: string;
  genre: GenreObjectif;
  /** Phrase proposée (modifiable par l'agent une fois retenue). */
  texte: string;
  /** Pourquoi on le propose, en une phrase simple. */
  raison: string;
}

export interface ObjectifRetenu {
  id: string;
  /** Vide pour un objectif ajouté à la main sans matière. */
  matiere: string;
  texte: string;
  libre: boolean;
}

/** Nombre maximum de propositions par matière : une liste courte se valide, une longue se survole. */
export const MAX_OBSERVATIONS = 3;
export const MAX_COMPETENCES = 2;
export const MAX_AIDES_A_GARDER = 2;
export const MAX_AIDES_A_REVOIR = 1;

const MOTS = ['partiellement', 'suffisamment', 'totalement'] as const;
const mot = (n: number): string => MOTS[n] ?? '';
const sansPoint = (t: string): string => t.replace(/[.\s]+$/, '');
const derniere = <T,>(liste: readonly T[]): T | undefined => liste[liste.length - 1];
const idDe = (matiere: string, genre: GenreObjectif, source: string): string => `${matiere}|${genre}|${source}`;

/** Nombre de séances de suite (en partant de la dernière) au même niveau. */
function serieFinale(suite: SuiviObservation['suite']): number {
  const fin = derniere(suite);
  if (!fin) return 0;
  let n = 0;
  for (let i = suite.length - 1; i >= 0 && suite[i]?.niveau === fin.niveau; i--) n++;
  return n;
}

function raisonObservation(suite: SuiviObservation['suite']): string {
  const fin = derniere(suite);
  if (!fin) return '';
  const avant = [...suite.slice(0, -1)].reverse().find((x) => x.niveau > fin.niveau);
  if (avant) {
    return `Moins bien qu’avant : ${mot(avant.niveau)} le ${dateCourte(avant.date)}, puis ${mot(fin.niveau)} le ${dateCourte(fin.date)}.`;
  }
  const serie = serieFinale(suite);
  return serie >= 2
    ? `Observé « ${mot(fin.niveau)} » lors des ${serie} dernières séances.`
    : `Observé « ${mot(fin.niveau)} » le ${dateCourte(fin.date)}.`;
}

function depuisObservations(matiere: string, suivis: readonly SuiviObservation[]): Proposition[] {
  const candidates = suivis.flatMap((o) => {
    const fin = derniere(o.suite);
    if (!fin || fin.niveau >= 2) return [];
    const recul = o.suite.some((x) => x.niveau > fin.niveau);
    return [{ o, niveau: fin.niveau, serie: serieFinale(o.suite), recul, date: fin.date }];
  });
  // D'abord ce qui est le moins acquis, puis ce qui a reculé, puis ce qui dure, puis le plus récent.
  candidates.sort((a, b) =>
    a.niveau - b.niveau || Number(b.recul) - Number(a.recul) || b.serie - a.serie || b.date.localeCompare(a.date));
  return candidates.slice(0, MAX_OBSERVATIONS).map(({ o, niveau }) => ({
    id: idDe(matiere, niveau === 0 ? 'progresser' : 'consolider', o.texte),
    matiere,
    genre: niveau === 0 ? 'progresser' : 'consolider',
    texte: `${niveau === 0 ? 'Faire progresser' : 'Consolider'}${NBSP}: ${min(sansPoint(o.texte))}.`,
    raison: raisonObservation(o.suite)
  }));
}

function depuisCompetences(matiere: string, suivis: readonly SuiviCompetence[]): Proposition[] {
  return suivis
    .filter((c) => c.niveau === null || c.niveau < 2)
    .sort((a, b) => (a.niveau ?? 1.5) - (b.niveau ?? 1.5))
    .slice(0, MAX_COMPETENCES)
    .map((c) => ({
      id: idDe(matiere, 'competence', c.texte),
      matiere,
      genre: 'competence' as const,
      texte: `Continuer à travailler la compétence${NBSP}: ${min(sansPoint(c.texte))}.`,
      raison: c.niveau === null ? 'Compétence notée sans niveau.' : `Niveau noté : ${mot(c.niveau)}.`
    }));
}

function depuisAides(matiere: string, suivis: readonly SuiviAide[]): Proposition[] {
  const gardees: Proposition[] = [];
  const revues: Proposition[] = [];
  for (const a of suivis) {
    const connus = a.effets.filter((e): e is number => e !== null);
    const fin = derniere(connus);
    if (fin === undefined) continue;
    if (fin === 2) {
      gardees.push({
        id: idDe(matiere, 'garder-aide', a.texte),
        matiere,
        genre: 'garder-aide',
        texte: `Garder l’aide qui fonctionne${NBSP}: ${min(sansPoint(a.texte))}.`,
        raison: connus.length === 1 ? 'Effet positif noté.' : connus.every((e) => e === 2) ? 'Effet positif à chaque séance.' : 'Effet positif lors de la dernière séance.'
      });
    } else if (connus.every((e) => e === 0)) {
      revues.push({
        id: idDe(matiere, 'revoir-aide', a.texte),
        matiere,
        genre: 'revoir-aide',
        texte: `Revoir l’aide${NBSP}: ${min(sansPoint(a.texte))}.`,
        raison: connus.length === 1 ? 'Aucun effet noté.' : 'Aucun effet noté, séance après séance.'
      });
    }
  }
  return [...gardees.slice(0, MAX_AIDES_A_GARDER), ...revues.slice(0, MAX_AIDES_A_REVOIR)];
}

export function proposerPourMatiere(m: SyntheseMatiere): Proposition[] {
  return [
    ...depuisObservations(m.matiere, m.suivis.observations),
    ...depuisCompetences(m.matiere, m.suivis.competences),
    ...depuisAides(m.matiere, m.suivis.aides)
  ];
}

/** Toutes les propositions, matière par matière (même ordre que la synthèse). */
export const proposerObjectifs = (s: Synthese): Proposition[] => s.matieres.flatMap(proposerPourMatiere);

/* Validation par l'agent : fonctions simples qui renvoient toujours une nouvelle liste. */

export const estRetenu = (retenus: readonly ObjectifRetenu[], id: string): boolean => retenus.some((r) => r.id === id);

export function retenir(retenus: readonly ObjectifRetenu[], p: Proposition): ObjectifRetenu[] {
  if (estRetenu(retenus, p.id)) return [...retenus];
  return [...retenus, { id: p.id, matiere: p.matiere, texte: p.texte, libre: false }];
}

export const retirer = (retenus: readonly ObjectifRetenu[], id: string): ObjectifRetenu[] => retenus.filter((r) => r.id !== id);

export const reecrire = (retenus: readonly ObjectifRetenu[], id: string, texte: string): ObjectifRetenu[] =>
  retenus.map((r) => (r.id === id ? { ...r, texte } : r));

/** Objectif écrit par l'agent. Un texte vide est ignoré. */
export function ajouterLibre(retenus: readonly ObjectifRetenu[], texte: string, matiere = ''): ObjectifRetenu[] {
  const propre = texte.replace(/\s+/g, ' ').trim();
  if (!propre) return [...retenus];
  const dernier = retenus.reduce((max, r) => {
    const m = /^libre-(\d+)$/.exec(r.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
  return [...retenus, { id: `libre-${dernier + 1}`, matiere, texte: Maj(propre), libre: true }];
}

/** Retenus dont le texte n'est pas vide, groupés par matière (les objectifs libres sans matière à la fin). */
export function retenusParMatiere(retenus: readonly ObjectifRetenu[]): { matiere: string; objectifs: ObjectifRetenu[] }[] {
  const groupes = new Map<string, ObjectifRetenu[]>();
  for (const r of retenus) {
    if (!r.texte.trim()) continue;
    groupes.set(r.matiere, [...(groupes.get(r.matiere) ?? []), r]);
  }
  return [...groupes]
    .map(([matiere, objectifs]) => ({ matiere, objectifs }))
    .sort((a, b) => (a.matiere === '' ? 1 : b.matiere === '' ? -1 : a.matiere.localeCompare(b.matiere, 'fr')));
}
