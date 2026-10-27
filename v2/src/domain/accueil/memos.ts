/*
 * Mémos de l'accueil : de petits « à ne pas oublier », libres ou rattachés à un élève ou à une école.
 * Ils sont enregistrés comme un réglage partagé (« memos ») : ils suivent l'agent d'un appareil à l'autre via OneDrive.
 */
export interface Memo {
  id: string;
  texte: string;
  fait: boolean;
  /** Mémo rattaché à un élève : il réapparaît sur son prochain créneau. */
  eleveId?: string;
  /** Mémo rattaché à une école : il réapparaît sur chaque créneau de cette école. */
  ecoleId?: string;
  creeLe: string;
}

export const REGLAGE_MEMOS = 'memos';
export const MEMOS_MAXI = 200;
export const MEMO_TEXTE_MAXI = 180;

const texte = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Mémos lisibles à partir d'une valeur enregistrée ou reçue : ce qui est abîmé est écarté, le reste est gardé. */
export function normaliserMemos(brut: unknown): Memo[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  const sortie: Memo[] = [];
  for (const x of brut) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const id = texte(o.id).trim();
    const t = texte(o.texte).trim().slice(0, MEMO_TEXTE_MAXI);
    if (!id || !t || vus.has(id)) continue;
    vus.add(id);
    const eleveId = texte(o.eleveId).trim();
    const ecoleId = texte(o.ecoleId).trim();
    sortie.push({ id, texte: t, fait: o.fait === true, ...(eleveId ? { eleveId } : {}), ...(ecoleId && !eleveId ? { ecoleId } : {}), creeLe: texte(o.creeLe) });
    if (sortie.length >= MEMOS_MAXI) break;
  }
  return sortie;
}

export const nouvelIdMemo = (): string => globalThis.crypto?.randomUUID?.() ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

/** Un nouveau mémo, ou `null` si le texte est vide. Un mémo est rattaché à un élève ou à une école, jamais aux deux. */
export function creerMemo(saisie: string, cible: { eleveId?: string; ecoleId?: string } = {}, id = nouvelIdMemo(), maintenant = new Date().toISOString()): Memo | null {
  const t = saisie.trim().slice(0, MEMO_TEXTE_MAXI);
  if (!t) return null;
  return { id, texte: t, fait: false, ...(cible.eleveId ? { eleveId: cible.eleveId } : cible.ecoleId ? { ecoleId: cible.ecoleId } : {}), creeLe: maintenant };
}

export const basculerMemo = (memos: readonly Memo[], id: string): Memo[] => memos.map((m) => (m.id === id ? { ...m, fait: !m.fait } : m));
export const retirerMemo = (memos: readonly Memo[], id: string): Memo[] => memos.filter((m) => m.id !== id);
/** Retire les mémos faits. */
export const viderFaits = (memos: readonly Memo[]): Memo[] => memos.filter((m) => !m.fait);

/** Mémos encore à faire qui concernent un créneau : ceux de l'élève, puis ceux de l'école. */
export function memosDuCreneau(memos: readonly Memo[], eleveId: string | undefined, ecoleId: string): Memo[] {
  return memos.filter((m) => !m.fait && ((m.eleveId && m.eleveId === eleveId) || (!m.eleveId && m.ecoleId === ecoleId)));
}
