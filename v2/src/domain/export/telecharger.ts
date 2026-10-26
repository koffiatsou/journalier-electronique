import { construireJournalier, construireJournaliers, construirePia, TYPE_DOCX, TYPE_ZIP } from './index.ts';
import type { OptionsExport } from './index.ts';
import type { Pia } from '../pia/types.ts';
import type { Eleve, Seance } from '../types.ts';

async function chargerFichier(chemin: string, erreur: string): Promise<Uint8Array> {
  const reponse = await fetch(chemin, { cache: 'no-store' });
  if (!reponse.ok) throw new Error(erreur);
  return new Uint8Array(await reponse.arrayBuffer());
}

const chargerModele = (): Promise<Uint8Array> => chargerFichier('./modeles/Journalier_modele_papier.docx', 'Le modèle Word du Journalier est introuvable.');
const chargerModelePia = (): Promise<Uint8Array> => chargerFichier('./modeles/PIA_modele_officiel_2025-09-11.docx', 'Le modèle Word du PIA est introuvable.');

function telecharger(octets: Uint8Array, nom: string, type: string): void {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([octets as BlobPart], { type }));
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
}

/** Génère le Journalier Word d'un élève et le télécharge. Rien ne quitte l'appareil. */
export async function telechargerJournalier(eleve: Eleve, seances: readonly Seance[], options: OptionsExport = {}): Promise<string> {
  const { octets, nom } = await construireJournalier(await chargerModele(), eleve, seances, options);
  telecharger(octets, nom, TYPE_DOCX);
  return nom;
}

/** Plusieurs élèves : une archive .zip avec un Journalier Word par élève. */
export async function telechargerJournaliers(groupes: readonly { eleve: Eleve; seances: readonly Seance[] }[], options: Omit<OptionsExport, 'precision'> = {}): Promise<{ nom: string; nombre: number }> {
  const { octets, nom, nombre } = await construireJournaliers(await chargerModele(), groupes, options);
  telecharger(octets, nom, TYPE_ZIP);
  return { nom, nombre };
}

/** Génère le PIA Word (modèle officiel) d'un élève et le télécharge. Rien ne quitte l'appareil. */
export async function telechargerPia(pia: Pia, eleve: Eleve): Promise<string> {
  const { octets, nom } = await construirePia(await chargerModelePia(), pia, eleve);
  telecharger(octets, nom, TYPE_DOCX);
  return nom;
}
