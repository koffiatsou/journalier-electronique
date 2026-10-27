/*
 * Avatar dessiné d'un élève (pas de photo : donnée sensible).
 * Des dessins originaux et génériques, calculés par le code : aucun personnage ni marque existants.
 */

export const STYLES_AVATAR = ['manga', 'bd', 'cartoon', 'pixel', 'minimal'] as const;
export type StyleAvatar = (typeof STYLES_AVATAR)[number];

export const STYLES_LIBELLES: Readonly<Record<StyleAvatar, string>> = {
  manga: 'Manga',
  bd: 'Bande dessinée',
  cartoon: 'Dessin animé',
  pixel: 'Pixel',
  minimal: 'Minimaliste'
};

/** Choix de l'élève : chaque nombre est un rang dans la liste correspondante ci-dessous. */
export interface AvatarEleve {
  style: StyleAvatar;
  teint: number;
  cheveux: number;
  coiffure: number;
  visage: number;
  accessoire: number;
}

export const TEINTS = ['#FBE3D0', '#F2C9A6', '#E0A878', '#C28450', '#98623C', '#6A4630'] as const;
export const TEINTS_LIBELLES = ['Très clair', 'Clair', 'Hâlé', 'Mat', 'Brun', 'Foncé'] as const;

export const CHEVEUX = ['#1F1B1D', '#4B2E20', '#7B4C2B', '#E2B65A', '#B8481F', '#C9CED6', '#3B6FE0', '#D6407F'] as const;
export const CHEVEUX_LIBELLES = ['Noirs', 'Bruns', 'Châtains', 'Blonds', 'Roux', 'Gris', 'Bleus', 'Roses'] as const;

export const COIFFURES_LIBELLES = ['Courte', 'Frange', 'Mi-longue', 'Longue', 'Bouclée', 'Queue de cheval', 'Chignon', 'Rasée'] as const;
export const VISAGES_LIBELLES = ['Sourire', 'Content', 'Sérieux', 'Surpris', 'Clin d’œil'] as const;
export const ACCESSOIRES_LIBELLES = ['Aucun', 'Lunettes rondes', 'Lunettes carrées', 'Casque audio', 'Casquette'] as const;

/** Une forme SVG. `f` = couleur (#rrggbb), « fond » / « haut » (couleur de l'élève, suit le thème clair/sombre) ou « none ». */
interface Trait { s?: string; sw?: number; o?: number }
export type Forme =
  | ({ t: 'rect'; x: number; y: number; w: number; h: number; rx?: number; f: string } & Trait)
  | ({ t: 'circle'; cx: number; cy: number; r: number; f: string } & Trait)
  | ({ t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; f: string } & Trait)
  | ({ t: 'path'; d: string; f: string } & Trait);

/** Côté de la zone de dessin (viewBox 0 0 64 64). */
export const COTE_DESSIN = 64;
