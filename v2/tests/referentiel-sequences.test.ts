import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { IndexReferentiel } from '../src/domain/referentiel/index.ts';
import type { EntreeReferentiel, Piste } from '../src/domain/referentiel/index.ts';

/** Vraies données de maths : les objectifs ci-dessous sont ceux d'une enseignante de maths (leçons, pas des élèves). */
const lignes = JSON.parse(readFileSync(new URL('../src/data/referentiel/mathematiques.json', import.meta.url), 'utf8')) as EntreeReferentiel[];
const index = new IndexReferentiel(lignes);
const RENTREE = 2026;
const NOMBRE_PISTES_PLUS = 8;

const proposer = (objectif: string, annee: 'S1' | 'S2' | 'S4', k?: number, rentree = RENTREE): Piste[] => index.suggerer({ objectif, annee, forme: 'G', rentree }, k);
/** Le tronc commun de S2 n'est en vigueur qu'à partir de la rentrée 2027 (voir `vigueur.ts`). */
const RENTREE_S2 = 2027;
const ordre = (t: string): number => ['s', 'f', 'c'].indexOf(t);

describe('données : séquences du programme (compétences terminales de maths)', () => {
  const duProgramme = lignes.filter((l) => l.q !== undefined);
  it('les 412 lignes HGT et les 286 lignes de qualification ont un code de séquence, sauf une ligne vide', () => {
    assert.equal(duProgramme.filter((l) => l.f === 'HGT').length, 411);
    assert.equal(duProgramme.filter((l) => l.f === 'HPT').length, 286);
  });
  it('la compétence à développer est en casse normale (jamais en majuscules)', () => {
    for (const l of duProgramme) {
      assert.ok(l.cd && l.cd !== l.cd.toUpperCase(), `${l.q} : ${l.cd}`);
    }
  });
});

describe('moteur : séquence du programme (S4, enseignement général)', () => {
  it('« Fonctions de référence » : toutes les pistes viennent de la même séquence, avec sa compétence', () => {
    const r = proposer('Fonctions de référence : transformées', 'S4');
    assert.ok(r.length > 0);
    assert.ok(r.every((p) => p.entree.q === '4UAA4' && p.sequence?.titre === 'Fonctions de référence'));
    assert.equal(r[0]?.sequence?.competence, 'S’approprier différents modèles fonctionnels');
  });
  it('« Voir d’autres pistes » complète la séquence et garde l’ordre Connaître, Appliquer, Transférer', () => {
    const r = proposer('Fonctions de référence : transformées', 'S4', NOMBRE_PISTES_PLUS);
    assert.ok(r.length > 4 && r.length <= NOMBRE_PISTES_PLUS);
    assert.deepEqual(r.map((p) => ordre(p.entree.t)), r.map((p) => ordre(p.entree.t)).sort((a, b) => a - b));
    assert.ok(r.some((p) => p.entree.t === 's') && r.some((p) => p.entree.t === 'c'));
  });
  it('« forme canonique du deuxième degré » (objectif d’une leçon) tombe sur la séquence « Deuxième degré »', () => {
    const r = proposer('Étudier la forme canonique d’une fonction du deuxième degré', 'S4');
    assert.ok(r.length > 0 && r.every((p) => p.sequence?.titre === 'Deuxième degré'));
  });
  it('« expression analytique d’une parabole à partir des graphiques » tombe aussi sur « Deuxième degré »', () => {
    const r = proposer('Déterminer l’expression analytique d’une parabole à partir des graphiques', 'S4');
    assert.ok(r.length > 0 && r.every((p) => p.sequence?.titre === 'Deuxième degré'));
  });
  it('une seule tâche proche : on ne complète pas avec des tâches sans rapport', () => {
    const r = proposer('Définir le rôle des paramètres α et β', 'S4', NOMBRE_PISTES_PLUS);
    assert.ok(r.every((p) => p.score > 0));
  });
  it('un objectif vague ne donne aucune piste', () => {
    assert.deepEqual(proposer('révisions', 'S4'), []);
  });
});

describe('moteur : avant S3, aucune séquence des compétences terminales', () => {
  it('un élève de S1 reçoit des lignes du tronc commun, jamais une séquence de qualification ou de S3–S6', () => {
    const r = proposer('proportionnalité, règle de trois', 'S1');
    assert.ok(r.length > 0 && r.every((p) => p.entree.q === undefined && p.entree.f === 'TC'));
  });
});

describe('données : modules et séquences du programme WBE du tronc commun (maths)', () => {
  const modules = lignes.filter((l) => l.sq !== undefined && l.n?.startsWith('S'));
  it('chaque ligne rangée est du tronc commun, de P1 à P5 ou de S1 à S3', () => {
    const rangees = lignes.filter((l) => l.sq !== undefined);
    assert.ok(rangees.length > 500);
    assert.ok(rangees.every((l) => l.f === 'TC' && ['P1', 'P2', 'P3', 'P4', 'P5', 'S1', 'S2', 'S3'].includes(l.n ?? '')));
  });
  it('les séquences du primaire ont un titre complet, sans ligature ni début de phrase coupé', () => {
    const titres = new Set(lignes.filter((l) => l.sq !== undefined && l.n?.startsWith('P')).map((l) => l.sq ?? ''));
    assert.ok(titres.size > 40);
    for (const t of titres) assert.ok(t[0] === t[0]?.toUpperCase() && !/[ﬁﬂﬀ]/.test(t), t);
  });
  it('les 35 modules et sections du programme ont chacun des lignes', () => {
    assert.equal(new Set(modules.map((l) => `${l.n}|${l.sq}`)).size, 35);
  });
});

