import type { ReactNode } from 'react';

interface IconeProps { taille?: number; className?: string }

const trace = (enfants: ReactNode, { taille = 18, className }: IconeProps) => (
  <svg
    width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}
  >
    {enfants}
  </svg>
);

export const IconeCoche = (p: IconeProps) => trace(<path d="M5 12.5l4.5 4.5L19 7.5" />, p);
export const IconeChevron = (p: IconeProps) => trace(<path d="M6 9l6 6 6-6" />, p);
export const IconeAccueil = (p: IconeProps) => trace(<><path d="M4 11l8-7 8 7" /><path d="M6 10v9h12v-9" /></>, p);
export const IconeAgenda = (p: IconeProps) => trace(<><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>, p);
export const IconeSeance = (p: IconeProps) => trace(<><path d="M5 4h11l3 3v13H5z" /><path d="M9 11h6M9 15h6" /></>, p);
export const IconeEleves = (p: IconeProps) => trace(<><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S13.9 16 14.5 19" /><circle cx="17" cy="9" r="2.3" /><path d="M16.5 14.6c2.2.1 3.6 1.4 4 3.9" /></>, p);
/** Plan individualisé : une planchette avec une coche (remplace l'ancien histogramme, qui évoquait des statistiques). */
export const IconePia = (p: IconeProps) => trace(<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v2.5a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z" /><path d="M9 12.5l1.8 1.8 3.4-3.6" /><path d="M9 18h6" /></>, p);
export const IconeCadenas = (p: IconeProps) => trace(<><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /><path d="M12 15v2" /></>, p);
export const IconeSoleil = (p: IconeProps) => trace(<><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></>, p);
export const IconeLune = (p: IconeProps) => trace(<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />, p);
export const IconeAuto = (p: IconeProps) => trace(<><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>, p);
export const IconeFeuille = (p: IconeProps) => trace(<><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h7" /></>, p);
export const IconeJournalier = (p: IconeProps) => trace(<><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z" /><path d="M6 3v18M10 8h5M10 12h5" /></>, p);

export const IconeSynchro = (p: IconeProps) => trace(<><path d="M20 12a8 8 0 0 0-14-5.3L4 9" /><path d="M4 4v5h5" /><path d="M4 12a8 8 0 0 0 14 5.3L20 15" /><path d="M20 20v-5h-5" /></>, p);
