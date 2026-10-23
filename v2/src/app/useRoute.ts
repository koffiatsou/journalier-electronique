import { useEffect, useState } from 'react';

export type Page = 'accueil' | 'agenda' | 'seance' | 'eleves' | 'rapports';
const PAGES: readonly Page[] = ['accueil', 'agenda', 'seance', 'eleves', 'rapports'];

function lire(): Page {
  const h = globalThis.location.hash.replace(/^#\/?/, '');
  return (PAGES as readonly string[]).includes(h) ? (h as Page) : 'accueil';
}

/** Navigation par fragment d'URL (#/seance) : fonctionne sur GitHub Pages sans configuration serveur. */
export function useRoute(): [Page, (p: Page) => void] {
  const [page, setPage] = useState<Page>(lire);
  useEffect(() => {
    const f = () => setPage(lire());
    globalThis.addEventListener('hashchange', f);
    return () => globalThis.removeEventListener('hashchange', f);
  }, []);
  return [page, (p) => { globalThis.location.hash = `/${p}`; }];
}
