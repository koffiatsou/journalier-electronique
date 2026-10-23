import type { Seance } from '../types.ts';
import { nettoyer } from './langue.ts';
import type { Faits } from './types.ts';

const sansVide = (liste: readonly string[]): string[] => liste.map(nettoyer).filter(Boolean);

/* Anciens enregistrements : le texte de repli d'un co-enseignement n'est pas un objectif. */
function objectifPropre(presence: Seance['presence'], texte: string): string {
  if (presence === 'absent_eleve_coteach' && /^(co-enseignement|intervention en co-enseignement)/i.test(texte)) return '';
  return texte;
}

/** Séance → faits : nettoie les textes, retire ce qui est vide. Aucune rédaction ici. */
export function versFaits(s: Seance, titulaire = ''): Faits {
  return {
    id: s.id,
    eleveId: s.eleveId,
    date: nettoyer(s.date),
    matiere: nettoyer(s.matiere),
    titulaire: nettoyer(titulaire),
    presence: s.presence,
    interventions: sansVide(s.interventions),
    objectifLecon: objectifPropre(s.presence, nettoyer(s.objectifLecon)),
    contenuClasse: nettoyer(s.contenuClasse),
    monObjectif: nettoyer(s.monObjectif),
    observations: s.observations.map((o) => ({ texte: nettoyer(o.texte), niveau: o.niveau })).filter((o) => o.texte),
    remarque: nettoyer(s.remarque),
    competences: s.competences.map((c) => ({ texte: nettoyer(c.texte), niveau: c.niveau })).filter((c) => c.texte),
    precisionCompetence: nettoyer(s.precisionCompetence),
    aides: s.aides.map((a) => ({ texte: nettoyer(a.nom), effet: a.effet })).filter((a) => a.texte),
    precisionAide: nettoyer(s.precisionAide),
    transfert: s.transfert,
    precisionTransfert: nettoyer(s.precisionTransfert),
    actions: sansVide(s.suite.actions),
    modalite: nettoyer(s.suite.modalite),
    objectifSuite: nettoyer(s.suite.objectif),
    collaborations: sansVide(s.suite.collaborations),
    precisionSuite: nettoyer(s.suite.precision)
  };
}
