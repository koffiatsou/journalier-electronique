/*
 * Texte de la réunion, prêt à copier dans un message ou un document.
 * Texte brut : puces « • », pas de mise en forme cachée.
 */
import { deIdentifier } from '../redaction/deidentifier.ts';
import { NBSP, dateFR, majusculePremiere as Maj } from '../redaction/langue.ts';
import type { Synthese, SyntheseMatiere } from '../redaction/index.ts';
import { retenusParMatiere } from './objectifs.ts';
import type { ObjectifRetenu } from './objectifs.ts';

export interface EnteteReunion {
  eleve: string;
  classe: string;
  /** Libellé de la période, par exemple « 2026-2027 au 26/10/2026 ». */
  periode: string;
  /** Noms à retirer du texte (dé-identification) ; vide = le nom de l'élève reste. */
  masquer?: readonly string[];
}

const puces = (lignes: readonly string[]): string[] => lignes.map((l) => `• ${l}`);

function dates(m: SyntheseMatiere): string {
  if (!m.dateDebut) return '';
  return m.dateDebut === m.dateFin ? ` (le ${dateFR(m.dateDebut)})` : ` (du ${dateFR(m.dateDebut)} au ${dateFR(m.dateFin)})`;
}

function blocMatiere(m: SyntheseMatiere): string[] {
  const out: string[] = [`${m.matiere}${dates(m)}`];
  const rubrique = (titre: string, lignes: readonly string[]) => {
    if (lignes.length) out.push(titre, ...puces(lignes));
  };
  rubrique('Points d’appui', m.appuis);
  rubrique('À travailler', m.aTravailler);
  rubrique('Compétence travaillée', m.competences);
  rubrique('Aides utilisées', m.aides.map(Maj));
  rubrique('Aides sans effet constaté', m.aidesSansEffet.map(Maj));
  if (out.length === 1) out.push('Aucune observation notée.');
  return out;
}

export function texteReunion(s: Synthese, retenus: readonly ObjectifRetenu[], e: EnteteReunion): string {
  const masque = (e.masquer ?? []).length > 0;
  const tete = [
    `Réunion${NBSP}: ${masque ? 'élève' : e.eleve}${e.classe ? ` (${e.classe})` : ''}`,
    `Période${NBSP}: ${e.periode}`
  ];
  const corps: string[] = [`${s.seances} séance${s.seances > 1 ? 's' : ''} d’accompagnement`];
  if (s.absences) corps.push(s.absences);

  for (const m of s.matieres) corps.push('', ...blocMatiere(m));

  const groupes = retenusParMatiere(retenus);
  if (groupes.length) {
    corps.push('', 'Objectifs retenus pour la suite');
    for (const g of groupes) {
      if (g.matiere) corps.push(g.matiere);
      corps.push(...puces(g.objectifs.map((o) => o.texte)));
    }
  }

  // L'en-tête est ajouté après le masquage : « élève » n'est jamais « remplacé » une seconde fois.
  const texteCorps = corps.join('\n');
  return [...tete, masque ? deIdentifier(texteCorps, e.masquer ?? []) : texteCorps].join('\n');
}
