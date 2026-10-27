/*
 * Identité des objets synchronisés.
 *
 * Chaque élève, séance, activité d'agenda, PIA et réglage partagé = un petit fichier dans OneDrive.
 * Une « clé » (type:identifiant) désigne un objet côté application ; un « chemin » désigne son fichier.
 */

export type TypeObjet = 'eleve' | 'seance' | 'activite' | 'pia' | 'reglage';

/** Ordre de traitement : les élèves d'abord (une séance ne doit jamais arriver sans son élève). */
export const TYPES_OBJETS: readonly TypeObjet[] = ['eleve', 'seance', 'activite', 'pia', 'reglage'];

/** Dossier OneDrive de chaque type (sous le dossier « v2 » de l'application, jamais celui de la V75). */
export const DOSSIERS: Readonly<Record<TypeObjet, string>> = {
  eleve: 'eleves',
  seance: 'seances',
  activite: 'agenda',
  pia: 'pia',
  reglage: 'reglages'
};

/** Réglages partagés entre les appareils (les autres, comme le thème, restent propres à l'appareil). */
export const REGLAGES_SYNCHRONISES: readonly string[] = ['agenda-horaires', 'agenda-ecoles', 'agenda-semaine-type'];

export interface RefObjet { type: TypeObjet; id: string }
export type Cle = string;

export const cle = (type: TypeObjet, id: string): Cle => `${type}:${id}`;

export function decouperCle(c: Cle): RefObjet | null {
  const i = c.indexOf(':');
  if (i < 1) return null;
  const type = c.slice(0, i);
  const id = c.slice(i + 1);
  return (TYPES_OBJETS as readonly string[]).includes(type) && id ? { type: type as TypeObjet, id } : null;
}

/** Les données de démonstration portent toujours un identifiant « demo-… » et ne partent jamais vers un vrai compte. */
export const PREFIXE_DEMO = 'demo-';
export const estDemo = (id: string): boolean => id.startsWith(PREFIXE_DEMO);

const SUR = /[a-z0-9._-]/;
const enc = new TextEncoder();
const dec = new TextDecoder('utf-8', { fatal: true });

/**
 * Nom de fichier sûr pour un identifiant : minuscules, chiffres, « . _ - » gardés ; le reste devient ~HH (octets UTF-8).
 * OneDrive ne distingue pas majuscules et minuscules : les majuscules sont donc codées elles aussi.
 */
export function nomFichier(id: string): string {
  let sortie = '';
  for (const car of id) {
    if (SUR.test(car)) { sortie += car; continue; }
    for (const octet of enc.encode(car)) sortie += `~${octet.toString(16).padStart(2, '0')}`;
  }
  return `${sortie}.json`;
}

/** Inverse de `nomFichier` ; `null` si le nom n'est pas un fichier de l'application. */
export function idDepuisNom(nom: string): string | null {
  if (!nom.endsWith('.json')) return null;
  const brut = nom.slice(0, -5);
  if (!brut) return null;
  const octets: number[] = [];
  for (let i = 0; i < brut.length; i += 1) {
    const c = brut[i]!;
    if (c === '~') {
      const hex = brut.slice(i + 1, i + 3);
      if (!/^[0-9a-f]{2}$/.test(hex)) return null;
      octets.push(parseInt(hex, 16));
      i += 2;
    } else if (SUR.test(c)) {
      octets.push(c.charCodeAt(0));
    } else {
      return null;
    }
  }
  try { return dec.decode(Uint8Array.from(octets)); } catch { return null; }
}

/** Chemin du fichier d'un objet, relatif au dossier de l'application : « seances/abc.json ». */
export const cheminDistant = (type: TypeObjet, id: string): string => `${DOSSIERS[type]}/${nomFichier(id)}`;
