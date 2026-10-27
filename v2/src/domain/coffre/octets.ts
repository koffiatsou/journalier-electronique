/** Octets ⇄ texte base64, sans dépendance (fonctionne dans le navigateur et dans Node). */

export function versBase64(octets: Uint8Array): string {
  let binaire = '';
  // Par paquets : `String.fromCharCode(...)` plante au-delà de quelques dizaines de milliers d'octets.
  for (let i = 0; i < octets.length; i += 0x8000) binaire += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  return btoa(binaire);
}

/** `null` si le texte n'est pas du base64 valide. */
export function depuisBase64(texte: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(texte) || texte.length % 4 !== 0) return null;
  try {
    const binaire = atob(texte);
    const octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
    return octets;
  } catch { return null; }
}

export const encoder = new TextEncoder();
export const decoder = new TextDecoder('utf-8', { fatal: true });
