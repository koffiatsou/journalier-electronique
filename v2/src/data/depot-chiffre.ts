import type { Activite } from '../domain/agenda/types.ts';
import { nouvelleCle, ouvrir, sceller } from '../domain/coffre/index.ts';
import type { Pia } from '../domain/pia/types.ts';
import { cle as cleSynchro } from '../domain/synchro/cles.ts';
import type { RefObjet } from '../domain/synchro/cles.ts';
import type { Eleve, Seance } from '../domain/types.ts';
import type { Depot, Reglage } from './repository.ts';
import { TYPE_DE_TABLE } from './stockage-brut.ts';
import type { Rangee, StockageBrut, Table } from './stockage-brut.ts';

/*
 * Dépôt chiffré : le `Depot` que connaît l'application, au-dessus d'un stockage brut.
 * Chaque objet est chiffré séparément (une séance = une rangée), avec la clé de l'espace et des données authentifiées
 * (propriétaire, table, identifiant). Le registre de synchronisation reste en clair : il ne contient que des
 * identifiants au hasard et des empreintes.
 */

const VERIFICATION = { table: 'meta', id: 'verification' } as const;
const NUAGE_DEMO = 'nuage-demo';

type TableDonnees = Exclude<Table, 'meta'>;

interface Illisible extends RefObjet { lien?: string }

/** Dépôt chiffré sur un stockage brut, avec la clé déjà obtenue (voir `ouvrirCoffre`). */
export function creerDepotChiffre(brut: StockageBrut, cle: CryptoKey, proprietaire: string): Depot {
  const illisibles = new Map<string, Illisible>();
  const contexte = (table: Table, id: string) => ({ proprietaire, table, id });
  const marque = (type: RefObjet['type'], id: string) => cleSynchro(type, id);

  async function lire<T>(table: TableDonnees): Promise<T[]> {
    const type = TYPE_DE_TABLE[table];
    const rangees = await brut.lire(table);
    for (const [k, x] of [...illisibles]) if (x.type === type) illisibles.delete(k);
    const sortie: T[] = [];
    for (const r of rangees) {
      try { sortie.push((await ouvrir(cle, contexte(table, r.id), r.c)) as T); }
      // Une rangée abîmée ne doit jamais empêcher d'ouvrir toutes les autres.
      catch { illisibles.set(marque(type, r.id), { type, id: r.id, ...(r.lien ? { lien: r.lien } : {}) }); }
    }
    return sortie;
  }

  async function ecrire(table: TableDonnees, id: string, valeur: unknown, lien?: string): Promise<void> {
    const rangee: Rangee = { id, ...(lien ? { lien } : {}), c: await sceller(cle, contexte(table, id), valeur) };
    await brut.ecrire(table, [rangee]);
    illisibles.delete(marque(TYPE_DE_TABLE[table], id)); // réécrit : l'ancienne rangée abîmée n'existe plus
  }

  return {
    chargerEleves: () => lire<Eleve>('eleves'),
    chargerSeances: () => lire<Seance>('seances'),
    enregistrerEleve: (e) => ecrire('eleves', e.id, e),
    supprimerEleve: async (id) => {
      await brut.supprimerEleve(id);
      for (const [k, x] of [...illisibles]) if ((x.type === 'eleve' && x.id === id) || x.lien === id) illisibles.delete(k);
    },
    enregistrerSeance: (s) => ecrire('seances', s.id, s, s.eleveId),
    supprimerSeance: async (id) => { await brut.supprimer('seances', [id]); illisibles.delete(marque('seance', id)); },
    chargerActivites: () => lire<Activite>('activites'),
    enregistrerActivite: (a) => ecrire('activites', a.id, a, a.eleveId),
    supprimerActivite: async (id) => { await brut.supprimer('activites', [id]); illisibles.delete(marque('activite', id)); },
    chargerPias: () => lire<Pia>('pia'),
    enregistrerPia: (p) => ecrire('pia', p.id, p, p.eleveId),
    supprimerPia: async (id) => { await brut.supprimer('pia', [id]); illisibles.delete(marque('pia', id)); },
    chargerReglages: () => lire<Reglage>('reglages'),
    enregistrerReglage: (r) => ecrire('reglages', r.id, r),

    chargerSynchro: () => brut.lireSynchro(),
    enregistrerSynchro: (entrees) => brut.ecrireSynchro(entrees),
    supprimerSynchro: (cles) => brut.supprimerSynchro(cles),
    viderSynchro: () => brut.viderSynchro(),

    chargerNuageDemo: async () => {
      const rangee = (await brut.lire('meta')).find((r) => r.id === NUAGE_DEMO);
      if (!rangee) return null;
      try { const v = await ouvrir(cle, contexte('meta', NUAGE_DEMO), rangee.c); return typeof v === 'string' ? v : null; } catch { return null; }
    },
    enregistrerNuageDemo: async (texte) => {
      if (texte === null) { await brut.supprimer('meta', [NUAGE_DEMO]); return; }
      await brut.ecrire('meta', [{ id: NUAGE_DEMO, c: await sceller(cle, contexte('meta', NUAGE_DEMO), texte) }]);
    },

    illisibles: () => [...illisibles.values()].map(({ type, id }) => ({ type, id })),
    ecarterIllisibles: async () => {
      const liste = [...illisibles.values()];
      for (const x of liste) {
        const table = (Object.keys(TYPE_DE_TABLE) as TableDonnees[]).find((t) => TYPE_DE_TABLE[t] === x.type)!;
        await brut.supprimer(table, [x.id]);
      }
      // Sans cette ligne, la synchronisation croirait que l'élément a été supprimé ici et le supprimerait dans OneDrive.
      await brut.supprimerSynchro(liste.map((x) => marque(x.type, x.id)));
      illisibles.clear();
      return liste.length;
    }
  };
}

