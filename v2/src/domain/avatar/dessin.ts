/*
 * Dessin des avatars : une fonction pure `dessiner(choix)` → liste de formes SVG (viewBox 64 × 64).
 * Le composant d'affichage ne fait que transformer ces formes en éléments SVG (aucun HTML injecté).
 * Cinq styles, tous dessinés ici : aucun personnage, logo ni marque existant.
 */
import { ACCESSOIRES_LIBELLES, CHEVEUX, COIFFURES_LIBELLES, STYLES_AVATAR, TEINTS, VISAGES_LIBELLES } from './types.ts';
import type { AvatarEleve, Forme, StyleAvatar } from './types.ts';

const ENCRE = '#2B2540';
const BOUCHE = '#8A2F3C';
const MONTURE = '#2B2540';
/** Traits du visage (yeux, bouche) sur le teint le plus foncé : clairs, sinon ils se perdent. */
const ENCRE_CLAIRE = '#F6E4D6';
const encreDe = (teint: number): string => (teint >= 5 ? ENCRE_CLAIRE : ENCRE);

/** Assombrit une couleur #rrggbb (k = 0 inchangée, 1 noire). */
function ombre(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number): string => Math.round(v * (1 - k)).toString(16).padStart(2, '0');
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

/** Contour des styles dessinés au trait (manga fin, bande dessinée épaisse, dessin animé moyen). */
const TRAIT: Readonly<Record<StyleAvatar, { s?: string; sw?: number }>> = {
  manga: { s: '#3A2C3F', sw: 0.9 },
  bd: { s: '#241F33', sw: 2 },
  cartoon: { s: ENCRE, sw: 1.6 },
  minimal: {},
  pixel: {}
};

/** Bord gauche de la tête (pour placer ce qui l'entoure : oreilles, casque). */
const BORD: Readonly<Record<'manga' | 'bd' | 'cartoon' | 'minimal', number>> = { manga: 19, bd: 18, cartoon: 16, minimal: 18 };

const TETE: Readonly<Record<'manga' | 'bd' | 'cartoon', string>> = {
  manga: 'M19 28 C19 16 25 13 32 13 C39 13 45 16 45 28 C45 38 39 47 32 48 C25 47 19 38 19 28 Z',
  bd: 'M18 29 C18 17 25 14 32 14 C39 14 46 17 46 29 C46 39 40 46 32 46 C24 46 18 39 18 29 Z',
  cartoon: 'M16 30 C16 18 24 14 32 14 C40 14 48 18 48 30 C48 41 41 46 32 46 C23 46 16 41 16 30 Z'
};

type Cercle = readonly [cx: number, cy: number, r: number];

/** Touffe de cercles : contour d'abord, puis remplissage, pour ne garder que le contour extérieur. */
function touffe(cercles: readonly Cercle[], f: string, trait: { s?: string; sw?: number }): Forme[] {
  const contour: Forme[] = trait.s ? cercles.map(([cx, cy, r]): Forme => ({ t: 'circle', cx, cy, r, f, s: trait.s!, sw: (trait.sw ?? 1) * 2 })) : [];
  return [...contour, ...cercles.map(([cx, cy, r]): Forme => ({ t: 'circle', cx, cy, r, f }))];
}

/* ───────── cheveux (vectoriel) ───────── */

function cheveuxArriere(coiffure: number, f: string, trait: { s?: string; sw?: number }): Forme[] {
  switch (coiffure) {
    case 2: return [{ t: 'path', d: 'M16 31 C13 14 23 9 32 9 C41 9 51 14 48 31 L49.5 45 L14.5 45 Z', f, ...trait }];
    case 3: return [{ t: 'path', d: 'M15 32 C12 13 22 8 32 8 C42 8 52 13 49 32 L51 58 L13 58 Z', f, ...trait }];
    case 4: return touffe([[19, 22, 8], [32, 14, 10], [45, 22, 8], [15.5, 32, 6], [48.5, 32, 6], [25, 16, 7.5], [39, 16, 7.5]], f, trait);
    case 5: return [{ t: 'path', d: 'M43 20 C54 19 59 33 52 47 C51 39 48 33 44 31 Z', f, ...trait }];
    case 6: return [{ t: 'circle', cx: 32, cy: 9, r: 7, f, ...trait }];
    default: return [];
  }
}

