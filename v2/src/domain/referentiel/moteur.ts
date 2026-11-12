import { developper } from './alias.ts';
import { racines, racinesAdministratives } from './texte.ts';
import { enVigueur } from './vigueur.ts';
import { ANNEES } from './types.ts';
import type { Annee, Contexte, EntreeReferentiel, Piste } from './types.ts';

interface Ligne {
  entree: EntreeReferentiel;
  attendu: Set<string>;
  theme: Set<string>;
}

/** Index d'une matière : mots → poids (plus un mot est rare, plus il compte). */
/** Ce que la question « Fonctionnement observé » couvre déjà (consignes, concentration…) : inutile de le reproposer comme compétence. */
const DEJA_COUVERT = /consignes?|ce qui est demand/i;

/** Nombre de pistes affichées d'abord ; au-delà (« Voir d'autres pistes »), on complète avec le reste de la séquence. */
export const PISTES_PAR_DEFAUT = 4;
/** Part du meilleur score en dessous de laquelle une piste n'est plus proposée d'emblée. */
const SEUIL_RELATIF = 0.6;
/** Lignes qui décident de la séquence du programme : la meilleure compte pleinement, les suivantes ne font qu'appuyer (une seule ligne chanceuse ne suffit pas, mais plusieurs lignes faibles ne doivent pas non plus l'emporter). */
const LIGNES_D_APPUI = 2;
const POIDS_D_APPUI = 0.25;
/** Nombre de tâches proches de l'objectif à partir duquel une séquence est jugée convaincante pour être complétée. */
const TACHES_PROCHES_MINIMUM = 2;
/** Années dont le programme est organisé en séquences (compétences terminales S3–S6) ; avant, le tronc commun et les Socles restent proposés ligne par ligne (une séquence de S3+ passerait sinon devant eux). */
const ANNEES_EN_SEQUENCES: ReadonlySet<Annee | undefined> = new Set<Annee>(['S3', 'S4', 'S5', 'S6']);
/** Ordre d'une séquence du programme : savoir (Connaître), savoir-faire (Appliquer), compétence (Transférer). Jamais affiché. */
const ORDRE_PROCESSUS: Readonly<Record<EntreeReferentiel['t'], number>> = { s: 0, f: 1, c: 2 };

/** Une unité de programme plus petite n'est pas une séquence (chaque ligne y est seule) ; plus grande, c'est un thème entier, pas une séquence de tâches. */
const TAILLE_MIN_SEQUENCE = 4;
const TAILLE_MAX_SEQUENCE = 60;

interface SequenceDeLigne { cle: string; titre: string }

/** Clé du module de programme d'une ligne du tronc commun (null si la ligne n'en a pas) : référentiel, année et intitulé. */
const cleModule = (e: EntreeReferentiel): string | null => (e.sq ? `${e.r}|${e.n ?? ''}|${e.sq}` : null);

/**
 * Compétence d'un module du programme : celle que le programme écrit en tête du module (`cd`, sciences) ; sinon l'intitulé (`i`) le plus
 * fréquent de ses lignes « compétence » (maths : « Articuler des propriétés géométriques… »), sans point final ; vide si rien ne convient.
 */
function competenceDuModule(module: readonly Ligne[]): string {
  const ecrite = module.find((l) => l.entree.cd)?.entree.cd;
  if (ecrite) return ecrite;
  const comptes = new Map<string, number>();
  for (const { entree } of module) if (entree.t === 'c' && entree.i) comptes.set(entree.i, (comptes.get(entree.i) ?? 0) + 1);
  const [premier = ''] = [...comptes].sort((a, b) => b[1] - a[1]).map(([intitule]) => intitule);
  return premier.replace(/\.$/, '');
}

/**
 * Séquence du programme d'une ligne (ou null).
 * - Maths S3–S6 : un tableau du PDF = une page d'un référentiel (le code « 4UAA4 » seul ne l'identifie pas : il revient
 *   d'une section à l'autre en qualification).
 * - Autres compétences terminales (HGT / HPT) : l'unité de programme = l'intitulé `i` (sinon le thème `u`) d'un référentiel.
 * Le tronc commun (S1–S3, primaire) n'a pas de séquences : essayé en regroupant par thème et par année, le corpus gelé baisse
 * (un cas de moins dans chaque lot), car les lignes y sont fines et les thèmes larges. Il reste proposé ligne par ligne.
 */