describe('moteur : module du programme (tronc commun S1 à S3)', () => {
  it('« décrire des figures en mouvement » (P4) tombe sur la séquence du programme primaire', () => {
    const r = index.suggerer({ objectif: 'Décrire des figures en mouvement, glissement et retournement', annee: 'P4', rentree: RENTREE });
    assert.equal(r[0]?.sequence?.titre, 'Décrire et représenter des figures en mouvement');
    assert.deepEqual(r.filter((p) => p.sequence).map((p) => ordre(p.entree.t)), r.filter((p) => p.sequence).map((p) => ordre(p.entree.t)).sort((a, b) => a - b));
  });
  it('« mesurer un angle au rapporteur » (S1) tombe sur les angles, avec la compétence du module', () => {
    const r = proposer('Mesurer un angle avec le rapporteur', 'S1');
    assert.equal(r[0]?.sequence?.titre, 'La géométrie plane / Les angles');
    assert.equal(r[0]?.sequence?.competence, 'Articuler des propriétés géométriques et des procédés de construction');
  });
  it('les pistes du module sont rangées Connaître, Appliquer, Transférer', () => {
    const r = proposer('Calculer le volume d’un prisme', 'S2', undefined, RENTREE_S2);
    const dumodule = r.filter((p) => p.sequence);
    assert.ok(dumodule.length >= 2);
    assert.deepEqual(dumodule.map((p) => ordre(p.entree.t)), dumodule.map((p) => ordre(p.entree.t)).sort((a, b) => a - b));
  });
  it('« Voir d’autres pistes » complète avec le reste du module', () => {
    const r = proposer('Calculer le volume d’un prisme', 'S2', NOMBRE_PISTES_PLUS, RENTREE_S2);
    assert.ok(r.length > proposer('Calculer le volume d’un prisme', 'S2', undefined, RENTREE_S2).length);
    assert.ok(r.filter((p) => p.sequence).every((p) => p.entree.sq === r[0]?.entree.sq));
  });
  it('les pistes d’un autre module viennent après, sans titre', () => {
    const r = proposer('Placer des points dans un repère', 'S1');
    const premierSansTitre = r.findIndex((p) => p.sequence === undefined);
    assert.ok(premierSansTitre < 0 || r.slice(premierSansTitre).every((p) => p.sequence === undefined));
  });
});

const charger = (fichier: string): IndexReferentiel =>
  new IndexReferentiel(JSON.parse(readFileSync(new URL(`../src/data/referentiel/${fichier}.json`, import.meta.url), 'utf8')) as EntreeReferentiel[]);
const titreDe = (index: IndexReferentiel, objectif: string, annee: 'S4'): string | undefined =>
  index.suggerer({ objectif, annee, forme: 'G', rentree: RENTREE })[0]?.sequence?.titre;

describe('moteur : séquences des autres matières (unités des compétences terminales S3–S6)', () => {
  it('sciences : la digestion tombe sur l’unité de biologie sur la nutrition', () => {
    assert.match(titreDe(charger('sciences'), 'La digestion et l’absorption des nutriments', 'S4') ?? '', /Nutrition et production d’énergie/);
  });
  it('français : résumer un texte tombe sur l’unité « Réduire, résumer… »', () => {
    assert.match(titreDe(charger('francais'), 'Résumer un texte informatif', 'S4') ?? '', /résumer/i);
  });
  it('histoire : la révolution industrielle tombe sur « Le Temps des Révolutions »', () => {
    assert.equal(titreDe(charger('histoire-geographie'), 'La révolution industrielle', 'S4'), 'Le Temps des Révolutions');
  });
});

describe('moteur : taille d’une séquence', () => {
  const ligne = (a: string, i: string): EntreeReferentiel => ({ m: 'Sciences', f: 'HGT', t: 'f', a, r: 'test', n: 'S4', i, u: 'Chimie' });
  const unites = (nombre: number): IndexReferentiel =>
    new IndexReferentiel(Array.from({ length: nombre }, (_, k) => ligne(`Calculer la masse molaire numéro ${k}`, 'La réaction chimique')));
  it('trois lignes ne font pas une séquence : on propose ligne par ligne', () => {
    const r = unites(3).suggerer({ objectif: 'masse molaire', annee: 'S4' });
    assert.ok(r.length > 0 && r.every((p) => p.sequence === undefined));
  });
  it('quatre lignes d’une même unité font une séquence', () => {
    const r = unites(4).suggerer({ objectif: 'masse molaire', annee: 'S4' });
    assert.ok(r.length > 0 && r.every((p) => p.sequence?.titre === 'La réaction chimique'));
  });
  it('plus de soixante lignes, c’est un thème entier et non une séquence', () => {
    const r = unites(61).suggerer({ objectif: 'masse molaire', annee: 'S4' });
    assert.ok(r.length > 0 && r.every((p) => p.sequence === undefined));
  });
});

describe('moteur : thèmes du programme de sciences (tronc commun S1 à S3)', () => {
  const sciences = charger('sciences');
  const proposerSciences = (objectif: string, annee: 'S1' | 'S2', rentree: number) => sciences.suggerer({ objectif, annee, forme: 'G', rentree });
  it('« la pression atmosphérique » (S2) tombe sur le thème « La pression », avec sa compétence écrite dans le programme', () => {
    const r = proposerSciences('La pression atmosphérique', 'S2', RENTREE_S2);
    assert.equal(r[0]?.sequence?.titre, 'La pression');
    assert.match(r[0]?.sequence?.competence ?? '', /^Décrire, expliquer, interpréter/);
  });
  it('« la reproduction humaine » (S1) tombe sur son thème, sans caractère parasite dans le titre', () => {
    const titre = proposerSciences('La reproduction humaine', 'S1', RENTREE)[0]?.sequence?.titre ?? '';
    assert.equal(titre, 'La reproduction humaine et des moyens de prévention');
  });
});
