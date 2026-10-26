import type { Eleve } from '../domain/types.ts';
import { anneeScolaire } from '../domain/export/journalier.ts';
import { ajouterAmenagement, ajouterObjectifPeriode, ajouterPresent, modifierCase, modifierIdentite, modifierPv1, modifierRetour, piaVierge, definirRetenus } from '../domain/pia/index.ts';
import type { Pia } from '../domain/pia/index.ts';
import type { Seance } from '../domain/types.ts';

/** Élèves fictifs, uniquement pour essayer l'application sans données réelles. */
export const ELEVES_DEMO: Eleve[] = [
  { id: 'demo-alpha', nom: 'Alpha', prenom: 'Élève', classe: '1CB', ecole: 'École fictive', titulaire: 'M. Test', dateNaissance: '', matieres: ['Mathématiques', 'Français', 'Néerlandais'], langues: ['Néerlandais'] },
  { id: 'demo-beta', nom: 'Bêta', prenom: 'Élève', classe: '4TQ', ecole: 'École fictive', titulaire: 'Mme Exemple', dateNaissance: '', matieres: ['Français', 'Sciences'] }
];

/* ───────── Exemple complet pour essayer le PIA ───────── */


/** Date ISO décalée de `jours` (négatif = avant), sans dépendre du fuseau horaire. */
function decaler(iso: string, jours: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

export interface ExempleDemo { eleves: Eleve[]; seances: Seance[]; pias: Pia[] }

/**
 * Élèves, séances et un PIA fictifs, calés sur la date du jour : des séances avant et après la réunion du PV 1,
 * pour essayer tous les onglets (idées d'après les séances, aménagements proposés, rappel du PV 2).
 * Le PIA d'« Alpha » est à moitié rempli ; « Bêta » n'a que des séances (on peut y commencer un PIA de zéro).
 */
export function exempleDemo(aujourdhui: string): ExempleDemo {
  const annee = anneeScolaire(aujourdhui);
  const debut = `${annee.slice(0, 4)}-08-25`;
  // Jamais avant le début de l'année scolaire du PIA.
  const jour = (avant: number): string => { const d = decaler(aujourdhui, -avant); return d < debut ? debut : d; };
  const maintenant = `${aujourdhui}T10:00:00.000Z`;
  const base = (id: string, date: string, matiere: string, surcharge: Partial<Seance> = {}, eleveId = 'demo-alpha'): Seance => ({
    id, eleveId, date, periodeDebut: '1e H', periodeFin: '1e H', matiere, niveauScolaire: 'S1', forme: 'Général (G)',
    presence: 'present', interventions: ['Accompagnement individuel'], objectifLecon: 'Objectif fictif', contenuClasse: '', monObjectif: '',
    observations: [], remarque: '', competences: [], precisionCompetence: '', situationAide: 'none', aides: [], precisionAide: '',
    transfert: null, suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' },
    creeLe: maintenant, modifieLe: maintenant, ...surcharge
  });
  const aides = [{ nom: 'Support visuel', effet: 2 as const }, { nom: 'Reformulation', effet: 2 as const }];
  const seances: Seance[] = [
    base('demo-s1', jour(60), 'Mathématiques', { observations: [{ texte: 'Maintient son attention', niveau: 0 }, { texte: 'Contrôle sa production', niveau: 0 }, { texte: 'Entre dans la tâche', niveau: 2 }], competences: [{ texte: 'Résoudre un problème à une opération', niveau: 1 }], aides }),
    base('demo-s2', jour(52), 'Mathématiques', { observations: [{ texte: 'Maintient son attention', niveau: 1 }, { texte: 'Contrôle sa production', niveau: 0 }, { texte: 'Entre dans la tâche', niveau: 2 }], aides }),
    base('demo-s3', jour(45), 'Français', { observations: [{ texte: 'Repère les informations pertinentes', niveau: 0 }, { texte: 'Entre dans la tâche', niveau: 2 }], aides: [{ nom: 'Reformulation', effet: 2 }] }),
    base('demo-s4', jour(38), 'Mathématiques', { observations: [{ texte: 'Contrôle sa production', niveau: 0 }, { texte: 'Maintient son attention', niveau: 1 }], aides }),
    base('demo-s5', jour(30), 'Mathématiques', { presence: 'absent_prof' }),
    base('demo-s6', jour(10), 'Mathématiques', { observations: [{ texte: 'Contrôle sa production', niveau: 1 }, { texte: 'Maintient son attention', niveau: 2 }, { texte: 'Entre dans la tâche', niveau: 2 }], competences: [{ texte: 'Résoudre un problème à une opération', niveau: 2 }], aides }),
    base('demo-s7', jour(6), 'Français', { observations: [{ texte: 'Repère les informations pertinentes', niveau: 1 }, { texte: 'Maintient son attention', niveau: 2 }], aides: [{ nom: 'Reformulation', effet: 2 }] }),
    base('demo-s8', jour(3), 'Mathématiques', { observations: [{ texte: 'Contrôle sa production', niveau: 2 }, { texte: 'Maintient son attention', niveau: 2 }], aides }),
    base('demo-b1', jour(20), 'Sciences', { observations: [{ texte: 'Entre dans la tâche', niveau: 1 }, { texte: 'Maintient son attention', niveau: 0 }], aides: [{ nom: 'Guidage verbal', effet: 2 }] }, 'demo-beta'),
    base('demo-b2', jour(13), 'Sciences', { observations: [{ texte: 'Entre dans la tâche', niveau: 2 }, { texte: 'Maintient son attention', niveau: 0 }], aides: [{ nom: 'Guidage verbal', effet: 2 }] }, 'demo-beta')
  ];

  let p = piaVierge('demo-alpha', annee, maintenant);
  p = modifierIdentite(p, 'option', 'Sciences');
  p = modifierIdentite(p, 'cpms', 'CPMS fictif — 02 000 00 00');
  p = modifierIdentite(p, 'responsable', 'Parent fictif — 0470 00 00 00');
  p = modifierCase(p, 'autonomie', 'ressources', 'Prépare et range son matériel sans rappel.');
  p = modifierCase(p, 'cognitif', 'ressources', 'Bonne mémoire visuelle.');
  p = modifierCase(p, 'cognitif', 'difficultes', 'A du mal à contrôler sa production avant de la rendre.');
  p = modifierCase(p, 'cognitif', 'objectifs', 'Relire et vérifier son travail avec une liste de contrôle.');
  p = definirRetenus(p, [
    { id: 'demo-r1', matiere: 'Mathématiques', texte: 'Contrôler sa production avant de la rendre.', libre: false },
    { id: 'demo-r2', matiere: '', texte: 'Utiliser seul son agenda.', libre: true }
  ]);
  p = modifierPv1(p, 'date', decaler(aujourdhui, -14));
  p = ajouterPresent(ajouterPresent(p, 'M. Test, titulaire'), 'Parent fictif, parent');
  p = modifierPv1(p, 'axe', 'Cognitif');
  p = ajouterObjectifPeriode(p, { matiere: 'Mathématiques', texte: 'Contrôler sa production avant de la rendre.', criteres: 'Relit seul 4 productions sur 5 pendant trois semaines.', source: 'demo-r1' });
  p = modifierPv1(p, 'ressources', 'Une séance en plus par semaine en mathématiques.');
  p = modifierRetour(p, 'parents', 'Les devoirs se passent mieux à la maison.');
  p = ajouterAmenagement(p, { types: ['P'], description: 'Consignes reformulées à l’oral', source: 'aide|reformulation' });
  p = ajouterAmenagement(p, { types: ['O'], description: 'Temps supplémentaire pour les évaluations' });
  return { eleves: ELEVES_DEMO, seances, pias: [p] };
}
