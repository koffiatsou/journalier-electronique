import type { ReactNode } from 'react';
import { IconeAccueil, IconeAgenda, IconeEleves, IconeRapports, IconeSeance } from '../ui/icons.tsx';
import type { Page } from './useRoute.ts';

const NAV: { page: Page; libelle: string; icone: (p: { taille?: number }) => ReactNode }[] = [
  { page: 'accueil', libelle: 'Accueil', icone: IconeAccueil },
  { page: 'agenda', libelle: 'Agenda', icone: IconeAgenda },
  { page: 'seance', libelle: 'Séance', icone: IconeSeance },
  { page: 'eleves', libelle: 'Élèves', icone: IconeEleves },
  { page: 'rapports', libelle: 'Rapports', icone: IconeRapports }
];

/** Cadre de l'application : rail latéral sur grand écran, barre d'onglets en bas sur mobile. */
export function Shell({ page, onAller, children }: { page: Page; onAller: (p: Page) => void; children: ReactNode }) {
  return (
    <div className="shell">
      <nav className="nav" aria-label="Navigation principale">
        <div className="marque">
          <span className="marque-logo" aria-hidden="true">J</span>
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
      <main className="contenu" id="contenu">{children}</main>
    </div>
  );
}
