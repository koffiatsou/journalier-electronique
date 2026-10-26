export type TypeActivite = 'eleve' | 'collaboration' | 'formation' | 'administratif' | 'libre';
export type StatutActivite = 'prevu' | 'realise' | 'annule';

export const TYPES_LIBELLES: Readonly<Record<TypeActivite, string>> = {
  eleve: 'Accompagnement d’un élève',
  collaboration: 'Collaboration',
  formation: 'Formation',
  administratif: 'Administratif',
  libre: 'Autre'
};

export interface Periode {
  label: string;
  /** « HH:MM » */
  debut: string;
  fin: string;
}

/** Horaires habituels ; l'utilisateur peut les régler (voir `horaires.ts`). Les pauses sont l'espace entre deux périodes. */
export const PERIODES_AGENDA: readonly Periode[] = [
  { label: '1e H', debut: '08:00', fin: '08:50' },
  { label: '2e H', debut: '08:50', fin: '09:40' },
  { label: '3e H', debut: '09:40', fin: '10:30' },
  { label: '4e H', debut: '10:45', fin: '11:35' },
  { label: '5e H', debut: '11:35', fin: '12:25' },
  { label: '6e H', debut: '13:15', fin: '14:05' },
  { label: '7e H', debut: '14:05', fin: '14:55' },
  { label: '8e H', debut: '14:55', fin: '15:45' }
];

/**
 * Une activité planifiée. Pour une répétition hebdomadaire, `date` est la première occurrence ;
 * les occurrences supprimées ou modifiées une par une sont listées dans `exceptions`.
 */
export interface Activite {
  id: string;
  type: TypeActivite;
  /** Élève du dossier (type « eleve »). */
  eleveId?: string;
  /** Nom saisi librement quand l'élève n'a pas (encore) de dossier. */
  nomLibre?: string;
  /** Titre libre ; pour un élève, il complète le nom (ex. « Remédiation fractions »). */
  titre: string;
  matiere?: string;
  lieu: string;
  note: string;
  /** AAAA-MM-JJ */
  date: string;
  /** Index de période (0 = 1e H). */
  debut: number;
  fin: number;
  repetition: 'aucune' | 'hebdomadaire';
  /** Dernier jour de la série (inclus). */
  jusquau?: string;
  /** Dates (AAAA-MM-JJ) retirées de la série. */
  exceptions?: string[];
  /** États propres à une date (annulé, réalisé pour une activité sans séance). */
  etats?: Record<string, StatutActivite>;
  /** Série d'origine d'une occurrence modifiée ou dupliquée. */
  serieId?: string;
  /** Couleur imposée (0–9) ; sinon celle de l'élève ou du type. */
  couleur?: number;
  creeLe: string;
  modifieLe: string;
}

/** Une activité à une date précise (c'est ce qu'on affiche). */
export interface Occurrence {
  cle: string;
  activite: Activite;
  date: string;
  debut: number;
  fin: number;
  statut: StatutActivite;
}
