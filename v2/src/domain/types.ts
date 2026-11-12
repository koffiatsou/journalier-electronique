import type { AvatarEleve } from './avatar/types.ts';

/*
 * Modèle de données du Journalier (V2).
 *
 * Volontairement plat et explicite : chaque champ correspond à une ligne du
 * Journalier papier. Aucune logique ici, uniquement des types et des constantes.
 */

/**
 * Niveau constaté pour une observation ou une compétence : -1 pas du tout, 0 un peu, 1 assez, 2 tout à fait.
 * Les séances d'avant le 9/11/2026 ont 0, 1, 2 (alors écrits « Partiellement », « Suffisamment », « Totalement ») :
 * « Pas du tout » a pris la valeur -1 pour que rien ne soit à convertir et que l'ordre reste le même.
 */
export type Niveau = -1 | 0 | 1 | 2;
/** Valeur du niveau le plus faible : la première pastille de l'échelle. */
export const NIVEAU_MIN = -1;
/** Effet d'une aide : 0 aucun, 1 partiel, 2 positif. */
export type Effet = 0 | 1 | 2;

/** Les mots de l'échelle, du plus faible au plus fort : le mot d'un niveau `n` est à la position `n - NIVEAU_MIN`. */
export const NIVEAUX_LIBELLES = ['Pas du tout', 'Un peu', 'Assez', 'Tout à fait'] as const;
/** Mot d'un niveau (vide si la valeur est inconnue). Ne sert pas aux points de vigilance, qui ont leur échelle. */
export const libelleNiveau = (n: number): string => NIVEAUX_LIBELLES[n - NIVEAU_MIN] ?? '';
/** Échelle d'un point de vigilance : mêmes valeurs 0, 1, 2 que `Niveau`, lues comme une fréquence. */
export const NIVEAUX_VIGILANCE = ['Ponctuellement', 'Souvent', 'Tout au long'] as const;

export const EFFETS_LIBELLES = ['Aucun effet', 'Effet partiel', 'Effet positif'] as const;

export type Presence =
  | 'present'
  | 'absent_eleve'
  | 'absent_eleve_coteach'
  | 'absent_prof'
  | 'absent_agent';

/** Choix de présence « Professeur absent, élève vu en individuel » : une séance tenue (présence normale) avec `profAbsent`. */
export const PRESENCE_PROF_ABSENT_VU = {
  titre: 'Professeur absent — élève vu en individuel',
  aide: 'La séance a bien lieu, hors de la classe : remplissez les rubriques comme d’habitude. Le Journalier note « professeur absent » à côté du cours.'
} as const;

export const PRESENCE_LIBELLES: Record<Presence, { titre: string; aide: string }> = {
  present: {
    titre: 'Présence normale',
    aide: 'Séance d’accompagnement habituelle avec l’élève présent.'
  },
  absent_eleve_coteach: {
    titre: 'Élève absent — co-intervention',
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

export interface Observation {
  texte: string;
  /** null tant que le niveau n'a pas été choisi : rien n'est présélectionné. */
  niveau: Niveau | null;
  /**
   * Point de vigilance (une difficulté observée) : son niveau dit « à quelle fréquence » (voir `NIVEAUX_VIGILANCE`),
   * jamais « à quel point c'est acquis ». Posé pour une observation libre ; les points connus se reconnaissent
   * à leur texte (`estVigilance`).
   */
  vigilance?: boolean;
}

export interface Aide {
  nom: string;
  effet: Effet | null;
}

/** Climat de classe observé pendant la séance (contexte, pas un niveau de l'élève) : une phrase d'ouverture des notes des agents. */
export type ClimatClasse = 'serein' | 'peu_engage' | 'agite' | 'tendu';
export const CLIMAT_LIBELLES: Readonly<Record<ClimatClasse, string>> = {
  serein: 'Serein et propice aux apprentissages',
  peu_engage: 'Calme, mais peu engagé',
  agite: 'Agité',
  tendu: 'Tendu'
};

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
  /** Professeur absent mais élève vu en individuel : la séance a lieu (présence « normale »), l'absence du professeur est seulement notée. */
  profAbsent?: boolean;
  interventions: string[];
  /** Facultatif : absent tant que l'agent ne l'a pas renseigné (les séances déjà enregistrées n'en ont pas). */
  climat?: ClimatClasse;
  precisionClimat?: string;

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
  /** Ancienne question « Utilisé ailleurs ? » : plus posée ni écrite dans le Journalier, mais gardée telle quelle (donnée déjà stockée). */
  transfert: Transfert | null;
  suite: {
    actions: string[];
    modalite: string;
    objectif: string;
    collaborations: string[];
    precision: string;
  };

  /** Enseignant du cours, gardé à l'encodage (ou saisi pour un remplacement) ; sinon on lit le dossier de l'élève. */
  enseignant?: string;

  creeLe: string;
  modifieLe: string;
}

/** Enseignant qui donne une matière à l'élève (différent du titulaire de classe). */
export interface EnseignantCours {
  matiere: string;
  nom: string;
}

export interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  classe: string;
  /** Nom de l'école (texte du dossier, repris dans les documents). */
  ecole: string;
  /** École de l'agenda à laquelle l'élève est rattaché (choisie dans la fiche) ; sinon on cherche une école du même nom, sinon l'école par défaut. */
  ecoleId?: string;
  /** Titulaire(s) de la classe : repris dans l'identité du PIA. */
  titulaire: string;
  /** Enseignants par cours : colonne « Titulaire » des séances du Journalier (à défaut, le titulaire de classe). */
  enseignants?: EnseignantCours[];
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
  /** Avatar dessiné (jamais de photo) ; sans avatar, les initiales sur la couleur de l'élève. */
  avatar?: AvatarEleve;
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

export const PERIODES_DEFAUT = ['1e H', '2e H', '3e H', '4e H', '5e H', '6e H', '7e H', '8e H', '9e H'] as const;

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
      'Persévère dans la tâche'
    ]
  }
];

