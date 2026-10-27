import type { Activite } from '../domain/agenda/types.ts';
import { NOM_ANCIENNE_BASE } from '../domain/coffre/index.ts';
import type { Pia } from '../domain/pia/types.ts';
import type { Eleve, Seance } from '../domain/types.ts';
import type { SourceAncienne } from './migration.ts';
import type { EntreeSynchro, Reglage } from './repository.ts';

/*
 * L'ancienne base (« journalier-v2 », version 5), celle d'AVANT le chiffrement : données en clair.
 * Elle n'est plus jamais écrite. On la lit une fois pour la chiffrer dans le coffre (`migration.ts`), puis on la supprime.
 */

const VERSION_ANCIENNE = 5;

/** L'ancienne base existe-t-elle sur cet appareil ? (Sans la créer : ouvrir une base qui n'existe pas la crée.) */
export async function ancienneBaseExiste(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') return false;
  if (typeof indexedDB.databases === 'function') {
    try { return (await indexedDB.databases()).some((d) => d.name === NOM_ANCIENNE_BASE); } catch { /* on essaie autrement */ }
  }
  return new Promise<boolean>((resolve) => {
    const req = indexedDB.open(NOM_ANCIENNE_BASE);
    let existait = true;
    req.onupgradeneeded = (ev) => {
      // oldVersion 0 : la base n'existait pas, on vient de la créer — on annule et on la supprime.
      if (ev.oldVersion === 0) { existait = false; req.transaction?.abort(); }
    };
    req.onsuccess = () => { req.result.close(); resolve(existait); };
    req.onerror = () => { if (!existait) indexedDB.deleteDatabase(NOM_ANCIENNE_BASE); resolve(false); };
  });
}

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM_ANCIENNE_BASE, VERSION_ANCIENNE);
    req.onupgradeneeded = () => {
      // Base encore plus ancienne (versions 1 à 4 de la V2) : on complète les magasins manquants pour pouvoir tout lire.
      const db = req.result;
      for (const nom of ['eleves', 'seances', 'activites', 'pia', 'reglages']) if (!db.objectStoreNames.contains(nom)) db.createObjectStore(nom, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('synchro')) db.createObjectStore('synchro', { keyPath: 'cle' });
    };
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
    req.onerror = () => reject(req.error ?? new Error('Ouverture de l’ancienne base impossible'));
  });
}

function toutLire<T>(db: IDBDatabase, magasin: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(magasin, 'readonly').objectStore(magasin).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error ?? new Error('Lecture impossible'));
  });
}

/** Lit l'ancienne base. À fermer avec `fermer()` avant de la supprimer. */
export async function ouvrirAncienneBase(): Promise<SourceAncienne & { fermer(): void }> {
  const db = await ouvrir();
  return {
    chargerEleves: () => toutLire<Eleve>(db, 'eleves'),
    chargerSeances: () => toutLire<Seance>(db, 'seances'),
    chargerActivites: () => toutLire<Activite>(db, 'activites'),
    chargerPias: () => toutLire<Pia>(db, 'pia'),
    chargerReglages: () => toutLire<Reglage>(db, 'reglages'),
    chargerSynchro: () => toutLire<EntreeSynchro>(db, 'synchro'),
    fermer: () => db.close()
  };
}

/** Supprime l'ancienne base. À n'appeler qu'après une migration vérifiée. */
export function supprimerAncienneBase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(NOM_ANCIENNE_BASE);
    const delai = setTimeout(() => reject(new Error('Suppression bloquée : fermez les autres onglets du Journalier.')), 4000);
    req.onsuccess = () => { clearTimeout(delai); resolve(); };
    req.onerror = () => { clearTimeout(delai); reject(req.error ?? new Error('Suppression impossible')); };
  });
}
