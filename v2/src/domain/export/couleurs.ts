import { sansAccents } from '../referentiel/texte.ts';

/**
 * Couleurs de fond des en-têtes du Journalier Word, une par matière. Toutes claires : le texte noir reste lisible,
 * à l'écran comme sur une impression en noir et blanc (les nuances se lisent en gris). Tout est facultatif :
 * par défaut les en-têtes gardent le gris du modèle.
 */
export interface CouleurWord {
  nom: string;
  /** Fond en hexadécimal (6 caractères, sans #), tel qu'attendu par Word. */
  fond: string;
}

export const COULEURS_WORD: readonly CouleurWord[] = [
  { nom: 'Bleu', fond: 'BDD7EE' },
  { nom: 'Vert', fond: 'C6E0B4' },
  { nom: 'Jaune', fond: 'FFE699' },
  { nom: 'Orange', fond: 'F8CBAD' },
  { nom: 'Rose', fond: 'F4B6C2' },
  { nom: 'Violet', fond: 'D9C3E6' },
  { nom: 'Turquoise', fond: 'B4E5E0' },
  { nom: 'Gris-bleu', fond: 'CAD3E0' },
  { nom: 'Beige', fond: 'E7D8BF' },
  { nom: 'Rouge clair', fond: 'F2A7A7' }
];

/** Réglage d'export : « Colorer par matière » coché ou non, et les couleurs choisies à la main (clé = matière normalisée). */
export interface ReglageCouleurs {
  actif: boolean;
  choix: Record<string, number>;
}

export const REGLAGE_COULEURS_VIDE: ReglageCouleurs = { actif: false, choix: {} };

/** Clé d'une matière : sans accents, sans majuscules, sans espaces autour (« Mathématiques » = « mathematiques »). */
export const cleMatiere = (matiere: string): string => sansAccents(matiere).trim();

/** Couleurs fixes des matières courantes, pour que deux matières du quotidien ne se ressemblent pas ; les autres passent par `empreinte`. */
const MATIERES_COURANTES: Readonly<Record<string, number>> = {
  mathematiques: 0, sciences: 1, geographie: 2, neerlandais: 3, francais: 4, anglais: 5, 'education physique': 6, histoire: 8, technique: 9
};

/** Empreinte stable d'un texte (FNV-1a) : la même matière a la même couleur à chaque export, sur tous les appareils. */
function empreinte(texte: string): number {
  let h = 2166136261;
  for (const c of texte) { h ^= c.codePointAt(0)!; h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Couleur d'une matière : celle choisie par l'agent, sinon la couleur automatique. */
export function couleurDeMatiere(matiere: string, choix: Readonly<Record<string, number>>): CouleurWord {
  const cle = cleMatiere(matiere);
  const choisie = choix[cle];
  const index = choisie !== undefined && COULEURS_WORD[choisie] ? choisie : (MATIERES_COURANTES[cle] ?? empreinte(cle) % COULEURS_WORD.length);
  return COULEURS_WORD[index]!;
}

/** Relit un réglage enregistré : tout ce qui n'est pas clair est ignoré (jamais d'erreur au chargement). */
export function normaliserReglageCouleurs(brut: unknown): ReglageCouleurs {
  if (typeof brut !== 'object' || brut === null) return { actif: false, choix: {} };
  const { actif, choix } = brut as { actif?: unknown; choix?: unknown };
  const valides: Record<string, number> = {};
  if (typeof choix === 'object' && choix !== null) {
    for (const [cle, v] of Object.entries(choix)) {
      if (typeof v === 'number' && Number.isInteger(v) && COULEURS_WORD[v]) valides[cle] = v;
    }
  }
  return { actif: actif === true, choix: valides };
}