const CALOTTE: Readonly<Record<number, string>> = {
  0: 'M16.5 29 C15 14 24 8.5 32 8.5 C41 8.5 49 14 47.5 29 C46 24 43 20 38 18.5 C32 21 24 21 19 25 C18 26 17 27.5 16.5 29 Z',
  1: 'M16.5 29 C15 13 24 8.5 32 8.5 C41 8.5 49 13 47.5 29 L46 24 C44 22 40 21 32 21 C24 21 20 22 18 24 Z',
  2: 'M16.5 30 C14.5 14 24 8 32 8 C41 8 49.5 14 47.5 30 C46 23 41 17 36 17 C30 22 22 22 18 27 Z',
  3: 'M16 32 C14 14 24 8 32 8 C40 8 50 14 48 32 C46 24 40 16 32 16 C24 16 18 24 16 32 Z',
  5: 'M16.5 29 C15 14 24 8.5 32 8.5 C41 8.5 49 14 47.5 29 C45 21 40 17 32 17 C25 17 20 21 16.5 29 Z',
  6: 'M16.5 29 C15 14 24 8.5 32 8.5 C41 8.5 49 14 47.5 29 C45 21 40 17 32 17 C25 17 20 21 16.5 29 Z',
  7: 'M17 24 C17 14 24 10.5 32 10.5 C40 10.5 47 14 47 24 C44 17 39 15.5 32 15.5 C25 15.5 20 17 17 24 Z'
};
/** Mèches de manga : les pointes restent au-dessus des sourcils. */
const MECHES = 'M23 20.5 L25.5 24.2 L28 20 L31 27 L34 20 L37 24.2 L39.5 20.5 Z';

function cheveuxAvant(a: AvatarEleve, f: string, trait: { s?: string; sw?: number }): Forme[] {
  if (a.coiffure === 4) return touffe([[21.5, 20, 5], [27.5, 15.5, 5.5], [36.5, 15.5, 5.5], [42.5, 20, 5], [32, 13, 5.5], [17.5, 27, 3.5], [46.5, 27, 3.5]], f, trait);
  const d = CALOTTE[a.coiffure] ?? CALOTTE[0]!;
  const res: Forme[] = [{ t: 'path', d, f, ...trait }];
  if (a.style === 'manga' && [0, 1, 2, 5, 6].includes(a.coiffure)) res.push({ t: 'path', d: MECHES, f });
  return res;
}

/* ───────── visage (vectoriel) ───────── */

function oeil(style: StyleAvatar, cx: number, ouvert: boolean, e: number, encre: string): Forme[] {
  const y = 31.2;
  if (!ouvert) return [{ t: 'path', d: `M${cx - 3} 32 Q${cx} 28.4 ${cx + 3} 32`, f: 'none', s: encre, sw: style === 'bd' ? 1.9 : 1.5 }];
  switch (style) {
    case 'manga': {
      const ry = 3.5 * e;
      const haut = y - ry;
      return [
        { t: 'ellipse', cx, cy: y, rx: 2.5 * e, ry, f: '#2A1F2D' },
        { t: 'circle', cx: cx - 0.8, cy: y - 1.2 * e, r: 0.95 * e, f: '#ffffff' },
        { t: 'path', d: `M${cx - 3.4 * e} ${haut + 0.7} Q${cx} ${haut - 1.3} ${cx + 3.4 * e} ${haut + 0.5}`, f: 'none', s: '#2A1F2D', sw: 1.3 }
      ];
    }
    case 'bd': return [{ t: 'ellipse', cx, cy: y, rx: 1.5 * e, ry: 2 * e, f: encre }];
    case 'cartoon': return [
      { t: 'ellipse', cx, cy: y, rx: 3.3 * e, ry: 3.7 * e, f: '#ffffff', s: ENCRE, sw: 1.2 },
      { t: 'circle', cx: cx + 0.5, cy: y + 0.3, r: 1.6 * e, f: ENCRE }
    ];
    default: return [{ t: 'circle', cx, cy: y, r: 1.8 * e, f: encre }];
  }
}

