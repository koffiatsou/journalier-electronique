import { ajouterJours, depuisISO, ecartJours, indexJour, lundiDe } from '../agenda/dates.ts';
import { PERIODES_AGENDA } from '../agenda/types.ts';
import type { Activite, Periode, StatutActivite, TypeActivite } from '../agenda/types.ts';
import { verifierHoraires } from '../agenda/horaires.ts';
import { cleNom, eleveDe, idActiviteV2 } from './convertir.ts';
import type { Annuaire } from './convertir.ts';
import type { Ecart } from './types.ts';

/*
 * V75 → V2 : agenda. Une série qui revient chaque semaine le même jour reste une série ; les autres répétitions
 * (tous les quinze jours, plusieurs jours, mensuelles…) n'existent pas en V2 : elles sont reprises date par date,
 * jusqu'à la fin de l'année scolaire, et le résultat le dit.
 */

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Brut) : {});
const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const iso = (v: unknown): string => { const t = texte(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''; };

const TYPES: Readonly<Record<string, TypeActivite>> = { ELEVE: 'eleve', COLLAB: 'collaboration', FORMATION: 'formation', ADMIN: 'administratif', LIBRE: 'libre' };
/** Date de départ des séries que la V75 laissait sans date (rentrée 2026). */
const DEPART_V75 = '2026-08-24';
/** Garde-fou : pas plus d'occurrences par événement répété, même sur une fin d'année très lointaine. */
const MAX_OCCURRENCES = 400;

export interface ContexteAgenda {
  annuaire: Annuaire;
  /** Aujourd'hui (AAAA-MM-JJ) : sert à choisir la fin de l'année scolaire jusqu'à laquelle on reprend les répétitions. */
  aujourdhui: string;
  maintenant: string;
}

export interface ActiviteReprise { activite: Activite; alertes: string[] }

export interface AgendaRepris {
  activites: ActiviteReprise[];
  /** Horaires des périodes de la V75, s'ils sont valides (sinon `null`). */
  horaires: Periode[] | null;
  /** Noms des huit périodes dans la V75, dans l'ordre. */
  periodesV75: string[];
  ecarts: Ecart[];
}

/** 31 juillet de l'année scolaire qui contient cette date. */
export function finAnneeScolaire(date: string): string {
  const annee = Number(date.slice(0, 4));
  const mois = Number(date.slice(5, 7));
  return `${mois >= 8 ? annee + 1 : annee}-07-31`;
}

const NB_PERIODES_V75 = 8;
/** Les huit périodes de la V75 : noms (ordre) et horaires valides (la neuvième période de la V2 reste sans heures). */
export function lirePeriodesV75(config: unknown): { noms: string[]; horaires: Periode[] | null } {
  const noms = PERIODES_AGENDA.map((p) => p.label);
  const brut = liste(objet(config).periods);
  if (brut.length !== NB_PERIODES_V75) return { noms, horaires: null };
  const lus = brut.map(objet);
  const nomsV75 = lus.map((p, i) => texte(p.label) || noms[i]!);
  const horaires: Periode[] = PERIODES_AGENDA.map((p, i) => ({ label: p.label, debut: lus[i] ? texte(lus[i]!.start) : '', fin: lus[i] ? texte(lus[i]!.end) : '' }));
  return { noms: nomsV75, horaires: verifierHoraires(horaires).length ? null : horaires };
}

/* ───────── Où tombe une répétition (portage de la règle de la V75) ───────── */

const JOURS_GRAPH = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function joursDeLaSemaine(ev: Brut, motif: Brut): number[] {
  const brut = liste(motif.daysOfWeek);
  if (!brut.length) return [Number(ev.dayIndex)];
  return brut.map((d) => {
    if (typeof d === 'string') { const i = JOURS_GRAPH.indexOf(d.toLowerCase()); return i >= 0 ? i : Number(d); }
    return Number(d);
  });
}

/** Faut-il une occurrence de cet événement ce jour-là ? Même règle que la V75 (jamais plus large). */
export function tombeLe(ev: Brut, date: string, exceptions: readonly string[]): boolean {
  if (exceptions.includes(date)) return false;
  const recurrence = texte(ev.recurrence);
  if (recurrence === 'unique') return iso(ev.date) === date;
  const motif = objet(ev.recurrencePattern);
  const portee = objet(ev.recurrenceRange);
  const depart = iso(portee.startDate) || iso(ev.date) || DEPART_V75;
  if (iso(portee.startDate) && date < iso(portee.startDate)) return false;
  if (portee.type === 'endDate' && iso(portee.endDate) && date > iso(portee.endDate)) return false;
  const compte = portee.type === 'count' || portee.type === 'numbered';
  const maximum = compte ? Number(portee.numberOfOccurrences) || 10 : Infinity;
  const intervalle = Math.max(1, Number(motif.interval) || 1);
  const jour = indexJour(date);

  if (recurrence === 'daily') {
    const ecart = ecartJours(depart, date);
    return ecart >= 0 && ecart % intervalle === 0 && Math.floor(ecart / intervalle) < maximum;
  }
  if (recurrence === 'weekly') {
    const jours = joursDeLaSemaine(ev, motif);
    if (!jours.includes(jour)) return false;
    const semaines = Math.round(ecartJours(lundiDe(depart), lundiDe(date)) / 7);
    if (semaines < 0 || semaines % intervalle !== 0) return false;
    if (maximum === Infinity) return true;
    const tries = [...new Set(jours)].sort((a, b) => a - b);
    const premier = indexJour(depart);
    let n = 0;
    for (let w = 0; w <= semaines; w += intervalle) {
      for (const j of tries) {
        if (w === 0 && j < premier) continue;
        if (w === semaines && j > jour) continue;
        n += 1;
      }
    }
    return n <= maximum;
  }
  const d = depuisISO(date);
  const d0 = depuisISO(depart);
  if (recurrence === 'monthly') {
    const mois = (d.getFullYear() - d0.getFullYear()) * 12 + (d.getMonth() - d0.getMonth());
    if (mois < 0 || mois % intervalle !== 0) return false;
    const rang = texte(motif.index);
    if (['first', 'second', 'third', 'fourth', 'last'].includes(rang)) {
      const cible = joursDeLaSemaine(ev, motif)[0] ?? indexJour(depart);
      if (jour !== cible) return false;
      const jm = d.getDate();
      const dernier = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const ok = rang === 'first' ? jm <= 7 : rang === 'second' ? jm >= 8 && jm <= 14 : rang === 'third' ? jm >= 15 && jm <= 21 : rang === 'fourth' ? jm >= 22 && jm <= 28 : jm > dernier - 7;
      if (!ok) return false;
    } else {
      const ancre = Number(motif.dayOfMonth) || (iso(ev.date) ? depuisISO(iso(ev.date)).getDate() : d0.getDate());
      if (d.getDate() !== ancre) return false;
    }
    return Math.floor(mois / intervalle) < maximum;
  }
  if (recurrence === 'yearly') {
    const moisCible = motif.month != null ? Number(motif.month) - 1 : d0.getMonth();
    const jourCible = motif.dayOfMonth != null ? Number(motif.dayOfMonth) : d0.getDate();
    if (d.getMonth() !== moisCible || d.getDate() !== jourCible) return false;
    const ans = d.getFullYear() - d0.getFullYear();
    return ans >= 0 && ans % intervalle === 0 && Math.floor(ans / intervalle) < maximum;
  }
  return false;
}

/* ───────── Conversion ───────── */

const statut = (s: string): StatutActivite | null => (s === 'cancelled' ? 'annule' : s === 'realized' ? 'realise' : null);

function rangPeriode(valeur: unknown, noms: readonly string[]): number {
  const t = cleNom(texte(valeur));
  const i = noms.findIndex((n) => cleNom(n) === t);
  return i >= 0 ? i : 0;
}

/** Série simple de la V75 : chaque semaine, un seul jour, avec ou sans date de fin (pas de nombre d'occurrences). */
function estSerieSimple(ev: Brut): boolean {
  if (texte(ev.recurrence) !== 'weekly') return false;
  const motif = objet(ev.recurrencePattern);
  if (Math.max(1, Number(motif.interval) || 1) !== 1) return false;
  if (liste(motif.daysOfWeek).length > 1) return false;
  const type = objet(ev.recurrenceRange).type;
  return type === undefined || type === 'noEnd' || type === 'endDate';
}

export function convertirAgenda(brut: unknown, ctx: ContexteAgenda): AgendaRepris {
  const agenda = objet(brut);
  const { noms, horaires } = lirePeriodesV75(agenda.__config);
  const exceptions = objet(agenda.__exceptions);
  const sortie: AgendaRepris = { activites: [], horaires, periodesV75: noms, ecarts: [] };
  const evenements = [...liste(agenda.__events), ...liste(agenda.__uniqueEvents).map((e) => ({ ...objet(e), recurrence: 'unique', date: objet(e).date ?? objet(e).occurrenceDate }))];
  const vus = new Set<string>();

  for (const element of evenements) {
    const ev = objet(element);
    const idV75 = texte(ev.eventId);
    const titre = texte(ev.title);
    const decrire = (): string => `Agenda : ${titre || texte(ev.eleve) || TYPES[texte(ev.type)] || 'activité'}${iso(ev.date) ? ` (${iso(ev.date)})` : ''}`;
    if (!idV75) { sortie.ecarts.push({ quoi: decrire(), raison: 'activité sans identifiant' }); continue; }
    if (vus.has(idV75)) continue;
    vus.add(idV75);
    if (Number(ev.dayIndex) > 4 && texte(ev.recurrence) !== 'unique') { sortie.ecarts.push({ quoi: decrire(), raison: 'activité un samedi ou un dimanche (la V2 n’affiche que du lundi au vendredi)' }); continue; }

    const type = TYPES[texte(ev.type)] ?? 'administratif';
    const eleveId = type === 'eleve' ? eleveDe(ctx.annuaire, ev.eleveId, ev.eleve) : null;
    const debut = rangPeriode(ev.startPeriod, noms);
    const fin = Math.max(debut, rangPeriode(ev.endPeriod ?? ev.startPeriod, noms));
    const etatV75 = statut(texte(ev.eventStatus));
    const matiere = texte(ev.matiere);
    const creeLe = texte(ev.createdAt) || ctx.maintenant;
    const commun = {
      type,
      ...(eleveId ? { eleveId } : type === 'eleve' && texte(ev.eleve) ? { nomLibre: texte(ev.eleve) } : {}),
      titre,
      ...(matiere ? { matiere } : {}),
      lieu: texte(ev.local),
      note: texte(ev.detail),
      debut, fin,
      creeLe,
      modifieLe: texte(ev.updatedAt) || creeLe
    };
    const avertir: string[] = [];
    if (type === 'eleve' && !eleveId && texte(ev.eleve)) avertir.push(`élève « ${texte(ev.eleve)} » introuvable : nom gardé tel quel, sans dossier`);

    const cleSerie = texte(ev.seriesId) || idV75;
    const retirees = liste(exceptions[cleSerie]).map(iso).filter(Boolean);

    if (texte(ev.recurrence) === 'unique') {
      const date = iso(ev.date);
      if (!date) { sortie.ecarts.push({ quoi: decrire(), raison: 'date illisible' }); continue; }
      sortie.activites.push({ activite: { id: idActiviteV2(idV75), ...commun, date, repetition: 'aucune', ...(etatV75 ? { etats: { [date]: etatV75 } } : {}) }, alertes: avertir });
      continue;
    }
    if (etatV75 === 'annule') { sortie.ecarts.push({ quoi: decrire(), raison: 'série annulée dans la V75' }); continue; }

    const portee = objet(ev.recurrenceRange);
    const depart = iso(portee.startDate) || iso(ev.date) || DEPART_V75;
    if (estSerieSimple(ev)) {
      const brutJour = Number(ev.dayIndex);
      const jour = Number.isInteger(brutJour) && brutJour >= 0 && brutJour <= 4 ? brutJour : indexJour(depart);
      const date = ajouterJours(depart, (jour - indexJour(depart) + 7) % 7);
      const jusquau = portee.type === 'endDate' ? iso(portee.endDate) : '';
      if (jusquau && jusquau < date) { sortie.ecarts.push({ quoi: decrire(), raison: 'série déjà terminée avant sa première date' }); continue; }
      sortie.activites.push({
        activite: { id: idActiviteV2(idV75), ...commun, date, repetition: 'hebdomadaire', ...(jusquau ? { jusquau } : {}), ...(retirees.length ? { exceptions: retirees.filter((d) => d >= date) } : {}) },
        alertes: avertir
      });
      continue;
    }

    // Répétition que la V2 ne connaît pas : une activité par date, jusqu'à la fin de l'année scolaire.
    const horizon = finAnneeScolaire(depart > ctx.aujourdhui ? depart : ctx.aujourdhui);
    const dates: string[] = [];
    for (let d = depart; d <= horizon && dates.length < MAX_OCCURRENCES; d = ajouterJours(d, 1)) if (indexJour(d) <= 4 && tombeLe(ev, d, retirees)) dates.push(d);
    if (!dates.length) { sortie.ecarts.push({ quoi: decrire(), raison: 'aucune date à reprendre jusqu’à la fin de l’année scolaire' }); continue; }
    const note = `répétition reprise date par date jusqu’au ${horizon.split('-').reverse().join('/')}`;
    dates.forEach((date, i) => sortie.activites.push({ activite: { id: idActiviteV2(idV75, date), ...commun, date, repetition: 'aucune' }, alertes: i === 0 ? [...avertir, `${dates.length} date${dates.length > 1 ? 's' : ''} : ${note}`] : [] }));
  }
  return sortie;
}
