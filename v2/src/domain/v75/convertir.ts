import { LANGUES_MODERNES } from '../eleves/eleves.ts';
import { sansAccents } from '../referentiel/texte.ts';
import { PERIODES_DEFAUT, PRESENCE_LIBELLES } from '../types.ts';
import type { Aide, Eleve, Effet, Niveau, Observation, Presence, Seance, SituationAide, Transfert } from '../types.ts';
import type { Ecart } from './types.ts';

/*
 * V75 → V2 : élèves et séances. Fonctions pures. Principe : on ne devine rien et on ne perd rien en silence.
 * Ce qui ne peut pas être repris est renvoyé avec sa raison ; ce qui change de forme est expliqué dans `alertes`.
 */

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Brut) : {});
const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const textes = (v: unknown): string[] => liste(v).map(texte).filter(Boolean);
const iso = (v: unknown): string => { const t = texte(v).slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : ''; };
/** Comparaison de noms : sans accents, sans majuscules, espaces simples. */
export const cleNom = (s: string): string => sansAccents(s).replace(/\s+/g, ' ').trim();

/** Identifiants V2 des objets repris : toujours les mêmes pour un même objet V75, donc une reprise répétée ne crée jamais de doublon. */
export const idEleveV2 = (idV75: string): string => `v75-${idV75}`;
export const idSeanceV2 = (idV75: string): string => `v75-s-${idV75}`;
export const idActiviteV2 = (idV75: string, suffixe = ''): string => `v75-a-${idV75}${suffixe ? `-${suffixe}` : ''}`;
/** Les éléments repris portent cette marque dans leur identifiant. */
export const estDeV75 = (id: string): boolean => id.startsWith('v75-');

/* ───────── Élèves ───────── */

export interface EleveRepris {
  eleve: Eleve;
  /** Identifiant dans la V75 (celui qui relie les séances et l'agenda). */
  idV75: string;
  /** Autre identifiant numérique de la V75, parfois utilisé dans les séances anciennes. */
  idsV75: string[];
  alertes: string[];
}

export function convertirEleve(brut: unknown): EleveRepris | Ecart {
  const e = objet(brut);
  const idV75 = texte(e.studentId) || texte(e.id);
  const admin = objet(e.administrativeInfo);
  const nom = texte(e.nom) || texte(admin.nom);
  if (!idV75) return { quoi: nom || 'Dossier sans nom', raison: 'dossier sans identifiant' };
  if (!nom) return { quoi: `Dossier ${idV75}`, raison: 'dossier sans nom' };
  const alertes: string[] = [];

  const matieres: string[] = [];
  const langues: string[] = [];
  for (const m of textes(e.matieres)) {
    const langue = LANGUES_MODERNES.find((l) => cleNom(l) === cleNom(m));
    if (langue) { if (!langues.includes(langue)) langues.push(langue); } else if (!matieres.includes(m)) matieres.push(m);
  }
  const naissanceBrute = texte(e.dateNaissance) || texte(admin.dateNaissance);
  const dateNaissance = iso(naissanceBrute);
  if (naissanceBrute && !dateNaissance) alertes.push('date de naissance illisible, laissée vide');

  const eleve: Eleve = {
    id: idEleveV2(idV75),
    // La V75 n'a qu'une case « nom » : on la garde telle quelle, à séparer ensuite si on le souhaite.
    nom, prenom: '',
    classe: texte(e.classe) || texte(admin.classe),
    ecole: texte(e.ecole) || texte(admin.ecole),
    titulaire: texte(e.titulaire) || texte(admin.titulaire),
    dateNaissance,
    matieres,
    ...(langues.length ? { langues } : {})
  };
  const idsV75 = [...new Set([idV75, texte(e.id)].filter(Boolean))];
  return { eleve, idV75, idsV75, alertes };
}

/** Retrouve l'élève d'une séance ou d'une activité : par identifiant, sinon par nom (accents et majuscules ignorés). */
export interface Annuaire {
  parIdentifiant(id: string): string | null;
  parNom(nom: string): string | null;
}

export function creerAnnuaire(repris: readonly EleveRepris[]): Annuaire {
  const parId = new Map<string, string>();
  const parNom = new Map<string, string | null>();
  for (const r of repris) {
    for (const id of r.idsV75) parId.set(id, r.eleve.id);
    const cle = cleNom(r.eleve.nom);
    // Deux élèves de même nom : le nom seul ne suffit pas à choisir, on n'invente rien.
    parNom.set(cle, parNom.has(cle) ? null : r.eleve.id);
  }
  return {
    parIdentifiant: (id) => parId.get(id) ?? null,
    parNom: (nom) => (nom ? parNom.get(cleNom(nom)) ?? null : null)
  };
}

export function eleveDe(annuaire: Annuaire, idV75: unknown, nom: unknown): string | null {
  const id = texte(idV75);
  return (id && annuaire.parIdentifiant(id)) || annuaire.parNom(texte(nom));
}

/* ───────── Séances ───────── */

export interface ContexteSeances {
  annuaire: Annuaire;
  /** Noms des huit périodes dans la V75 (réglables là-bas) ; sert à les ramener à « 1e H »… */
  periodesV75: readonly string[];
  /** Moment de la reprise (date ISO) pour les séances sans date de création. */
  maintenant: string;
}

export interface SeanceReprise { seance: Seance; alertes: string[] }

