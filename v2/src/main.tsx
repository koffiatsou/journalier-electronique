import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Racine } from './app/Racine.tsx';
import { appliquerTheme, themeEnregistre } from './ui/theme.ts';
import { CANAL_RETOUR, Connexion, IDENTIFIANTS_MICROSOFT } from './synchro/connexion.ts';
import type { MessageRetour, Stockage } from './synchro/connexion.ts';
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
import './ui/styles/reprise.css';
import './ui/styles/verrou.css';

// Thème choisi sur cet appareil, appliqué avant l'affichage pour éviter un éclair clair.
appliquerTheme(themeEnregistre(), false);

/*
 * Ici on ne lit AUCUNE donnée : on prépare seulement ce qui sert à ouvrir le Journalier (stockages du navigateur,
 * connexion Microsoft). Les données ne sont lues qu'une fois le coffre ouvert (voir app/Racine.tsx).
 */
function demarrer() {
  // Stockages du navigateur : ils peuvent être indisponibles (navigation privée) ; on se rabat alors sur la mémoire.
  const memoire = (): Stockage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } }; };
  const stockage = (nom: 'localStorage' | 'sessionStorage'): Stockage => { try { return globalThis[nom]; } catch { return memoire(); } };
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
  const racine = document.getElementById('root');
  if (!racine) throw new Error('Élément #root introuvable');
  const env = { local: stockage('localStorage'), session: stockage('sessionStorage'), connexion };
  createRoot(racine).render(<StrictMode><Racine env={env} adresseRetour={adresseRetour} /></StrictMode>);
}

demarrer();
