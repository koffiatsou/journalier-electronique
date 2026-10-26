/*
 * Indices pour rédiger le profil et le procès-verbal : des exemples et des phrases toutes faites
 * à cliquer pour s'inspirer, jamais imposées ; et des rapprochements tirés des séances.
 * Rien n'est jamais écrit dans le PIA sans que l'agent le choisisse. Textes à relire par l'utilisateur.
 */
import { OBSERVATIONS_SUGGEREES } from '../types.ts';
import type { Seance } from '../types.ts';
import { minusculePremiere as min } from '../redaction/langue.ts';
import type { Aspect, CleRetour, Colonne } from './types.ts';

/** Ce qu'on attend dans chaque colonne du tableau de profil, en une phrase. */
export const CONSIGNE_COLONNE: Readonly<Record<Colonne, string>> = {
  ressources: 'Ce sur quoi l’élève peut s’appuyer : ses points forts, ce qui fonctionne déjà.',
  difficultes: 'Ce qui freine ses apprentissages : des constats, sans jugement.',
  objectifs: 'Ce que l’on cherche à améliorer, dit simplement et de façon positive.'
};

/** Un exemple par case, affiché en indice sous la zone de texte. */
export const EXEMPLES: Readonly<Record<Aspect, Record<Colonne, string>>> = {
  physique: {
    ressources: 'Bonne motricité globale ; écrit de façon lisible.',
    difficultes: 'Se fatigue vite quand il faut écrire longtemps.',
    objectifs: 'Utiliser le clavier de l’ordinateur pour les textes longs.'
  },
  autonomie: {
    ressources: 'Prépare et range son matériel sans rappel.',
    difficultes: 'A besoin d’un adulte pour démarrer un travail.',
    objectifs: 'Utiliser seul son agenda pour noter les devoirs.'
  },
  comportement: {
    ressources: 'Relation de confiance avec les adultes ; accepte l’aide proposée.',
    difficultes: 'Se décourage vite devant une tâche qui paraît difficile.',
    objectifs: 'Renforcer la persévérance : essayer avant de demander de l’aide.'
  },
  communication: {
    ressources: 'S’exprime clairement à l’oral quand il se sent en confiance.',
    difficultes: 'Ose peu poser des questions devant la classe.',
    objectifs: 'Reformuler une consigne avec ses propres mots.'
  },
  cognitif: {
    ressources: 'Comprend mieux avec un exemple ou un schéma.',
    difficultes: 'Lit les consignes trop vite et passe à côté de l’essentiel.',
    objectifs: 'Repérer ce qui est demandé avant de commencer un exercice.'
  }
};

