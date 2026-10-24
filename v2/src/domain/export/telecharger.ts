import { construireJournalier, construireJournaliers, TYPE_DOCX, TYPE_ZIP } from './index.ts';
import type { OptionsExport } from './index.ts';
import type { Eleve, Seance } from '../types.ts';

async function chargerModele(): Promise<Uint8Array> {
  const reponse = await fetch('./modeles/Journalier_modele_papier.docx', { cache: 'no-store' });
  if (!reponse.ok) throw new Error('Le modèle Word du Journalier est introuvable.');
  return new Uint8Array(await reponse.arrayBuffer());
}

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
