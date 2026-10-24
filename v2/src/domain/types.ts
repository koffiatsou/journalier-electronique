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

export type Transfert = 'observed' | 'later' | 'not_observed';

export const TRANSFERT_LIBELLES: Record<Transfert, string> = {
  observed: 'Oui',
  later: 'Pas encore',
  not_observed: 'Pas observé'
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
  /** Stratégie réutilisée ailleurs que pendant la séance (question facultative de l'étape « Ce qui a aidé »). */
  transfert: Transfert | null;
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
  /** Année (S1…S6), si elle diffère de ce que dit la classe. */
  niveau?: string;
  /** Niveau d'étude : primaire, secondaire général, technique, professionnel, CEFA. */
  filiere?: Filiere;
  /** Langues modernes suivies (Néerlandais, Anglais, Espagnol…), toutes reliées au référentiel « Langues modernes ». */
  langues?: string[];
  /** Ancien champ (une seule langue) : converti en `langues` au chargement, voir `normaliserEleve`. */
  langue?: string;
  /** Couleur dans l'agenda (0–9) ; sinon déduite de l'identifiant. */
  couleur?: number;
  /** Année scolaire (« 2026-2027 ») pour laquelle le dossier (classe, titulaire) est à jour ; posée par le passage d'année. */
  anneeDossier?: string;
  /** Date d'archivage (AAAA-MM-JJ) : l'élève n'est plus suivi, son historique reste au Journalier. */
  archiveLe?: string;
}

export type Filiere = 'primaire' | 'secondaire' | 'technique_transition' | 'technique_qualification' | 'professionnel' | 'cefa';
export const FILIERES_LIBELLES: Readonly<Record<Filiere, string>> = {
  primaire: 'Primaire',
  secondaire: 'Secondaire général',
  technique_transition: 'Technique de transition',
  technique_qualification: 'Technique de qualification',
  professionnel: 'Professionnel',
  cefa: 'CEFA'
};

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

export type SituationAide = 'none' | 'existing' | 'new' | 'later';

export const SITUATION_AIDE_LIBELLES: Record<SituationAide, string> = {
  none: 'Aucune',
  existing: 'Déjà en place',
  new: 'Nouvelles',
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

/**
 * Nature d'une aide, déduite de son nom : l'agent n'a jamais à la choisir.
 * Adaptation = ce qu'on change pour l'élève (tâche, support, matériel, environnement).
 * Médiation = ce que l'adulte fait pendant la tâche pour l'aider à comprendre.
 */
export type NatureAide = 'adaptation' | 'mediation';

export const NATURE_AIDES: Readonly<Record<string, NatureAide>> = {
  'Support visuel': 'adaptation',
  'Gabarit / fiche outil': 'adaptation',
  'Aide organisation': 'adaptation',
  'Outil numérique': 'adaptation',
  'Matériel': 'adaptation',
  'Environnement': 'adaptation',
  'Reformulation': 'mediation',
  'Explicitation / verbalisation': 'mediation',
  'Décomposition': 'adaptation',
  'Modélisation': 'mediation',
  'Guidage verbal': 'mediation'
};

export const natureAide = (nom: string): NatureAide | null => NATURE_AIDES[nom.trim()] ?? null;

export const INTERVENTIONS_SUGGEREES = [
  'Accompagnement individuel',
  'Accompagnement groupe classe',
  'Atelier / sous-groupe',
  'Cointervention',
  'Coenseignement'
] as const;

export const ACTIONS_SUITE_SUGGEREES = [
  'Maintenir l’accompagnement',
  'Adapter la stratégie',
  'Tester une nouvelle stratégie',
  'Préparer un support',
  'Favoriser l’autonomie',
  'Laisser plus d’autonomie'
] as const;

export const COLLABORATIONS_SUGGEREES = [
  'Échange avec l’enseignant',
  'Mettre une stratégie en commun',
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
