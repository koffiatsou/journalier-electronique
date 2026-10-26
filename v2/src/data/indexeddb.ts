import type { Activite } from '../domain/agenda/types.ts';
import type { Pia } from '../domain/pia/types.ts';
import type { Eleve, Seance } from '../domain/types.ts';
import type { Depot, EntreeSynchro, Reglage } from './repository.ts';

const NOM_BASE = 'journalier-v2';
const VERSION = 5;

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM_BASE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('eleves')) db.createObjectStore('eleves', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('seances')) db.createObjectStore('seances', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('activites')) db.createObjectStore('activites', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pia')) db.createObjectStore('pia', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('reglages')) db.createObjectStore('reglages', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('synchro')) db.createObjectStore('synchro', { keyPath: 'cle' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Ouverture de la base impossible'));
  });
}

function requete<T>(db: IDBDatabase, magasin: string, mode: IDBTransactionMode, action: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(magasin, mode);
    const req = action(tx.objectStore(magasin));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Opération impossible'));
  });
}

/** Supprime, dans la transaction en cours, tous les enregistrements d'un magasin dont `eleveId` correspond. */
function supprimerLies(tx: IDBTransaction, magasin: string, eleveId: string): void {
  const req = tx.objectStore(magasin).openCursor();
  req.onsuccess = () => {
    const curseur = req.result;
    if (!curseur) return;
    if ((curseur.value as { eleveId?: string }).eleveId === eleveId) curseur.delete();
    curseur.continue();
  };
}

/**
 * Dépôt IndexedDB local. Les données restent sur l'appareil.
 * Le chiffrement du coffre (AES-GCM, comme en V75) viendra s'intercaler ici sans changer l'interface.
 */
export async function creerDepotIndexedDb(): Promise<Depot> {
  const db = await ouvrir();
  return {
    chargerEleves: () => requete<Eleve[]>(db, 'eleves', 'readonly', (s) => s.getAll()),
    chargerSeances: () => requete<Seance[]>(db, 'seances', 'readonly', (s) => s.getAll()),
    enregistrerEleve: async (e) => { await requete(db, 'eleves', 'readwrite', (s) => s.put(e)); },
    supprimerEleve: (id) => new Promise<void>((resolve, reject) => {
      // Une seule transaction sur tous les magasins liés à l'élève : tout est supprimé, ou rien.
      const tx = db.transaction(['eleves', 'seances', 'activites', 'pia'], 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Suppression impossible'));
      tx.onabort = () => reject(tx.error ?? new Error('Suppression annulée'));
      tx.objectStore('eleves').delete(id);
      supprimerLies(tx, 'seances', id);
      supprimerLies(tx, 'activites', id);
      supprimerLies(tx, 'pia', id);
    }),
    enregistrerSeance: async (x) => { await requete(db, 'seances', 'readwrite', (s) => s.put(x)); },
    supprimerSeance: async (id) => { await requete(db, 'seances', 'readwrite', (s) => s.delete(id)); },
    chargerActivites: () => requete<Activite[]>(db, 'activites', 'readonly', (s) => s.getAll()),
    enregistrerActivite: async (a) => { await requete(db, 'activites', 'readwrite', (s) => s.put(a)); },
    supprimerActivite: async (id) => { await requete(db, 'activites', 'readwrite', (s) => s.delete(id)); },
    chargerPias: () => requete<Pia[]>(db, 'pia', 'readonly', (s) => s.getAll()),
    enregistrerPia: async (x) => { await requete(db, 'pia', 'readwrite', (s) => s.put(x)); },
    supprimerPia: async (id) => { await requete(db, 'pia', 'readwrite', (s) => s.delete(id)); },
    chargerReglages: () => requete<Reglage[]>(db, 'reglages', 'readonly', (s) => s.getAll()),
    enregistrerReglage: async (x) => { await requete(db, 'reglages', 'readwrite', (s) => s.put(x)); },
    chargerSynchro: () => requete<EntreeSynchro[]>(db, 'synchro', 'readonly', (s) => s.getAll()),
    // Plusieurs entrées d'un coup, dans une seule transaction : le registre reste cohérent même si l'onglet se ferme.
    enregistrerSynchro: (entrees) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction('synchro', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Enregistrement impossible'));
      tx.onabort = () => reject(tx.error ?? new Error('Enregistrement annulé'));
      for (const x of entrees) tx.objectStore('synchro').put(x);
    }),
    supprimerSynchro: (cles) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction('synchro', 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Suppression impossible'));
      tx.onabort = () => reject(tx.error ?? new Error('Suppression annulée'));
      for (const c of cles) tx.objectStore('synchro').delete(c);
    }),
    viderSynchro: async () => { await requete(db, 'synchro', 'readwrite', (s) => s.clear()); }
  };
}
