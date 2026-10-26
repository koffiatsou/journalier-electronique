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
export const IconeReunion = (p: IconeProps) => trace(<><path d="M5 20V10M12 20V4M19 20v-7" /></>, p);
export const IconeFeuille = (p: IconeProps) => trace(<><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 12h7M9 16h7" /></>, p);
export const IconeJournalier = (p: IconeProps) => trace(<><path d="M6 3h11a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6z" /><path d="M6 3v18M10 8h5M10 12h5" /></>, p);

export const IconeSynchro = (p: IconeProps) => trace(<><path d="M20 12a8 8 0 0 0-14-5.3L4 9" /><path d="M4 4v5h5" /><path d="M4 12a8 8 0 0 0 14 5.3L20 15" /><path d="M20 20v-5h-5" /></>, p);
