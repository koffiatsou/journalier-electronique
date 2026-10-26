import { ajouterJours, indexJour } from './dates.ts';

/**
 * Calendrier scolaire de la Fédération Wallonie-Bruxelles (enseignement obligatoire) et jours fériés belges.
 * Domaine pur : aucune dépendance au navigateur.
 *
 * - Les jours fériés légaux et les congés fixes (27 septembre, 2 novembre) se CALCULENT, pour n'importe quelle année.
 * - Les vacances scolaires viennent d'un TABLEAU (`ANNEES_SCOLAIRES_FWB`) : le Gouvernement les fixe année par année.
 *   Hors des années du tableau, on ne montre que les jours fériés et on le dit (`calendrierConnu`).
 */

const p2 = (n: number): string => String(n).padStart(2, '0');
const iso = (annee: number, mois: number, jour: number): string => `${annee}-${p2(mois)}-${p2(jour)}`;

/** Dimanche de Pâques (calcul de Meeus / Jones / Butcher, calendrier grégorien). */
export function paques(annee: number): string {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(annee, mois, jour);
}

export interface JourNomme { date: string; libelle: string }

/** Les dix jours fériés légaux belges d'une année (certains tombent un week-end). */
export function joursFeries(annee: number): JourNomme[] {
  const p = paques(annee);
  return [
    { date: iso(annee, 1, 1), libelle: 'Nouvel An' },
    { date: ajouterJours(p, 1), libelle: 'Lundi de Pâques' },
    { date: iso(annee, 5, 1), libelle: 'Fête du Travail' },
    { date: ajouterJours(p, 39), libelle: 'Ascension' },
    { date: ajouterJours(p, 50), libelle: 'Lundi de Pentecôte' },
    { date: iso(annee, 7, 21), libelle: 'Fête nationale' },
    { date: iso(annee, 8, 15), libelle: 'Assomption' },
    { date: iso(annee, 11, 1), libelle: 'Toussaint' },
    { date: iso(annee, 11, 11), libelle: 'Armistice' },
    { date: iso(annee, 12, 25), libelle: 'Noël' }
  ];
}

/** Congés de la Fédération Wallonie-Bruxelles qui ne sont pas des jours fériés légaux (fixes chaque année). */
export function congesFWB(annee: number): JourNomme[] {
  return [
    { date: iso(annee, 9, 27), libelle: 'Fête de la Communauté française' },
    { date: iso(annee, 11, 2), libelle: 'Commémoration des défunts' }
  ];
}

export interface Vacances { libelle: string; du: string; au: string }

export interface AnneeScolaireFWB {
  /** « 2026-2027 » */
  libelle: string;
  /** Premier jour de classe (lundi). */
  rentree: string;
  /** Dernier jour de classe (vendredi) : les vacances d'été commencent le lendemain. */
  dernierJour: string;
  /** Rentrée de l'année suivante : les vacances d'été s'arrêtent la veille. */
  rentreeSuivante: string;
  /** Congés d'automne, d'hiver, de détente et de printemps (du lundi au vendredi). */
  vacances: Vacances[];
}

/**
 * Dates officielles recoupées entre plusieurs sources (La Libre, Infor Jeunes, RTBF, La CSC enseignement).
 * 2025-2026 : le congé de détente est du 16 au 27 février 2026 (La Libre, Infor Jeunes ; l'article RTBF du 23 février était erroné).
 * 2027-2028 et 2028-2029 : une seule source (La CSC enseignement) ; à revérifier quand l'année approche.
 * Pour ajouter une année : une entrée ici, rien d'autre.
 */
export const ANNEES_SCOLAIRES_FWB: readonly AnneeScolaireFWB[] = [
  {
    libelle: '2025-2026', rentree: '2025-08-25', dernierJour: '2026-07-03', rentreeSuivante: '2026-08-24',
    vacances: [
      { libelle: 'Congé d’automne', du: '2025-10-20', au: '2025-10-31' },
      { libelle: 'Vacances d’hiver', du: '2025-12-22', au: '2026-01-02' },
      { libelle: 'Congé de détente', du: '2026-02-16', au: '2026-02-27' },
      { libelle: 'Vacances de printemps', du: '2026-04-27', au: '2026-05-08' }
    ]
  },
  {
    libelle: '2026-2027', rentree: '2026-08-24', dernierJour: '2027-07-02', rentreeSuivante: '2027-08-30',
    vacances: [
      { libelle: 'Congé d’automne', du: '2026-10-19', au: '2026-10-30' },
      { libelle: 'Vacances d’hiver', du: '2026-12-21', au: '2027-01-01' },
      { libelle: 'Congé de détente', du: '2027-02-22', au: '2027-03-05' },
      { libelle: 'Vacances de printemps', du: '2027-04-26', au: '2027-05-07' }
    ]
  },
  {
    libelle: '2027-2028', rentree: '2027-08-30', dernierJour: '2028-07-07', rentreeSuivante: '2028-08-28',
    vacances: [
      { libelle: 'Congé d’automne', du: '2027-10-25', au: '2027-11-05' },
      { libelle: 'Vacances d’hiver', du: '2027-12-27', au: '2028-01-07' },
      { libelle: 'Congé de détente', du: '2028-02-28', au: '2028-03-10' },
      { libelle: 'Vacances de printemps', du: '2028-05-01', au: '2028-05-12' }
    ]
  },
  {
    libelle: '2028-2029', rentree: '2028-08-28', dernierJour: '2029-07-06', rentreeSuivante: '2029-08-27',
    vacances: [
      { libelle: 'Congé d’automne', du: '2028-10-23', au: '2028-11-03' },
      { libelle: 'Vacances d’hiver', du: '2028-12-25', au: '2029-01-05' },
      { libelle: 'Congé de détente', du: '2029-02-26', au: '2029-03-09' },
      { libelle: 'Vacances de printemps', du: '2029-04-30', au: '2029-05-11' }
    ]
  }
];

