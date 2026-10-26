/*
 * Dossiers des élèves : fonctions pures (aucun accès au stockage ni à l'écran).
 * Archivage, suppression complète, passage d'année scolaire, recherche, cartes.
 */
import type { Activite } from '../agenda/types.ts';
import { normaliserAvatar } from '../avatar/avatar.ts';
import { analyserClasse } from '../referentiel/contexte.ts';
import { sansAccents } from '../referentiel/texte.ts';
import { FILIERES_LIBELLES } from '../types.ts';
import type { Eleve, Seance } from '../types.ts';

/** Langues du référentiel « Langues modernes » (voir src/data/referentiel). */
export const LANGUES_MODERNES = ['Néerlandais', 'Anglais', 'Allemand', 'Espagnol', 'Italien'] as const;

/* ───────── Langues ───────── */

/** Toutes les langues du dossier, sans doublon ; lit aussi l'ancien champ à une seule langue. */
export function languesDe(e: Pick<Eleve, 'langues' | 'langue'>): string[] {
  const brutes = e.langues ?? (e.langue ? [e.langue] : []);
  return [...new Set(brutes.map((l) => l.trim()).filter(Boolean))];
}

/** Dossier tel que l'application l'attend : l'ancien champ `langue` devient `langues`. */
export function normaliserEleve(e: Eleve): Eleve {
  const { langue: _ancienne, langues: _l, avatar: brut, ...reste } = e;
  const langues = languesDe(e);
  const avatar = normaliserAvatar(brut);
  return { ...reste, ...(langues.length ? { langues } : {}), ...(avatar ? { avatar } : {}) };
}

/* ───────── Archivage ───────── */

export const estArchive = (e: Pick<Eleve, 'archiveLe'>): boolean => Boolean(e.archiveLe);

export const elevesActifs = (eleves: readonly Eleve[]): Eleve[] => eleves.filter((e) => !estArchive(e));
export const elevesArchives = (eleves: readonly Eleve[]): Eleve[] => eleves.filter(estArchive);

/** Élèves à proposer dans un choix (séance, agenda) : les actifs, plus l'élève déjà choisi même s'il est archivé. */
export const elevesProposes = (eleves: readonly Eleve[], idCourant?: string): Eleve[] =>
  eleves.filter((e) => !estArchive(e) || e.id === idCourant);

export const archiver = (e: Eleve, date: string): Eleve => ({ ...e, archiveLe: date });

export function reactiver(e: Eleve): Eleve {
  const { archiveLe: _a, ...reste } = e;
  return reste;
}

/* ───────── Suppression complète ───────── */

export interface EffetSuppression {
  /** Identifiants des séances qui disparaissent avec l'élève. */
  seances: string[];
  /** Identifiants des activités de l'agenda (séries et occurrences) qui disparaissent aussi. */
  activites: string[];
  /** Identifiants des PIA (un par année scolaire) qui disparaissent aussi. */
  pias: string[];
}

/** Ce qu'entraîne la suppression d'un élève : ses séances, ses activités d'agenda et ses PIA (rien ne doit rester sans élève). */
export function effetSuppression(eleveId: string, seances: readonly Seance[], activites: readonly Activite[], pias: readonly { id: string; eleveId: string }[] = []): EffetSuppression {
  return {
    seances: seances.filter((s) => s.eleveId === eleveId).map((s) => s.id),
    activites: activites.filter((a) => a.eleveId === eleveId).map((a) => a.id),
    pias: pias.filter((x) => x.eleveId === eleveId).map((x) => x.id)
  };
}

/* ───────── Recherche ───────── */

/** Tout ce qu'on peut vouloir retrouver dans un dossier, sans accents ni majuscules. */
export function texteDossier(e: Eleve): string {
  const filiere = e.filiere ?? analyserClasse(e.classe)?.filiere;
  return sansAccents([
    e.nom, e.prenom, e.classe, e.niveau ?? '', filiere ? FILIERES_LIBELLES[filiere] : '', e.ecole, e.titulaire,
    ...e.matieres, ...languesDe(e), e.archiveLe ? 'archivé archive' : ''
  ].join(' '));
}

/** Les mots de la recherche doivent tous se trouver dans le dossier (ordre indifférent, accents ignorés). */
export function motsDeRecherche(requete: string): string[] {
  return sansAccents(requete).split(/\s+/).filter(Boolean);
}

export function rechercherEleves<T extends Eleve>(eleves: readonly T[], requete: string): T[] {
  const mots = motsDeRecherche(requete);
  if (!mots.length) return [...eleves];
  return eleves.filter((e) => { const t = texteDossier(e); return mots.every((m) => t.includes(m)); });
}

/* ───────── Cartes ───────── */

/** Initiales pour la pastille (prénom puis nom) ; « ? » si le dossier n'a pas de nom. */
export function initiales(e: Pick<Eleve, 'nom' | 'prenom'>): string {
  const premiere = (t: string): string => [...t.trim()].find((c) => /\p{L}/u.test(c))?.toLocaleUpperCase('fr') ?? '';
  return `${premiere(e.prenom)}${premiere(e.nom)}` || '?';
}

export interface BilanSeances { nombre: number; derniere: string }

