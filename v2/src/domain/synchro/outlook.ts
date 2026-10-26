import { ajouterJours, lundiDe } from '../agenda/dates.ts';
import { occurrences } from '../agenda/planning.ts';
import { TYPES_LIBELLES } from '../agenda/types.ts';
import type { Activite, Periode } from '../agenda/types.ts';
import { initiales } from '../eleves/eleves.ts';
import { anneeScolaire } from '../export/journalier.ts';
import type { Eleve, Seance } from '../types.ts';

/*
 * Liaison avec Outlook : l'agenda du Journalier est recopié (à sens unique) dans un calendrier à part, « Journalier ».
 * Ce qui se passe dans Outlook ne modifie jamais le Journalier. À chaque envoi, on compare l'agenda à ce que contient
 * déjà ce calendrier et on ne fait que le nécessaire (créer, corriger, retirer) : jamais de doublons.
 */

export const NOM_CALENDRIER = 'Journalier';
/** Repère écrit dans la description de chaque événement : c'est lui qui relie l'événement à l'activité. */
export const REPERE = 'journalier:';

/** Que montrer de l'élève dans Outlook ? Par prudence : rien (un calendrier Outlook se partage facilement). */
export type NomDansOutlook = 'aucun' | 'initiales' | 'prenom';
export const NOMS_DANS_OUTLOOK: Readonly<Record<NomDansOutlook, string>> = {
  aucun: 'Aucun nom d’élève',
  initiales: 'Initiales (A. B.)',
  prenom: 'Prénom et initiale du nom'
};

export interface ReglagesOutlook { actif: boolean; nom: NomDansOutlook; lieu: boolean }
export const REGLAGES_OUTLOOK_DEFAUT: ReglagesOutlook = { actif: false, nom: 'aucun', lieu: true };
export const REGLAGE_OUTLOOK = 'outlook';

export function normaliserReglagesOutlook(brut: unknown): ReglagesOutlook {
  const o = (brut && typeof brut === 'object' ? brut : {}) as Record<string, unknown>;
  const nom = (['aucun', 'initiales', 'prenom'] as const).find((n) => n === o.nom) ?? REGLAGES_OUTLOOK_DEFAUT.nom;
  return { actif: o.actif === true, nom, lieu: o.lieu !== false };
}

export interface EvenementSouhaite {
  /** Clé de l'occurrence (`idActivité@date`) : le repère retrouvé dans Outlook. */
  cle: string;
  sujet: string;
  /** AAAA-MM-JJTHH:MM, heure de Bruxelles. */
  debut: string;
  fin: string;
  lieu: string;
}

export interface EvenementExistant extends EvenementSouhaite { id: string }

export interface PlanOutlook {
  creer: EvenementSouhaite[];
  modifier: { id: string; evenement: EvenementSouhaite }[];
  supprimer: string[];
}

const initialeDe = (t: string): string => [...t.trim()].find((c) => /\p{L}/u.test(c))?.toLocaleUpperCase('fr') ?? '';

function nomPour(e: Pick<Eleve, 'nom' | 'prenom'> | undefined, libre: string | undefined, option: NomDansOutlook): string {
  if (option === 'aucun') return '';
  if (e) {
    if (option === 'initiales') return initiales(e).split('').join('. ') + '.';
    return `${e.prenom.trim()} ${initialeDe(e.nom)}.`.trim();
  }
  const l = (libre ?? '').trim();
  if (!l) return '';
  return option === 'initiales' ? l.split(/\s+/).map(initialeDe).filter(Boolean).join('. ') + '.' : l;
}

export function sujetDe(a: Activite, eleves: readonly Eleve[], option: NomDansOutlook): string {
  if (a.type !== 'eleve') return a.titre.trim() || TYPES_LIBELLES[a.type];
  const nom = nomPour(eleves.find((x) => x.id === a.eleveId), a.nomLibre, option);
  const morceaux = ['Accompagnement', nom, a.matiere?.trim() ?? ''].filter(Boolean);
  const base = morceaux.length > 1 ? `${morceaux[0]} — ${morceaux.slice(1).join(' — ')}` : morceaux[0]!;
  return a.titre.trim() ? `${base} · ${a.titre.trim()}` : base;
}

/** Les événements que l'agenda doit produire entre deux dates (activités annulées exclues). */
export function evenementsSouhaites(activites: readonly Activite[], eleves: readonly Eleve[], seances: readonly Seance[], horaires: readonly Periode[], du: string, au: string, reglages: ReglagesOutlook): EvenementSouhaite[] {
  const sortie: EvenementSouhaite[] = [];
  for (const o of occurrences(activites, du, au, seances)) {
    if (o.statut === 'annule') continue;
    const debut = horaires[o.debut];
    const fin = horaires[o.fin];
    if (!debut || !fin) continue;
    sortie.push({
      cle: o.cle, sujet: sujetDe(o.activite, eleves, reglages.nom),
      debut: `${o.date}T${debut.debut}`, fin: `${o.date}T${fin.fin}`,
      lieu: reglages.lieu ? o.activite.lieu.trim() : ''
    });
  }
  return sortie;
}

/** Du lundi de la semaine en cours jusqu'à la fin de l'année scolaire (31 juillet). */
export function fenetreOutlook(aujourdhui: string): { du: string; au: string } {
  const annee = anneeScolaire(aujourdhui);
  const fin = Number(annee.slice(5, 9));
  return { du: lundiDe(aujourdhui), au: Number.isFinite(fin) && fin > 0 ? `${fin}-07-31` : ajouterJours(aujourdhui, 300) };
}

const memes = (a: EvenementSouhaite, b: EvenementSouhaite): boolean =>
  a.sujet === b.sujet && a.debut.slice(0, 16) === b.debut.slice(0, 16) && a.fin.slice(0, 16) === b.fin.slice(0, 16) && a.lieu === b.lieu;

/** Compare ce qu'il faut avec ce qu'il y a dans le calendrier. Les événements sans repère ne sont jamais touchés. */
export function planifierOutlook(souhaites: readonly EvenementSouhaite[], existants: readonly EvenementExistant[]): PlanOutlook {
  const plan: PlanOutlook = { creer: [], modifier: [], supprimer: [] };
  const parCle = new Map<string, EvenementExistant>();
  for (const e of existants) {
    if (!e.cle) continue;
    if (parCle.has(e.cle)) plan.supprimer.push(e.id); // doublon : on garde le premier
    else parCle.set(e.cle, e);
  }
  const voulues = new Set<string>();
  for (const s of souhaites) {
    voulues.add(s.cle);
    const e = parCle.get(s.cle);
    if (!e) plan.creer.push(s);
    else if (!memes(s, e)) plan.modifier.push({ id: e.id, evenement: s });
  }
  for (const [c, e] of parCle) if (!voulues.has(c)) plan.supprimer.push(e.id);
  return plan;
}

/** Texte de description d'un événement (contient le repère). */
export const descriptionEvenement = (cleOccurrence: string): string =>
  `Recopié depuis le Journalier. Ne le modifiez pas ici : il serait remplacé au prochain envoi.\n${REPERE}${cleOccurrence}`;

/** Retrouve le repère dans la description d'un événement (HTML ou texte). */
export function repereDans(description: string): string {
  const m = /journalier:([^\s<"&]+)/.exec(description);
  return m ? m[1]! : '';
}
