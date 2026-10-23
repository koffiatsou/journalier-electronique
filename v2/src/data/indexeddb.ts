import type { Activite } from '../domain/agenda/types.ts';
import type { Eleve, Seance } from '../domain/types.ts';
import type { Depot } from './repository.ts';

const NOM_BASE = 'journalier-v2';
const VERSION = 2;

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM_BASE, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('eleves')) db.createObjectStore('eleves', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('seances')) db.createObjectStore('seances', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('activites')) db.createObjectStore('activites', { keyPath: 'id' });
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
    enregistrerSeance: async (x) => { await requete(db, 'seances', 'readwrite', (s) => s.put(x)); },
    supprimerSeance: async (id) => { await requete(db, 'seances', 'readwrite', (s) => s.delete(id)); },
    chargerActivites: () => requete<Activite[]>(db, 'activites', 'readonly', (s) => s.getAll()),
    enregistrerActivite: async (a) => { await requete(db, 'activites', 'readwrite', (s) => s.put(a)); },
    supprimerActivite: async (id) => { await requete(db, 'activites', 'readwrite', (s) => s.delete(id)); }
  };
}
