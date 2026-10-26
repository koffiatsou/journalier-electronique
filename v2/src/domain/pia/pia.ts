/*
 * Fonctions pures sur un PIA : création, relecture du stockage, modifications.
 * Elles renvoient toujours un nouveau PIA ; l'écran n'a jamais à fabriquer l'objet à la main.
 */
import type { ObjectifRetenu } from '../reunion/objectifs.ts';
import { ASPECTS, COLONNES } from './types.ts';
import type {
  Amenagement, Aspect, CleRetour, Colonne, IdentitePia, ObjectifPeriode, Pia, Profil, Retours, TypeAmenagement
} from './types.ts';

export const idPia = (eleveId: string, annee: string): string => `${eleveId}|${annee}`;

const profilVide = (): Profil =>
  Object.fromEntries(ASPECTS.map((a) => [a.id, { ressources: '', difficultes: '', objectifs: '' }])) as Profil;

const retoursVides = (): Retours => ({ parents: '', direction: '', eleve: '', pms: '', agent: '', autres: '' });
const identiteVide = (): IdentitePia => ({ option: '', cpms: '', representantPole: '', responsable: '' });

/** Un PIA vierge : rien n'est rempli automatiquement (le profil se rédige à la main, avec des idées proposées). */
export function piaVierge(eleveId: string, annee: string, maintenant: string): Pia {
  return {
    id: idPia(eleveId, annee),
    eleveId,
    annee,
    identite: identiteVide(),
    profil: profilVide(),
    retenus: [],
    pv1: { date: '', presents: [], axe: '', objectifs: [], ressources: '', retours: retoursVides() },
    amenagements: [],
    creeLe: maintenant,
    modifieLe: maintenant
  };
}

/* ───────── Relecture du stockage (jamais de confiance aveugle) ───────── */

const texte = (v: unknown): string => (typeof v === 'string' ? v : '');
const objet = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const TYPES: readonly TypeAmenagement[] = ['P', 'O', 'M'];

function objectifRetenu(v: unknown): ObjectifRetenu | null {
  const o = objet(v);
  const id = texte(o.id);
  return id ? { id, matiere: texte(o.matiere), texte: texte(o.texte), libre: o.libre === true } : null;
}

function objectifPeriode(v: unknown): ObjectifPeriode | null {
  const o = objet(v);
  const id = texte(o.id);
  if (!id) return null;
  const source = texte(o.source);
  return { id, matiere: texte(o.matiere), texte: texte(o.texte), criteres: texte(o.criteres), ...(source ? { source } : {}) };
}

function amenagement(v: unknown): Amenagement | null {
  const o = objet(v);
  const id = texte(o.id);
  if (!id) return null;
  const types = TYPES.filter((t) => liste(o.types).includes(t));
  const source = texte(o.source);
  return { id, types, description: texte(o.description), ...(source ? { source } : {}) };
}

const sansNull = <T,>(l: (T | null)[]): T[] => l.filter((x): x is T => x !== null);

/**
 * Relit un PIA lu dans la base : toute pièce manquante ou abîmée est remplacée par une valeur vide.
 * Renvoie null si on ne peut même pas savoir à quel élève et à quelle année il appartient.
 */
export function normaliserPia(brut: unknown): Pia | null {
  const o = objet(brut);
  const eleveId = texte(o.eleveId);
  const annee = texte(o.annee);
  if (!eleveId || !annee) return null;
  const base = piaVierge(eleveId, annee, texte(o.creeLe));
  const identite = objet(o.identite);
  const profil = objet(o.profil);
  const pv1 = objet(o.pv1);
  const retours = objet(pv1.retours);
  for (const a of ASPECTS) {
    const cellule = objet(profil[a.id]);
    for (const c of COLONNES) base.profil[a.id][c.id] = texte(cellule[c.id]);
  }
  return {
    ...base,
    modifieLe: texte(o.modifieLe) || base.creeLe,
    identite: {
      option: texte(identite.option), cpms: texte(identite.cpms),
      representantPole: texte(identite.representantPole), responsable: texte(identite.responsable)
    },
    retenus: sansNull(liste(o.retenus).map(objectifRetenu)),
    pv1: {
      date: texte(pv1.date),
      presents: liste(pv1.presents).filter((p): p is string => typeof p === 'string'),
      axe: texte(pv1.axe),
      objectifs: sansNull(liste(pv1.objectifs).map(objectifPeriode)),
      ressources: texte(pv1.ressources),
      retours: {
        parents: texte(retours.parents), direction: texte(retours.direction), eleve: texte(retours.eleve),
        pms: texte(retours.pms), agent: texte(retours.agent), autres: texte(retours.autres)
      }
    },
    amenagements: sansNull(liste(o.amenagements).map(amenagement))
  };
}

/* ───────── Profil ───────── */

export function modifierCase(p: Pia, aspect: Aspect, colonne: Colonne, valeur: string): Pia {
  return { ...p, profil: { ...p.profil, [aspect]: { ...p.profil[aspect], [colonne]: valeur } } };
}

const norme = (t: string): string => t.replace(/\s+/g, ' ').trim().toLowerCase();

/** Le texte contient-il déjà cette idée (ligne pour ligne, majuscules ignorées) ? */
export const contientLigne = (contenu: string, ligne: string): boolean =>
  contenu.split('\n').some((l) => norme(l) === norme(ligne));

/** Ajoute une idée sur une nouvelle ligne, sans jamais la mettre deux fois. */
export function ajouterLigne(contenu: string, ligne: string): string {
  const propre = ligne.replace(/\s+/g, ' ').trim();
  if (!propre || contientLigne(contenu, propre)) return contenu;
  const base = contenu.replace(/\s+$/, '');
  return base ? `${base}\n${propre}` : propre;
}