/** Première et dernière date couvertes par le tableau des vacances. */
export const CALENDRIER_CONNU_DU: string = ANNEES_SCOLAIRES_FWB[0]!.rentree;
export const CALENDRIER_CONNU_AU: string = ajouterJours(ANNEES_SCOLAIRES_FWB[ANNEES_SCOLAIRES_FWB.length - 1]!.rentreeSuivante, -1);

export const calendrierConnu = (date: string): boolean => date >= CALENDRIER_CONNU_DU && date <= CALENDRIER_CONNU_AU;

export interface InfosJour {
  /** Jour férié légal (ex. « Lundi de Pâques »). */
  ferie?: string;
  /** Congé de la Fédération (27 septembre, 2 novembre). */
  conge?: string;
  /** Vacances scolaires (ex. « Congé d’automne », « Vacances d’été »). */
  vacances?: string;
  /** Vrai si au moins un des trois s'applique (le week-end n'est pas compté ici). */
  sansClasse: boolean;
  /** Texte à afficher : férié ou congé d'abord, sinon les vacances. */
  libelle?: string;
  /** Les vacances de cette date sont-elles dans le tableau ? Sinon seuls les fériés et congés fixes sont donnés. */
  calendrierConnu: boolean;
}

const feriesParAnnee = new Map<number, Map<string, string>>();
const congesParAnnee = new Map<number, Map<string, string>>();
function table(cache: Map<number, Map<string, string>>, annee: number, liste: (a: number) => JourNomme[]): Map<string, string> {
  let t = cache.get(annee);
  if (!t) { t = new Map(liste(annee).map((j) => [j.date, j.libelle])); cache.set(annee, t); }
  return t;
}

/** Dernier jour de classe d'une année civile : le premier vendredi de juillet (règle constante, vérifiée sur toutes les années du tableau). */
export function dernierJourDeClasseParRegle(annee: number): string {
  const premier = iso(annee, 7, 1);
  return ajouterJours(premier, (4 - indexJour(premier) + 7) % 7);
}
/** Rentrée d'une année civile : le dernier lundi d'août (sauf 2026, où la Fédération a fixé le 24 ; le tableau prime). */
export function rentreeParRegle(annee: number): string {
  const dernier = iso(annee, 8, 31);
  return ajouterJours(dernier, -indexJour(dernier));
}

function vacancesDu(date: string): string | undefined {
  for (const a of ANNEES_SCOLAIRES_FWB) {
    for (const v of a.vacances) if (date >= v.du && date <= v.au) return v.libelle;
    if (date > a.dernierJour && date < a.rentreeSuivante) return 'Vacances d’été';
  }
  // Hors du tableau : seules les grandes vacances sont sûres (règle ci-dessus).
  const annee = Number(date.slice(0, 4));
  if (!calendrierConnu(date) && date > dernierJourDeClasseParRegle(annee) && date < rentreeParRegle(annee)) return 'Vacances d’été';
  return undefined;
}

/** Ce qui rend un jour particulier (férié, congé, vacances). Les week-ends ne sont pas traités : l'appelant les ignore. */
export function infosJour(date: string): InfosJour {
  const annee = Number(date.slice(0, 4));
  const ferie = table(feriesParAnnee, annee, joursFeries).get(date);
  const conge = table(congesParAnnee, annee, congesFWB).get(date);
  const vacances = vacancesDu(date);
  const infos: InfosJour = { sansClasse: Boolean(ferie || conge || vacances), calendrierConnu: calendrierConnu(date) };
  if (ferie) infos.ferie = ferie;
  if (conge) infos.conge = conge;
  if (vacances) infos.vacances = vacances;
  const libelle = ferie ?? conge ?? vacances;
  if (libelle) infos.libelle = libelle;
  return infos;
}

/** Pour l'affichage : « ferie » (jour férié ou congé fixe) avant « vacances ». */
export function natureJour(infos: InfosJour): 'ferie' | 'vacances' | null {
  if (infos.ferie || infos.conge) return 'ferie';
  if (infos.vacances) return 'vacances';
  return null;
}

/** Année scolaire du tableau qui contient cette date (de la rentrée à la veille de la rentrée suivante), s'il y en a une. */
export function anneeScolaireFWB(date: string): AnneeScolaireFWB | undefined {
  return ANNEES_SCOLAIRES_FWB.find((a) => date >= a.rentree && date < a.rentreeSuivante);
}
