import type { EntreeSynchro } from './repository.ts';
import type { Rangee, StockageBrut, Table } from './stockage-brut.ts';

/*
 * Stockage IndexedDB du coffre : UNE base par propriétaire (journalier-v2-<propriétaire>), ne contenant que des rangées
 * chiffrées (le chiffrement est fait au-dessus, dans `depot-chiffre.ts`), le registre de synchronisation et la clé.
 * Les données restent sur l'appareil.
 */

const VERSION = 1;
const TABLES: readonly Table[] = ['eleves', 'seances', 'activites', 'pia', 'reglages', 'meta'];
const ID_CLE = 'principale';

function ouvrirBase(nom: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(nom, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const t of TABLES) if (!db.objectStoreNames.contains(t)) db.createObjectStore(t, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('synchro')) db.createObjectStore('synchro', { keyPath: 'cle' });
      if (!db.objectStoreNames.contains('cles')) db.createObjectStore('cles', { keyPath: 'id' });
    };
    req.onsuccess = () => {
      // Si un autre onglet veut supprimer ou mettre à jour cette base, on lui laisse la place.
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error ?? new Error('Ouverture de la base impossible'));
    req.onblocked = () => reject(new Error('Base bloquée par un autre onglet : fermez les autres onglets du Journalier.'));
  });
}

/** Transaction d'écriture « stricte » (écrite sur le disque avant d'annoncer la réussite) quand le navigateur le permet. */
function transactionEcriture(db: IDBDatabase, magasins: string | string[]): IDBTransaction {
  try { return db.transaction(magasins, 'readwrite', { durability: 'strict' }); } catch { return db.transaction(magasins, 'readwrite'); }
}

/** Exécute des actions dans UNE transaction ; réussit quand la transaction est terminée (et non quand la requête répond). */
function ecrireTx(db: IDBDatabase, magasins: string | string[], actions: (tx: IDBTransaction) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = transactionEcriture(db, magasins);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Enregistrement impossible'));
    tx.onabort = () => reject(tx.error ?? new Error('Enregistrement annulé'));
    actions(tx);
  });
}

function toutLire<T>(db: IDBDatabase, magasin: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const req = db.transaction(magasin, 'readonly').objectStore(magasin).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error ?? new Error('Lecture impossible'));
  });
}

/** Supprime, dans la transaction en cours, toutes les rangées d'une table dont le lien est cet élève. */
function supprimerLies(tx: IDBTransaction, table: string, eleveId: string): void {
  const req = tx.objectStore(table).openCursor();
  req.onsuccess = () => {
    const curseur = req.result;
    if (!curseur) return;
    if ((curseur.value as Rangee).lien === eleveId) curseur.delete();
    curseur.continue();
  };
}

export interface StockageIndexedDb extends StockageBrut { fermer(): void }

export async function ouvrirStockageIndexedDb(nomBase: string): Promise<StockageIndexedDb> {
  const db = await ouvrirBase(nomBase);
  return {
    lire: (table) => toutLire<Rangee>(db, table),
    ecrire: (table, rangees) => ecrireTx(db, table, (tx) => { for (const r of rangees) tx.objectStore(table).put(r); }),
    supprimer: (table, ids) => ecrireTx(db, table, (tx) => { for (const id of ids) tx.objectStore(table).delete(id); }),
    supprimerEleve: (id) => ecrireTx(db, ['eleves', 'seances', 'activites', 'pia'], (tx) => {
      // Une seule transaction sur toutes les tables liées à l'élève : tout est supprimé, ou rien.
      tx.objectStore('eleves').delete(id);
      for (const t of ['seances', 'activites', 'pia']) supprimerLies(tx, t, id);
    }),
    lireSynchro: () => toutLire<EntreeSynchro>(db, 'synchro'),
    // Plusieurs entrées d'un coup, dans une seule transaction : le registre reste cohérent même si l'onglet se ferme.
    ecrireSynchro: (entrees) => ecrireTx(db, 'synchro', (tx) => { for (const x of entrees) tx.objectStore('synchro').put(x); }),
    supprimerSynchro: (cles) => ecrireTx(db, 'synchro', (tx) => { for (const c of cles) tx.objectStore('synchro').delete(c); }),
    viderSynchro: () => ecrireTx(db, 'synchro', (tx) => { tx.objectStore('synchro').clear(); }),
    lireCle: async () => (await toutLire<{ id: string; cle: CryptoKey }>(db, 'cles')).find((x) => x.id === ID_CLE)?.cle ?? null,
    ecrireCle: (cle) => ecrireTx(db, 'cles', (tx) => { tx.objectStore('cles').put({ id: ID_CLE, cle }); }),
    fermer: () => db.close()
  };
}

/** Supprime la base d'un propriétaire (remise à zéro de l'appareil pour cet espace). Fermer d'abord le stockage ouvert. */
export function supprimerBase(nomBase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(nomBase);
    const delai = setTimeout(() => reject(new Error('Suppression bloquée : fermez les autres onglets du Journalier.')), 4000);
    req.onsuccess = () => { clearTimeout(delai); resolve(); };
    req.onerror = () => { clearTimeout(delai); reject(req.error ?? new Error('Suppression impossible')); };
  });
}
