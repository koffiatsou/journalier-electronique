import { useState } from 'react';
import type { ReactNode } from 'react';
import { appliquerTheme, themeEnregistre, themeSuivant } from '../ui/theme.ts';
import type { Theme } from '../ui/theme.ts';
import { IconeAccueil, IconeAgenda, IconeEleves, IconeJournalier, IconeReunion, IconeSeance } from '../ui/icons.tsx';
import type { Aller, Page } from './useRoute.ts';

const NAV: { page: Page; libelle: string; icone: (p: { taille?: number }) => ReactNode }[] = [
  { page: 'accueil', libelle: 'Accueil', icone: IconeAccueil },
  { page: 'agenda', libelle: 'Agenda', icone: IconeAgenda },
  { page: 'seance', libelle: 'Séance', icone: IconeSeance },
  { page: 'journalier', libelle: 'Journalier', icone: IconeJournalier },
  { page: 'eleves', libelle: 'Élèves', icone: IconeEleves },
  { page: 'pia', libelle: 'PIA', icone: IconeReunion }
];

/** Cadre de l'application : rail latéral sur grand écran, barre d'onglets en bas sur mobile. */
const THEMES: Record<Theme, { symbole: string; libelle: string }> = {
  auto: { symbole: '◐', libelle: 'Automatique' },
  clair: { symbole: '☀', libelle: 'Clair' },
  sombre: { symbole: '☾', libelle: 'Sombre' }
};

export function Shell({ page, onAller, children }: { page: Page; onAller: Aller; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(themeEnregistre);
  const suivant = themeSuivant(theme);
  return (
    <div className="shell">
      <nav className="nav" aria-label="Navigation principale">
        <div className="marque">
          <img className="marque-logo" src="./logo-poles-territoriaux.svg" alt="Logo des Pôles territoriaux" width="150" height="103" />
          <span className="marque-texte"><strong>Journalier</strong><small>Pôle territorial WBE BXL</small></span>
        </div>
        <ul>
          {NAV.map(({ page: p, libelle, icone: Icone }) => (
            <li key={p}>
              <a href={`#/${p}`} className="nav-lien" aria-current={page === p ? 'page' : undefined}
                onClick={(e) => { e.preventDefault(); onAller(p); }}>
                <Icone taille={20} />
                <span>{libelle}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <button type="button" className="theme-bouton" title={`Thème : ${THEMES[theme].libelle}. Passer à : ${THEMES[suivant].libelle}`}
        aria-label={`Thème : ${THEMES[theme].libelle}. Passer à : ${THEMES[suivant].libelle}`}
        onClick={() => { setTheme(suivant); appliquerTheme(suivant); }}>
        <span aria-hidden="true">{THEMES[theme].symbole}</span><span className="theme-texte">{THEMES[theme].libelle}</span>
      </button>
      <main className="contenu" id="contenu">{children}</main>
    </div>
  );
}
