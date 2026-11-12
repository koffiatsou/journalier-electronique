/** Une ligne du référentiel officiel (données compactes générées depuis les PDF, voir tools/referentiel). */
export interface EntreeReferentiel {
  /** Matière : Mathématiques, Français, Langues modernes. */
  m: string;
  /** Année : P1…S6 (absente si le référentiel ne la précise pas). */
  n?: Annee;
  /** Dernière année couverte quand le référentiel vaut pour un degré (ex. S3 → S4). */
  nf?: Annee;
  /** Cadre : TC = tronc commun, HGT = humanités générales et technologiques, HPT = professionnelles et techniques, SOC = Socles de compétences (S2, jusqu'à la rentrée 2026 incluse). */
  f: 'TC' | 'HGT' | 'HPT' | 'SOC';
  /** Nature interne : s = savoir, f = savoir-faire, c = compétence. Jamais affichée à l'agent. */
  t: 's' | 'f' | 'c';
  /** Thème ou unité. */
  u?: string;
  /** Intitulé de la compétence ou du savoir. */
  i?: string;
  /** Phrase affichée : verbe + objet. */
  a: string;
  /** Page du PDF source. */
  p?: number;
  /** Référentiel d'origine. */
  r: string;
  /** Langue concernée (grammaire propre à une langue) ; absente = commun à toutes. */
  l?: string;
  /** Code de la séquence du programme (« 4UAA4 ») : présent seulement sur les lignes des compétences terminales de maths S4–S6 ; seul, il n'est pas unique (voir `cleSequence`). */
  q?: string;
  /** Compétence à développer de la séquence, en casse normale. */
  cd?: string;
  /** Module et section du programme du tronc commun (« La géométrie plane / Les angles »), d'après le programme WBE S1–S3 ; sert à regrouper les tâches d'une même séquence. */
  sq?: string;
}

export const ANNEES = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'] as const;
export type Annee = (typeof ANNEES)[number];
export type FormeEnseignement = 'G' | 'TTR' | 'TQ' | 'P';

export interface Contexte {
  /** Objectif de la leçon (et, si on veut, « mon objectif »). */
  objectif: string;
  annee?: Annee | undefined;
  forme?: FormeEnseignement | undefined;
  /** Langue du dossier de l'élève (Néerlandais, Anglais…), pour les langues modernes. */
  langue?: string | undefined;
  /** Rentrée de la séance (2026 pour 2026-2027) : les lignes du tronc commun pas encore en vigueur sont écartées. Absente = tout est proposé. */
  rentree?: number | undefined;
}

/** Séquence du programme (unité d'acquis d'apprentissage) à laquelle appartient une piste. */
export interface SequenceProgramme {
  /** Titre de la séquence (« Fonctions de référence »). */
  titre: string;
  /** Compétence à développer (« S'approprier différents modèles fonctionnels »). */
  competence: string;
}

export interface Piste {
  entree: EntreeReferentiel;
  score: number;
  /** Année du référentiel quand elle diffère de celle de l'élève. */
  ecartAnnee: Annee | null;
  /** Renseignée quand la piste vient d'une séquence du programme : toutes les pistes proposées sont alors de la même séquence. */
  sequence?: SequenceProgramme;
}
