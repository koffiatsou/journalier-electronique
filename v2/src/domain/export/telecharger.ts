import { construireJournalier, TYPE_DOCX } from './index.ts';
import type { Eleve, Seance } from '../types.ts';

async function chargerModele(): Promise<Uint8Array> {
  const reponse = await fetch('./modeles/Journalier_modele_papier.docx', { cache: 'no-store' });
  if (!reponse.ok) throw new Error('Le modèle Word du Journalier est introuvable.');
  return new Uint8Array(await reponse.arrayBuffer());
}

/** Génère le Journalier Word d'un élève et le télécharge. Rien ne quitte l'appareil. */
export async function telechargerJournalier(eleve: Eleve, seances: readonly Seance[], deidentifie: boolean): Promise<string> {
  const { octets, nom } = await construireJournalier(await chargerModele(), eleve, seances, deidentifie);
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([octets as BlobPart], { type: TYPE_DOCX }));
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
  return nom;
}