function yeux(style: StyleAvatar, visage: number, encre: string): Forme[] {
  switch (visage) {
    case 1: return [...oeil(style, 26, false, 1, encre), ...oeil(style, 38, false, 1, encre)];
    case 3: return [...oeil(style, 26, true, 1.25, encre), ...oeil(style, 38, true, 1.25, encre)];
    case 4: return [...oeil(style, 26, true, 1, encre), ...oeil(style, 38, false, 1, encre)];
    default: return [...oeil(style, 26, true, 1, encre), ...oeil(style, 38, true, 1, encre)];
  }
}

function sourcils(style: StyleAvatar, visage: number, couleur: string): Forme[] {
  if (style === 'minimal') return [];
  const sw = style === 'bd' ? 1.8 : 1.3;
  const g = (d: string): Forme => ({ t: 'path', d, f: 'none', s: couleur, sw });
  switch (visage) {
    case 2: return [g('M22.6 25.6 L29.4 26.8'), g('M34.6 26.8 L41.4 25.6')];
    case 3: return [g('M22.6 25.4 Q26 23 29.4 25'), g('M34.6 25 Q38 23 41.4 25.4')];
    case 4: return [g('M22.6 26.8 Q26 25 29.4 26.4'), g('M34.6 24.6 Q38 22.6 41.4 25')];
    default: return [g('M22.6 26.8 Q26 25 29.4 26.4'), g('M34.6 26.4 Q38 25 41.4 26.8')];
  }
}

function bouche(style: StyleAvatar, visage: number, encre: string): Forme[] {
  const sw = style === 'bd' ? 1.8 : 1.4;
  const trait = (d: string): Forme => ({ t: 'path', d, f: 'none', s: encre, sw });
  switch (visage) {
    case 1: return [{ t: 'path', d: 'M26.8 37.8 Q32 45 37.2 37.8 Z', f: BOUCHE, s: ENCRE, sw: 1.1 }];
    case 2: return [trait('M28.5 39.8 L35.5 39.8')];
    case 3: return [{ t: 'ellipse', cx: 32, cy: 40.2, rx: 2.3, ry: 3, f: BOUCHE, s: ENCRE, sw: 1 }];
    case 4: return [trait('M27.5 38.2 Q33 43 37.5 37.4')];
    default: return [trait('M27.5 38.5 Q32 42.5 36.5 38.5')];
  }
}

/* ───────── accessoires (vectoriel) ───────── */

function lunettes(carrees: boolean): Forme[] {
  const m = { f: 'none', s: MONTURE, sw: 1.5 };
  const verres: Forme[] = carrees
    ? [{ t: 'rect', x: 20.6, y: 27, w: 10.8, h: 8.4, rx: 2.2, ...m }, { t: 'rect', x: 32.6, y: 27, w: 10.8, h: 8.4, rx: 2.2, ...m }]
    : [{ t: 'circle', cx: 26, cy: 31.2, r: 5.2, ...m }, { t: 'circle', cx: 38, cy: 31.2, r: 5.2, ...m }];
  const gauche = carrees ? 20.6 : 20.8;
  const droite = carrees ? 43.4 : 43.2;
  return [
    ...verres,
    { t: 'path', d: 'M31.4 30.5 L32.6 30.5', ...m },
    { t: 'path', d: `M${gauche} 30.2 L${gauche - 3.2} 29.2`, ...m },
    { t: 'path', d: `M${droite} 30.2 L${droite + 3.2} 29.2`, ...m }
  ];
}

function casque(bord: number): Forme[] {
  return [
    { t: 'path', d: `M${bord - 1} 30 C${bord - 3.5} 3 ${64 - bord + 3.5} 3 ${64 - bord + 1} 30`, f: 'none', s: '#2F3A4F', sw: 3 },
    { t: 'rect', x: bord - 4, y: 27, w: 5.4, h: 11, rx: 2.7, f: 'haut', s: '#2F3A4F', sw: 1 },
    { t: 'rect', x: 64 - bord - 1.4, y: 27, w: 5.4, h: 11, rx: 2.7, f: 'haut', s: '#2F3A4F', sw: 1 }
  ];
}

const casquette = (trait: { s?: string; sw?: number }): Forme[] => [
  { t: 'path', d: 'M16 22.5 C16 9 24 6.5 32 6.5 C40 6.5 48 9 48 22.5 Z', f: 'haut', ...trait },
  { t: 'path', d: 'M42 21.5 C51 20.5 58 23 58 26 C52 27 46 26.5 40 25.5 Z', f: 'haut', ...trait },
  { t: 'path', d: 'M42 21.5 C51 20.5 58 23 58 26 C52 27 46 26.5 40 25.5 Z', f: '#000000', o: 0.22 }
];

