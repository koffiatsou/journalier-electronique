import type { CompteV75, Ecart, EtatV75, PiaBrutV75 } from './types.ts';

/*
 * Lecture du coffre de la V75 (base `journalier-secure-v74`), en lecture seule.
 * Chaque enregistrement est chiffré en AES-GCM avec une clé du navigateur qui n'est pas exportable mais reste utilisable ici,
 * parce que la V2 et la V75 sont sur le même site. Le format est celui de `src/app/storage-vault.js` de la V75 :
 * données authentifiées `journalier-storage-v2|<compte>|<type>|<id>`, empreinte SHA-256 du texte chiffré en hexadécimal.
 * Ce fichier ne dépend ni de l'écran ni d'IndexedDB : le stockage est passé en paramètre (et remplacé par un faux dans les tests).
 */

/** Version du format d'enregistrement de la V75 qu'on sait relire. */
export const VERSION_STOCKAGE_V75 = 2;

export interface RangeeV75 {
  id: string;
  ownerId: string;
  type: string;
  schemaVersion: number;
  iv: ArrayBuffer | Uint8Array;
  ciphertext: ArrayBuffer | Uint8Array;
  digest?: string;
}

export type MagasinV75 = 'meta' | 'students' | 'sessions' | 'agenda' | 'pia';

export interface StockageV75 {
  /** Faux s'il n'y a pas de coffre V75 sur cet appareil (rien n'est alors créé). */
  existe(): Promise<boolean>;
  rangees(magasin: MagasinV75): Promise<RangeeV75[]>;
  /** Clés de chiffrement, par identifiant de compte V75. */
  cles(): Promise<{ compte: string; cle: CryptoKey }[]>;
  /** Referme la connexion à la base quand la lecture est finie. */
  fermer?(): Promise<void>;
}

const octets = (b: ArrayBuffer | Uint8Array): Uint8Array => (b instanceof Uint8Array ? b : new Uint8Array(b));

const hex = (b: ArrayBuffer): string => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Déchiffre un enregistrement ; lève une erreur (en français) s'il est abîmé, d'une autre version, ou n'ouvre pas avec cette clé. */
export async function dechiffrerRangee(r: RangeeV75, cle: CryptoKey): Promise<unknown> {
  if (!r.ciphertext || !r.iv || !r.ownerId || !r.type || r.id == null) throw new Error('enregistrement incomplet');
  if (r.schemaVersion !== VERSION_STOCKAGE_V75) throw new Error('version de stockage non prise en charge');
  const chiffre = octets(r.ciphertext);
  if (r.digest && hex(await crypto.subtle.digest('SHA-256', chiffre as BufferSource)) !== r.digest) throw new Error('empreinte invalide (enregistrement abîmé)');
  const donnees = new TextEncoder().encode(`journalier-storage-v${VERSION_STOCKAGE_V75}|${r.ownerId}|${r.type}|${String(r.id)}`);
  const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: octets(r.iv) as BufferSource, additionalData: donnees }, cle, chiffre as BufferSource);
  return JSON.parse(new TextDecoder().decode(clair));
}

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Brut) : {});
const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Les coffres V75 trouvés sur cet appareil, avec à qui ils appartiennent. Aucune donnée d'élève n'est lue ici. */
export async function trouverComptes(st: StockageV75): Promise<CompteV75[]> {
  if (!(await st.existe())) return [];
  const [cles, metas, eleves, seances] = await Promise.all([st.cles(), st.rangees('meta'), st.rangees('students'), st.rangees('sessions')]);
  const comptes: CompteV75[] = [];
  for (const { compte, cle } of cles) {
    const meta = metas.find((m) => m.ownerId === compte && String(m.id) === compte);
    if (!meta) continue;
    let identite: Brut = {};
    try {
      const lu = objet(await dechiffrerRangee(meta, cle));
      // La V75 considère un coffre « pas encore migré » comme absent : on fait de même.
      if (lu.migrationStatus !== 'complete') continue;
      identite = objet(lu.identity);
    } catch { continue; }
    comptes.push({
      id: compte,
      nom: texte(identite.displayName) || 'Compte de la V75',
      adresse: texte(identite.microsoftAccount),
      eleves: eleves.filter((r) => r.ownerId === compte).length,
      seances: seances.filter((r) => r.ownerId === compte).length
    });
  }
  return comptes;
}

/** Range un PIA lu (coffre ou OneDrive) dans la forme attendue. Trois formes ont existé dans la V75 (voir `journalierLoadGranularState`). */
export function piaBrutV75(valeur: unknown): PiaBrutV75 | null {
  const v = objet(valeur);
  if (v.record || v.imported) return { record: v.record ?? null, imported: v.imported ?? null };
  if (v.type === 'PIA_ANNUEL') return { record: v, imported: v.sourceContinuity ?? null };
  if (v.sourceContinuity) return { record: null, imported: v.sourceContinuity };
  return Object.keys(v).length ? { record: v, imported: null } : null;
}

export interface LectureV75 { etat: EtatV75; illisibles: Ecart[] }

/** Lit tout le coffre d'un compte. Un enregistrement illisible est signalé, jamais ignoré en silence. */
export async function lireCoffreV75(st: StockageV75, compte: string): Promise<LectureV75> {
  const cle = (await st.cles()).find((c) => c.compte === compte)?.cle;
  if (!cle) throw new Error('La clé de ce coffre est introuvable sur cet appareil.');
  const [students, sessions, agenda, pia] = await Promise.all([st.rangees('students'), st.rangees('sessions'), st.rangees('agenda'), st.rangees('pia')]);
  const illisibles: Ecart[] = [];
  const lire = async (rangees: RangeeV75[], quoi: string): Promise<{ id: string; valeur: unknown }[]> => {
    const lues: { id: string; valeur: unknown }[] = [];
    for (const r of rangees.filter((x) => x.ownerId === compte)) {
      try { lues.push({ id: String(r.id), valeur: await dechiffrerRangee(r, cle) }); } catch (e) {
        illisibles.push({ quoi: `${quoi} (${String(r.id)})`, raison: e instanceof Error ? e.message : 'illisible' });
      }
    }
    return lues;
  };
  const [eleves, seances, evenements, piaLues] = await Promise.all([lire(students, 'Élève'), lire(sessions, 'Séance'), lire(agenda, 'Agenda'), lire(pia, 'PIA')]);

  const agendaV75: { __events: unknown[]; __exceptions: unknown; __config: unknown } = { __events: [], __exceptions: {}, __config: {} };
  for (const e of evenements) {
    if (e.id === '__config') agendaV75.__config = e.valeur;
    else if (e.id === '__exceptions') agendaV75.__exceptions = e.valeur;
    else agendaV75.__events.push(e.valeur);
  }

  const pias: Record<string, PiaBrutV75> = {};
  for (const { id, valeur } of piaLues) {
    const p = piaBrutV75(valeur);
    if (p) pias[id] = p;
  }
  return { etat: { eleves: eleves.map((x) => x.valeur), seances: seances.map((x) => x.valeur), agenda: agendaV75, pias }, illisibles };
}