function sequenceDe(e: EntreeReferentiel): SequenceDeLigne | null {
  if (e.q) return { cle: `${e.r}|${e.p ?? ''}`, titre: e.u ?? '' };
  if (e.f !== 'HGT' && e.f !== 'HPT') return null;
  const unite = e.i ?? e.u;
  return unite ? { cle: `${e.r}|${unite}`, titre: unite } : null;
}

export class IndexReferentiel {
  private readonly lignes: Ligne[];
  private readonly poids = new Map<string, number>();
  /** Lignes de chaque séquence du programme, d'après `cleSequence` (voir les tailles minimale et maximale ci-dessus). */
  private readonly sequences = new Map<string, Ligne[]>();
  private readonly titres = new Map<string, string>();
  /** Lignes de chaque module du programme du tronc commun (champ `sq`), dans l'ordre du programme. */
  private readonly modules = new Map<string, Ligne[]>();
  private readonly dansSequence: ReadonlySet<Ligne>;
  /** Matière du jeu (champ `m` des lignes) : choisit la table d'alias de terrain. */
  private readonly matiere: string | undefined;

  constructor(toutes: readonly EntreeReferentiel[]) {
    const entrees = toutes.filter((x) => typeof x.a === 'string' && x.a.length > 0);
    this.matiere = entrees[0]?.m;
    const df = new Map<string, number>();
    this.lignes = entrees.map((entree) => {
      const attendu = new Set(racines(entree.a));
      const theme = new Set(racines(`${entree.i ?? ''} ${entree.u ?? ''} ${entree.q ? (entree.cd ?? '') : ''}`));
      for (const t of new Set([...attendu, ...theme])) df.set(t, (df.get(t) ?? 0) + 1);
      const ligne = { entree, attendu, theme };
      const cleDuModule = cleModule(entree);
      if (cleDuModule) this.modules.set(cleDuModule, [...(this.modules.get(cleDuModule) ?? []), ligne]);
      const sequence = sequenceDe(entree);
      if (sequence) {
        this.sequences.set(sequence.cle, [...(this.sequences.get(sequence.cle) ?? []), ligne]);
        this.titres.set(sequence.cle, sequence.titre);
      }
      return ligne;
    });
    for (const [cle, lignes] of this.sequences) {
      if (lignes.length < TAILLE_MIN_SEQUENCE || lignes.length > TAILLE_MAX_SEQUENCE) {
        this.sequences.delete(cle);
        this.titres.delete(cle);
      }
    }
    this.dansSequence = new Set([...this.sequences.values()].flat());
    const n = entrees.length;
    for (const [t, c] of df) this.poids.set(t, Math.log((n + 1) / (c + 0.5)));
  }

  get taille(): number { return this.lignes.length; }

  /** La ligne peut-elle être proposée à cet élève (langue, forme d'enseignement, en vigueur, pas déjà couverte par Fonctionnement) ? */
  private admissible(entree: EntreeReferentiel, ctx: Contexte): boolean {
    if (entree.l && ctx.langue && entree.l !== ctx.langue) return false;
    return formeCompatible(entree, ctx) && !DEJA_COUVERT.test(entree.a) && enVigueur(entree, ctx.rentree);
  }

  /** Proximité d'une ligne avec les mots de l'objectif, année comprise ; 0 = pas proposable ou sans rapport. */
  private noter({ entree, attendu, theme }: Ligne, ctx: Contexte, mots: readonly string[]): number {
    if (!this.admissible(entree, ctx)) return 0;
    let score = 0;
    for (const t of mots) {
      const w = this.poids.get(t) ?? 0;
      if (attendu.has(t)) score += w;
      else if (theme.has(t)) score += w * 0.7;
    }
    return score * facteurAnnee(entree.n, entree.nf, ctx.annee);
  }

