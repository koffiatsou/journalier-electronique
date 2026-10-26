import { lireZip, ecrireZip } from './zip.ts';
import { identiteDe, nomFichier, preparerBlocs, remplirDocument } from './journalier.ts';
import { nomFichierPia, remplirEntete, remplirPia } from './pia.ts';
import type { Pia } from '../pia/types.ts';
import type { Eleve, Seance } from '../types.ts';

export { lireZip, ecrireZip } from './zip.ts';
export { remplirDocument, preparerBlocs, nomFichier, anneeScolaire } from './journalier.ts';
export { remplirPia, nomFichierPia } from './pia.ts';

export const TYPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const TYPE_ZIP = 'application/zip';

export interface OptionsExport {
  /** Sans nom, prénom, date de naissance, école ni titulaire. */
  deidentifie?: boolean;
  /** Libellé de la période pour le nom du fichier (sans « / »), ex. « 2026-2027 au 24-10-2026 ». */
  periode?: string;
  /** Distingue des fichiers dé-identifiés d'un même export. */
  precision?: string;
}

/** Construit le Journalier Word d'un élève à partir du modèle papier (octets du .docx). */
export async function construireJournalier(modele: Uint8Array, eleve: Eleve, seances: readonly Seance[], options: OptionsExport | boolean = {}): Promise<{ octets: Uint8Array; nom: string }> {
  const { deidentifie = false, periode = '', precision = '' } = typeof options === 'boolean' ? { deidentifie: options } : options;
  const entrees = await lireZip(modele);
  const doc = entrees['word/document.xml'];
  if (!doc) throw new Error('Modèle Journalier invalide.');
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  entrees['word/document.xml'] = enc.encode(remplirDocument(dec.decode(doc), preparerBlocs(seances, eleve, deidentifie), identiteDe(eleve, deidentifie)));
  signerPole(entrees);
  return { octets: ecrireZip(entrees), nom: nomFichier(eleve, seances, deidentifie, periode, precision) };
}

/** Le créateur du fichier est toujours le pôle, jamais une personne : on le remet à chaque export. */
function signerPole(entrees: Record<string, Uint8Array>): void {
  const core = entrees['docProps/core.xml'];
  if (!core) return;
  const dec = new TextDecoder();
  entrees['docProps/core.xml'] = new TextEncoder().encode(dec.decode(core)
    .replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, '<dc:creator>Pôle Territorial WBE BXL</dc:creator>')
    .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>Pôle Territorial WBE BXL</cp:lastModifiedBy>'));
}

/** Construit le PIA Word d'un élève à partir du modèle officiel (octets du .docx). */
export async function construirePia(modele: Uint8Array, pia: Pia, eleve: Eleve): Promise<{ octets: Uint8Array; nom: string }> {
  const entrees = await lireZip(modele);
  const doc = entrees['word/document.xml'];
  if (!doc) throw new Error('Modèle PIA invalide.');
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const identite = {
    nom: `${eleve.nom} ${eleve.prenom}`.trim(), dateNaissance: eleve.dateNaissance, ecole: eleve.ecole, classe: eleve.classe,
    option: pia.identite.option, titulaire: eleve.titulaire, cpms: pia.identite.cpms,
    representantPole: pia.identite.representantPole, responsable: pia.identite.responsable
  };
  entrees['word/document.xml'] = enc.encode(remplirPia(dec.decode(doc), { pia, identite }));
  for (const nom of Object.keys(entrees)) {
    if (/^word\/header\d*\.xml$/.test(nom)) entrees[nom] = enc.encode(remplirEntete(dec.decode(entrees[nom]), pia.annee));
  }
  signerPole(entrees);
  return { octets: ecrireZip(entrees), nom: nomFichierPia(eleve, pia.annee) };
}

/** Rend chaque nom unique dans l'archive (« … (2).docx »). */
function unique(nom: string, pris: Set<string>): string {
  let n = nom;
  for (let i = 2; pris.has(n); i += 1) n = nom.replace(/\.docx$/, ` (${i}).docx`);
  pris.add(n);
  return n;
}

/**
 * Plusieurs élèves : un Journalier Word par élève, réunis dans une archive .zip.
 * Les élèves sans séance dans la période sont ignorés.
 */
export async function construireJournaliers(modele: Uint8Array, groupes: readonly { eleve: Eleve; seances: readonly Seance[] }[], options: Omit<OptionsExport, 'precision'> = {}): Promise<{ octets: Uint8Array; nom: string; nombre: number }> {
  const entrees: Record<string, Uint8Array> = {};
  const pris = new Set<string>();
  for (const { eleve, seances } of groupes) {
    if (!seances.length) continue;
    const { octets, nom } = await construireJournalier(modele, eleve, seances, { ...options, precision: options.deidentifie ? eleve.classe : '' });
    entrees[unique(nom, pris)] = octets;
  }
  const nombre = Object.keys(entrees).length;
  if (!nombre) throw new Error('Aucune séance dans cette période.');
  const base = `Journaliers${options.deidentifie ? ' - dé-identifiés' : ''}${options.periode ? ` - ${options.periode}` : ''}`;
  return { octets: ecrireZip(entrees), nom: `${base}.zip`.replace(/[\\/:*?"<>|]/g, ''), nombre };
}