/** Phrases génériques à cliquer, par aspect et par colonne. */
export const PHRASES: Readonly<Record<Aspect, Record<Colonne, readonly string[]>>> = {
  physique: {
    ressources: [
      'Bonne motricité globale',
      'Bonne motricité fine (écriture, découpage)',
      'Écrit de façon lisible',
      'Se déplace sans difficulté dans l’école'
    ],
    difficultes: [
      'Écriture lente ou fatigante',
      'Fatigabilité en fin de journée',
      'Difficulté de motricité fine (écriture, découpage, outils)',
      'Besoin de pauses fréquentes'
    ],
    objectifs: [
      'Améliorer l’aisance de l’écriture',
      'Utiliser le clavier de façon fluide',
      'Alterner les temps de travail et les pauses',
      'Installer une posture de travail confortable'
    ]
  },
  autonomie: {
    ressources: [
      'Prépare et range son matériel',
      'Demande de l’aide quand il en a besoin',
      'Utilise son agenda',
      'Respecte les règles de la classe'
    ],
    difficultes: [
      'Entre difficilement dans la tâche sans aide',
      'Difficulté à s’organiser (matériel, agenda, ordre des tâches)',
      'Oublie le matériel ou les devoirs',
      'Difficulté à terminer un travail seul'
    ],
    objectifs: [
      'Automatiser l’usage de l’agenda',
      'Préparer seul son matériel',
      'Découper une tâche en étapes avant de commencer',
      'Demander de l’aide au bon moment',
      'Laisser plus d’autonomie dans les tâches connues'
    ]
  },
  comportement: {
    ressources: [
      'Relation positive avec les adultes',
      'Bonne relation avec les autres élèves',
      'Motivé et volontaire',
      'Accepte l’aide proposée',
      'Persévère quand la tâche est comprise'
    ],
    difficultes: [
      'Se décourage rapidement face à l’échec',
      'Manque de confiance en soi',
      'Évite la tâche quand elle paraît trop difficile',
      'Difficulté à gérer la frustration',
      'Attention difficile à maintenir'
    ],
    objectifs: [
      'Renforcer la persévérance',
      'Renforcer la confiance en soi',
      'Valoriser les réussites',
      'Apprendre à demander une pause quand c’est nécessaire',
      'Maintenir l’attention sur des temps plus longs'
    ]
  },
  communication: {
    ressources: [
      'S’exprime clairement à l’oral',
      'Sait expliquer ce qu’il a compris',
      'Écoute les consignes',
      'Communique facilement avec les adultes'
    ],
    difficultes: [
      'Difficulté à s’exprimer devant le groupe',
      'Difficulté à reformuler une consigne',
      'Vocabulaire limité',
      'Difficulté à exprimer ses besoins',
      'Difficulté de compréhension du français'
    ],
    objectifs: [
      'Oser poser des questions en classe',
      'Reformuler une consigne avec ses mots',
      'Enrichir le vocabulaire des matières',
      'Exprimer ses besoins à l’adulte'
    ]
  },
  cognitif: {
    ressources: [
      'Bonne mémoire visuelle',
      'Comprend mieux avec un support visuel ou un exemple',
      'Raisonne bien à l’oral',
      'Retient bien ce qui a été expliqué'
    ],
    difficultes: [
      'Difficulté de compréhension des consignes écrites',
      'Lenteur dans le traitement de l’information',
      'Difficulté à retenir à long terme',
      'Difficulté à réutiliser une méthode dans une autre situation',
      'Difficulté à résoudre un problème en plusieurs étapes'
    ],
    objectifs: [
      'Identifier ce qui est demandé dans une consigne',
      'Automatiser une méthode de travail',
      'Consolider les bases (tables, orthographe, vocabulaire…)',
      'Réutiliser une stratégie connue dans une autre situation'
    ]
  }
};

/* ───────── Procès-verbal 1 ───────── */

export const EXEMPLE_AXE = 'Exemple : l’organisation du travail, la compréhension des consignes, la confiance en soi.';
export const EXEMPLE_OBJECTIF = 'Exemple : repérer la question dans un énoncé de problème.';
export const EXEMPLE_CRITERES = 'Exemple : repère seul la question dans 4 problèmes sur 5, pendant trois semaines.';
export const EXEMPLE_RESSOURCES = 'Exemple : une séance en plus par semaine en mathématiques, le prêt d’un ordinateur, un point toutes les deux semaines avec la titulaire.';

export const EXEMPLES_RETOURS: Readonly<Record<CleRetour, string>> = {
  parents: 'Exemple : les devoirs se passent mieux à la maison depuis l’utilisation de l’agenda.',
  direction: 'Exemple : l’équipe souhaite un point sur les évaluations avant les examens.',
  eleve: 'Exemple : dit que les fiches avec un exemple l’aident à démarrer.',
  pms: 'Exemple : propose un bilan complémentaire sur la lecture.',
  agent: 'Exemple : progrès nets en mathématiques ; reste à travailler l’organisation.',
  autres: 'Exemple : le logopède confirme un travail régulier sur la lecture.'
};

/* ───────── Rapprochements tirés des séances ───────── */

export interface Rapprochement {
  /** Stable d'un calcul à l'autre. */
  id: string;
  aspect: Aspect;
  colonne: Colonne;
  /** Phrase à ajouter dans la case. */
  texte: string;
  /** Pourquoi on la propose : combien de séances, dans quelles matières, quel niveau. */
  raison: string;
}

/** Aspects pour lesquels les séances permettent de rapprocher des observations. */
export const ASPECTS_RAPPROCHES: readonly Aspect[] = ['cognitif', 'autonomie', 'comportement'];

/** Rangement de départ des rubriques d'observation (décision du 26/10/2026, modifiable). */
export const ASPECT_DE_RUBRIQUE: Readonly<Record<string, Aspect>> = {
  'Compréhension / traitement': 'cognitif',
  'Réalisation': 'cognitif',
  'Organisation / fonctions exécutives': 'autonomie',
  'Rapport à l’aide / engagement': 'comportement'
};

