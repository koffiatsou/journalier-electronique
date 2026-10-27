import {
  DOSSIERS, TYPES_OBJETS, aPlat, cheminDistant, cle, decouperCle, empreinte, estDemo, etiquette, idDepuisNom, lireEnveloppe, modifieLeDe,
  normaliserObjet, planifier, trierCles, versTexte
} from '../domain/synchro/index.ts';
import type { Cle, EntreeRegistre, GenreConflit, ObjetSynchro, ObjetsLocaux, RefObjet, TypeObjet } from '../domain/synchro/index.ts';
import { ErreurVersion, SCELLEUR_NEUTRE } from './nuage.ts';
import type { FichierDistant, Nuage, Scelleur } from './nuage.ts';

/*
 * Synchronisation entre les données de cet appareil et un nuage (OneDrive ou simulation).
 * Jamais d'écrasement silencieux : quand les deux côtés ont changé et diffèrent, c'est un conflit qu'on présente à l'utilisateur.
 */

/** Ce que l'orchestrateur lit et écrit dans les données de cet appareil. */
export interface PortLocal {
  lire(): Promise<ObjetsLocaux>;
  /** Écrit et supprime en une fois. Supprimer un élève supprime aussi ses séances, activités et PIA. */
  appliquer(ecrire: ObjetSynchro[], supprimer: RefObjet[]): Promise<void>;
}

/** Mémoire de la dernière synchronisation (propre à cet appareil). */
export interface PortRegistre {
  lire(): Promise<Map<Cle, EntreeRegistre>>;
  enregistrer(entrees: Map<Cle, EntreeRegistre>): Promise<void>;
  retirer(cles: Cle[]): Promise<void>;
  compte(): Promise<string | null>;
  definirCompte(id: string): Promise<void>;
  vider(): Promise<void>;
}

export interface OptionsSynchro {
  nuage: Nuage;
  local: PortLocal;
  registre: PortRegistre;
  /** Identité du compte : si elle change, la mémoire de la dernière synchronisation est repartie de zéro. */
  compteId: string;
  /** Vrai pour un vrai compte : les données de démonstration ne partent jamais et ne sont jamais reçues. */
  exclureDemo: boolean;
  scelleur?: Scelleur;
  maintenant?: () => string;
}

export type GenreAffiche = 'modification' | GenreConflit;

export interface ConflitAffiche {
  cle: Cle;
  genre: GenreAffiche;
  etiquette: string;
  /** Dernière modification ici / dans OneDrive, quand on la connaît. */
  ici: string;
  la: string;
  liees: { cle: Cle; etiquette: string }[];
}

export interface ResultatSynchro {
  le: string;
  envoyes: number;
  recus: number;
  supprimesIci: number;
  supprimesLa: number;
  conflits: ConflitAffiche[];
  /** Éléments laissés de côté, avec la raison. */
  ignores: string[];
  /** Éléments qui n'ont pas pu être traités (fichier abîmé…). */
  erreurs: string[];
  /** Quelqu'un a modifié un fichier pendant l'opération : relancer règle presque toujours le problème. */
  aRelancer: boolean;
}

interface Local { type: TypeObjet; id: string; donnees: unknown; empreinte: string; eleveId?: string }

async function preparerLocaux(objets: ObjetsLocaux, exclureDemo: boolean): Promise<Map<Cle, Local>> {
  const sortie = new Map<Cle, Local>();
  for (const [c, o] of aPlat(objets)) {
    if (exclureDemo && o.type !== 'reglage' && estDemo(o.id)) continue;
    const donnees = normaliserObjet(o.type, o.donnees);
    if (donnees === null) continue;
    sortie.set(c, { type: o.type, id: o.id, donnees, empreinte: await empreinte(donnees), ...(o.eleveId ? { eleveId: o.eleveId } : {}) });
  }
  return sortie;
}

async function listerDistants(nuage: Nuage, exclureDemo: boolean): Promise<Map<Cle, FichierDistant>> {
  const sortie = new Map<Cle, FichierDistant>();
  for (const type of TYPES_OBJETS) {
    for (const f of await nuage.lister(DOSSIERS[type])) {
      const id = idDepuisNom(f.chemin.split('/').pop() ?? '');
      if (id === null || (exclureDemo && type !== 'reglage' && estDemo(id))) continue;
      sortie.set(cle(type, id), f);
    }
  }
  return sortie;
}

type Telechargement = { ok: true; donnees: unknown; empreinte: string } | { ok: false; erreur: string };

