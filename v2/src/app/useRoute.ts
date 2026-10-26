import { useEffect, useState } from 'react';

export type Page = 'accueil' | 'agenda' | 'seance' | 'journalier' | 'eleves' | 'reunion';
const PAGES: readonly Page[] = ['accueil', 'agenda', 'seance', 'journalier', 'eleves', 'reunion'];

/** Paramètres facultatifs après la page : #/journalier?eleve=… ou #/reunion?eleve=… */
export type Parametres = Record<string, string>;
export type Aller = (p: Page, parametres?: Parametres) => void;

function lire(): { page: Page; parametres: Parametres } {
  const [chemin = '', requete = ''] = globalThis.location.hash.replace(/^#\/?/, '').split('?');
  const page = (PAGES as readonly string[]).includes(chemin) ? (chemin as Page) : 'accueil';
  return { page, parametres: Object.fromEntries(new URLSearchParams(requete)) };
}

/** Navigation par fragment d'URL (#/seance) : fonctionne sur GitHub Pages sans configuration serveur. */
export function useRoute(): [Page, Aller, Parametres] {
  const [route, setRoute] = useState(lire);
  useEffect(() => {
    const f = () => setRoute(lire());
    globalThis.addEventListener('hashchange', f);
    return () => globalThis.removeEventListener('hashchange', f);
  }, []);
  const aller: Aller = (p, parametres) => {
    const q = parametres ? new URLSearchParams(parametres).toString() : '';
    globalThis.location.hash = `/${p}${q ? `?${q}` : ''}`;
  };
  return [route.page, aller, route.parametres];
}
