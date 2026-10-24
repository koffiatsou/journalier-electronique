/**
 * Recherche d'une séance par un mot : nom de l'élève, matière, objectif, observations, compétences, aides, suite…
 * Les accents et les majuscules sont ignorés ; tous les mots saisis doivent se trouver dans la séance.
 */
import { motsDeRecherche } from '../eleves/eleves.ts';
import { dateFR } from '../redaction/langue.ts';
import { sansAccents } from '../referentiel/texte.ts';
import { PRESENCE_LIBELLES } from '../types.ts';
import type { Eleve, Seance } from '../types.ts';

export function texteSeance(s: Seance, eleve?: Eleve): string {
  return sansAccents([
    eleve ? `${eleve.nom} ${eleve.prenom} ${eleve.classe}` : '',
    s.date, dateFR(s.date), s.periodeDebut, s.matiere, s.niveauScolaire, PRESENCE_LIBELLES[s.presence].titre,
    ...s.interventions, s.objectifLecon, s.contenuClasse, s.monObjectif,
    ...s.observations.map((o) => o.texte), s.remarque,
    ...s.competences.map((c) => c.texte), s.precisionCompetence,
    ...s.aides.map((a) => a.nom), s.precisionAide,
    ...s.suite.actions, s.suite.modalite, s.suite.objectif, ...s.suite.collaborations, s.suite.precision
  ].join(' '));
}

export function rechercherSeances(seances: readonly Seance[], requete: string, eleveParId: ReadonlyMap<string, Eleve>): Seance[] {
  const mots = motsDeRecherche(requete);
  if (!mots.length) return [...seances];
  return seances.filter((s) => { const t = texteSeance(s, eleveParId.get(s.eleveId)); return mots.every((m) => t.includes(m)); });
}
