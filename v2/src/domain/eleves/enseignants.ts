import { sansAccents } from '../referentiel/texte.ts';
import type { EnseignantCours, Eleve, Seance } from '../types.ts';

const cle = (matiere: string): string => sansAccents(matiere).trim();

/** Relit la liste d'un dossier : espaces retirés, lignes incomplètes écartées, une seule ligne par matière (la première). */
export function normaliserEnseignants(brut: unknown): EnseignantCours[] {
  if (!Array.isArray(brut)) return [];
  const vus = new Set<string>();
  const liste: EnseignantCours[] = [];
  for (const x of brut) {
    const o = (x ?? {}) as Record<string, unknown>;
    const matiere = typeof o.matiere === 'string' ? o.matiere.trim() : '';
    const nom = typeof o.nom === 'string' ? o.nom.trim() : '';
    if (!matiere || !nom || vus.has(cle(matiere))) continue;
    vus.add(cle(matiere));
    liste.push({ matiere, nom });
  }
  return liste;
}

/** Enseignant du cours d'après le dossier de l'élève ; sans ligne pour cette matière, le titulaire de classe. */
export function enseignantDuDossier(eleve: Pick<Eleve, 'titulaire' | 'enseignants'> | undefined, matiere: string): string {
  if (!eleve) return '';
  const k = cle(matiere);
  const trouve = k ? eleve.enseignants?.find((x) => cle(x.matiere) === k) : undefined;
  return (trouve?.nom ?? eleve.titulaire ?? '').trim();
}

/**
 * Nom à écrire dans la colonne « Titulaire » d'une séance : celui noté dans la séance (remplacement, ou nom gardé
 * à l'encodage), sinon celui du dossier. Les séances encodées avant ce réglage prennent donc le dossier actuel.
 */
export function enseignantDeSeance(seance: Pick<Seance, 'matiere' | 'enseignant'>, eleve: Pick<Eleve, 'titulaire' | 'enseignants'> | undefined): string {
  return seance.enseignant?.trim() || enseignantDuDossier(eleve, seance.matiere);
}

/** Séance à enregistrer : le nom saisi est gardé, sinon celui du dossier est noté dans la séance (l'historique ne bouge plus ensuite). */
export function fixerEnseignant<T extends Pick<Seance, 'matiere' | 'enseignant'>>(seance: T, eleve: Pick<Eleve, 'titulaire' | 'enseignants'> | undefined): T {
  const nom = enseignantDeSeance(seance, eleve);
  const { enseignant: _ancien, ...reste } = seance;
  return (nom ? { ...reste, enseignant: nom } : reste) as T;
}
