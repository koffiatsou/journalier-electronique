import { creerDepotMemoire } from '../data/memoire.ts';
import { ouvrirCoffre } from '../data/depot-chiffre.ts';
import { ancienneBaseExiste, ouvrirAncienneBase, supprimerAncienneBase } from '../data/indexeddb-ancien.ts';
import { ouvrirStockageIndexedDb, supprimerBase } from '../data/indexeddb.ts';
import { migrerVersCoffre } from '../data/migration.ts';
import type { Depot } from '../data/repository.ts';
import { PROPRIETAIRE_ESSAI, nomBaseDe, proprietaireDeCompte } from '../domain/coffre/index.ts';
import { creerMagasin } from '../state/store.ts';
import type { Magasin } from '../state/store.ts';
import type { Connexion, Stockage } from '../synchro/connexion.ts';
import { NuageSimule } from '../synchro/simule.ts';
import { creerSynchro } from '../synchro/service.ts';
import type { Synchro } from '../synchro/service.ts';

/*
 * Une session = le Journalier ouvert pour UN propriétaire : son espace chiffré, son magasin d'état, sa synchronisation.
 * Tant qu'aucune session n'est ouverte, l'application est verrouillée : aucune donnée n'est lue ni affichée.
 */

export type Nature = 'compte' | 'essai';

/** Mémorise, pour cet onglet seulement, que le mode essai est ouvert (comme la session Microsoft : fermer le navigateur reverrouille). */
export const CLE_ESSAI = 'journalier-mode-essai';
/** Où le faux OneDrive de la démonstration était gardé, en clair, avant le coffre. */
const CLE_NUAGE_ANCIEN = 'journalier-demo-nuage';

export interface Environnement {
  /** Préférences de cet appareil (localStorage) : rien de sensible. */
  local: Stockage;
  /** Mémoire de l'onglet (sessionStorage) : mode essai ouvert, session Microsoft. */
  session: Stockage;
  connexion: Connexion;
}

export interface SessionOuverte {
  proprietaire: string;
  nature: Nature;
  magasin: Magasin;
  synchro: Synchro;
  /** À montrer une fois à l'ouverture : anciennes données chiffrées, enregistrement impossible… */
  notices: string[];
  /** Libère la base (avant de verrouiller ou de supprimer l'espace). */
  fermer(): void;
}

export type ResultatSession =
  | { ok: true; session: SessionOuverte }
  | { ok: false; raison: 'cle-perdue' | 'erreur'; message: string; proprietaire: string };

export const chiffrementDisponible = (): boolean => typeof globalThis.crypto?.subtle?.encrypt === 'function';

/** L'espace d'un propriétaire : celui du compte connecté, ou celui du mode essai. `null` si aucun compte n'est connecté. */
export async function proprietaireDe(nature: Nature, connexion: Connexion): Promise<string | null> {
  if (nature === 'essai') return PROPRIETAIRE_ESSAI;
  const compte = connexion.compte();
  return compte ? proprietaireDeCompte(compte.id) : null;
}

/** Y a-t-il des données d'avant le chiffrement sur cet appareil ? (pour prévenir sur l'écran de verrouillage) */
export async function donneesNonChiffreesPresentes(): Promise<boolean> {
  try { return await ancienneBaseExiste(); } catch { return false; }
}

/** Efface l'espace chiffré d'un propriétaire (clé perdue : on repart de zéro, puis on récupère depuis OneDrive ou une copie). */
export async function reinitialiserEspace(proprietaire: string): Promise<void> {
  await supprimerBase(nomBaseDe(proprietaire));
}

