/** Largeur minimale d'une carte (comme l'ancienne grille `minmax(220px, 1fr)`) et espace entre deux cartes, en pixels. */
export const LARGEUR_CARTE_MIN = 220;
export const ECART_CARTES = 12;
/** Estimation de la hauteur d'une carte : lignes de texte (≈ 7,6 px par caractère en gras) + marges, titre et bouton. */
const PIXELS_PAR_CARACTERE = 7.6;
const HAUTEUR_LIGNE = 20;
const HAUTEUR_FIXE = 84;
/** Marge intérieure horizontale d'une carte (2 × 16 px). */
const MARGE_HORIZONTALE = 32;

/** Nombre de colonnes de cartes qui tiennent dans la largeur disponible (au moins une). */
export function nombreDeColonnes(largeur: number): number {
  if (!(largeur > 0)) return 1;
  return Math.max(1, Math.floor((largeur + ECART_CARTES) / (LARGEUR_CARTE_MIN + ECART_CARTES)));
}

/** Hauteur estimée d'une carte dont le texte fait `longueur` caractères dans une colonne de `largeurColonne` pixels. */
export function hauteurEstimee(longueur: number, largeurColonne: number): number {
  const caracteresParLigne = Math.max(12, Math.floor((largeurColonne - MARGE_HORIZONTALE) / PIXELS_PAR_CARACTERE));
  return Math.ceil(Math.max(1, longueur) / caracteresParLigne) * HAUTEUR_LIGNE + HAUTEUR_FIXE;
}

/**
 * Répartit des cartes (dans l'ordre, par hauteur estimée) entre `colonnes` colonnes : chaque carte va dans la colonne
 * la moins remplie, la première en cas d'égalité. Une carte haute dans une colonne laisse donc plusieurs cartes
 * courtes s'empiler dans l'autre. Renvoie, par colonne, les rangs des cartes dans l'ordre d'origine.
 * Ne dépend que du texte, jamais de l'état ouvert ou fermé d'une carte : ouvrir une carte ne déplace aucune autre carte.
 */
export function repartir(hauteurs: readonly number[], colonnes: number): number[][] {
  const n = Math.max(1, Math.floor(colonnes));
  const sortie: number[][] = Array.from({ length: n }, () => []);
  const cumul = new Array<number>(n).fill(0);
  hauteurs.forEach((h, rang) => {
    let choix = 0;
    for (let c = 1; c < n; c += 1) {
      if ((cumul[c] ?? 0) < (cumul[choix] ?? 0)) choix = c;
    }
    sortie[choix]?.push(rang);
    cumul[choix] = (cumul[choix] ?? 0) + h + ECART_CARTES;
  });
  return sortie;
}
