/*
 * Synthèse par matière pour la réunion : constats datés, sans comptage.
 * Les séances d'absence ne comptent pas dans les observations ; elles sont résumées à part.
 */
import type { Seance } from '../types.ts';
import { versFaits } from './faits.ts';
import {
  NBSP, dateCourte, enumeration, finPhrase, majusculePremiere as Maj, minusculePremiere as min
} from './langue.ts';
import { statsPresence } from './presence.ts';

const NIVEAUX = ['Partiellement', 'Suffisamment', 'Totalement'] as const;
const EFFET_MOT = ['aucun effet', 'effet partiel', 'effet positif'] as const;

/** Une observation suivie séance après séance (niveau 0 partiel, 1 suffisant, 2 total). */
export interface SuiviObservation { texte: string; suite: { date: string; niveau: number }[] }
/** Une aide et l'effet noté à chaque séance (null = effet non précisé). */
export interface SuiviAide { texte: string; effets: (number | null)[] }
/** Une compétence et son dernier niveau (null = notée sans niveau). */
export interface SuiviCompetence { texte: string; niveau: number | null }

export interface SyntheseMatiere {
  matiere: string;
  dateDebut: string;
  dateFin: string;
  appuis: string[];
  aTravailler: string[];
  aides: string[];
  aidesSansEffet: string[];
  competences: string[];
  /** Le même contenu sous forme de données (sert aux propositions d'objectifs de la réunion). */
  suivis: { observations: SuiviObservation[]; aides: SuiviAide[]; competences: SuiviCompetence[] };
}

export interface Synthese {
  matieres: SyntheseMatiere[];
  seances: number;
  absences: string;
}

const mot = (n: number): string => min(NIVEAUX[n] ?? '');

function suiteNiveaux(suite: readonly { date: string; niveau: number }[]): string {
  const premier = suite[0];
  if (!premier) return '';
  if (suite.length === 1) return `${mot(premier.niveau)}.`;
  if (new Set(suite.map((x) => x.niveau)).size === 1) return `${mot(premier.niveau)} à chaque séance.`;
  const etapes: { date: string; niveau: number }[] = [];
  for (const x of suite) {
    if (!etapes.length || etapes[etapes.length - 1]?.niveau !== x.niveau) etapes.push(x);
  }
  return `${etapes.map((x) => `${mot(x.niveau)} (${dateCourte(x.date)})`).join(' → ')}.`;
}

export function synthese(seances: readonly Seance[]): Synthese {
  const faits = seances.map((s) => versFaits(s)).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const presentes = faits.filter((f) => f.presence === 'present');
  const parMatiere = new Map<string, typeof presentes>();
  for (const f of presentes) {
    const m = f.matiere || 'Matière non précisée';
    parMatiere.set(m, [...(parMatiere.get(m) ?? []), f]);
  }

  const matieres: SyntheseMatiere[] = [];
  parMatiere.forEach((liste, matiere) => {
    const obs = new Map<string, { date: string; niveau: number }[]>();
    const aides = new Map<string, (number | null)[]>();
    for (const f of liste) {
      for (const o of f.observations) {
        if (o.niveau === null) continue;
        obs.set(o.texte, [...(obs.get(o.texte) ?? []), { date: f.date, niveau: o.niveau }]);
      }
      for (const a of f.aides) aides.set(a.texte, [...(aides.get(a.texte) ?? []), a.effet]);
    }

    const appuis: string[] = [];
    const travail: string[] = [];
    obs.forEach((suite, texte) => {
      const ligne = `${Maj(texte)}${NBSP}: ${suiteNiveaux(suite)}`;
      (suite[suite.length - 1]?.niveau === 2 ? appuis : travail).push(ligne);
    });

    const lignesAides: string[] = [];
    const sansEffet: string[] = [];
    aides.forEach((effets, texte) => {
      const connus = effets.filter((e): e is number => e !== null);
      const uniques = [...new Set(connus)];
      const nom = min(texte);
      const seul = uniques[0];
      if (!connus.length) lignesAides.push(nom);
      else if (uniques.length === 1 && seul === 0) sansEffet.push(nom);
      else if (uniques.length === 1 && seul !== undefined) lignesAides.push(`${nom} (${EFFET_MOT[seul] ?? ''})`);
      else lignesAides.push(`${nom} (effet variable${NBSP}: ${enumeration(uniques.map((e) => (EFFET_MOT[e] ?? '').replace(/^effet /, '')))})`);
    });

    const comps = new Map<string, number | null>();
    for (const f of liste) {
      for (const c of f.competences) comps.set(c.texte, c.niveau);
      if (f.precisionCompetence) {
        const t = finPhrase(Maj(f.precisionCompetence));
        if (!comps.has(t)) comps.set(t, null);
      }
    }
    const competences = [...comps].map(([t, n]) =>
      n === null ? t : `${Maj(min(t))} (${mot(n)}).`);

    const premiere = liste[0];
    const derniere = liste[liste.length - 1];
    matieres.push({
      matiere,
      dateDebut: premiere?.date ?? '',
      dateFin: derniere?.date ?? '',
      appuis, aTravailler: travail, aides: lignesAides, aidesSansEffet: sansEffet, competences,
      suivis: {
        observations: [...obs].map(([texte, suite]) => ({ texte, suite })),
        aides: [...aides].map(([texte, effets]) => ({ texte, effets })),
        competences: [...comps].map(([texte, niveau]) => ({ texte, niveau }))
      }
    });
  });
  matieres.sort((a, b) => a.matiere.localeCompare(b.matiere, 'fr'));

  const st = statsPresence(seances);
  const morceaux: string[] = [];
  const pl = (n: number): string => (n > 1 ? 's' : '');
  if (st.absent_prof) morceaux.push(`${st.absent_prof} cours annulé${pl(st.absent_prof)} (professeur absent)`);
  if (st.absent_eleve) morceaux.push(`${st.absent_eleve} absence${pl(st.absent_eleve)} de l’élève`);
  if (st.absent_eleve_coteach) morceaux.push(`${st.absent_eleve_coteach} intervention${pl(st.absent_eleve_coteach)} en classe en l’absence de l’élève`);
  if (st.absent_agent) morceaux.push(`${st.absent_agent} absence${pl(st.absent_agent)} de l’agent du pôle`);
  return {
    matieres,
    seances: presentes.length,
    absences: morceaux.length ? `Sur la période${NBSP}: ${morceaux.join(' ; ')}.` : ''
  };
}
