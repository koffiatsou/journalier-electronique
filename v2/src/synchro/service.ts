import { useSyncExternalStore } from 'react';
import type { Depot } from '../data/repository.ts';
import { estDemo } from '../domain/synchro/cles.ts';
import { NOM_CALENDRIER, REGLAGES_OUTLOOK_DEFAUT, REGLAGE_OUTLOOK, evenementsSouhaites, fenetreOutlook, normaliserReglagesOutlook, planifierOutlook } from '../domain/synchro/outlook.ts';
import type { ReglagesOutlook } from '../domain/synchro/outlook.ts';
import type { Magasin } from '../state/store.ts';
import { portLocal, portRegistre } from './adaptateurs.ts';
import { Connexion } from './connexion.ts';
import type { Compte, Stockage } from './connexion.ts';
import { creerCalendrierGraph, creerNuageGraph } from './graph.ts';
import { ErreurAcces, ErreurVersion } from './nuage.ts';
import type { CalendrierNuage, Nuage } from './nuage.ts';
import { appliquerRestauration, preparerCopie, preparerRestauration } from './secours.ts';
import type { LectureRestauration, RestaurationPrevue } from './secours.ts';
import type { NuageSimule } from './simule.ts';
import { resoudreConflit, synchroniser } from './synchroniser.ts';
import type { Choix, ConflitAffiche, ResultatSynchro } from './synchroniser.ts';

/*
 * Service de synchronisation : ce que l'écran voit et commande.
 * Deux « modes » : un vrai compte Microsoft, ou la démonstration (faux OneDrive et faux Outlook sur cet appareil).
 */

export type ModeNuage = 'aucun' | 'demonstration' | 'microsoft';
export interface Message { genre: 'ok' | 'erreur' | 'info'; texte: string }
export interface BilanOutlook { le: string; crees: number; modifies: number; retires: number }

export interface EtatSynchro {
  mode: ModeNuage;
  compte: Compte | null;
  /** Connecté auparavant, mais la session a expiré : il faut ouvrir la fenêtre de connexion. */
  reconnexion: boolean;
  enCours: 'connexion' | 'synchronisation' | 'outlook' | null;
  derniere: ResultatSynchro | null;
  conflits: ConflitAffiche[];
  message: Message | null;
  auto: boolean;
  outlook: ReglagesOutlook;
  outlookAutorise: boolean;
  dernierOutlook: BilanOutlook | null;
  nuageDemo: { fichiers: number; evenements: number };
}

export interface DependancesSynchro {
  magasin: Magasin;
  depot: Depot;
  connexion: Connexion;
  demo: NuageSimule;
  /** Préférences de cet appareil (mode, envoi automatique) : localStorage. */
  preferences: Stockage;
  aujourdhui?: () => string;
  maintenant?: () => string;
  /** Silence avant l'envoi automatique, en millisecondes. */
  delaiAutoMs?: number;
  /** Remplaçables dans les tests. */
  nuageMicrosoft?: () => Nuage;
  calendrierMicrosoft?: () => CalendrierNuage;
}

const CLE_MODE = 'journalier-synchro-mode';
const CLE_AUTO = 'journalier-synchro-auto';
const COMPTE_DEMO: Compte = { id: 'demonstration', nom: 'Démonstration', courriel: '' };

/** Phrase de bilan d'une synchronisation, en français simple. */
export function resume(r: ResultatSynchro): string {
  const morceaux: string[] = [];
  if (r.envoyes) morceaux.push(`${r.envoyes} envoyé${r.envoyes > 1 ? 's' : ''} vers OneDrive`);
  if (r.recus) morceaux.push(`${r.recus} reçu${r.recus > 1 ? 's' : ''} de OneDrive`);
  if (r.supprimesLa) morceaux.push(`${r.supprimesLa} supprimé${r.supprimesLa > 1 ? 's' : ''} dans OneDrive`);
  if (r.supprimesIci) morceaux.push(`${r.supprimesIci} supprimé${r.supprimesIci > 1 ? 's' : ''} ici`);
  const fin: string[] = [];
  if (r.conflits.length) fin.push(`${r.conflits.length} à décider ci-dessous`);
  if (r.ignores.length) fin.push(`${r.ignores.length} laissé${r.ignores.length > 1 ? 's' : ''} de côté`);
  if (r.erreurs.length) fin.push(`${r.erreurs.length} en erreur`);
  if (!morceaux.length && !fin.length) return 'Tout est à jour.';
  return `Synchronisation terminée : ${[...morceaux, ...fin].join(' ; ')}.`;
}

