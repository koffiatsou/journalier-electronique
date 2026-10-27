/* Validation, tirage au hasard et description des avatars (fonctions pures). */
import { NB_OPTIONS } from './dessin.ts';
import {
  ACCESSOIRES_LIBELLES, CHEVEUX_LIBELLES, COIFFURES_LIBELLES, STYLES_AVATAR, STYLES_LIBELLES, TEINTS_LIBELLES, VISAGES_LIBELLES
} from './types.ts';
import type { AvatarEleve, StyleAvatar } from './types.ts';

export const AVATAR_PAR_DEFAUT: AvatarEleve = { style: 'cartoon', teint: 1, cheveux: 1, coiffure: 0, visage: 0, accessoire: 0 };

const rang = (v: unknown, nb: number): number => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < nb ? v : 0);

/**
 * Relit un avatar venu du stockage : style inconnu → pas d'avatar (initiales) ;
 * une option illisible revient à sa première valeur. Les champs inconnus sont ignorés.
 */
export function normaliserAvatar(brut: unknown): AvatarEleve | undefined {
  if (typeof brut !== 'object' || brut === null) return undefined;
  const o = brut as Record<string, unknown>;
  const style = STYLES_AVATAR.find((s) => s === o.style);
  if (!style) return undefined;
  return {
    style,
    teint: rang(o.teint, NB_OPTIONS.teint),
    cheveux: rang(o.cheveux, NB_OPTIONS.cheveux),
    coiffure: rang(o.coiffure, NB_OPTIONS.coiffure),
    visage: rang(o.visage, NB_OPTIONS.visage),
    accessoire: rang(o.accessoire, NB_OPTIONS.accessoire)
  };
}

/** Avatar tiré au hasard (une fois sur deux sans accessoire). `alea` renvoie un nombre dans [0, 1[ ; fixé dans les tests. */
export function avatarAuHasard(alea: () => number = Math.random, style?: StyleAvatar): AvatarEleve {
  const tire = (nb: number): number => Math.min(nb - 1, Math.floor(alea() * nb));
  return {
    style: style ?? STYLES_AVATAR[tire(NB_OPTIONS.style)]!,
    teint: tire(NB_OPTIONS.teint),
    cheveux: tire(NB_OPTIONS.cheveux),
    coiffure: tire(NB_OPTIONS.coiffure),
    visage: tire(NB_OPTIONS.visage),
    accessoire: alea() < 0.5 ? 0 : 1 + tire(NB_OPTIONS.accessoire - 1)
  };
}

export const memeAvatar = (a: AvatarEleve | undefined, b: AvatarEleve | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && a.style === b.style && a.teint === b.teint && a.cheveux === b.cheveux
    && a.coiffure === b.coiffure && a.visage === b.visage && a.accessoire === b.accessoire);

/** Phrase lue par les lecteurs d'écran, ex. « Avatar manga : cheveux bruns, coiffure frange, visage content ». */
export function descriptionAvatar(a: AvatarEleve): string {
  const acc = a.accessoire ? `, ${ACCESSOIRES_LIBELLES[a.accessoire]!.toLowerCase()}` : '';
  return `Avatar ${STYLES_LIBELLES[a.style].toLowerCase()} : teint ${TEINTS_LIBELLES[a.teint]!.toLowerCase()}, cheveux ${CHEVEUX_LIBELLES[a.cheveux]!.toLowerCase()}, `
    + `coiffure ${COIFFURES_LIBELLES[a.coiffure]!.toLowerCase()}, visage ${VISAGES_LIBELLES[a.visage]!.toLowerCase()}${acc}`;
}