  /**
   * Propose au plus `k` pistes, les plus proches de l'objectif.
   * Quand l'objectif correspond à une séquence du programme, toutes les pistes viennent de cette séquence (voir `depuisSequence`) ;
   * sinon une piste par intitulé et par année. Aucune piste quand l'objectif est vague (« révisions », « interro »…).
   */
  suggerer(ctx: Contexte, k = PISTES_PAR_DEFAUT): Piste[] {
    const mots = [...new Set(racines(developper(ctx.objectif, this.matiere)))].filter((t) => !racinesAdministratives.has(t));
    if (!mots.length) return [];
    const notes = new Map<Ligne, number>(this.lignes.map((l) => [l, this.noter(l, ctx, mots)]));
    const meilleures = new Map<string, Piste>();
    for (const ligne of this.lignes) {
      const score = notes.get(ligne) ?? 0;
      if (score <= 0) continue;
      const { entree } = ligne;
      const cle = `${entree.i ?? entree.a.slice(0, 40)}|${entree.n ?? ''}`;
      const actuelle = meilleures.get(cle);
      if (!actuelle || score > actuelle.score) {
        meilleures.set(cle, { entree, score, ecartAnnee: entree.n && ctx.annee && !dans(entree, ctx.annee) ? entree.n : null });
      }
    }
    const triees = [...meilleures.values()].sort((a, b) => b.score - a.score);
    const premier = triees[0];
    if (!premier) return [];
    const duProgramme = ANNEES_EN_SEQUENCES.has(ctx.annee) ? this.depuisSequence(ctx, notes, k) : null;
    if (duProgramme) return duProgramme;
    const vus = new Set<string>();
    const choisies = triees.filter((p) => p.score >= premier.score * SEUIL_RELATIF && !vus.has(p.entree.a) && vus.add(p.entree.a)).slice(0, k);
    return this.avecModuleDuProgramme(choisies, ctx, notes, k);
  }

  /**
   * Tronc commun : le module du programme de la meilleure piste qui en a un est nommé, ses pistes passent en tête dans l'ordre Connaître, Appliquer,
   * Transférer, et « Voir d'autres pistes » le complète avec le reste du module (un module du tronc commun est petit : la ligne la plus proche suffit à le désigner). Les autres pistes restent proposées après lui, sans titre.
   * La sélection ligne par ligne ne change pas : un module trop large ferait perdre des pistes pertinentes (corpus gelé).
   */
  private avecModuleDuProgramme(pistes: Piste[], ctx: Contexte, notes: ReadonlyMap<Ligne, number>, k: number): Piste[] {
    const tete = pistes.find((p) => p.entree.sq)?.entree;
    const cle = tete ? cleModule(tete) : null;
    const module = cle ? this.modules.get(cle) : undefined;
    if (!tete?.sq || !module) return pistes;
    const duModule = pistes.filter((p) => cleModule(p.entree) === cle);
    const autres = pistes.filter((p) => cleModule(p.entree) !== cle);
    const deja = new Set(pistes.map((p) => p.entree.a));
    const reste = k > PISTES_PAR_DEFAUT
      ? module.filter((l) => !deja.has(l.entree.a) && this.admissible(l.entree, ctx)).slice(0, k - pistes.length)
        .map((l) => ({ entree: l.entree, score: notes.get(l) ?? 0, ecartAnnee: l.entree.n && ctx.annee && !dans(l.entree, ctx.annee) ? l.entree.n : null }))
      : [];
    const sequence = { titre: tete.sq, competence: competenceDuModule(module) };
    const rangees = [...duModule, ...reste]
      .map((p) => ({ ...p, sequence }))
      .sort((a, b) => ORDRE_PROCESSUS[a.entree.t] - ORDRE_PROCESSUS[b.entree.t]);
    return [...rangees, ...autres];
  }

