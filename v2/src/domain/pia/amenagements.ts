/*
 * Aménagements proposés : on part des aides qui ont réellement eu un effet positif dans les séances.
 * Rien n'est ajouté sans que l'agent le choisisse, et il réécrit toujours la description.
 */
import { majusculePremiere as Maj } from '../redaction/langue.ts';
import type { Seance } from '../types.ts';
import type { Amenagement, TypeAmenagement } from './types.ts';

/**
 * Correspondance aide → type d'aménagement (proposition de départ du 26/10/2026, à valider).
 * P = méthodes d'enseignement, d'évaluation, d'apprentissage ; O = temps, espace, déroulement ;
 * M = outils, mobilier, logiciels. Le support visuel est classé « pédagogique » (sauf problème de vue de l'élève).
 */
export const TYPE_DE_AIDE: Readonly<Record<string, TypeAmenagement>> = {
  'reformulation': 'P',
  'explicitation / verbalisation': 'P',
  'décomposition': 'P',
  'modélisation': 'P',
  'guidage verbal': 'P',
  'support visuel': 'P',
  'aide organisation': 'O',
  'environnement': 'O',
  'matériel': 'M',
  'outil numérique': 'M',
  'gabarit / fiche outil': 'M'
};

const norme = (t: string): string => t.replace(/[.\s]+$/, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Type d'aménagement d'une aide connue ; null pour une aide libre ou « Autre » (l'agent choisit). */
export const typeDeAide = (nom: string): TypeAmenagement | null => TYPE_DE_AIDE[norme(nom)] ?? null;

export interface PropositionAmenagement {
  /** Stable d'un calcul à l'autre : une aide déjà reprise n'est plus proposée. */
  id: string;
  types: TypeAmenagement[];
  description: string;
  raison: string;
}

/** Nombre maximum d'aménagements proposés. */
export const MAX_PROPOSITIONS = 6;

/**
 * Aides qui ont eu un effet positif au moins une fois, et dont le dernier effet noté n'est pas « aucun effet »,
 * triées par nombre de séances à effet positif. Les aides déjà reprises dans le PIA sont écartées.
 */
export function proposerAmenagements(seances: readonly Seance[], existants: readonly Amenagement[]): PropositionAmenagement[] {
  const dejaPris = new Set(existants.map((a) => a.source).filter(Boolean));
  const parAide = new Map<string, { nom: string; effets: (number | null)[]; positives: Set<string>; matieres: Set<string> }>();
  const chrono = [...seances].filter((s) => s.presence === 'present').sort((a, b) => a.date.localeCompare(b.date) || a.periodeDebut.localeCompare(b.periodeDebut, 'fr', { numeric: true }));
  for (const s of chrono) {
    for (const a of s.aides) {
      if (!a.nom.trim()) continue;
      const cle = norme(a.nom);
      const courant = parAide.get(cle) ?? { nom: a.nom.trim(), effets: [], positives: new Set<string>(), matieres: new Set<string>() };
      courant.effets.push(a.effet);
      if (a.effet === 2) { courant.positives.add(s.id); courant.matieres.add(s.matiere || 'Matière non précisée'); }
      parAide.set(cle, courant);
    }
  }

  const propositions: (PropositionAmenagement & { poids: number })[] = [];
  for (const [cle, a] of parAide) {
    const id = `aide|${cle}`;
    if (dejaPris.has(id)) continue;
    const connus = a.effets.filter((e): e is number => e !== null);
    const fin = connus[connus.length - 1];
    if (!a.positives.size || fin === undefined || fin === 0) continue;
    const type = typeDeAide(a.nom);
    const matieres = [...a.matieres];
    const n = a.positives.size;
    propositions.push({
      id,
      types: type ? [type] : [],
      description: `${Maj(a.nom)}${matieres.length ? ` (${matieres.join(', ')})` : ''}`,
      raison: `Effet positif noté lors de ${n} séance${n > 1 ? 's' : ''}${type ? '' : ' ; à classer (P, O ou M) vous-même'}.`,
      poids: n
    });
  }
  propositions.sort((x, y) => y.poids - x.poids || x.description.localeCompare(y.description, 'fr'));
  return propositions.slice(0, MAX_PROPOSITIONS).map(({ poids: _p, ...p }) => p);
}
