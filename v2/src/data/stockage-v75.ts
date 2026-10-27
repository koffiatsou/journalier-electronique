import type { MagasinV75, RangeeV75, StockageV75 } from '../domain/v75/lecture.ts';

/*
 * Accès en LECTURE SEULE à la base de la V75 (`journalier-secure-v74`), qui vit sur le même site que la V2.
 * Règles : on ne l'ouvre qu'en lecture ; on ne la crée jamais si elle n'existe pas ; on n'y écrit rien, jamais.
 */

const NOM_BASE_V75 = 'journalier-secure-v74';

/** Ouvre la base si elle existe ; sinon `null`, sans rien créer (annuler la « mise à niveau » supprime la base fraîchement créée). */
function ouvrirSansCreer(): Promise<IDBDatabase | null> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    let creee = false;
    const demande = indexedDB.open(NOM_BASE_V75);
    demande.onupgradeneeded = () => { creee = true; try { demande.transaction?.abort(); } catch { /* déjà annulée */ } };
    demande.onsuccess = () => {
      const base = demande.result;
      // Une base sans les tables de la V75 n'est pas la sienne.
      resolve(['meta', 'students', 'sessions', 'agenda', 'pia', 'keys'].every((n) => base.objectStoreNames.contains(n)) ? base : (base.close(), null));
    };
    demande.onerror = () => { if (creee) resolve(null); else reject(demande.error ?? new Error('Impossible d’ouvrir le stockage de la V75.')); };
    demande.onblocked = () => reject(new Error('Le stockage de la V75 est bloqué par un autre onglet : fermez-le puis réessayez.'));
  });
}

const demander = <T>(r: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error ?? new Error('Lecture impossible.')); });

export function stockageV75(): StockageV75 {
  let base: Promise<IDBDatabase | null> | null = null;
  const ouvrir = (): Promise<IDBDatabase | null> => (base ??= ouvrirSansCreer());
  const tout = async <T>(magasin: string): Promise<T[]> => {
    const db = await ouvrir();
    return db ? demander<T[]>(db.transaction(magasin, 'readonly').objectStore(magasin).getAll()) : [];
  };
  return {
    existe: async () => (await ouvrir()) !== null,
    rangees: (magasin: MagasinV75) => tout<RangeeV75>(magasin),
    cles: async () => (await tout<{ accountKey: string; key: CryptoKey }>('keys')).filter((k) => k.key).map((k) => ({ compte: k.accountKey, cle: k.key })),
    // Referme la connexion une fois la lecture terminée (la V75 pourra alors se mettre à jour si elle en a besoin).
    fermer: async () => { const db = await ouvrir(); db?.close(); base = null; }
  };
}