  /**
   * Séquence du programme la plus proche de l'objectif (meilleure ligne, appuyée par les suivantes), à condition que sa meilleure ligne
   * ne soit pas battue par une ligne qui n'appartient à aucune séquence (tronc commun, autres référentiels). Pistes : celles qui correspondent à l'objectif, puis — pour
   * « Voir d'autres pistes » — le reste de la séquence ; toujours dans l'ordre Connaître, Appliquer, Transférer.
   */
  private depuisSequence(ctx: Contexte, notes: ReadonlyMap<Ligne, number>, k: number): Piste[] | null {
    let retenue: Ligne[] | null = null;
    let sommeRetenue = 0;
    let cleRetenue = '';
    for (const [cle, lignes] of this.sequences) {
      const [premiere = 0, ...suivantes] = lignes.map((l) => notes.get(l) ?? 0).sort((a, b) => b - a);
      const somme = premiere + POIDS_D_APPUI * suivantes.slice(0, LIGNES_D_APPUI).reduce((s, x) => s + x, 0);
      if (somme > sommeRetenue) { retenue = lignes; sommeRetenue = somme; cleRetenue = cle; }
    }
    if (!retenue) return null;
    const note = (l: Ligne): number => notes.get(l) ?? 0;
    const meilleur = Math.max(...retenue.map(note));
    const horsProgramme = Math.max(0, ...this.lignes.filter((l) => !this.dansSequence.has(l)).map((l) => notes.get(l) ?? 0));
    if (meilleur < horsProgramme) return null;
    const proposables = retenue.filter((l) => this.admissible(l.entree, ctx));
    const proches = proposables.filter((l) => note(l) >= meilleur * SEUIL_RELATIF).sort((a, b) => note(b) - note(a)).slice(0, k);
    // Compléter par le reste de la séquence n'a de sens que si elle correspond vraiment à l'objectif (au moins deux tâches proches) :
    // sinon une seule ligne chanceuse ferait défiler des tâches sans rapport.
    const convaincante = proches.length >= TACHES_PROCHES_MINIMUM;
    const reste = k > PISTES_PAR_DEFAUT && convaincante ? proposables.filter((l) => !proches.includes(l)).slice(0, k - proches.length) : [];
    const premiere = retenue[0]?.entree;
    const sequence = { titre: this.titres.get(cleRetenue) ?? '', competence: premiere?.cd ?? '' };
    const vus = new Set<string>();
    return [...proches, ...reste]
      .sort((a, b) => ORDRE_PROCESSUS[a.entree.t] - ORDRE_PROCESSUS[b.entree.t] || retenue.indexOf(a) - retenue.indexOf(b))
      .filter((l) => !vus.has(l.entree.a) && vus.add(l.entree.a))
      .map((l) => ({
        entree: l.entree,
        score: note(l),
        ecartAnnee: l.entree.n && ctx.annee && !dans(l.entree, ctx.annee) ? l.entree.n : null,
        sequence
      }));
  }
}

function formeCompatible(e: EntreeReferentiel, ctx: Contexte): boolean {
  if (e.f === 'TC' || e.f === 'SOC' || !ctx.forme) return true;
  return e.f === 'HGT' ? ctx.forme === 'G' || ctx.forme === 'TTR' : ctx.forme === 'TQ' || ctx.forme === 'P';
}

/** Même année : plein poids ; année voisine : légèrement moins ; plus loin : nettement moins (mais jamais exclu). */
function dans(e: EntreeReferentiel, cible: Annee): boolean {
  if (!e.n) return true;
  const i = ANNEES.indexOf(cible);
  return i >= ANNEES.indexOf(e.n) && i <= ANNEES.indexOf(e.nf ?? e.n);
}

function facteurAnnee(a: Annee | undefined, fin: Annee | undefined, cible: Annee | undefined): number {
  if (!a || !cible) return 1;
  if (dans({ n: a, nf: fin } as EntreeReferentiel, cible)) return 1;
  const debut = ANNEES.indexOf(a);
  const d = ANNEES.indexOf(cible) - (ANNEES.indexOf(cible) > debut ? ANNEES.indexOf(fin ?? a) : debut);
  if (d === 0) return 1;
  if (d === 1) return 0.85;
  if (d === -1) return 0.8;
  return d > 1 ? 0.6 : 0.4;
}
