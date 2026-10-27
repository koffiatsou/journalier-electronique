import type { Eleve } from '../types.ts';
import { jourComplet } from './dates.ts';
import { enMinutes, heureValide, normaliserHoraires, nbPeriodesUtilisees, periodeUtilisee, verifierHoraires } from './horaires.ts';
import type { ErreurHoraire } from './horaires.ts';
import { libelle } from './planning.ts';
import { PERIODES_AGENDA } from './types.ts';
import type { Occurrence, Periode } from './types.ts';

/*
 * Plusieurs écoles (2, exceptionnellement 3) ont des horaires différents. Les huit/neuf périodes (« 1e H »…) restent les
 * lignes de l'agenda : seules les HEURES changent d'une école à l'autre. Une séance ou une activité d'élève prend l'heure de
 * l'école de l'élève ; une autre activité (collaboration…) celle de l'école choisie, sinon de l'école par défaut.
 * La première école de la liste est l'école par défaut.
 */

export interface Ecole {
  id: string;
  nom: string;
  /** Toujours `NB_PERIODES` périodes ; les dernières peuvent rester sans heures (non utilisées). */
  periodes: Periode[];
}

export interface Ecoles {
  ecoles: Ecole[];
  /** Temps de trajet minimal (minutes) entre deux écoles : en dessous, l'agenda prévient. */
  trajet: number;
}

/** Nom du réglage dans la base (remplace `agenda-horaires`, encore relu si le nouveau n'existe pas). */
export const REGLAGE_ECOLES = 'agenda-ecoles';
export const TRAJET_PAR_DEFAUT = 30;
export const TRAJET_MAXI = 180;
export const MAX_ECOLES = 10;
export const NOM_ECOLE_PAR_DEFAUT = 'Mon école';

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texte = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Pour comparer des noms : sans accents, majuscules ni espaces en trop. */
export const cleNom = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

export function ecolesParDefaut(horaires?: unknown): Ecoles {
  return { ecoles: [{ id: 'ecole-1', nom: NOM_ECOLE_PAR_DEFAUT, periodes: normaliserHoraires(horaires) }], trajet: TRAJET_PAR_DEFAUT };
}

export function nouvelIdEcole(existantes: readonly Pick<Ecole, 'id'>[]): string {
  const pris = new Set(existantes.map((e) => e.id));
  let n = existantes.length + 1;
  while (pris.has(`ecole-${n}`)) n++;
  return `ecole-${n}`;
}

/**
 * Relit le réglage des écoles. Une valeur abîmée ne bloque jamais l'agenda : sans réglage lisible, on retombe sur
 * l'ancien réglage « horaires » (une seule école) ou sur les horaires habituels.
 */
export function normaliserEcoles(brut: unknown, ancienHoraires?: unknown): Ecoles {
  const o = objet(brut);
  if (!o || !Array.isArray(o.ecoles) || o.ecoles.length === 0) return ecolesParDefaut(ancienHoraires);
  const ecoles: Ecole[] = [];
  for (const x of o.ecoles.slice(0, MAX_ECOLES)) {
    const e = objet(x);
    const n = ecoles.length + 1;
    const id = e && texte(e.id) && !ecoles.some((y) => y.id === e.id) ? e.id : nouvelIdEcole(ecoles);
    ecoles.push({ id, nom: e && texte(e.nom) ? e.nom.trim() : `École ${n}`, periodes: normaliserHoraires(e?.periodes) });
  }
  const t = o.trajet;
  const trajet = typeof t === 'number' && Number.isInteger(t) && t >= 0 && t <= TRAJET_MAXI ? t : TRAJET_PAR_DEFAUT;
  return { ecoles, trajet };
}

export interface ErreurEcole { ecoleId: string; /** Période concernée ; absent = le nom. */ index?: number; message: string }

