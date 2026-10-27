import { TYPES_LIBELLES } from '../agenda/types.ts';
import type { Activite } from '../agenda/types.ts';
import type { Pia } from '../pia/types.ts';
import { dateFR } from '../redaction/langue.ts';
import type { Eleve, Seance } from '../types.ts';
import { REGLAGES_SYNCHRONISES, cle } from './cles.ts';
import type { Cle, TypeObjet } from './cles.ts';

/** Réglage rangé sous un nom (même forme que `Reglage` du dépôt, répétée ici pour garder le domaine indépendant). */
export interface ReglageObjet { id: string; valeur: unknown }

/** Tout ce que l'application garde et qui peut partir vers OneDrive ou dans une copie de secours. */
export interface ObjetsLocaux {
  eleves: Eleve[];
  seances: Seance[];
  activites: Activite[];
  pias: Pia[];
  reglages: ReglageObjet[];
}

export interface ObjetSynchro { type: TypeObjet; id: string; donnees: unknown; eleveId?: string }

/** Met tous les objets à plat, sous leur clé. Seuls les réglages partagés entre appareils sont repris. */
export function aPlat(o: ObjetsLocaux): Map<Cle, ObjetSynchro> {
  const sortie = new Map<Cle, ObjetSynchro>();
  const ajouter = (x: ObjetSynchro) => sortie.set(cle(x.type, x.id), x);
  for (const e of o.eleves) ajouter({ type: 'eleve', id: e.id, donnees: e });
  for (const s of o.seances) ajouter({ type: 'seance', id: s.id, donnees: s, eleveId: s.eleveId });
  for (const a of o.activites) ajouter({ type: 'activite', id: a.id, donnees: a, ...(a.eleveId ? { eleveId: a.eleveId } : {}) });
  for (const p of o.pias) ajouter({ type: 'pia', id: p.id, donnees: p, eleveId: p.eleveId });
  for (const r of o.reglages) if (REGLAGES_SYNCHRONISES.includes(r.id)) ajouter({ type: 'reglage', id: r.id, donnees: r });
  return sortie;
}

const texte = (v: unknown): string => (typeof v === 'string' ? v : '');
const nomEleve = (id: string, eleves: readonly Eleve[]): string => {
  const e = eleves.find((x) => x.id === id);
  return e ? `${e.prenom} ${e.nom}`.trim() : 'élève inconnu';
};

/** Phrase courte pour désigner un objet à l'écran (liste des conflits, bilan). */
export function etiquette(type: TypeObjet, donnees: unknown, eleves: readonly Eleve[]): string {
  const o = (donnees && typeof donnees === 'object' ? donnees : {}) as Record<string, unknown>;
  switch (type) {
    case 'eleve': return `Élève : ${`${texte(o.prenom)} ${texte(o.nom)}`.trim() || 'sans nom'}`;
    case 'seance': return `Séance du ${dateFR(texte(o.date))} — ${nomEleve(texte(o.eleveId), eleves)} — ${texte(o.matiere) || 'matière non précisée'}`;
    case 'activite': {
      const t = texte(o.type) as keyof typeof TYPES_LIBELLES;
      return `Agenda : ${texte(o.titre) || TYPES_LIBELLES[t] || 'activité'} (${dateFR(texte(o.date))})`;
    }
    case 'pia': return `PIA de ${nomEleve(texte(o.eleveId), eleves)} (${texte(o.annee)})`;
    case 'reglage': return texte(o.id) === 'agenda-semaine-type' ? 'Semaine type de l’agenda' : texte(o.id) === 'memos' ? 'Mes mémos' : 'Horaires de l’agenda';
  }
}

/** Moment de la dernière modification, si l'objet en porte un (aide à choisir entre deux versions). */
export function modifieLeDe(donnees: unknown): string {
  const o = (donnees && typeof donnees === 'object' ? donnees : {}) as Record<string, unknown>;
  return texte(o.modifieLe);
}