async function telecharger(nuage: Nuage, scelleur: Scelleur, f: FichierDistant, type: TypeObjet, id: string): Promise<Telechargement> {
  let texte: string;
  try { texte = await scelleur.ouvrir(await nuage.lire(f)); } catch (e) {
    if (e instanceof ErreurVersion) return { ok: false, erreur: 'le fichier a changé pendant la lecture' };
    throw e;
  }
  const lu = lireEnveloppe(texte);
  if (!lu.ok) return { ok: false, erreur: lu.erreur };
  if (lu.enveloppe.type !== type || lu.enveloppe.id !== id) return { ok: false, erreur: 'le contenu ne correspond pas au nom du fichier' };
  const donnees = normaliserObjet(type, lu.enveloppe.donnees);
  if (donnees === null) return { ok: false, erreur: 'contenu inutilisable' };
  return { ok: true, donnees, empreinte: await empreinte(donnees) };
}

const eleveIdDe = (donnees: unknown): string => {
  const v = (donnees as { eleveId?: unknown } | null)?.eleveId;
  return typeof v === 'string' ? v : '';
};

export async function synchroniser(o: OptionsSynchro): Promise<ResultatSynchro> {
  const maintenant = o.maintenant ?? (() => new Date().toISOString());
  const scelleur = o.scelleur ?? SCELLEUR_NEUTRE;
  const res: ResultatSynchro = { le: maintenant(), envoyes: 0, recus: 0, supprimesIci: 0, supprimesLa: 0, conflits: [], ignores: [], erreurs: [], aRelancer: false };

  if ((await o.registre.compte()) !== o.compteId) {
    await o.registre.vider();
    await o.registre.definirCompte(o.compteId);
  }
  const objets = await o.local.lire();
  const locaux = await preparerLocaux(objets, o.exclureDemo);
  const distants = await listerDistants(o.nuage, o.exclureDemo);
  const registre = await o.registre.lire();
  const nom = (type: TypeObjet, donnees: unknown): string => etiquette(type, donnees, objets.eleves);

  const plan = planifier({
    locaux: new Map([...locaux].map(([c, l]) => [c, { empreinte: l.empreinte, ...(l.eleveId ? { eleveId: l.eleveId } : {}) }])),
    distants: new Map([...distants].map(([c, f]) => [c, { etag: f.etag }])),
    registre
  });

  const aEnregistrer = new Map<Cle, EntreeRegistre>();
  const aRetirer: Cle[] = [...plan.oublier];
  try {
    /* 1. Recevoir ce qui est nouveau ou modifié dans OneDrive. */
    const ecrireIci: ObjetSynchro[] = [];
    const supprimerIci: RefObjet[] = [];
    const recus = new Map<Cle, EntreeRegistre>();
    const elevesPresents = new Set(objets.eleves.map((e) => e.id));
    for (const c of trierCles(plan.recevoir)) {
      const ref = decouperCle(c)!;
      const f = distants.get(c)!;
      const r = await telecharger(o.nuage, scelleur, f, ref.type, ref.id);
      if (!r.ok) { res.erreurs.push(`${c} : ${r.erreur}`); continue; }
      if (ref.type === 'eleve') elevesPresents.add(ref.id);
      const eid = ref.type === 'eleve' || ref.type === 'reglage' ? '' : eleveIdDe(r.donnees);
      if (eid && !elevesPresents.has(eid)) { res.ignores.push(`${nom(ref.type, r.donnees)} : l’élève n’existe pas ici`); continue; }
      ecrireIci.push({ type: ref.type, id: ref.id, donnees: r.donnees, ...(eid ? { eleveId: eid } : {}) });
      recus.set(c, { empreinte: r.empreinte, etag: f.etag });
    }
    for (const c of plan.supprimerLocal) { supprimerIci.push(decouperCle(c)!); aRetirer.push(c); }
    if (ecrireIci.length || supprimerIci.length) await o.local.appliquer(ecrireIci, supprimerIci);
    for (const [c, e] of recus) aEnregistrer.set(c, e);
    res.recus = recus.size;
    res.supprimesIci = supprimerIci.length;

    /* 2. Modifié des deux côtés : on compare les contenus. */
    for (const c of trierCles(plan.aVerifier)) {
      const ref = decouperCle(c)!;
      const f = distants.get(c)!;
      const l = locaux.get(c)!;
      const r = await telecharger(o.nuage, scelleur, f, ref.type, ref.id);
      if (!r.ok) { res.erreurs.push(`${c} : ${r.erreur}`); continue; }
      if (r.empreinte === l.empreinte) aEnregistrer.set(c, { empreinte: l.empreinte, etag: f.etag });
      else res.conflits.push({ cle: c, genre: 'modification', etiquette: nom(ref.type, l.donnees), ici: modifieLeDe(l.donnees), la: modifieLeDe(r.donnees), liees: [] });
    }

    /* 3. Envoyer ce qui est nouveau ou modifié ici. */
    for (const c of plan.envoyer) {
      const l = locaux.get(c)!;
      const texte = await scelleur.sceller(versTexte(l.type, l.id, l.donnees, maintenant()));
      try {
        const f = await o.nuage.ecrire(cheminDistant(l.type, l.id), texte, registre.get(c)?.etag ?? null);
        aEnregistrer.set(c, { empreinte: l.empreinte, etag: f.etag });
        res.envoyes += 1;
      } catch (e) {
        if (e instanceof ErreurVersion) res.aRelancer = true; else throw e;
      }
    }

    /* 4. Supprimer dans OneDrive ce qui a été supprimé ici (et inchangé là-bas). */
    for (const c of plan.supprimerDistant) {
      try {
        await o.nuage.supprimer({ ...distants.get(c)!, etag: registre.get(c)!.etag });
        aRetirer.push(c);
        res.supprimesLa += 1;
      } catch (e) {
        if (e instanceof ErreurVersion) res.aRelancer = true; else throw e;
      }
    }

    /* 5. Suppressions en désaccord : à présenter à l'utilisateur. */
    for (const k of plan.conflits) {
      const ref = decouperCle(k.cle)!;
      const l = locaux.get(k.cle);
      const f = distants.get(k.cle);
      let donnees: unknown = l?.donnees;
      let la = '';
      if (!l && f) {
        const r = await telecharger(o.nuage, scelleur, f, ref.type, ref.id);
        if (r.ok) { donnees = r.donnees; la = modifieLeDe(r.donnees); }
      }
      res.conflits.push({
        cle: k.cle, genre: k.genre, etiquette: nom(ref.type, donnees ?? { id: ref.id }), ici: l ? modifieLeDe(l.donnees) : '', la,
        liees: k.liees.map((lc) => ({ cle: lc, etiquette: nom(decouperCle(lc)!.type, locaux.get(lc)?.donnees ?? {}) }))
      });
    }
  } finally {
    // Ce qui a réussi est mémorisé même si une étape suivante échoue (réseau coupé…) : la reprise sera correcte.
    if (aEnregistrer.size) await o.registre.enregistrer(aEnregistrer);
    if (aRetirer.length) await o.registre.retirer(aRetirer);
  }
  return res;
}

