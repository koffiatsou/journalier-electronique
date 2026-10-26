/** Écriture JSON stable : clés triées, valeurs indéfinies ignorées. Deux objets identiques donnent le même texte. */
export function canonique(valeur: unknown): string {
  if (valeur === null || typeof valeur !== 'object') return JSON.stringify(valeur) ?? 'null';
  if (Array.isArray(valeur)) return `[${valeur.map((v) => (v === undefined ? 'null' : canonique(v))).join(',')}]`;
  const o = valeur as Record<string, unknown>;
  const morceaux = Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${canonique(o[k])}`);
  return `{${morceaux.join(',')}}`;
}

/** Empreinte (SHA-256, en hexadécimal) du contenu d'un objet : sert à savoir s'il a changé depuis la dernière synchronisation. */
export async function empreinte(valeur: unknown): Promise<string> {
  const octets = new TextEncoder().encode(canonique(valeur));
  const hache = await globalThis.crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(hache)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
