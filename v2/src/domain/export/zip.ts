/** Lecture et écriture d'archives ZIP (le .docx en est une), sans dépendance : tout reste dans le navigateur. */

const MAX_ENTREES = 500;
const MAX_OCTETS = 30 * 1024 * 1024;

let tableCrc: Uint32Array | null = null;
export function crc32(octets: Uint8Array): number {
  if (!tableCrc) {
    tableCrc = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      tableCrc[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of octets) c = tableCrc[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type Entrees = Record<string, Uint8Array>;

export async function lireZip(donnees: Uint8Array): Promise<Entrees> {
  const vue = new DataView(donnees.buffer, donnees.byteOffset, donnees.byteLength);
  let fin = -1;
  for (let i = donnees.length - 22; i >= Math.max(0, donnees.length - 65557); i--) {
    if (vue.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('Archive Word invalide ou illisible.');
  const nombre = vue.getUint16(fin + 10, true);
  if (nombre > MAX_ENTREES) throw new Error('Le document Word contient trop d’éléments.');
  let p = vue.getUint32(fin + 16, true);
  const sortie: Entrees = {};
  let total = 0;
  for (let i = 0; i < nombre; i++) {
    if (vue.getUint32(p, true) !== 0x02014b50) throw new Error('Répertoire de l’archive Word invalide.');
    const methode = vue.getUint16(p + 10, true);
    const compresse = vue.getUint32(p + 20, true);
    const taille = vue.getUint32(p + 24, true);
    const nom = vue.getUint16(p + 28, true);
    const extra = vue.getUint16(p + 30, true);
    const commentaire = vue.getUint16(p + 32, true);
    const local = vue.getUint32(p + 42, true);
    const titre = new TextDecoder().decode(donnees.subarray(p + 46, p + 46 + nom));
    const debut = local + 30 + vue.getUint16(local + 26, true) + vue.getUint16(local + 28, true);
    total += taille;
    if (total > MAX_OCTETS) throw new Error('Le document Word est trop volumineux.');
    const brut = donnees.slice(debut, debut + compresse);
    if (methode === 0) sortie[titre] = brut;
    else if (methode === 8) {
      const flux = new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      sortie[titre] = new Uint8Array(await new Response(flux).arrayBuffer());
    } else throw new Error('Compression de l’archive Word non prise en charge.');
    p += 46 + nom + extra + commentaire;
  }
  return sortie;
}

const u16 = (v: number): number[] => [v & 255, (v >>> 8) & 255];
const u32 = (v: number): number[] => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];

function coller(morceaux: Uint8Array[]): Uint8Array {
  const sortie = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
  let o = 0;
  for (const m of morceaux) { sortie.set(m, o); o += m.length; }
  return sortie;
}

/** Écrit une archive sans compression (suffisant pour un .docx et sans risque). */
export function ecrireZip(entrees: Entrees): Uint8Array {
  const enc = new TextEncoder();
  const locaux: Uint8Array[] = [];
  const centraux: Uint8Array[] = [];
  let decalage = 0;
  for (const [titre, donnees] of Object.entries(entrees)) {
    const nom = enc.encode(titre);
    const crc = crc32(donnees);
    const entete = Uint8Array.from([...u32(0x04034b50), 20, 0, 0, 0, 0, 0, ...u16(0), ...u16(0), ...u32(crc), ...u32(donnees.length), ...u32(donnees.length), ...u16(nom.length), ...u16(0)]);
    locaux.push(entete, nom, donnees);
    centraux.push(Uint8Array.from([...u32(0x02014b50), 20, 0, 20, 0, 0, 0, 0, 0, ...u16(0), ...u16(0), ...u32(crc), ...u32(donnees.length), ...u32(donnees.length), ...u16(nom.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(decalage), ...nom]));
    decalage += entete.length + nom.length + donnees.length;
  }
  const repertoire = coller(centraux);
  const nombre = Object.keys(entrees).length;
  const fin = Uint8Array.from([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(nombre), ...u16(nombre), ...u32(repertoire.length), ...u32(decalage), ...u16(0)]);
  return coller([...locaux, repertoire, fin]);
}
