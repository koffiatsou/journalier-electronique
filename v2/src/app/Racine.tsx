import { useCallback, useEffect, useRef, useState } from 'react';
import { ClePerdue, ErreurOuverture, Ouverture, Verrou } from '../features/verrou/Verrou.tsx';
import { CLE_MODE_SYNCHRO, messageErreur } from '../synchro/service.ts';
import { App } from './App.tsx';
import { CLE_ESSAI, chiffrementDisponible, donneesNonChiffreesPresentes, ouvrirSession, reinitialiserEspace } from './session.ts';
import type { Environnement, Nature, SessionOuverte } from './session.ts';

type Phase =
  | { nom: 'demarrage' }
  | { nom: 'verrou' }
  | { nom: 'ouverture' }
  | { nom: 'ouvert'; session: SessionOuverte }
  | { nom: 'cle-perdue'; nature: Nature; proprietaire: string; message: string }
  | { nom: 'erreur'; nature: Nature; message: string };

const sans = (f: () => void): void => { try { f(); } catch { /* stockage refusé : sans importance ici */ } };

/**
 * Racine de l'application : décide ce qu'on voit. Verrouillée tant qu'aucune session n'est ouverte ; ouverte par la
 * connexion Microsoft (espace du compte) ou par le mode essai (espace fictif). Se reverrouille quand on se déconnecte.
 */
export function Racine({ env, adresseRetour }: { env: Environnement; adresseRetour: string }) {
  const [phase, setPhase] = useState<Phase>({ nom: 'demarrage' });
  const [occupe, setOccupe] = useState(false);
  const [message, setMessage] = useState<{ genre: 'erreur' | 'info'; texte: string } | null>(null);
  const [ancienneBase, setAncienneBase] = useState(false);
  const session = useRef<SessionOuverte | null>(null);
  const ouverture = useRef(false);
  const demarre = useRef(false);

  const montrerVerrou = useCallback(async (info: { genre: 'erreur' | 'info'; texte: string } | null) => {
    setMessage(info);
    setAncienneBase(await donneesNonChiffreesPresentes());
    setPhase({ nom: 'verrou' });
  }, []);

  const ouvrir = useCallback(async (nature: Nature) => {
    if (ouverture.current) return;
    ouverture.current = true;
    setPhase({ nom: 'ouverture' });
    try {
      const r = await ouvrirSession(nature, env);
      if (r.ok) { session.current = r.session; setPhase({ nom: 'ouvert', session: r.session }); }
      else if (r.raison === 'cle-perdue') setPhase({ nom: 'cle-perdue', nature, proprietaire: r.proprietaire, message: r.message });
      else setPhase({ nom: 'erreur', nature, message: r.message });
    } catch (e) {
      setPhase({ nom: 'erreur', nature, message: `Ouverture impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}.` });
    } finally { ouverture.current = false; }
  }, [env]);

  /** Ferme la session (en écrivant d'abord ce qui attend), oublie le compte de cet onglet, affiche le verrou. */
  const verrouiller = useCallback(async (info?: string, natureSansSession?: Nature) => {
    const s = session.current;
    session.current = null;
    if (s) {
      try { await s.magasin.viderEnregistrements(); } catch { /* l'erreur d'écriture est déjà signalée dans l'état du PIA */ }
      s.fermer();
    }
    sans(() => env.session.removeItem(CLE_ESSAI));
    if ((s?.nature ?? natureSansSession) === 'compte' && env.connexion.compte()) env.connexion.deconnecter();
    await montrerVerrou(info ? { genre: 'info', texte: info } : null);
  }, [env, montrerVerrou]);

  // Démarrage : une session déjà ouverte dans cet onglet (rechargement) se rouvre toute seule, sinon verrou.
  useEffect(() => {
    if (demarre.current) return;
    demarre.current = true;
    if (env.connexion.compte()) { void ouvrir('compte'); return; }
    let essai: string | null = null;
    try { essai = env.session.getItem(CLE_ESSAI); } catch { essai = null; }
    if (essai === '1') { void ouvrir('essai'); return; }
    void montrerVerrou(null);
  }, [env, ouvrir, montrerVerrou]);

  // Un brouillon de PIA ne doit pas se perdre si l'on ferme l'onglet ou change d'application.
  const ouverte = phase.nom === 'ouvert' ? phase.session : null;
  useEffect(() => {
    if (!ouverte) return;
    const vider = () => { void ouverte.magasin.viderEnregistrements(); };
    const visibilite = () => { if (document.visibilityState === 'hidden') vider(); };
    document.addEventListener('visibilitychange', visibilite);
    globalThis.addEventListener('pagehide', vider);
    return () => { document.removeEventListener('visibilitychange', visibilite); globalThis.removeEventListener('pagehide', vider); };
  }, [ouverte]);

  // Se déconnecter de Microsoft (depuis l'écran Synchro, ou la session expire côté navigateur) verrouille aussi le Journalier.
  useEffect(() => env.connexion.abonner(() => {
    const s = session.current;
    if (s && s.nature === 'compte' && !env.connexion.compte()) void verrouiller('Vous êtes déconnecté : le Journalier s’est verrouillé.');
  }), [env, verrouiller]);

  const seConnecter = async () => {
    if (occupe) return;
    setOccupe(true); setMessage(null);
    try {
      await env.connexion.connecter(['fichiers']);
      // Se connecter ici, c'est aussi choisir de synchroniser avec le OneDrive du compte (modifiable dans l'écran Synchro).
      sans(() => env.local.setItem(CLE_MODE_SYNCHRO, 'microsoft'));
      await ouvrir('compte');
    } catch (e) { setMessage({ genre: 'erreur', texte: messageErreur(e) }); } finally { setOccupe(false); }
  };

  const essayer = () => { sans(() => env.session.setItem(CLE_ESSAI, '1')); void ouvrir('essai'); };

  const repartir = async (p: Extract<Phase, { nom: 'cle-perdue' }>) => {
    setOccupe(true);
    try { await reinitialiserEspace(p.proprietaire); await ouvrir(p.nature); }
    catch (e) { setPhase({ nom: 'erreur', nature: p.nature, message: `Remise à zéro impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}.` }); }
    finally { setOccupe(false); }
  };

  switch (phase.nom) {
    case 'demarrage':
    case 'ouverture':
      return <Ouverture />;
    case 'verrou':
      return <Verrou occupe={occupe} message={message} ancienneBase={ancienneBase} chiffrementOk={chiffrementDisponible()}
        onConnecter={() => { void seConnecter(); }} onAnnuler={() => env.connexion.annuler()} onEssai={essayer} />;
    case 'cle-perdue':
      return <ClePerdue message={phase.message} occupe={occupe} onRepartir={() => { void repartir(phase); }} onRetour={() => { void verrouiller(undefined, phase.nature); }} />;
    case 'erreur':
      return <ErreurOuverture message={phase.message} onReessayer={() => { void ouvrir(phase.nature); }} onRetour={() => { void verrouiller(undefined, phase.nature); }} />;
    case 'ouvert':
      return <App key={phase.session.proprietaire} magasin={phase.session.magasin} synchro={phase.session.synchro} adresseRetour={adresseRetour}
        essai={phase.session.nature === 'essai'} notices={phase.session.notices} onVerrouiller={() => { void verrouiller(); }} />;
  }
}
