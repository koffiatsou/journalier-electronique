import type { EntreeReferentiel } from './types.ts';

/** Connaître (s), Appliquer (f), Transférer (c) : jamais affichés, ils ne servent qu'à ranger les tâches d'une séquence. */
export type Processus = EntreeReferentiel['t'];

/** Verbes qui demandent de savoir : reconnaître, nommer, énoncer… */
const VERBES_CONNAITRE = new Set([
  'identifier', 'nommer', 'enoncer', 'definir', 'reconnaitre', 'citer', 'decrire', 'associer', 'repere', 'reperer', 'situer', 'designer',
  'distinguer', 'differencier', 'connaitre', 'comprendre', 'memoriser', 'retenir', 'enumerer', 'localiser', 'lister', 'expliquer', 'caracteriser'
]);
/** Verbes qui demandent de transférer : résoudre, justifier, concevoir… dans une situation nouvelle. */
const VERBES_TRANSFERER = new Set([
  'resoudre', 'justifier', 'argumenter', 'analyser', 'concevoir', 'creer', 'evaluer', 'elaborer', 'transferer', 'mobiliser', 'articuler',
  'integrer', 'synthetiser', 'critiquer', 'debattre', 'planifier', 'inventer', 'proposer', 'interpreter', 'generaliser', 'modeliser'
]);
/** Une tâche posée dans un problème ou une situation complexe est un transfert, quel que soit son verbe. */
const SITUATION_DE_TRANSFERT = /probl[eè]me|situation (?:complexe|nouvelle|inedite|inédite)|en autonomie|projet/i;

const sansAccents = (texte: string): string => texte.normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Processus d'un attendu d'après son verbe (le premier mot de la tâche, à l'infinitif) : Connaître, Transférer, sinon Appliquer
 * (construire, calculer, utiliser, réaliser, mesurer… : l'application d'une procédure connue). C'est une interprétation, utilisée seulement
 * quand les données ne distinguent pas déjà les trois types (voir `groupesSansTypes`).
 */
export function processusDuVerbe(attendu: string): Processus {
  if (SITUATION_DE_TRANSFERT.test(attendu)) return 'c';
  const verbe = sansAccents(attendu.trim().split(/[\s,;:]+/)[0] ?? '').toLowerCase();
  if (VERBES_TRANSFERER.has(verbe)) return 'c';
  if (VERBES_CONNAITRE.has(verbe)) return 's';
  return 'f';
}

/** Part d'un même type, dans un groupe (référentiel, année), à partir de laquelle on le juge sans information. */
const PART_DEGENEREE = 0.9;
/** En dessous de cette taille, un groupe ne dit rien de fiable sur la répartition des types. */
const TAILLE_MINIMALE_DU_GROUPE = 20;

/**
 * Groupes (référentiel et année) dont presque toutes les lignes ont le même type (arts, technique, éducation physique, latin des compétences
 * terminales ; Socles de compétences) : le type n'y distingue rien, on classe ces lignes par leur verbe.
 */
export function groupesSansTypes(entrees: readonly EntreeReferentiel[]): ReadonlySet<string> {
  const comptes = new Map<string, Map<Processus, number>>();
  for (const e of entrees) {
    const cle = `${e.r}|${e.n ?? ''}`;
    const groupe = comptes.get(cle) ?? new Map<Processus, number>();
    groupe.set(e.t, (groupe.get(e.t) ?? 0) + 1);
    comptes.set(cle, groupe);
  }
  const sans = new Set<string>();
  for (const [cle, groupe] of comptes) {
    const total = [...groupe.values()].reduce((a, b) => a + b, 0);
    if (total >= TAILLE_MINIMALE_DU_GROUPE && Math.max(...groupe.values()) / total >= PART_DEGENEREE) sans.add(cle);
  }
  return sans;
}
