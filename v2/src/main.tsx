import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { creerDepotIndexedDb } from './data/indexeddb.ts';
import { creerDepotMemoire } from './data/memoire.ts';
import { creerMagasin } from './state/store.ts';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/layout.css';
import './ui/styles/seance.css';
import './ui/styles/agenda.css';
import './ui/styles/eleves.css';

async function demarrer() {
  // Repli en mémoire si IndexedDB est indisponible (navigation privée, par exemple).
  const depot = await creerDepotIndexedDb().catch(() => creerDepotMemoire());
  const magasin = creerMagasin(depot);
  const racine = document.getElementById('root');
  if (!racine) throw new Error('Élément #root introuvable');
  createRoot(racine).render(<StrictMode><App magasin={magasin} /></StrictMode>);
}

void demarrer();