/** Vérifie les écoles saisies : un nom par école (tous différents), des horaires cohérents. */
export function verifierEcoles(ecoles: readonly Ecole[]): ErreurEcole[] {
  const erreurs: ErreurEcole[] = [];
  const plusieurs = ecoles.length > 1;
  const vus = new Set<string>();
  if (ecoles.length === 0) return [{ ecoleId: '', message: 'Il faut au moins une école.' }];
  for (const e of ecoles) {
    const nom = e.nom.trim() || 'Une école';
    const prefixe = plusieurs ? `${nom} — ` : '';
    if (!e.nom.trim()) erreurs.push({ ecoleId: e.id, message: 'Donnez un nom à chaque école.' });
    else if (vus.has(cleNom(e.nom))) erreurs.push({ ecoleId: e.id, message: `Deux écoles portent le nom « ${e.nom.trim()} » : donnez-leur des noms différents.` });
    vus.add(cleNom(e.nom));
    for (const h of verifierHoraires(e.periodes) as ErreurHoraire[]) erreurs.push({ ecoleId: e.id, index: h.index, message: `${prefixe}${h.message}` });
  }
  return erreurs;
}

/* ───────── Quelle école pour quel élève, quelle activité ? ───────── */

export const ecoleParDefaut = (ecoles: readonly Ecole[]): Ecole => ecoles[0] ?? ecolesParDefaut().ecoles[0]!;

/** L'école à laquelle l'élève est explicitement rattaché (identifiant, sinon nom identique), ou `undefined`. */
export function rattachement(eleve: Pick<Eleve, 'ecoleId' | 'ecole'> | undefined, ecoles: readonly Ecole[]): Ecole | undefined {
  if (!eleve) return undefined;
  const parId = eleve.ecoleId ? ecoles.find((e) => e.id === eleve.ecoleId) : undefined;
  if (parId) return parId;
  const nom = cleNom(eleve.ecole ?? '');
  return nom ? ecoles.find((e) => cleNom(e.nom) === nom) : undefined;
}

export const ecoleDeEleve = (eleve: Pick<Eleve, 'ecoleId' | 'ecole'> | undefined, ecoles: readonly Ecole[]): Ecole => rattachement(eleve, ecoles) ?? ecoleParDefaut(ecoles);

/** L'école d'une occurrence : celle de l'élève, ou de l'activité, ou l'école par défaut. */
export function ecoleDeOccurrence(o: Occurrence, eleves: readonly Eleve[], ecoles: readonly Ecole[]): Ecole {
  const a = o.activite;
  if (a.type === 'eleve' && a.eleveId) return ecoleDeEleve(eleves.find((e) => e.id === a.eleveId), ecoles);
  return (a.ecoleId ? ecoles.find((e) => e.id === a.ecoleId) : undefined) ?? ecoleParDefaut(ecoles);
}

/** Heures réelles d'une occurrence dans son école, ou `null` si l'école n'a pas d'horaire pour ces périodes. */
export function heuresDe(ecole: Ecole, debut: number, fin: number): { debut: string; fin: string } | null {
  const d = ecole.periodes[debut];
  const f = ecole.periodes[fin];
  return periodeUtilisee(d) && periodeUtilisee(f) ? { debut: d!.debut, fin: f!.fin } : null;
}

export const libelleHeures = (h: { debut: string; fin: string } | null): string => (h ? `${h.debut} – ${h.fin}` : '');

/**
 * Les lignes de la grille de l'agenda : pour chaque période, les heures de la première école qui l'utilise (l'école par défaut d'abord).
 * `jusqua` agrandit la grille pour qu'une activité placée sur une période plus loin reste visible.
 */
export function horairesReference(ecoles: readonly Ecole[], jusqua = 0): Periode[] {
  const n = Math.max(1, jusqua + 1, ...ecoles.map((e) => nbPeriodesUtilisees(e.periodes)));
  return PERIODES_AGENDA.slice(0, n).map((p, i) => {
    const source = ecoles.find((e) => periodeUtilisee(e.periodes[i]));
    return source ? { ...source.periodes[i]! } : { label: p.label, debut: '', fin: '' };
  });
}

