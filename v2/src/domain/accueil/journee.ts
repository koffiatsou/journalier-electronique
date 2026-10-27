import { ajouterJours, avertissementsEcoles, ecoleDeOccurrence, heuresDe, libelle, libelleHeures, occurrences, occurrencesAgenda } from '../agenda/index.ts';
import type { Activite, Ecole, Occurrence } from '../agenda/index.ts';
import { enMinutes, heureValide } from '../agenda/horaires.ts';
import type { Eleve, Seance } from '../types.ts';

/** Ce qu'on sait de la dernière séance avec l'élève, pour reprendre où on s'était arrêté. */
export interface Suite {
  date: string;
  matiere: string;
  /** « Mon objectif » de cette séance. */
  monObjectif: string;
  /** Aides dont l'effet a été positif. */
  aides: string[];
  /** Points observés « Partiellement » : à retravailler. */
  aRetravailler: string[];
  /* Ce qui a été prévu pour la suite (étape « Suite » de la séance). */
  objectif: string;
  actions: string[];
  collaborations: string[];
  precision: string;
}

/**
 * Ce que la dernière séance de l'élève avant ce jour permet de rappeler. Seule la dernière séance compte : si elle n'a presque rien noté,
 * on ne remonte pas plus loin (une consigne ancienne ne serait plus d'actualité). Le format de la prochaine séance n'est pas repris.
 */
export function suiteDerniereSeance(eleveId: string | undefined, avant: string, seances: readonly Seance[]): Suite | null {
  if (!eleveId) return null;
  const derniere = seances
    .filter((s) => s.eleveId === eleveId && s.date < avant)
    .sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe))[0];
  if (!derniere) return null;
  const s = derniere.suite;
  return {
    date: derniere.date,
    matiere: derniere.matiere,
    monObjectif: derniere.monObjectif.trim(),
    aides: derniere.aides.filter((a) => a.effet === 2).map((a) => a.nom),
    aRetravailler: derniere.observations.filter((o) => o.niveau === 0).map((o) => o.texte),
    objectif: s.objectif.trim(),
    actions: s.actions,
    collaborations: s.collaborations,
    precision: s.precision.trim()
  };
}

/** Les lignes à montrer pour un rappel, avec leur étiquette ; vide si la séance n'a rien noté de plus que sa date. */
export function lignesSuite(s: Suite): { etiquette: string; texte: string }[] {
  const lignes: { etiquette: string; texte: string }[] = [
    { etiquette: 'Mon objectif', texte: s.monObjectif },
    { etiquette: 'Ce qui a aidé', texte: s.aides.join(' · ') },
    { etiquette: 'À retravailler', texte: s.aRetravailler.join(' · ') },
    { etiquette: 'Objectif prévu', texte: s.objectif },
    { etiquette: 'Actions prévues', texte: s.actions.join(' · ') },
    { etiquette: 'À concerter', texte: s.collaborations.join(' · ') },
    { etiquette: 'Précision', texte: s.precision }
  ];
  return lignes.filter((l) => l.texte);
}

/** Un rendez-vous de la journée, avec tout ce qu'il faut pour le préparer. */
export interface Creneau {
  occ: Occurrence;
  eleve: Eleve | undefined;
  nom: string;
  ecole: Ecole;
  /** « 08:00 – 08:50 », ou vide si l'école n'utilise pas ces périodes. */
  heures: string;
  /** Minutes depuis minuit ; `null` si les heures sont inconnues. */
  debutMin: number | null;
  finMin: number | null;
  suite: Suite | null;
}

/** Les rendez-vous d'un jour (annulés exclus), dans l'ordre de l'horloge, avec la suite notée la dernière fois. */
export function journeeDu(date: string, activites: readonly Activite[], seances: readonly Seance[], eleves: readonly Eleve[], ecoles: readonly Ecole[]): Creneau[] {
  const creneaux = occurrencesAgenda(activites, date, date, seances)
    .filter((o) => o.statut !== 'annule')
    .map((occ): Creneau => {
      const eleve = eleves.find((e) => e.id === occ.activite.eleveId);
      const ecole = ecoleDeOccurrence(occ, eleves, ecoles);
      const h = heuresDe(ecole, occ.debut, occ.fin);
      const valide = h && heureValide(h.debut) && heureValide(h.fin);
      return {
        occ, eleve, ecole,
        nom: libelle(occ.activite, eleve ? `${eleve.prenom} ${eleve.nom}`.trim() : undefined),
        heures: libelleHeures(h),
        debutMin: valide ? enMinutes(h.debut) : null,
        finMin: valide ? enMinutes(h.fin) : null,
        suite: occ.activite.type === 'eleve' ? suiteDerniereSeance(occ.activite.eleveId, date, seances) : null
      };
    });
  return creneaux.sort((a, b) => (a.debutMin ?? 1e6 + a.occ.debut) - (b.debutMin ?? 1e6 + b.occ.debut) || a.occ.cle.localeCompare(b.occ.cle));
}

/** Passage d'une école à une autre dans la journée. */
export interface Deplacement {
  de: Creneau;
  vers: Creneau;
  /** Minutes entre la fin du premier rendez-vous et le début du suivant (négatif : ils se chevauchent). */
  ecart: number;
  trajet: number;
  /** Le temps libre est plus court que le trajet prévu. */
  serre: boolean;
}

/** Les changements d'école entre deux rendez-vous qui se suivent. */
export function deplacements(creneaux: readonly Creneau[], trajet: number): Deplacement[] {
  const sortie: Deplacement[] = [];
  const horaires = creneaux.filter((c) => c.debutMin !== null && c.finMin !== null);
  for (let i = 0; i < horaires.length - 1; i++) {
    const de = horaires[i]!;
    const vers = horaires[i + 1]!;
    if (de.ecole.id === vers.ecole.id) continue;
    const ecart = vers.debutMin! - de.finMin!;
    sortie.push({ de, vers, ecart, trajet, serre: ecart < trajet });
  }
  return sortie;
}

/** Les chevauchements de la journée (le plus grave) : même règle que dans l'agenda. */
export const chevauchements = (creneaux: readonly Creneau[], eleves: readonly Eleve[], ecoles: readonly Ecole[], trajet: number) =>
  avertissementsEcoles(creneaux.map((c) => c.occ), eleves, ecoles, trajet).filter((a) => a.genre === 'chevauchement');

/** Rendez-vous avec un élève prévus et passés (avant aujourd'hui) mais sans séance encodée, du plus ancien au plus récent. */
export function aEncoder(aujourdhui: string, activites: readonly Activite[], seances: readonly Seance[], jours = 14): Occurrence[] {
  return occurrences(activites, ajouterJours(aujourdhui, -jours), ajouterJours(aujourdhui, -1), seances)
    .filter((o) => o.statut === 'prevu' && o.activite.type === 'eleve' && Boolean(o.activite.eleveId));
}