/** Retire une idée ajoutée plus tôt (la ligne qui lui correspond, pas le reste du texte). */
export function retirerLigne(contenu: string, ligne: string): string {
  return contenu.split('\n').filter((l) => norme(l) !== norme(ligne)).join('\n').replace(/^\n+|\n+$/g, '');
}

export const modifierIdentite = (p: Pia, champ: keyof IdentitePia, valeur: string): Pia =>
  ({ ...p, identite: { ...p.identite, [champ]: valeur } });

/* ───────── Procès-verbal 1 ───────── */

export const modifierPv1 = <K extends 'date' | 'axe' | 'ressources'>(p: Pia, champ: K, valeur: string): Pia =>
  ({ ...p, pv1: { ...p.pv1, [champ]: valeur } });

export const modifierRetour = (p: Pia, cle: CleRetour, valeur: string): Pia =>
  ({ ...p, pv1: { ...p.pv1, retours: { ...p.pv1.retours, [cle]: valeur } } });

export const definirPresents = (p: Pia, presents: readonly string[]): Pia => ({ ...p, pv1: { ...p.pv1, presents: [...presents] } });

/** Ajoute une ligne de plus à remplir (nom et fonction). */
export const ajouterPresent = (p: Pia, valeur = ''): Pia => definirPresents(p, [...p.pv1.presents, valeur]);
export const changerPresent = (p: Pia, i: number, valeur: string): Pia => definirPresents(p, p.pv1.presents.map((x, j) => (j === i ? valeur : x)));
export const retirerPresent = (p: Pia, i: number): Pia => definirPresents(p, p.pv1.presents.filter((_, j) => j !== i));

/** Prochain identifiant « préfixe-N » libre dans une liste. */
function prochainId(ids: readonly string[], prefixe: string): string {
  const re = new RegExp(`^${prefixe}-(\\d+)$`);
  const max = ids.reduce((m, id) => { const r = re.exec(id); return r ? Math.max(m, Number(r[1])) : m; }, 0);
  return `${prefixe}-${max + 1}`;
}

const avecObjectifs = (p: Pia, objectifs: ObjectifPeriode[]): Pia => ({ ...p, pv1: { ...p.pv1, objectifs } });

export function ajouterObjectifPeriode(p: Pia, partiel: Partial<Pick<ObjectifPeriode, 'matiere' | 'texte' | 'criteres' | 'source'>> = {}): Pia {
  const objectif: ObjectifPeriode = {
    id: prochainId(p.pv1.objectifs.map((o) => o.id), 'objectif'),
    matiere: partiel.matiere ?? '', texte: partiel.texte ?? '', criteres: partiel.criteres ?? '',
    ...(partiel.source ? { source: partiel.source } : {})
  };
  return avecObjectifs(p, [...p.pv1.objectifs, objectif]);
}

export const modifierObjectifPeriode = (p: Pia, id: string, champ: 'texte' | 'criteres', valeur: string): Pia =>
  avecObjectifs(p, p.pv1.objectifs.map((o) => (o.id === id ? { ...o, [champ]: valeur } : o)));

export const retirerObjectifPeriode = (p: Pia, id: string): Pia => avecObjectifs(p, p.pv1.objectifs.filter((o) => o.id !== id));

/** Objectifs retenus à la réunion qui ne sont pas encore dans le procès-verbal. */
export const retenusAReprendre = (p: Pia): ObjectifRetenu[] => {
  const deja = new Set(p.pv1.objectifs.map((o) => o.source).filter(Boolean));
  return p.retenus.filter((r) => r.texte.trim() && !deja.has(r.id));
};

/** Reprend les objectifs retenus à la réunion (une seule fois chacun), sans critères : l'agent les écrit. */
export function reprendreRetenus(p: Pia): Pia {
  let suite = p;
  for (const r of retenusAReprendre(p)) suite = ajouterObjectifPeriode(suite, { matiere: r.matiere, texte: r.texte, source: r.id });
  return suite;
}

/* ───────── Aménagements ───────── */

const avecAmenagements = (p: Pia, amenagements: Amenagement[]): Pia => ({ ...p, amenagements });

export function ajouterAmenagement(p: Pia, partiel: Partial<Pick<Amenagement, 'types' | 'description' | 'source'>> = {}): Pia {
  const a: Amenagement = {
    id: prochainId(p.amenagements.map((x) => x.id), 'amenagement'),
    types: TYPES.filter((t) => partiel.types?.includes(t)),
    description: partiel.description ?? '',
    ...(partiel.source ? { source: partiel.source } : {})
  };
  return avecAmenagements(p, [...p.amenagements, a]);
}

export const modifierAmenagement = (p: Pia, id: string, description: string): Pia =>
  avecAmenagements(p, p.amenagements.map((a) => (a.id === id ? { ...a, description } : a)));

/** Coche ou décoche un type ; les types restent toujours dans l'ordre P, O, M. */
export function basculerType(p: Pia, id: string, type: TypeAmenagement): Pia {
  return avecAmenagements(p, p.amenagements.map((a) => {
    if (a.id !== id) return a;
    const types = a.types.includes(type) ? a.types.filter((t) => t !== type) : [...a.types, type];
    return { ...a, types: (['P', 'O', 'M'] as const).filter((t) => types.includes(t)) };
  }));
}

export const retirerAmenagement = (p: Pia, id: string): Pia => avecAmenagements(p, p.amenagements.filter((a) => a.id !== id));

/* ───────── Objectifs retenus à la réunion ───────── */

export const definirRetenus = (p: Pia, retenus: readonly ObjectifRetenu[]): Pia => ({ ...p, retenus: [...retenus] });