export function messageErreur(e: unknown): string {
  if (e instanceof ErreurAcces) return e.message;
  if (e instanceof ErreurVersion) return 'OneDrive a changé pendant l’opération : relancez la synchronisation.';
  return `Une erreur est survenue : ${e instanceof Error ? e.message : 'inconnue'}.`;
}

async function enParallele<T>(liste: readonly T[], n: number, action: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const ouvriers = Array.from({ length: Math.min(n, liste.length) }, async () => {
    while (i < liste.length) { const x = liste[i]!; i += 1; await action(x); }
  });
  await Promise.all(ouvriers);
}

export function creerSynchro(d: DependancesSynchro) {
  const aujourdhui = d.aujourdhui ?? (() => new Date().toISOString().slice(0, 10));
  const maintenant = d.maintenant ?? (() => new Date().toISOString());
  const lirePref = (k: string): string | null => { try { return d.preferences.getItem(k); } catch { return null; } };
  const ecrirePref = (k: string, v: string): void => { try { d.preferences.setItem(k, v); } catch { /* préférence non gardée */ } };

  const modeInitial = lirePref(CLE_MODE);
  let etat: EtatSynchro = {
    mode: modeInitial === 'demonstration' || modeInitial === 'microsoft' ? modeInitial : 'aucun',
    compte: null, reconnexion: false, enCours: null, derniere: null, conflits: [], message: null,
    auto: lirePref(CLE_AUTO) !== 'non', outlook: REGLAGES_OUTLOOK_DEFAUT, outlookAutorise: false, dernierOutlook: null, nuageDemo: d.demo.resume()
  };
  const abonnes = new Set<() => void>();
  const maj = (suite: Partial<EtatSynchro>): void => { etat = { ...etat, ...suite }; abonnes.forEach((f) => f()); };

  /** Compte, session et droits tels que la connexion les connaît (à rappeler après toute connexion ou déconnexion). */
  const relire = (): void => {
    if (etat.mode === 'demonstration') { maj({ compte: COMPTE_DEMO, reconnexion: false, outlookAutorise: true, nuageDemo: d.demo.resume() }); return; }
    if (etat.mode === 'microsoft') {
      const compte = d.connexion.compte();
      maj({ compte, reconnexion: d.connexion.reconnexionNecessaire(), outlookAutorise: d.connexion.calendrierAutorise() });
      return;
    }
    maj({ compte: null, reconnexion: false, outlookAutorise: false });
  };
  d.connexion.abonner(relire);

  const nuage = (): Nuage => (etat.mode === 'demonstration' ? d.demo : d.nuageMicrosoft?.() ?? creerNuageGraph({ jeton: d.connexion }));
  const calendrier = (): CalendrierNuage => (etat.mode === 'demonstration' ? d.demo : d.calendrierMicrosoft?.() ?? creerCalendrierGraph({ jeton: d.connexion }));
  const options = () => ({
    nuage: nuage(), local: portLocal(d.magasin), registre: portRegistre(d.depot),
    compteId: etat.mode === 'demonstration' ? COMPTE_DEMO.id : etat.compte?.id ?? '', exclureDemo: etat.mode === 'microsoft', maintenant
  });
  const pret = (): boolean => (etat.mode === 'demonstration' || (etat.mode === 'microsoft' && !!etat.compte && !etat.reconnexion));

  function signaler(e: unknown): void {
    if (e instanceof ErreurAcces && e.code === 'non-connecte') relire();
    maj({ enCours: null, message: { genre: 'erreur', texte: messageErreur(e) } });
  }

  /* ───────── Synchronisation ───────── */

  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let enSynchro = false;

  async function synchroniserMaintenant(silencieux = false): Promise<void> {
    if (enSynchro || !pret()) return;
    enSynchro = true;
    maj({ enCours: 'synchronisation', ...(silencieux ? {} : { message: null }) });
    try {
      let r = await synchroniser(options());
      if (r.aRelancer) { // quelqu'un a modifié un fichier pendant l'opération : une seconde passe règle presque toujours cela
        const seconde = await synchroniser(options());
        r = { ...seconde, envoyes: r.envoyes + seconde.envoyes, recus: r.recus + seconde.recus, supprimesLa: r.supprimesLa + seconde.supprimesLa, supprimesIci: r.supprimesIci + seconde.supprimesIci };
      }
      const rien = !r.envoyes && !r.recus && !r.supprimesIci && !r.supprimesLa;
      maj({
        enCours: null, derniere: r, conflits: r.conflits, nuageDemo: d.demo.resume(),
        message: silencieux && rien && !r.conflits.length && !r.erreurs.length ? etat.message : { genre: r.erreurs.length || r.conflits.length ? 'info' : 'ok', texte: resume(r) }
      });
      if (etat.outlook.actif && etat.outlookAutorise) { enSynchro = false; await envoyerVersOutlook(true); }
    } catch (e) { signaler(e); } finally { enSynchro = false; }
  }

  function programmerAuto(): void {
    if (!etat.auto || !pret() || etat.conflits.length) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(() => { minuteur = null; void synchroniserMaintenant(true); }, d.delaiAutoMs ?? 30_000);
  }

  // Tout changement de données ici déclenche un envoi, après un moment de calme (comme en V75, 30 secondes).
  let vu = d.magasin.lire();
  d.magasin.abonner(() => {
    const e = d.magasin.lire();
    const change = e.eleves !== vu.eleves || e.seances !== vu.seances || e.activites !== vu.activites || e.pias !== vu.pias || e.horaires !== vu.horaires || e.semaineType !== vu.semaineType;
    vu = e;
    if (change && !enSynchro) programmerAuto();
  });

  /* ───────── Outlook ───────── */

  async function envoyerVersOutlook(silencieux = false): Promise<void> {
    if (!pret() || !etat.outlook.actif || !etat.outlookAutorise || etat.enCours === 'outlook') return;
    maj({ enCours: 'outlook', ...(silencieux ? {} : { message: null }) });
    try {
      const cal = calendrier();
      const id = await cal.trouverOuCreer(NOM_CALENDRIER);
      const { du, au } = fenetreOutlook(aujourdhui());
      const e = d.magasin.lire();
      const demoSeulement = etat.mode === 'demonstration';
      const activites = e.activites.filter((a) => demoSeulement || !(estDemo(a.id) || (a.eleveId && estDemo(a.eleveId))));
      const souhaites = evenementsSouhaites(activites, e.eleves, e.seances, e.horaires, du, au, etat.outlook);
      const plan = planifierOutlook(souhaites, await cal.evenements(id, du, au));
      await enParallele(plan.supprimer, 4, (x) => cal.supprimerEvenement(id, x));
      await enParallele(plan.modifier, 4, (x) => cal.modifier(id, x.id, x.evenement));
      await enParallele(plan.creer, 4, (x) => cal.creer(id, x));
      const bilan: BilanOutlook = { le: maintenant(), crees: plan.creer.length, modifies: plan.modifier.length, retires: plan.supprimer.length };
      const rien = !bilan.crees && !bilan.modifies && !bilan.retires;
      maj({
        enCours: null, dernierOutlook: bilan, nuageDemo: d.demo.resume(),
        message: silencieux && rien ? etat.message : { genre: 'ok', texte: rien ? 'Outlook est déjà à jour.' : `Outlook mis à jour : ${bilan.crees} ajouté${bilan.crees > 1 ? 's' : ''}, ${bilan.modifies} corrigé${bilan.modifies > 1 ? 's' : ''}, ${bilan.retires} retiré${bilan.retires > 1 ? 's' : ''}.` }
      });
    } catch (er) { signaler(er); }
  }

  async function enregistrerOutlook(r: ReglagesOutlook): Promise<void> {
    await d.depot.enregistrerReglage({ id: REGLAGE_OUTLOOK, valeur: r });
    maj({ outlook: r });
  }

  /* ───────── Actions ───────── */

  return {
    lire: () => etat,
    abonner(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; },

    /** À appeler une fois au démarrage : relit les réglages et reprend là où on s'était arrêté. */
    async demarrer(): Promise<void> {
      const reglage = (await d.depot.chargerReglages()).find((r) => r.id === REGLAGE_OUTLOOK);
      maj({ outlook: normaliserReglagesOutlook(reglage?.valeur) });
      relire();
      if (pret() && etat.auto) void synchroniserMaintenant(true);
    },

    synchroniser: () => synchroniserMaintenant(false),

    /** Essayer sans compte : faux OneDrive et faux Outlook sur cet appareil. */
    utiliserDemonstration() {
      ecrirePref(CLE_MODE, 'demonstration');
      maj({ mode: 'demonstration', conflits: [], derniere: null, message: { genre: 'info', texte: 'Mode démonstration : rien n’est envoyé à Microsoft. Tout reste sur cet appareil.' } });
      relire();
    },

    /** Ouvre la fenêtre de connexion Microsoft (à appeler depuis un clic). */
    async connecter(): Promise<void> {
      if (etat.enCours) return;
      maj({ enCours: 'connexion', message: null });
      try {
        await d.connexion.connecter(['fichiers']);
        ecrirePref(CLE_MODE, 'microsoft');
        maj({ mode: 'microsoft', enCours: null, conflits: [], derniere: null });
        relire();
        await synchroniserMaintenant(false);
      } catch (e) { maj({ enCours: null }); signaler(e); }
    },

    annulerConnexion() { d.connexion.annuler(); },

    /** Oublie le compte sur cet appareil. Les données locales et celles de OneDrive restent en place. */
    deconnecter() {
      if (minuteur) { clearTimeout(minuteur); minuteur = null; }
      if (etat.mode === 'microsoft') d.connexion.deconnecter();
      ecrirePref(CLE_MODE, 'aucun');
      maj({ mode: 'aucun', conflits: [], derniere: null, enCours: null, dernierOutlook: null, message: { genre: 'info', texte: 'Déconnecté. Vos données restent sur cet appareil.' } });
      relire();
    },

    changerAuto(auto: boolean) { ecrirePref(CLE_AUTO, auto ? 'oui' : 'non'); maj({ auto }); if (!auto && minuteur) { clearTimeout(minuteur); minuteur = null; } },

    async resoudre(conflit: ConflitAffiche, choix: Choix): Promise<void> {
      if (!pret() || enSynchro) return;
      enSynchro = true;
      maj({ enCours: 'synchronisation', message: null });
      try {
        await resoudreConflit(options(), conflit, choix);
        maj({ conflits: etat.conflits.filter((c) => c.cle !== conflit.cle) });
      } catch (e) { enSynchro = false; signaler(e); return; }
      enSynchro = false;
      await synchroniserMaintenant(false);
    },

    /* Outlook */
    async reglerOutlook(partiel: Partial<ReglagesOutlook>): Promise<void> { await enregistrerOutlook({ ...etat.outlook, ...partiel }); },

    /** Autorise l'accès à Outlook (fenêtre Microsoft) puis envoie l'agenda. À appeler depuis un clic. */
    async activerOutlook(): Promise<void> {
      if (etat.enCours) return;
      try {
        if (etat.mode === 'microsoft' && !etat.outlookAutorise) {
          maj({ enCours: 'connexion', message: null });
          await d.connexion.connecter(['fichiers', 'calendrier']);
          relire();
          maj({ enCours: null });
        }
        await enregistrerOutlook({ ...etat.outlook, actif: true });
        await envoyerVersOutlook(false);
      } catch (e) { maj({ enCours: null }); signaler(e); }
    },

    envoyerVersOutlook: () => envoyerVersOutlook(false),

    /** Supprime le calendrier « Journalier » d'Outlook et arrête l'envoi. */
    async retirerOutlook(): Promise<void> {
      if (!pret() || etat.enCours) return;
      maj({ enCours: 'outlook', message: null });
      try {
        const cal = calendrier();
        await cal.supprimerCalendrier(await cal.trouverOuCreer(NOM_CALENDRIER));
        await enregistrerOutlook({ ...etat.outlook, actif: false });
        maj({ enCours: null, dernierOutlook: null, nuageDemo: d.demo.resume(), message: { genre: 'ok', texte: 'Le calendrier « Journalier » a été supprimé d’Outlook.' } });
      } catch (e) { signaler(e); }
    },

    /* Pour essayer (démonstration seulement) */
    /** Comme si un autre appareil avait modifié une séance dans OneDrive. */
    modifierAilleurs(): boolean {
      const chemin = d.demo.modifierSurAutreAppareil('seances', (contenu) => {
        const o = JSON.parse(contenu) as { donnees: { remarque?: string } };
        o.donnees.remarque = `${o.donnees.remarque ?? ''} [modifié sur un autre appareil]`.trim();
        return JSON.stringify(o);
      });
      maj({ nuageDemo: d.demo.resume(), message: { genre: chemin ? 'info' : 'erreur', texte: chemin ? 'Une séance a été modifiée « sur un autre appareil ». Lancez la synchronisation pour la recevoir.' : 'Aucune séance dans le faux OneDrive : synchronisez d’abord.' } });
      return chemin !== null;
    },
    /** Comme si un autre appareil avait supprimé une séance dans OneDrive. */
    supprimerAilleurs(): boolean {
      let chemin: string | null = null;
      d.demo.modifierSurAutreAppareil('seances', (_c, p) => { chemin ??= p; return null; });
      const ok = chemin !== null && d.demo.supprimerSurAutreAppareil(chemin);
      maj({ nuageDemo: d.demo.resume(), message: { genre: ok ? 'info' : 'erreur', texte: ok ? 'Une séance a été supprimée « sur un autre appareil ». Lancez la synchronisation.' : 'Aucune séance dans le faux OneDrive : synchronisez d’abord.' } });
      return ok;
    },
    async viderNuageDemo(): Promise<void> {
      d.demo.vider();
      await portRegistre(d.depot).vider();
      maj({ nuageDemo: d.demo.resume(), derniere: null, conflits: [], dernierOutlook: null, message: { genre: 'ok', texte: 'Le faux OneDrive et le faux Outlook sont vides.' } });
    },

    /* Copie de secours */
    preparerCopie: () => preparerCopie(d.magasin, maintenant()),
    preparerRestauration: (texte: string): Promise<LectureRestauration> => preparerRestauration(d.magasin, texte),
    async restaurer(prevue: RestaurationPrevue, remplacerDifferents: boolean): Promise<number> {
      const n = await appliquerRestauration(d.magasin, prevue, remplacerDifferents);
      maj({ message: { genre: 'ok', texte: n ? `Copie restaurée : ${n} élément${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''} ou remplacé${n > 1 ? 's' : ''}.` : 'Rien à restaurer : tout y est déjà.' } });
      return n;
    }
  };
}

export type Synchro = ReturnType<typeof creerSynchro>;

export const useSynchro = <T,>(synchro: Synchro, selecteur: (e: EtatSynchro) => T): T =>
  useSyncExternalStore(synchro.abonner, () => selecteur(synchro.lire()));