/** Réponse de l'utilisateur à un conflit : garder ce qu'il y a ICI, ou adopter ce qu'il y a dans OneDrive (« là »). */
export type Choix = 'ici' | 'la';

export async function resoudreConflit(o: OptionsSynchro, conflit: ConflitAffiche, choix: Choix): Promise<void> {
  const scelleur = o.scelleur ?? SCELLEUR_NEUTRE;
  const maintenant = o.maintenant ?? (() => new Date().toISOString());
  const ref = decouperCle(conflit.cle);
  if (!ref) throw new Error('Élément inconnu.');
  const objets = await o.local.lire();
  const l = (await preparerLocaux(objets, o.exclureDemo)).get(conflit.cle);
  const f = (await listerDistants(o.nuage, o.exclureDemo)).get(conflit.cle);
  const memoriser = (e: EntreeRegistre) => o.registre.enregistrer(new Map([[conflit.cle, e]]));
  const depuisDistant = async (): Promise<{ donnees: unknown; empreinte: string }> => {
    if (!f) throw new Error('Le fichier n’existe plus dans OneDrive.');
    const r = await telecharger(o.nuage, scelleur, f, ref.type, ref.id);
    if (!r.ok) throw new Error(`Le fichier de OneDrive est inutilisable : ${r.erreur}`);
    return r;
  };
  const envoyer = async (etagAttendu: string | null): Promise<void> => {
    if (!l) throw new Error('L’élément n’existe plus ici.');
    try {
      const ecrit = await o.nuage.ecrire(cheminDistant(ref.type, ref.id), await scelleur.sceller(versTexte(ref.type, ref.id, l.donnees, maintenant())), etagAttendu);
      await memoriser({ empreinte: l.empreinte, etag: ecrit.etag });
    } catch (e) {
      if (e instanceof ErreurVersion) throw new Error('OneDrive a changé entre-temps : relancez la synchronisation.');
      throw e;
    }
  };
  const recuperer = async (): Promise<void> => {
    const r = await depuisDistant();
    const eid = ref.type === 'eleve' || ref.type === 'reglage' ? '' : eleveIdDe(r.donnees);
    if (eid && !objets.eleves.some((e) => e.id === eid)) throw new Error('L’élève de cet élément n’existe plus ici : impossible de le récupérer seul.');
    await o.local.appliquer([{ type: ref.type, id: ref.id, donnees: r.donnees, ...(eid ? { eleveId: eid } : {}) }], []);
    await memoriser({ empreinte: r.empreinte, etag: f!.etag });
  };

  if (conflit.genre === 'modification') {
    if (choix === 'ici') { if (!f) throw new Error('Le fichier n’existe plus dans OneDrive.'); await envoyer(f.etag); } else await recuperer();
  } else if (conflit.genre === 'supprimeDistant') {
    if (choix === 'ici') {
      await envoyer(f ? f.etag : null);
      // Les éléments qui dépendaient de cet élève repartiront comme des nouveautés.
      if (conflit.liees.length) await o.registre.retirer(conflit.liees.map((x) => x.cle));
    } else {
      await o.local.appliquer([], [{ type: ref.type, id: ref.id }]);
      await o.registre.retirer([conflit.cle, ...conflit.liees.map((x) => x.cle)]);
    }
  } else if (choix === 'ici') {
    // Supprimé ici, modifié dans OneDrive : on garde la suppression.
    if (f) {
      try { await o.nuage.supprimer(f); } catch (e) {
        if (e instanceof ErreurVersion) throw new Error('OneDrive a changé entre-temps : relancez la synchronisation.');
        throw e;
      }
    }
    await o.registre.retirer([conflit.cle]);
  } else {
    await recuperer();
  }
}

