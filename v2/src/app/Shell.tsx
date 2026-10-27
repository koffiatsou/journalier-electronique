import { useState } from 'react';
import type { ReactNode } from 'react';
import { appliquerTheme, themeEnregistre, themeSuivant } from '../ui/theme.ts';
import type { Theme } from '../ui/theme.ts';
import { IconeAccueil, IconeAgenda, IconeAuto, IconeCadenas, IconeEleves, IconeJournalier, IconeLune, IconePia, IconeSeance, IconeSoleil, IconeSynchro } from '../ui/icons.tsx';
import type { Aller, Page } from './useRoute.ts';

const NAV: { page: Page; libelle: string; icone: (p: { taille?: number }) => ReactNode }[] = [
  { page: 'accueil', libelle: 'Accueil', icone: IconeAccueil },
  { page: 'agenda', libelle: 'Agenda', icone: IconeAgenda },
  { page: 'seance', libelle: 'Séance', icone: IconeSeance },
  { page: 'journalier', libelle: 'Journalier', icone: IconeJournalier },
  { page: 'eleves', libelle: 'Élèves', icone: IconeEleves },
  { page: 'pia', libelle: 'PIA', icone: IconePia },
  { page: 'synchro', libelle: 'Synchro', icone: IconeSynchro }
];

/**
 * Cadre de l'application : barre du haut + barre d'onglets en bas sur téléphone, menu étroit à gauche sur tablette en
 * portrait, menu large (avec le logo) sur tablette en paysage et ordinateur. Voir `layout.css`.
 */
const THEMES: Record<Theme, { icone: (p: { taille?: number }) => ReactNode; libelle: string }> = {
  auto: { icone: IconeAuto, libelle: 'Automatique' },
  clair: { icone: IconeSoleil, libelle: 'Clair' },
  sombre: { icone: IconeLune, libelle: 'Sombre' }
};

export function Shell({ page, onAller, essai, onVerrouiller, children }: { page: Page; onAller: Aller; essai: boolean; onVerrouiller: () => void; children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(themeEnregistre);
  const suivant = themeSuivant(theme);
  const IconeTheme = THEMES[theme].icone;
  return (
    <div className="shell">
      <header className="barre-haut">
        <img className="barre-haut-logo" src="./logo-poles-territoriaux.svg" alt="Logo des Pôles territoriaux" width="52" height="36" />
        <span className="barre-haut-texte"><strong>Journalier</strong><small>Pôle territorial WBE BXL</small></span>
      </header>
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
                <Icone taille={22} />
                <span>{libelle}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="outils">
        <button type="button" className="theme-bouton" title={`Thème : ${THEMES[theme].libelle}. Passer à : ${THEMES[suivant].libelle}`}
          aria-label={`Thème : ${THEMES[theme].libelle}. Passer à : ${THEMES[suivant].libelle}`}
          onClick={() => { setTheme(suivant); appliquerTheme(suivant); }}>
          <IconeTheme taille={18} /><span className="theme-texte">{THEMES[theme].libelle}</span>
        </button>
        <button type="button" className="verrouiller-bouton" title="Verrouiller le Journalier : il faudra se reconnecter pour l’ouvrir"
          aria-label="Verrouiller le Journalier" onClick={onVerrouiller}>
          <IconeCadenas taille={18} /><span className="theme-texte">Verrouiller</span>
        </button>
      </div>
      <main className="contenu" id="contenu">
        {essai ? <p className="bandeau-essai" role="note"><strong>Mode essai</strong> — données fictives seulement. N’écrivez jamais de vrais noms d’élèves ici.</p> : null}
        {children}
      </main>
    </div>
  );
}