export async function ouvrirSession(nature: Nature, env: Environnement): Promise<ResultatSession> {
  const proprietaire = await proprietaireDe(nature, env.connexion);
  if (!proprietaire) return { ok: false, raison: 'erreur', proprietaire: '', message: 'Aucun compte Microsoft n’est connecté.' };
  const echec = (message: string, raison: 'cle-perdue' | 'erreur' = 'erreur'): ResultatSession => ({ ok: false, raison, message, proprietaire });
  if (!chiffrementDisponible()) return echec('Ce navigateur ne permet pas le chiffrement des données. Ouvrez le Journalier dans un navigateur à jour, depuis l’adresse sécurisée (https).');

  const notices: string[] = [];
  let depot: Depot;
  let fermerBase: () => void = () => undefined;

  let stockage: Awaited<ReturnType<typeof ouvrirStockageIndexedDb>> | null = null;
  try { if (typeof indexedDB !== 'undefined') stockage = await ouvrirStockageIndexedDb(nomBaseDe(proprietaire)); } catch { stockage = null; }

  if (!stockage) {
    // Navigation privée ou navigateur sans base : le Journalier reste utilisable, mais rien n'est gardé à la fermeture.
    depot = creerDepotMemoire();
    notices.push('Ce navigateur ne permet pas d’enregistrer sur l’appareil (navigation privée ?). Ce que vous saisissez sera perdu à la fermeture : faites une copie de secours avant de quitter.');
  } else {
    const base = stockage;
    const ouverture = await ouvrirCoffre(base, proprietaire);
    if (!ouverture.ok) { base.fermer(); return echec(ouverture.message, ouverture.raison); }
    depot = ouverture.depot;
    fermerBase = () => base.fermer();

    // Anciennes données en clair (avant le chiffrement) : on les chiffre, on vérifie, puis seulement on les supprime.
    try {
      if (await ancienneBaseExiste()) {
        const source = await ouvrirAncienneBase();
        const bilan = await migrerVersCoffre(source, depot);
        source.fermer();
        if (bilan.statut === 'migre') {
          try { await supprimerAncienneBase(); notices.push(`${bilan.message} Les anciennes données non chiffrées ont été supprimées de cet appareil.`); }
          catch { notices.push(`${bilan.message} L’ancienne copie non chiffrée n’a pas pu être supprimée (fermez les autres onglets du Journalier, elle sera retirée à la prochaine ouverture).`); }
        } else if (bilan.statut === 'reporte') {
          notices.push(`${bilan.message} Elles restent non chiffrées sur cet appareil.`);
        } else if (bilan.statut === 'echec') {
          fermerBase();
          if (bilan.aReinitialiser) await supprimerBase(nomBaseDe(proprietaire)).catch(() => undefined);
          return echec(`${bilan.message} Rien n’a été perdu : réessayez, ou faites-vous aider.`);
        }
      }
    } catch (e) {
      fermerBase();
      return echec(`Les anciennes données n’ont pas pu être chiffrées : ${e instanceof Error ? e.message : 'erreur inconnue'}. Elles n’ont pas été touchées.`);
    }
  }

  // Le faux OneDrive de la démonstration : gardé dans le coffre (il peut contenir de vraies données le temps d'un essai).
  const ancienNuage = (() => { try { return env.local.getItem(CLE_NUAGE_ANCIEN); } catch { return null; } })();
  let texteNuage = await depot.chargerNuageDemo();
  if (ancienNuage !== null && texteNuage === null) {
    await depot.enregistrerNuageDemo(ancienNuage);
    texteNuage = ancienNuage;
  }
  if (ancienNuage !== null) { try { env.local.removeItem(CLE_NUAGE_ANCIEN); } catch { /* sera retiré une prochaine fois */ } }
  const demo = new NuageSimule({
    lire: () => texteNuage,
    ecrire: (t) => { texteNuage = t; void depot.enregistrerNuageDemo(t).catch(() => undefined); }
  });

  const magasin = creerMagasin(depot);
  const synchro = creerSynchro({ magasin, depot, connexion: env.connexion, demo, preferences: env.local, autoriserMicrosoft: nature === 'compte' });
  return { ok: true, session: { proprietaire, nature, magasin, synchro, notices, fermer: () => { synchro.arreter(); fermerBase(); } } };
}