/* ───────── assemblage vectoriel ───────── */

function dessinerVectoriel(a: AvatarEleve): Forme[] {
  const style = a.style as 'manga' | 'bd' | 'cartoon' | 'minimal';
  const peau = TEINTS[a.teint]!;
  const cheveux = CHEVEUX[a.cheveux]!;
  const T = TRAIT[style];
  const minimal = style === 'minimal';
  const bord = BORD[style];
  const formes: Forme[] = [{ t: 'rect', x: 0, y: 0, w: 64, h: 64, f: 'fond' }];

  formes.push(...cheveuxArriere(a.coiffure, cheveux, T));
  if (!minimal) formes.push({ t: 'rect', x: 27, y: 40, w: 10, h: 12, rx: 2, f: ombre(peau, 0.12), ...T });
  formes.push({ t: 'path', d: 'M5 64 C5 53 17 49 32 49 C47 49 59 53 59 64 Z', f: 'haut', ...T });
  if (!minimal) formes.push({ t: 'path', d: 'M26.5 49.6 L32 56 L37.5 49.6 Z', f: ombre(peau, 0.12) });
  if (!minimal) {
    formes.push({ t: 'circle', cx: bord, cy: 31, r: 2.8, f: peau, ...T }, { t: 'circle', cx: 64 - bord, cy: 31, r: 2.8, f: peau, ...T });
  }
  formes.push(minimal
    ? { t: 'circle', cx: 32, cy: 29, r: 14, f: peau }
    : { t: 'path', d: TETE[style], f: peau, ...T });

  if (style === 'manga' || style === 'cartoon') {
    const [gx, dx, r] = style === 'manga' ? [24, 40, 2.2] : [22, 42, 2.4];
    formes.push({ t: 'circle', cx: gx, cy: 37.2, r, f: '#E8837C', o: 0.4 }, { t: 'circle', cx: dx, cy: 37.2, r, f: '#E8837C', o: 0.4 });
  }
  formes.push(...cheveuxAvant(a, cheveux, T));
  formes.push(...sourcils(style, a.visage, ombre(cheveux, 0.35)));
  const encre = encreDe(a.teint);
  formes.push(...yeux(style, a.visage, encre));
  if (style === 'bd') formes.push({ t: 'path', d: 'M32 33.2 L31.2 36.6 L33 36.6', f: 'none', s: ombre(peau, 0.35), sw: 1.3 });
  formes.push(...bouche(style, a.visage, encre));

  switch (a.accessoire) {
    case 1: formes.push(...lunettes(false)); break;
    case 2: formes.push(...lunettes(true)); break;
    case 3: formes.push(...casque(bord)); break;
    case 4: formes.push(...casquette(T)); break;
    default: break;
  }
  return formes;
}

/* ───────── pixel ───────── */

type Rangee = readonly [y: number, x1: number, x2: number];

const COURTE: Rangee[] = [[2, 5, 10], [3, 4, 11], [4, 4, 6], [4, 9, 11], [5, 4, 4], [5, 11, 11]];
const CHEVEUX_PIXEL: Readonly<Record<number, Rangee[]>> = {
  0: COURTE,
  1: [[2, 5, 10], [3, 4, 11], [4, 4, 11], [5, 4, 4], [5, 11, 11]],
  2: [[2, 5, 10], [3, 4, 11], [4, 3, 6], [4, 9, 12], [5, 3, 4], [5, 11, 12], [6, 3, 4], [6, 11, 12], [7, 3, 4], [7, 11, 12], [8, 3, 3], [8, 12, 12]],
  3: [[2, 5, 10], [3, 4, 11], [4, 3, 12], ...[5, 6, 7, 8, 9, 10, 11, 12, 13].flatMap((y): Rangee[] => [[y, 3, 4], [y, 11, 12]])],
  4: [[1, 5, 10], [2, 4, 11], [3, 3, 12], [4, 3, 5], [4, 10, 12], [5, 3, 3], [5, 12, 12], [6, 3, 3], [6, 12, 12], [7, 3, 3], [7, 12, 12]],
  5: [...COURTE, [4, 12, 12], [5, 13, 13], [6, 13, 13], [7, 13, 13], [8, 12, 12]],
  6: [...COURTE, [0, 7, 8], [1, 6, 9]],
  7: [[3, 5, 10], [4, 4, 4], [4, 11, 11]]
};

