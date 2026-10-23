/*
 * Modèle de données du Journalier (V2).
 *
 * Volontairement plat et explicite : chaque champ correspond à une ligne du
 * Journalier papier. Aucune logique ici, uniquement des types et des constantes.
 */

/** Niveau constaté pour une observation ou une compétence : 0 partiel, 1 suffisant, 2 total. */
export type Niveau = 0 | 1 | 2;
/** Effet d'une aide : 0 aucun, 1 partiel, 2 positif. */
export type Effet = 0 | 1 | 2;

export const NIVEAUX_LIBELLES = ['Partiellement', 'Suffisamment', 'Totalement'] as const;
export const EFFETS_LIBELLES = ['Aucun effet', 'Effet partiel', 'Effet positif'] as const;

export type Presence =
  | 'present'
  | 'absent_eleve'
  | 'absent_eleve_coteach'
  | 'absent_prof'
  | 'absent_agent';

export const PRESENCE_LIBELLES: Record<Presence, { titre: string; aide: string }> = {
  present: {
    titre: 'Présence normale',
    aide: 'Séance d’accompagnement habituelle avec l’élève présent.'
  },
  absent_eleve_coteach: {
    titre: 'Élève absent — co-enseignement',
    aide: 'Vous restez en classe : indiquez le contenu vu. Pas de partie orthopédagogique.'
  },
  absent_eleve: {
    titre: 'Élève absent — séance non tenue',
    aide: 'L’absence est tracée dans le Journalier sans fausser les observations.'
  },
  absent_prof: {
    titre: 'Professeur absent — cours annulé',
    aide: 'Créneau tracé sans impact sur le taux de présence de l’élève.'
  },
  absent_agent: {
    titre: 'Agent du pôle absent',
    aide: 'Votre absence est tracée sans impact sur le taux de présence de l’élève.'
  }
};

export type Transfert = 'observed' | 'not_observed' | 'no_opportunity' | 'later' | 'not_relevant';

export const TRANSFERT_LIBELLES: Record<Transfert, string> = {
  observed: 'Observé',
  not_observed: 'Non observé',
  no_opportunity: 'Pas d’occasion de l’observer',
  later: 'À observer plus tard',
  not_relevant: 'Sans objet'
};

export interface Observation {
  texte: string;
  /** null tant que le niveau n'a pas été choisi : rien n'est présélectionné. */
  niveau: Niveau | null;
}

export interface Aide {
  nom: string;
  effet: Effet | null;
}

export interface Seance {
  id: string;
  eleveId: string;
  /** Date au format AAAA-MM-JJ. */
  date: string;
  periodeDebut: string;
  periodeFin: string;
  matiere: string;
  niveauScolaire: string;
  forme: string;
  presence: Presence;
  interventions: string[];

  /* Partie pédagogique */
  objectifLecon: string;
  contenuClasse: string;
  monObjectif: string;

  /* Partie orthopédagogique */
  observations: Observation[];
  remarque: string;
  competences: Observation[];
  precisionCompetence: string;
  situationAide: SituationAide;
  aides: Aide[];
  precisionAide: string;
  transfert: Transfert | null;
  precisionTransfert: string;
  suite: {
    actions: string[];
    modalite: string;
    objectif: string;
    collaborations: string[];
    precision: string;
  };

  creeLe: string;
  modifieLe: string;
}

export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  classe: string;
  ecole: string;
  titulaire: string;
  dateNaissance: string;
  /** Matières suivies, proposées en priorité dans le formulaire de séance. */
  matieres: string[];
}

export const PERIODES_DEFAUT = ['1e H', '2e H', '3e H', '4e H', '5e H', '6e H', '7e H', '8e H'] as const;

/** Observations proposées par rubrique (l'agent peut aussi saisir librement). */
export const OBSERVATIONS_SUGGEREES: ReadonlyArray<{ rubrique: string; items: readonly string[] }> = [
  {
    rubrique: 'Compréhension / traitement',
    items: [
      'Identifie ce qui est demandé dans la consigne',
      'Repère les informations pertinentes',
      'Comprend la notion travaillée',
      'Mobilise des connaissances antérieures',
      'Met en relation des informations'
    ]
  },
  {
    rubrique: 'Organisation / fonctions exécutives',
    items: [
      'Entre dans la tâche',
      'Organise son travail',
      'Maintient son attention',
      'Suit les étapes de la tâche',
      'Gère le matériel nécessaire'
    ]
  },
  {
    rubrique: 'Réalisation',
    items: [
      'Met en œuvre la procédure travaillée',
      'Choisit une stratégie adaptée',
      'Contrôle sa production',
      'Réutilise une stratégie connue'
    ]
  },
  {
    rubrique: 'Rapport à l’aide / engagement',
    items: [
      'Demande de l’aide',
      'Accepte l’aide',
      'Utilise l’aide proposée',
      'Poursuit après l’aide',
      'Persévère dans la tâche',
      'Se désengage / évite la tâche'
    ]
  }
];

export type SituationAide = 'none' | 'existing_adaptation' | 'existing_mediation' | 'new' | 'later';

export const SITUATION_AIDE_LIBELLES: Record<SituationAide, string> = {
  none: 'Aucune',
  existing_adaptation: 'Adaptation déjà en place',
  existing_mediation: 'Médiation déjà en place',
  new: 'Nouvelle adaptation / médiation',
  later: 'Piste pour plus tard'
};

export const AIDES_SUGGEREES = [
  'Reformulation',
  'Explicitation / verbalisation',
  'Support visuel',
  'Gabarit / fiche outil',
  'Décomposition',
  'Modélisation',
  'Guidage verbal',
  'Aide organisation',
  'Outil numérique',
  'Matériel',
  'Environnement',
  'Autre'
] as const;

export const INTERVENTIONS_SUGGEREES = [
  'Accompagnement individuel',
  'Accompagnement groupe classe',
  'Atelier / sous-groupe',
  'Cointervention',
  'Coenseignement'
] as const;

export const ACTIONS_SUITE_SUGGEREES = [
  'Maintenir l’accompagnement',
  'Adapter la stratégie / médiation',
  'Tester une nouvelle stratégie / médiation',
  'Préparer un support',
  'Favoriser l’autonomie',
  'Réduire ponctuellement l’étayage'
] as const;

export const COLLABORATIONS_SUGGEREES = [
  'Échange avec l’enseignant',
  'Coordination d’une stratégie / d’un outil',
  'Adaptation à partager avec l’équipe',
  'Point avec l’équipe pédagogique',
  'Questionner à la prochaine réunion d’intégration'
] as const;

export const MODALITES_SUITE = [
  'Maintenir l’individuel',
  'Groupe',
  'Cointervention',
  'Coenseignement'
] as const;
