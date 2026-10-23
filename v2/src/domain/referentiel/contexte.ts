import { sansAccents } from './texte.ts';
import { ANNEES } from './types.ts';
import type { Annee, FormeEnseignement } from './types.ts';
import type { Filiere } from '../types.ts';

export type Jeu = 'mathematiques' | 'francais' | 'langues' | 'sciences' | 'economie';

export interface Cible {
  jeu: Jeu;
  /** Nom de la matière dans le référentiel (inutile pour le filtrage, utile pour l'affichage). */
  langue?: string;
}

/** Retrouve le jeu de données à partir de la matière saisie librement (« Maths », « Néerlandais »…). null = pas de référentiel disponible. */
export function cibleDeMatiere(matiere: string): Cible | null {
  const m = sansAccents(matiere);
  if (/\bmath/.test(m)) return { jeu: 'mathematiques' };
  if (/\bfran[cç]/.test(m)) return { jeu: 'francais' };
  if (/\b(sciences?|biolog|chimie|physique)/.test(m) && !/econom|sociales/.test(m)) return { jeu: 'sciences' };
  if (/econom|droit|gestion/.test(m)) return { jeu: 'economie' };
  if (/neerland|\bnl\b/.test(m)) return { jeu: 'langues', langue: 'Néerlandais' };
  if (/anglais/.test(m)) return { jeu: 'langues', langue: 'Anglais' };
  if (/allemand/.test(m)) return { jeu: 'langues', langue: 'Allemand' };
  if (/espagnol/.test(m)) return { jeu: 'langues', langue: 'Espagnol' };
  if (/italien/.test(m)) return { jeu: 'langues', langue: 'Italien' };
  return null;
}

export interface ClasseAnalysee {
  annee: Annee;
  filiere: Filiere | undefined;
}

const CLASSE = /^\s*([1-7])\s*(?:e|re|ère|ème|eme)?\s*(CEFA|TTR|TT|TQ|C|D|G|T|P)\s*([A-Z0-9]{0,3})\s*$/i;
const LETTRE_FILIERE: Readonly<Record<string, Filiere | undefined>> = {
  C: 'secondaire', D: 'secondaire', G: 'secondaire', TT: 'technique_transition', TTR: 'technique_transition',
  TQ: 'technique_qualification', P: 'professionnel', CEFA: 'cefa', T: undefined
};

/**
 * Notation des classes de la FWB : chiffre + lettre(s) de l'organisation des études + section.
 * 3CB = 3e commune, section B ; 1DB = 1re différenciée ; 4TQ = 4e technique de qualification ; 5P = 5e professionnelle.
 */
export function analyserClasse(classe: string): ClasseAnalysee | undefined {
  const m = CLASSE.exec(classe);
  if (!m) return undefined;
  const annee = `S${Math.min(Number(m[1]), 6)}` as Annee;
  return { annee, filiere: LETTRE_FILIERE[m[2]!.toUpperCase()] };
}

/** « S3 », « 3e secondaire », « 3ème »… → S3. */
export function anneeDeNiveau(texte: string): Annee | undefined {
  const t = sansAccents(texte).replace(/\s+/g, '');
  const direct = /\b([ps])([1-6])\b/.exec(sansAccents(texte));
  if (direct) {
    const a = `${direct[1]!.toUpperCase()}${direct[2]}` as Annee;
    if ((ANNEES as readonly string[]).includes(a)) return a;
  }
  const pr = /^([1-6])(e|eme|re|ere)?(primaire|prim)$/.exec(t);
  if (pr) return `P${pr[1]}` as Annee;
  const n = /^([1-6])(e|eme|re|ere)?(sec|secondaire)?$/.exec(t);
  if (n) return `S${n[1]}` as Annee;
  return analyserClasse(texte)?.annee;
}

/** Niveau d'étude du dossier → forme d'enseignement du référentiel (le primaire n'en a pas). */
export function formeDeFiliere(filiere: string): FormeEnseignement | undefined {
  switch (filiere) {
    case 'secondaire': return 'G';
    case 'technique_transition': return 'TTR';
    case 'technique_qualification': return 'TQ';
    case 'primaire': return undefined;
    case 'professionnel': case 'cefa': return 'P';
    default: return formeDeTexte(filiere);
  }
}

export function formeDeTexte(texte: string): FormeEnseignement | undefined {
  const t = sansAccents(texte).trim();
  if (!t) return undefined;
  if (/^(g|general)/.test(t)) return 'G';
  if (/^(ttr|transition)/.test(t)) return 'TTR';
  if (/^(tq|technique|qualification)/.test(t)) return 'TQ';
  if (/^(p$|prof)/.test(t)) return 'P';
  return undefined;
}
