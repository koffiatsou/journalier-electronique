import type { Presence, Seance } from '../../domain/types.ts';
import { SITUATION_AIDE_LIBELLES } from '../../domain/types.ts';

export const nouvelId = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

export function aujourdhuiISO(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Séance vierge : rien n'est présélectionné (niveaux, effets, transfert). */
export function seanceVide(eleveId = '', date = aujourdhuiISO()): Seance {
  const maintenant = new Date().toISOString();
  return {
    id: nouvelId(), eleveId, date, periodeDebut: '1e H', periodeFin: '1e H',
    matiere: '', niveauScolaire: '', forme: '', presence: 'present', interventions: [],
    objectifLecon: '', contenuClasse: '', monObjectif: '',
    observations: [], remarque: '', competences: [], precisionCompetence: '',
    situationAide: 'none', aides: [], precisionAide: '',
    transfert: null,
    suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' },
    creeLe: maintenant, modifieLe: maintenant
  };
}

/** Étapes 2 à 5 : sans objet quand l'élève est absent. */
export const etapesUtiles = (p: Presence): readonly boolean[] =>
  p === 'present' ? [true, true, true, true, true] : [true, false, false, false, true];

export type EtatEtape = 'vide' | 'remplie' | 'sans-objet';

/** Une étape est « remplie » dès qu'une de ses rubriques contient quelque chose. */
export function etatsEtapes(s: Seance): EtatEtape[] {
  const utiles = etapesUtiles(s.presence);
  const rempli = [
    Boolean(s.eleveId && s.matiere),
    s.observations.length > 0 || s.remarque.trim() !== '',
    s.competences.length > 0 || s.precisionCompetence.trim() !== '',
    s.aides.length > 0 || s.precisionAide.trim() !== '' || s.situationAide !== 'none' || s.transfert !== null,
    s.suite.actions.length > 0 || s.suite.collaborations.length > 0 || s.suite.modalite !== ''
      || s.suite.objectif.trim() !== '' || s.suite.precision.trim() !== ''
  ];
  return rempli.map((r, i) => (!utiles[i] ? 'sans-objet' : r ? 'remplie' : 'vide'));
}

/** Niveaux et effets encore à choisir : à compléter avant d'enregistrer. */
export function niveauxManquants(s: Seance): string[] {
  if (s.presence !== 'present') return [];
  return [
    ...s.observations.filter((o) => o.niveau === null).map((o) => o.texte),
    ...s.competences.filter((c) => c.niveau === null).map((c) => c.texte),
    ...s.aides.filter((a) => a.effet === null).map((a) => a.nom)
  ];
}

export interface Verification { ok: boolean; raisons: string[] }

export function verifier(s: Seance): Verification {
  const raisons: string[] = [];
  if (!s.eleveId) raisons.push('Choisissez l’élève accompagné.');
  if (!s.date) raisons.push('Indiquez la date.');
  if (s.presence !== 'absent_agent' && !s.matiere.trim()) raisons.push('Indiquez la matière.');
  const manquants = niveauxManquants(s);
  if (manquants.length) raisons.push(`Choisissez un niveau pour : ${manquants.join(', ')}.`);
  return { ok: raisons.length === 0, raisons };
}

/** Au plus deux points cités, puis « et N autre(s) » : une ligne lisible sous le titre d'une rubrique fermée. */
function enumerer(textes: readonly string[]): string {
  const [premier, deuxieme] = textes;
  if (premier === undefined) return '';
  if (textes.length === 1 || deuxieme === undefined) return premier;
  if (textes.length === 2) return `${premier}, ${deuxieme}`;
  const reste = textes.length - 2;
  return `${premier}, ${deuxieme} et ${reste} autre${reste > 1 ? 's' : ''}`;
}

const periodeDuCreneau = (s: Seance): string =>
  (s.periodeDebut === s.periodeFin ? s.periodeDebut : `${s.periodeDebut} à ${s.periodeFin}`);

/**
 * Résumé d'une ligne de chaque rubrique (sous son titre quand elle est fermée) ; `null` quand la rubrique est vide
 * ou sans objet : l'écran n'affiche alors rien.
 */
export function resumesEtapes(s: Seance): (string | null)[] {
  const etats = etatsEtapes(s);
  const suite = s.suite;
  const textes: string[] = [
    [s.matiere, periodeDuCreneau(s)].filter((t) => t.trim() !== '').join(' · '),
    s.observations.length ? enumerer(s.observations.map((o) => o.texte)) : s.remarque.trim(),
    s.competences.length ? enumerer(s.competences.map((c) => c.texte)) : s.precisionCompetence.trim(),
    s.aides.length ? enumerer(s.aides.map((a) => a.nom)) : s.situationAide !== 'none' ? `Adaptations : ${SITUATION_AIDE_LIBELLES[s.situationAide].toLowerCase()}` : s.precisionAide.trim(),
    suite.objectif.trim() || enumerer(suite.actions) || enumerer(suite.collaborations) || suite.modalite || suite.precision.trim()
  ];
  return textes.map((t, i) => (etats[i] === 'remplie' && t !== '' ? t : null));
}

export interface Progression { faites: number; total: number }

/** « N rubriques renseignées sur M » : les rubriques sans objet (élève absent) ne comptent pas dans M. */
export function progression(s: Seance): Progression {
  const etats = etatsEtapes(s);
  return { faites: etats.filter((e) => e === 'remplie').length, total: etats.filter((e) => e !== 'sans-objet').length };
}