/* ───────── Avertissements : chevauchement et trajet ───────── */

export interface Avertissement {
  date: string;
  genre: 'chevauchement' | 'trajet';
  /** Clés des deux occurrences concernées. */
  cles: [string, string];
  texte: string;
}

/**
 * Deux rendez-vous de la même journée dans deux écoles différentes : ils ne doivent pas se chevaucher, et il doit rester
 * le temps du trajet entre les deux. Dans une même école, deux activités sur les mêmes périodes restent permises (elles s'affichent côte à côte).
 */
export function avertissementsEcoles(occ: readonly Occurrence[], eleves: readonly Eleve[], ecoles: readonly Ecole[], trajet: number): Avertissement[] {
  if (ecoles.length < 2) return [];
  interface Cas { o: Occurrence; ecole: Ecole; du: number; au: number; heures: string; nom: string }
  const parJour = new Map<string, Cas[]>();
  for (const o of occ) {
    if (o.statut === 'annule') continue;
    const ecole = ecoleDeOccurrence(o, eleves, ecoles);
    const h = heuresDe(ecole, o.debut, o.fin);
    if (!h || !heureValide(h.debut) || !heureValide(h.fin)) continue;
    const el = eleves.find((e) => e.id === o.activite.eleveId);
    const cas: Cas = { o, ecole, du: enMinutes(h.debut), au: enMinutes(h.fin), heures: libelleHeures(h), nom: libelle(o.activite, el ? `${el.prenom} ${el.nom}`.trim() : undefined) };
    parJour.set(o.date, [...(parJour.get(o.date) ?? []), cas]);
  }
  const sortie: Avertissement[] = [];
  for (const [date, liste] of [...parJour].sort(([a], [b]) => a.localeCompare(b))) {
    const tri = [...liste].sort((a, b) => a.du - b.du || a.au - b.au);
    for (let i = 0; i < tri.length; i++) {
      for (let j = i + 1; j < tri.length; j++) {
        const a = tri[i]!;
        const b = tri[j]!;
        if (a.ecole.id === b.ecole.id) continue;
        const qui = `« ${a.nom} » (${a.ecole.nom}, ${a.heures}) et « ${b.nom} » (${b.ecole.nom}, ${b.heures})`;
        if (a.du < b.au && b.du < a.au) {
          sortie.push({ date, genre: 'chevauchement', cles: [a.o.cle, b.o.cle], texte: `${jourComplet(date)} : ${qui} se chevauchent.` });
        } else {
          const ecart = b.du - a.au;
          if (ecart < trajet) sortie.push({ date, genre: 'trajet', cles: [a.o.cle, b.o.cle], texte: `${jourComplet(date)} : ${ecart <= 0 ? 'aucun temps' : `seulement ${ecart} min`} entre ${qui} (trajet prévu : ${trajet} min).` });
        }
      }
    }
  }
  return sortie;
}

/* ───────── Changement d'écoles : mettre les dossiers des élèves en accord ───────── */

/**
 * Quand on renomme ou supprime une école, les élèves qui lui étaient rattachés suivent : nom mis à jour dans le dossier
 * (il sert aux documents), ou rattachement retiré si l'école disparaît (le texte du dossier est conservé).
 * Renvoie seulement les dossiers à enregistrer.
 */
export function elevesApresChangement(eleves: readonly Eleve[], avant: readonly Ecole[], apres: readonly Ecole[]): Eleve[] {
  const sortie: Eleve[] = [];
  for (const e of eleves) {
    const ancienne = rattachement(e, avant);
    if (!ancienne) continue;
    const nouvelle = apres.find((x) => x.id === ancienne.id);
    if (nouvelle) {
      if (e.ecoleId !== nouvelle.id || e.ecole !== nouvelle.nom) sortie.push({ ...e, ecoleId: nouvelle.id, ecole: nouvelle.nom });
    } else if (e.ecoleId) {
      const { ecoleId: _i, ...reste } = e;
      sortie.push(reste);
    }
  }
  return sortie;
}