/* ───────── Repartir de OneDrive ───────── */

export interface Decompte { eleves: number; seances: number; activites: number; pias: number; reglages: number }

const decompter = (types: Iterable<TypeObjet>): Decompte => {
  const n: Decompte = { eleves: 0, seances: 0, activites: 0, pias: 0, reglages: 0 };
  for (const t of types) {
    if (t === 'eleve') n.eleves += 1; else if (t === 'seance') n.seances += 1; else if (t === 'activite') n.activites += 1; else if (t === 'pia') n.pias += 1; else n.reglages += 1;
  }
  return n;
};

export interface ApercuRepartir {
  /** Ce que OneDrive contient et que l'on pourrait reprendre. */
  nuage: Decompte;
  /** Ce que cet appareil contient aujourd'hui (et qui serait remplacé). */
  ici: Decompte;
  /** Fichiers de OneDrive illisibles (abîmés) : ils ne seraient pas repris. */
  erreurs: string[];
  /** Fichiers de OneDrive laissés de côté (par exemple une séance dont l'élève n'est pas dans OneDrive). */
  ignores: string[];
}

export interface ResultatRepartir extends ApercuRepartir {
  /** Objets écrits sur cet appareil. */
  ecrits: number;
  /** Objets de cet appareil qui n'étaient pas dans OneDrive et ont été retirés. */
  retires: number;
}

interface LuNuage { type: TypeObjet; id: string; donnees: unknown; eleveId: string; empreinte: string; etag: string }