/** Points de vigilance proposés (difficultés observées) : échelle de fréquence, jamais classés parmi les acquis. */
export const VIGILANCES_SUGGEREES: readonly string[] = ['Se désengage / évite la tâche'];

const cleVigilance = (t: string): string => t.replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
const VIGILANCES_CONNUES: ReadonlySet<string> = new Set(VIGILANCES_SUGGEREES.map(cleVigilance));

/** Vrai pour un point de vigilance : posé à la saisie, ou point connu (les séances d'avant n'ont pas de marque). */
export const estVigilance = (o: { texte: string; vigilance?: boolean | undefined }): boolean =>
  o.vigilance === true || VIGILANCES_CONNUES.has(cleVigilance(o.texte));

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
  'Renforcement positif',
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
  'Guidage verbal': 'mediation',
  'Renforcement positif': 'mediation'
};

export const natureAide = (nom: string): NatureAide | null => NATURE_AIDES[nom.trim()] ?? null;

/**
 * Façons d'intervenir (voir `lexique.ts` pour les définitions). Les séances déjà enregistrées gardent leurs anciens mots
 * (« Accompagnement groupe classe », « Atelier / sous-groupe », « Cointervention », « Coenseignement ») : ils restent
 * affichés et décochables dans le formulaire (`interventionsAffichees`), jamais réécrits.
 */
export const INTERVENTIONS_SUGGEREES = [
  'Accompagnement individuel',
  'Accompagnement collectif (en classe)',
  'Atelier groupe classe',
  'Co-intervention',
  'Co-enseignement'
] as const;

/** Les choix à montrer pour une séance : les suggestions, puis les anciens mots que la séance contient encore. */
export const interventionsAffichees = (choisies: readonly string[]): string[] => [
  ...INTERVENTIONS_SUGGEREES,
  ...choisies.filter((v) => !(INTERVENTIONS_SUGGEREES as readonly string[]).includes(v))
];

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

/**
 * « Format de la prochaine séance » : les mêmes mots que « Mon intervention » (depuis le 9/11/2026). Les anciens formats déjà
 * enregistrés (« Maintenir l'individuel », « Groupe », « Cointervention », « Coenseignement ») restent affichés (`modalitesAffichees`).
 */
export const MODALITES_SUITE = INTERVENTIONS_SUGGEREES;

/** Les formats à montrer : la liste, puis l'ancien format de la séance s'il n'y est plus. */
export const modalitesAffichees = (actuelle: string): string[] =>
  actuelle && !(MODALITES_SUITE as readonly string[]).includes(actuelle) ? [...MODALITES_SUITE, actuelle] : [...MODALITES_SUITE];