/** Nombre de séances et date de la dernière, pour chaque élève (une seule passe). */
export function bilanSeances(seances: readonly Seance[]): Map<string, BilanSeances> {
  const res = new Map<string, BilanSeances>();
  for (const s of seances) {
    const b = res.get(s.eleveId);
    if (!b) res.set(s.eleveId, { nombre: 1, derniere: s.date });
    else { b.nombre += 1; if (s.date > b.derniere) b.derniere = s.date; }
  }
  return res;
}

/* ───────── Passage d'année scolaire ───────── */

export type ActionPassage = 'passer' | 'laisser' | 'archiver';

export interface LignePassage {
  eleveId: string;
  action: ActionPassage;
  /** Classe de l'année qui commence (modifiable : redoublement, changement de lettre…). */
  classe: string;
  /** Explication courte affichée à côté de la ligne. */
  note: string;
  /** Le dossier est déjà celui de l'année visée : un « passage en bloc » ne doit pas le faire passer une seconde fois. */
  dejaAJour: boolean;
}

/** Année suivante, ex. « 2025-2026 » → « 2026-2027 » ; chaîne vide si le format est illisible. */
export function anneeSuivante(annee: string): string {
  const m = /^(\d{4})-(\d{4})$/.exec(annee);
  return m && Number(m[2]) === Number(m[1]) + 1 ? `${m[2]}-${Number(m[2]) + 1}` : '';
}

/** Dernière année du parcours : 6e, ou 7e pour le professionnel et le CEFA. */
const derniereAnnee = (classe: string): number => {
  const f = analyserClasse(classe)?.filiere;
  return f === 'professionnel' || f === 'cefa' ? 7 : 6;
};

/** « 3CB » → « 4CB ». undefined si la classe n'est pas reconnue ou si c'était la dernière année du parcours. */
export function classeSuivante(classe: string): string | undefined {
  const m = /^\s*([1-7])(.*)$/.exec(classe);
  if (!m || !analyserClasse(classe)) return undefined;
  const n = Number(m[1]);
  return n >= derniereAnnee(classe) ? undefined : `${n + 1}${m[2]!.trim()}`;
}

/** « S3 » → « S4 », « P6 » → « S1 ». undefined si illisible ou si c'était S6. */
export function niveauSuivant(niveau: string): string | undefined {
  const m = /^\s*([PS])([1-6])\s*$/i.exec(niveau);
  if (!m) return undefined;
  const lettre = m[1]!.toUpperCase();
  const n = Number(m[2]);
  if (n < 6) return `${lettre}${n + 1}`;
  return lettre === 'P' ? 'S1' : undefined;
}

/**
 * Proposition de passage pour les élèves actifs, à relire ligne par ligne.
 * Prudence : un dossier déjà à jour, ou dont l'année est inconnue, n'est jamais modifié sans choix de l'utilisateur.
 */
export function planPassage(eleves: readonly Eleve[], cible: string): LignePassage[] {
  return elevesActifs(eleves).map((e): LignePassage => {
    const base = { eleveId: e.id, classe: classeSuivante(e.classe) ?? e.classe, dejaAJour: false };
    if (e.anneeDossier && e.anneeDossier >= cible) return { ...base, classe: e.classe, dejaAJour: true, action: 'laisser', note: `Déjà à jour pour ${cible}.` };
    if (!e.anneeDossier) return { ...base, action: 'laisser', note: 'Année du dossier inconnue : choisissez.' };
    if (!e.classe.trim()) return { ...base, action: 'laisser', note: 'Pas de classe dans le dossier.' };
    const suivante = classeSuivante(e.classe);
    if (suivante) return { ...base, classe: suivante, action: 'passer', note: `Dossier de ${e.anneeDossier}.` };
    if (analyserClasse(e.classe)) return { ...base, classe: e.classe, action: 'archiver', note: 'Dernière année du parcours.' };
    return { ...base, classe: e.classe, action: 'passer', note: 'Classe non reconnue : à saisir à la main.' };
  });
}

export interface OptionsPassage {
  /** Efface le titulaire des élèves qui passent (il change presque toujours d'une année à l'autre). */
  viderTitulaire: boolean;
  /** Date du jour (AAAA-MM-JJ), utilisée pour l'archivage. */
  aujourdhui: string;
}

/** Applique une ligne du passage d'année. Les séances ne sont jamais touchées : elles gardent la classe de leur époque. */
export function appliquerPassage(e: Eleve, ligne: LignePassage, cible: string, options: OptionsPassage): Eleve {
  if (ligne.action === 'laisser') return e;
  if (ligne.action === 'archiver') return archiver(e, options.aujourdhui);
  const classe = ligne.classe.trim();
  const { niveau: ancien, ...reste } = e;
  const changeDeClasse = classe !== e.classe.trim();
  const suivant = ancien && changeDeClasse ? niveauSuivant(ancien) : undefined;
  const garde = ancien && !changeDeClasse ? { niveau: ancien } : suivant ? { niveau: suivant } : {};
  return { ...reste, ...garde, classe, anneeDossier: cible, titulaire: options.viderTitulaire ? '' : e.titulaire };
}