/** Lit tout OneDrive sans rien modifier, ni là-bas ni ici. */
async function lireToutLeNuage(o: OptionsSynchro): Promise<{ lus: Map<Cle, LuNuage>; erreurs: string[]; ignores: string[]; reserves: Set<Cle> }> {
  const scelleur = o.scelleur ?? SCELLEUR_NEUTRE;
  const distants = await listerDistants(o.nuage, o.exclureDemo);
  const brut = new Map<Cle, LuNuage>();
  const erreurs: string[] = [];
  /** Éléments de OneDrive qu'on n'a pas pu reprendre : la version d'ici, s'il y en a une, n'est jamais retirée. */
  const reserves = new Set<Cle>();
  for (const c of trierCles(distants.keys())) {
    const ref = decouperCle(c)!;
    const f = distants.get(c)!;
    const r = await telecharger(o.nuage, scelleur, f, ref.type, ref.id);
    if (!r.ok) { erreurs.push(`${c} : ${r.erreur}`); reserves.add(c); continue; }
    brut.set(c, { type: ref.type, id: ref.id, donnees: r.donnees, eleveId: ref.type === 'eleve' || ref.type === 'reglage' ? '' : eleveIdDe(r.donnees), empreinte: r.empreinte, etag: f.etag });
  }
  // Une séance, une activité ou un PIA dont l'élève n'est pas dans OneDrive ne peut pas entrer ici.
  const eleves = new Set([...brut.values()].filter((x) => x.type === 'eleve').map((x) => x.id));
  const ignores: string[] = [];
  const lus = new Map<Cle, LuNuage>();
  for (const [c, x] of brut) {
    if (x.eleveId && !eleves.has(x.eleveId)) { ignores.push(`${c} : l’élève n’est pas dans OneDrive`); reserves.add(c); continue; }
    lus.set(c, x);
  }
  return { lus, erreurs, ignores, reserves };
}

/** Ce qu'il y a ici et qui compte pour « repartir » (les données de démonstration sont mises à part pour un vrai compte). */
async function lireIci(o: OptionsSynchro): Promise<{ objets: ObjetsLocaux; locaux: Map<Cle, Local> }> {
  const objets = await o.local.lire();
  return { objets, locaux: await preparerLocaux(objets, o.exclureDemo) };
}

/** Montre ce qui se passerait si cet appareil repartait de OneDrive, sans rien changer. */
export async function apercuRepartir(o: OptionsSynchro): Promise<ApercuRepartir> {
  const { lus, erreurs, ignores } = await lireToutLeNuage(o);
  const { locaux } = await lireIci(o);
  return { nuage: decompter([...lus.values()].map((x) => x.type)), ici: decompter([...locaux.values()].map((x) => x.type)), erreurs, ignores };
}

/**
 * Remplace les données de cet appareil par celles de OneDrive (nouvel ordinateur, ou appareil dont les données sont dépassées).
 * Rien n'est fusionné : ce qui est ici et pas dans OneDrive est retiré. OneDrive n'est jamais modifié.
 * Un fichier de OneDrive illisible n'est pas repris, et la version d'ici (s'il y en a une) est gardée.
 * Tout est relu et vérifié AVANT de toucher à cet appareil ; si OneDrive est vide ou illisible, on s'arrête sans rien changer.
 */
export async function repartirDeOneDrive(o: OptionsSynchro): Promise<ResultatRepartir> {
  const { lus, erreurs, ignores, reserves } = await lireToutLeNuage(o);
  if (!lus.size) throw new Error(erreurs.length ? 'Aucun fichier de OneDrive n’a pu être lu : rien n’a été changé.' : 'OneDrive ne contient encore aucune donnée du Journalier : rien n’a été changé.');
  const { locaux } = await lireIci(o);

  const supprimer: RefObjet[] = [];
  const elevesRetires = new Set<string>();
  for (const [c, l] of locaux) if (!lus.has(c) && !reserves.has(c) && l.type === 'eleve') { supprimer.push({ type: 'eleve', id: l.id }); elevesRetires.add(l.id); }
  for (const [c, l] of locaux) {
    if (lus.has(c) || reserves.has(c) || l.type === 'eleve') continue;
    if (l.eleveId && elevesRetires.has(l.eleveId)) continue; // supprimé avec son élève
    supprimer.push({ type: l.type, id: l.id });
  }
  const ecrire: ObjetSynchro[] = trierCles(lus.keys()).map((c) => lus.get(c)!)
    .map((x) => ({ type: x.type, id: x.id, donnees: x.donnees, ...(x.eleveId ? { eleveId: x.eleveId } : {}) }));

  // La mémoire de la dernière synchronisation est vidée AVANT de changer les données, remplie APRÈS : si l'opération est
  // interrompue, la synchronisation suivante comparera simplement les deux côtés (jamais d'écrasement silencieux).
  await o.registre.vider();
  await o.registre.definirCompte(o.compteId);
  await o.local.appliquer(ecrire, supprimer);
  await o.registre.enregistrer(new Map([...lus].map(([c, x]) => [c, { empreinte: x.empreinte, etag: x.etag }])));

  return { nuage: decompter([...lus.values()].map((x) => x.type)), ici: decompter([...locaux.values()].map((x) => x.type)), erreurs, ignores, ecrits: ecrire.length, retires: supprimer.length };
}
