import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { creerDepotIndexedDb } from './data/indexeddb.ts';
import { creerDepotMemoire } from './data/memoire.ts';
import { appliquerTheme, themeEnregistre } from './ui/theme.ts';
import { creerMagasin } from './state/store.ts';
import { CANAL_RETOUR, Connexion, IDENTIFIANTS_MICROSOFT } from './synchro/connexion.ts';
import type { MessageRetour, Stockage } from './synchro/connexion.ts';
import { NuageSimule } from './synchro/simule.ts';
import { creerSynchro } from './synchro/service.ts';
import './ui/styles/tokens.css';
import './ui/styles/base.css';
import './ui/styles/components.css';
import './ui/styles/layout.css';
import './ui/styles/seance.css';
import './ui/styles/agenda.css';
import './ui/styles/eleves.css';
import './ui/styles/reunion.css';
import './ui/styles/pia.css';
import './ui/styles/synchro.css';

// Thème choisi sur cet appareil, appliqué avant l'affichage pour éviter un éclair clair.
appliquerTheme(themeEnregistre(), false);

async function demarrer() {
  // Repli en mémoire si IndexedDB est indisponible (navigation privée, par exemple).
  const depot = await creerDepotIndexedDb().catch(() => creerDepotMemoire());
  const magasin = creerMagasin(depot);
  // Un brouillon de PIA ne doit pas se perdre si l'on ferme l'onglet ou change d'application.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void magasin.viderEnregistrements(); });
  globalThis.addEventListener('pagehide', () => { void magasin.viderEnregistrements(); });
  // Stockages du navigateur : ils peuvent être indisponibles (navigation privée) ; on se rabat alors sur la mémoire.
  const memoire = (): Stockage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } }; };
  const stockage = (nom: 'localStorage' | 'sessionStorage'): Stockage => { try { return globalThis[nom]; } catch { return memoire(); } };
  const local = stockage('localStorage');
  const adresseRetour = new URL('./msal-redirect.html', globalThis.location.href.split('#')[0]).href;
  const connexion = new Connexion({
    config: { ...IDENTIFIANTS_MICROSOFT, adresseRetour },
    stockage: stockage('sessionStorage'),
    ouvrirFenetre: (adresse) => {
      const f = globalThis.open(adresse, 'journalier-microsoft', 'popup,width=520,height=720');
      return f ? { fermer: () => f.close() } : null;
    },
    ecouterRetour: (rappel) => {
      const canal = new BroadcastChannel(CANAL_RETOUR);
      canal.onmessage = (ev: MessageEvent<MessageRetour>) => rappel(ev.data);
      return () => canal.close();
    }
  });
  const demo = new NuageSimule({
    lire: () => { try { return local.getItem('journalier-demo-nuage'); } catch { return null; } },
    ecrire: (t) => { try { local.setItem('journalier-demo-nuage', t); } catch { /* simulation non gardée */ } }
  });
  const synchro = creerSynchro({ magasin, depot, connexion, demo, preferences: local });
  const racine = document.getElementById('root');
  if (!racine) throw new Error('Élément #root introuvable');
  createRoot(racine).render(<StrictMode><App magasin={magasin} synchro={synchro} adresseRetour={adresseRetour} /></StrictMode>);
}

void demarrer();
