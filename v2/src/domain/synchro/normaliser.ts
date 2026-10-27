import { lireHoraires } from '../agenda/horaires.ts';
import { MAX_ECOLES, TRAJET_MAXI, normaliserEcoles, verifierEcoles } from '../agenda/ecoles.ts';
import { normaliserSemaineType } from '../agenda/semainetype.ts';
import { normaliserEleve } from '../eleves/eleves.ts';
import { normaliserPia } from '../pia/pia.ts';
import { normaliserMemos } from '../accueil/memos.ts';
import { REGLAGES_SYNCHRONISES } from './cles.ts';
import type { TypeObjet } from './cles.ts';

/*
 * Un objet reçu de OneDrive (ou d'une copie) est relu avec les mêmes règles que celui qu'on lit dans la base :
 * ce qui est abîmé est refusé, ce qui est ancien est mis à jour. Le résultat sert aussi à calculer l'empreinte,
 * pour que « ici » et « là-bas » se comparent sous la même forme.
 */

const objet = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const texte = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/** Renvoie l'objet remis en forme, ou `null` s'il est inutilisable. */
export function normaliserObjet(type: TypeObjet, donnees: unknown): unknown | null {
  const o = objet(donnees);
  if (!o) return null;
  switch (type) {
    case 'eleve':
      if (!texte(o.id) || typeof o.nom !== 'string' || typeof o.prenom !== 'string') return null;
      return normaliserEleve(o as unknown as Parameters<typeof normaliserEleve>[0]);
    case 'seance':
      return texte(o.id) && texte(o.eleveId) && texte(o.date) && Array.isArray(o.observations) ? o : null;
    case 'activite':
      return texte(o.id) && typeof o.type === 'string' && texte(o.date) && typeof o.debut === 'number' && typeof o.fin === 'number' ? o : null;
    case 'pia': {
      if (!texte(o.id) || !texte(o.eleveId)) return null;
      return normaliserPia(o);
    }
    case 'reglage': {
      if (!texte(o.id) || !REGLAGES_SYNCHRONISES.includes(o.id)) return null;
      if (o.id === 'agenda-horaires') {
        const horaires = lireHoraires(o.valeur);
        return horaires ? { id: o.id, valeur: horaires } : null;
      }
      if (o.id === 'agenda-ecoles') return ecolesValides(o.valeur) ? { id: o.id, valeur: normaliserEcoles(o.valeur) } : null;
      if (o.id === 'memos') return Array.isArray(o.valeur) ? { id: o.id, valeur: normaliserMemos(o.valeur) } : null;
      if (o.valeur === null) return { id: o.id, valeur: null };
      const semaine = normaliserSemaineType(o.valeur);
      return semaine ? { id: o.id, valeur: semaine } : null;
    }
  }
}

/** Un réglage « écoles » reçu n'est accepté que s'il est entièrement lisible : on ne remplace jamais le sien par une moitié de réglage. */
function ecolesValides(valeur: unknown): boolean {
  const v = objet(valeur);
  if (!v || !Array.isArray(v.ecoles) || v.ecoles.length === 0 || v.ecoles.length > MAX_ECOLES) return false;
  if (typeof v.trajet !== 'number' || !Number.isInteger(v.trajet) || v.trajet < 0 || v.trajet > TRAJET_MAXI) return false;
  const lues = [];
  for (const x of v.ecoles) {
    const e = objet(x);
    const periodes = e ? lireHoraires(e.periodes) : null;
    if (!e || !texte(e.id) || !texte(e.nom) || !periodes) return false;
    lues.push({ id: e.id, nom: e.nom, periodes });
  }
  return new Set(lues.map((e) => e.id)).size === lues.length && verifierEcoles(lues).length === 0;
}