export type RefusCoffre = { ok: false; raison: 'cle-perdue'; message: string };
export type OuvertureCoffre = { ok: true; depot: Depot; nouveau: boolean } | RefusCoffre;

const CLE_PERDUE: RefusCoffre = {
  ok: false, raison: 'cle-perdue',
  message: 'Les données chiffrées de cet appareil ne peuvent plus être lues : la clé de chiffrement est introuvable.'
};

async function contientDesDonnees(brut: StockageBrut): Promise<boolean> {
  for (const t of ['eleves', 'seances', 'activites', 'pia', 'reglages'] as const) if ((await brut.lire(t)).length) return true;
  return false;
}

/**
 * Ouvre l'espace chiffré d'un propriétaire. Première fois : crée la clé. Ensuite : vérifie qu'elle ouvre bien la
 * rangée de contrôle. Des données sans clé (ou une clé qui n'ouvre plus rien) = « clé perdue » : on ne devine rien,
 * on ne supprime rien, on le dit à l'utilisateur (récupération depuis OneDrive ou une copie de secours).
 */
export async function ouvrirCoffre(brut: StockageBrut, proprietaire: string): Promise<OuvertureCoffre> {
  let cle = await brut.lireCle();
  const controle = (await brut.lire('meta')).find((r) => r.id === VERIFICATION.id);
  const ctx = { proprietaire, table: VERIFICATION.table, id: VERIFICATION.id };
  let nouveau = false;

  if (cle && controle) {
    try { await ouvrir(cle, ctx, controle.c); } catch { return CLE_PERDUE; }
  } else {
    if (!cle) {
      if (controle || await contientDesDonnees(brut)) return CLE_PERDUE;
      cle = await nouvelleCle();
      await brut.ecrireCle(cle);
      nouveau = true;
    }
    // Création interrompue entre la clé et le contrôle : on pose le contrôle.
    await brut.ecrire('meta', [{ id: VERIFICATION.id, c: await sceller(cle, ctx, { ok: true }) }]);
  }
  return { ok: true, depot: creerDepotChiffre(brut, cle, proprietaire), nouveau };
}