/** Nombre maximum de rapprochements par case : une courte liste se lit, une longue se survole. */
export const MAX_RAPPROCHEMENTS = 3;
/** Une observation n'est rapprochée que si elle revient dans au moins ce nombre de séances. */
export const MIN_SEANCES = 2;

const norme = (t: string): string => t.replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim().toLowerCase();
const MOTS = ['partiellement', 'suffisamment', 'totalement'] as const;
const sansPoint = (t: string): string => t.replace(/[.\s]+$/, '');

const ASPECT_DE_TEXTE: ReadonlyMap<string, Aspect> = new Map(
  OBSERVATIONS_SUGGEREES.flatMap(({ rubrique, items }) => {
    const aspect = ASPECT_DE_RUBRIQUE[rubrique];
    return aspect ? items.map((i): [string, Aspect] => [norme(i), aspect]) : [];
  })
);

interface Entree { seanceId: string; date: string; matiere: string; niveau: number }

/**
 * Observations qui reviennent sur plusieurs séances (de n'importe quelle matière), rangées par aspect.
 * Le DERNIER niveau noté décide : « Totalement » = ressource ; « Partiellement » = difficulté et objectif
 * (« Faire progresser ») ; « Suffisamment » = objectif (« Consolider »). Les absences ne comptent pas.
 */
export function rapprocher(seances: readonly Seance[]): Rapprochement[] {
  const parTexte = new Map<string, { texte: string; entrees: Entree[] }>();
  const chrono = [...seances].filter((s) => s.presence === 'present').sort((a, b) => a.date.localeCompare(b.date) || a.periodeDebut.localeCompare(b.periodeDebut, 'fr', { numeric: true }));
  for (const s of chrono) {
    for (const o of s.observations) {
      if (o.niveau === null || !o.texte.trim()) continue;
      const cle = norme(o.texte);
      const courant = parTexte.get(cle) ?? { texte: sansPoint(o.texte.trim()), entrees: [] };
      courant.entrees.push({ seanceId: s.id, date: s.date, matiere: s.matiere || 'Matière non précisée', niveau: o.niveau });
      parTexte.set(cle, courant);
    }
  }

  const candidats: (Rapprochement & { poids: number; recent: string })[] = [];
  for (const [cle, { texte, entrees }] of parTexte) {
    const aspect = ASPECT_DE_TEXTE.get(cle);
    if (!aspect || !ASPECTS_RAPPROCHES.includes(aspect)) continue;
    const nbSeances = new Set(entrees.map((e) => e.seanceId)).size;
    if (nbSeances < MIN_SEANCES) continue;
    const fin = entrees[entrees.length - 1];
    if (!fin) continue;
    const matieres = [...new Set(entrees.map((e) => e.matiere))];
    const raison = `Noté lors de ${nbSeances} séances${matieres.length > 1 ? ` (${matieres.join(', ')})` : ` en ${matieres[0] ?? ''}`} ; dernier niveau : ${MOTS[fin.niveau] ?? ''}.`;
    const ajouter = (colonne: Colonne, phrase: string) =>
      candidats.push({ id: `${aspect}|${colonne}|${cle}`, aspect, colonne, texte: phrase, raison, poids: nbSeances, recent: fin.date });
    const t = min(texte);
    if (fin.niveau === 2) ajouter('ressources', `Acquis : ${t}`);
    if (fin.niveau === 0) {
      ajouter('difficultes', `Pas encore acquis : ${t}`);
      ajouter('objectifs', `Faire progresser : ${t}`);
    }
    if (fin.niveau === 1) ajouter('objectifs', `Consolider : ${t}`);
  }

  candidats.sort((a, b) => b.poids - a.poids || b.recent.localeCompare(a.recent) || a.texte.localeCompare(b.texte, 'fr'));
  const compte = new Map<string, number>();
  return candidats.filter((c) => {
    const k = `${c.aspect}|${c.colonne}`;
    const n = compte.get(k) ?? 0;
    compte.set(k, n + 1);
    return n < MAX_RAPPROCHEMENTS;
  }).map(({ poids: _p, recent: _r, ...r }) => r);
}

export const rapprochementsDe = (liste: readonly Rapprochement[], aspect: Aspect, colonne: Colonne): Rapprochement[] =>
  liste.filter((r) => r.aspect === aspect && r.colonne === colonne);
