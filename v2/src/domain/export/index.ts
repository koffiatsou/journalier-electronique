import { lireZip, ecrireZip } from './zip.ts';
import { identiteDe, nomFichier, preparerBlocs, remplirDocument } from './journalier.ts';
import type { Eleve, Seance } from '../types.ts';

export { lireZip, ecrireZip } from './zip.ts';
export { remplirDocument, preparerBlocs, nomFichier, anneeScolaire } from './journalier.ts';

export const TYPE_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Construit le Journalier Word d'un élève à partir du modèle papier (octets du .docx). */
export async function construireJournalier(modele: Uint8Array, eleve: Eleve, seances: readonly Seance[], deidentifie = false): Promise<{ octets: Uint8Array; nom: string }> {
  const entrees = await lireZip(modele);
  const doc = entrees['word/document.xml'];
  if (!doc) throw new Error('Modèle Journalier invalide.');
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  entrees['word/document.xml'] = enc.encode(remplirDocument(dec.decode(doc), preparerBlocs(seances, eleve, deidentifie), identiteDe(eleve, deidentifie)));
  const core = entrees['docProps/core.xml'];
  if (core) {
    entrees['docProps/core.xml'] = enc.encode(dec.decode(core)
      .replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, '<dc:creator>Pôle Territorial WBE BXL</dc:creator>')
      .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>Pôle Territorial WBE BXL</cp:lastModifiedBy>'));
  }
  return { octets: ecrireZip(entrees), nom: nomFichier(eleve, seances, deidentifie) };
}