function dessinerPixel(a: AvatarEleve): Forme[] {
  const peau = TEINTS[a.teint]!;
  const cheveux = CHEVEUX[a.cheveux]!;
  const C = 4;
  const encre = encreDe(a.teint);
  const formes: Forme[] = [{ t: 'rect', x: 0, y: 0, w: 64, h: 64, f: 'fond' }];
  const ligne = (y: number, x1: number, x2: number, f: string): void => { formes.push({ t: 'rect', x: x1 * C, y: y * C, w: (x2 - x1 + 1) * C, h: C, f }); };
  const cellule = (x: number, y: number, f: string): void => ligne(y, x, x, f);

  ligne(11, 6, 9, ombre(peau, 0.12));
  ligne(12, 4, 11, 'haut');
  for (const y of [13, 14, 15]) ligne(y, 2, 13, 'haut');
  for (let y = 3; y <= 9; y += 1) ligne(y, 4, 11, peau);
  ligne(10, 5, 10, peau);
  cellule(3, 7, peau); cellule(12, 7, peau);
  for (const [y, x1, x2] of CHEVEUX_PIXEL[a.coiffure] ?? COURTE) ligne(y, x1, x2, cheveux);

  // Yeux
  const ferme = (x: number): void => { formes.push({ t: 'rect', x: x * C, y: 7 * C + 1, w: C, h: 2, f: encre }); };
  const ouvert = (x: number, grand: boolean): void => { if (grand) cellule(x, 6, encre); cellule(x, 7, encre); };
  switch (a.visage) {
    case 1: ferme(6); ferme(9); break;
    case 3: ouvert(6, true); ouvert(9, true); break;
    case 4: ouvert(6, false); ferme(9); break;
    default: ouvert(6, false); ouvert(9, false);
  }
  // Bouche
  switch (a.visage) {
    case 1: cellule(6, 9, encre); cellule(9, 9, encre); ligne(9, 7, 8, BOUCHE); ligne(10, 7, 8, encre); break;
    case 2: ligne(9, 7, 8, encre); break;
    case 3: ligne(9, 7, 8, BOUCHE); ligne(10, 7, 8, BOUCHE); break;
    default: cellule(6, 9, encre); cellule(9, 9, encre); ligne(10, 7, 8, encre);
  }
  // Accessoires
  switch (a.accessoire) {
    case 1: case 2: {
      const carre = a.accessoire === 2;
      for (const y of [6, 8]) { if (carre) { ligne(y, 5, 6, MONTURE); ligne(y, 9, 10, MONTURE); } else { cellule(6, y, MONTURE); cellule(9, y, MONTURE); } }
      for (const x of [5, 7, 8, 10]) cellule(x, 7, MONTURE);
      break;
    }
    case 3:
      ligne(1, 5, 10, '#2F3A4F'); cellule(4, 2, '#2F3A4F'); cellule(11, 2, '#2F3A4F');
      for (const y of [3, 4, 5]) { cellule(3, y, '#2F3A4F'); cellule(12, y, '#2F3A4F'); }
      for (const y of [6, 7, 8]) { cellule(3, y, 'haut'); cellule(12, y, 'haut'); }
      break;
    case 4:
      ligne(2, 5, 10, 'haut'); ligne(3, 4, 11, 'haut');
      ligne(4, 4, 13, '#2B2540');
      break;
    default: break;
  }
  return formes;
}

/** Les formes à dessiner pour ce choix (viewBox 0 0 64 64). Même choix → mêmes formes. */
export function dessiner(a: AvatarEleve): Forme[] {
  return a.style === 'pixel' ? dessinerPixel(a) : dessinerVectoriel(a);
}

/** Nombre de valeurs possibles pour chaque option (pour valider et tirer au hasard). */
export const NB_OPTIONS = {
  style: STYLES_AVATAR.length,
  teint: TEINTS.length,
  cheveux: CHEVEUX.length,
  coiffure: COIFFURES_LIBELLES.length,
  visage: VISAGES_LIBELLES.length,
  accessoire: ACCESSOIRES_LIBELLES.length
} as const;
