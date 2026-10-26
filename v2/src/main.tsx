import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { creerDepotIndexedDb } from './data/indexeddb.ts';
import { creerDepotMemoire } from './data/memoire.ts';
import { appliquerTheme, themeEnregistre } from './ui/theme.ts';
import { creerMagasin } from './state/store.ts';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/layout.css';
import './ui/styles/seance.css';
import './ui/styles/agenda.css';
import './ui/styles/eleves.css';
import './ui/styles/reunion.css';
import './ui/styles/pia.css';

// Thème choisi sur cet appareil, appliqué avant l'affichage pour éviter un éclair clair.
appliquerTheme(themeEnregistre(), false);

async function demarrer() {
  // Repli en mémoire si IndexedDB est indisponible (navigation privée, par exemple).
  const depot = await creerDepotIndexedDb().catch(() => creerDepotMemoire());
  const magasin = creerMagasin(depot);
  // Un brouillon de PIA ne doit pas se perdre si l'on ferme l'onglet ou change d'application.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void magasin.viderEnregistrements(); });
  globalThis.addEventListener('pagehide', () => { void magasin.viderEnregistrements(); });
  const racine = document.getElementById('root');
  if (!racine) throw new Error('Élément #root introuvable');
  createRoot(racine).render(<StrictMode><App magasin={magasin} /></StrictMode>);
}

void demarrer();
