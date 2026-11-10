/**
 * Position de défilement de chaque écran visité, pour la retrouver avec le bouton « Précédent » du navigateur.
 *
 * Pourquoi : le contenu de l'écran est remplacé par React APRÈS le changement d'adresse ; quand le navigateur restitue
 * « tout seul » la position, la nouvelle page est encore vide ou courte et la position retombe à 0. On la mémorise donc
 * nous-mêmes, par ENTRÉE de l'historique : chaque entrée reçoit une clé dans `history.state`.
 *  - une entrée neuve (clic dans le menu, lien) n'a pas encore de clé : on arrive en haut de page ;
 *  - une entrée déjà visitée (« Précédent » / « Suivant ») a sa clé : on retrouve sa position.
 */

/** Ce dont la mémoire a besoin de l'historique du navigateur. */
export interface Historique {
  readonly state: unknown;
  replaceState(etat: unknown, titre: string): void;
}

interface EtatMarque { cleDefilement?: string }

const cleDe = (etat: unknown): string | undefined =>
  (typeof etat === 'object' && etat !== null ? (etat as EtatMarque).cleDefilement : undefined);

export function creerMemoirePositions(historique: Historique, nouvelleCle: () => string = () => globalThis.crypto.randomUUID()) {
  const positions = new Map<string, number>();
  /** Gelée entre le changement d'adresse et le dessin du nouvel écran : le navigateur y fait défiler la page malgré nous. */
  let gelee = false;

  return {
    /** Donne une clé à l'entrée courante de l'historique si elle n'en a pas (on garde le reste de son état). */
    marquer(): void {
      if (cleDe(historique.state)) return;
      const reste = typeof historique.state === 'object' && historique.state !== null ? historique.state : {};
      historique.replaceState({ ...reste, cleDefilement: nouvelleCle() }, '');
    },
    /** Retient la position de l'entrée courante (ignorée pendant un changement d'écran, ou sans clé). */
    noter(y: number): void {
      const cle = cleDe(historique.state);
      if (!gelee && cle) positions.set(cle, y);
    },
    /** À appeler dès que l'adresse change. */
    geler(): void { gelee = true; },
    /** À appeler une fois le nouvel écran dessiné et la position posée. */
    degeler(): void { gelee = false; },
    /** Position à reprendre pour l'entrée courante : `undefined` pour une entrée neuve (on arrive en haut). */
    aReprendre(): number | undefined {
      const cle = cleDe(historique.state);
      return cle ? positions.get(cle) : undefined;
    }
  };
}

export type MemoirePositions = ReturnType<typeof creerMemoirePositions>;

/** Délai de secours : au-delà, la mémoire se dégèle même si l'écran n'a pas posé sa position. */
const DELAI_DEGEL_MS = 600;

/** Branche la mémoire sur la fenêtre : marque l'entrée courante, suit le défilement, gèle pendant les changements d'adresse. */
export function installerPositions(memoire: MemoirePositions, fenetre: Window = window): () => void {
  memoire.marquer();
  let secours: ReturnType<typeof setTimeout> | undefined;
  const surDefilement = () => memoire.noter(fenetre.scrollY);
  const surChangement = () => {
    memoire.geler();
    clearTimeout(secours);
    secours = setTimeout(() => memoire.degeler(), DELAI_DEGEL_MS);
    // Une entrée neuve reçoit sa clé tout de suite ; une entrée déjà visitée garde la sienne.
    memoire.marquer();
  };
  fenetre.addEventListener('scroll', surDefilement, { passive: true });
  fenetre.addEventListener('hashchange', surChangement);
  fenetre.addEventListener('popstate', surChangement);
  return () => {
    clearTimeout(secours);
    fenetre.removeEventListener('scroll', surDefilement);
    fenetre.removeEventListener('hashchange', surChangement);
    fenetre.removeEventListener('popstate', surChangement);
  };
}

/** Mémoire unique de l'application (une seule fenêtre). */
let memoireGlobale: MemoirePositions | null = null;
export const memoirePositions = (): MemoirePositions => (memoireGlobale ??= creerMemoirePositions(globalThis.history));