/** Phrases que la V75 écrivait toute seule dans « objectif de la leçon » quand l'élève ou le professeur était absent. */
const OBJECTIFS_AUTOMATIQUES_V75 = new Set(
  ['Élève absent — Séance non tenue', 'Professeur absent / Cours annulé', 'Agent du pôle absent', 'Co-enseignement en classe'].map(cleNom)
);

const niveau = (v: unknown): Niveau | null => (v === 0 || v === 1 || v === 2 ? v : typeof v === 'string' && /^[012]$/.test(v) ? (Number(v) as Niveau) : null);
const effet = (v: unknown): Effet | null => niveau(v);
const PRESENCES = Object.keys(PRESENCE_LIBELLES) as Presence[];
const SITUATIONS: readonly SituationAide[] = ['none', 'existing', 'new', 'later'];
const TRANSFERTS: readonly Transfert[] = ['observed', 'later', 'not_observed'];

function periode(valeur: unknown, ctx: ContexteSeances): string {
  const t = texte(valeur);
  if (!t) return PERIODES_DEFAUT[0];
  if ((PERIODES_DEFAUT as readonly string[]).includes(t)) return t;
  const rang = ctx.periodesV75.findIndex((p) => cleNom(p) === cleNom(t));
  return rang >= 0 && rang < PERIODES_DEFAUT.length ? PERIODES_DEFAUT[rang]! : t;
}

export function convertirSeance(brut: unknown, ctx: ContexteSeances): SeanceReprise | Ecart {
  const s = objet(brut);
  const idV75 = texte(s.id);
  const ident = objet(s.identification);
  const date = iso(ident.date);
  const qui = texte(ident.eleve);
  const decrire = (): string => `Séance du ${date || texte(ident.date) || 'date inconnue'}${qui ? ` (${qui})` : ''}`;
  if (!idV75) return { quoi: decrire(), raison: 'séance sans identifiant' };
  if (!date) return { quoi: decrire(), raison: 'date illisible' };
  const eleveId = eleveDe(ctx.annuaire, ident.eleveId, ident.eleve);
  if (!eleveId) return { quoi: decrire(), raison: qui ? `élève « ${qui} » introuvable dans les dossiers repris` : 'séance sans élève' };

  const alertes: string[] = [];
  const contexte = objet(s.contexte);
  const objectif = objet(s.objectif);
  const q2 = objet(s.q2);
  const q3 = objet(s.q3);
  const q4 = objet(s.q4);
  const q5 = objet(s.q5);
  const q6 = objet(s.q6);
  const meta = objet(s.metadata);
  const per = objet(ident.periode);

  const presenceBrute = texte(contexte.presenceStatus);
  const presence: Presence = (PRESENCES as string[]).includes(presenceBrute) ? (presenceBrute as Presence) : 'present';

  const observations: Observation[] = liste(q2.observations).map(objet).map((o) => ({ texte: texte(o.observation), niveau: niveau(o.niveau) })).filter((o) => o.texte);
  const competences: Observation[] = liste(q3.indicateurs).map(objet).map((o) => ({ texte: texte(o.texte), niveau: niveau(o.appreciation) })).filter((o) => o.texte);

  const effets = objet(q4.effets);
  const aides: Aide[] = textes(q4.types).map((nom) => ({ nom, effet: effet(effets[nom]) }));
  const situationBrute = texte(q4.situation);
  const situationAide: SituationAide = (SITUATIONS as readonly string[]).includes(situationBrute) ? (situationBrute as SituationAide) : 'none';

  const transfertBrut = texte(q5.statut);
  const transfert: Transfert | null = (TRANSFERTS as readonly string[]).includes(transfertBrut) ? (transfertBrut as Transfert) : null;
  // La V2 n'a plus de case de précision pour le transfert : on garde le texte avec les précisions sur les aides.
  const precisionTransfert = texte(q5.precision);
  const precisionAide = [texte(q4.precision), precisionTransfert ? `Utilisé ailleurs que pendant la séance : ${precisionTransfert}` : ''].filter(Boolean).join('\n');
  if (precisionTransfert) alertes.push('précision sur l’utilisation ailleurs ajoutée aux précisions sur les aides');

  const objectifLecon = texte(objectif.objectifLecon);
  const creeLe = texte(meta.createdAt) || ctx.maintenant;

  const seance: Seance = {
    id: idSeanceV2(idV75),
    eleveId,
    date,
    periodeDebut: periode(per.start, ctx),
    periodeFin: periode(per.end || per.start, ctx),
    matiere: texte(contexte.matiere),
    niveauScolaire: texte(contexte.niveau),
    forme: texte(contexte.forme),
    presence,
    interventions: textes(contexte.typeIntervention),
    objectifLecon: OBJECTIFS_AUTOMATIQUES_V75.has(cleNom(objectifLecon)) ? '' : objectifLecon,
    contenuClasse: texte(contexte.classNotes),
    monObjectif: texte(objectif.objectifProfessionnel),
    observations,
    remarque: texte(q2.precision),
    competences,
    precisionCompetence: texte(q3.precision),
    situationAide,
    aides,
    precisionAide,
    transfert,
    suite: {
      actions: textes(q6.actions),
      modalite: texte(q6.modalite),
      objectif: texte(q6.objectif),
      collaborations: textes(q6.collaborations),
      precision: texte(q6.precision)
    },
    creeLe,
    modifieLe: texte(meta.updatedAt) || creeLe
  };
  return { seance, alertes };
}

export const estEcart = (x: unknown): x is Ecart => typeof x === 'object' && x !== null && 'raison' in x && 'quoi' in x;
