import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { IndexReferentiel, RENTREE_TRONC_COMMUN, enVigueur, anneeDeNiveau, developper, rentreeDeDate, rentreeDeLigne, analyserClasse, cibleDeMatiere, formeDeFiliere, formeDeTexte } from '../src/domain/referentiel/index.ts';
import type { EntreeReferentiel } from '../src/domain/referentiel/index.ts';

const e = (a: string, extra: Partial<EntreeReferentiel> = {}): EntreeReferentiel => ({ m: 'Mathématiques', f: 'TC', t: 'f', a, r: 'test', ...extra });

const index = new IndexReferentiel([
  e('Calculer des produits de nombres relatifs.', { n: 'S2', i: 'Opérations sur les nombres relatifs', u: 'Nombres' }),
  e('Résoudre une équation du premier degré.', { n: 'S2', i: 'Équations', u: 'Algèbre' }),
  e('Calculer le périmètre d’un rectangle.', { n: 'S1', i: 'Périmètre', u: 'Grandeurs' }),
  e('Identifier le sinus d’un angle dans un triangle rectangle.', { n: 'S3', f: 'HGT', i: 'Trigonométrie', u: 'Géométrie' }),
  e('Résoudre un problème de pourcentage.', { n: 'S2', i: 'Pourcentages', u: 'Grandeurs' })
]);

describe('moteur de pistes', () => {
  it('trouve la compétence liée à l’objectif', () => {
    const r = index.suggerer({ objectif: 'Résoudre des équations', annee: 'S2' });
    assert.match(r[0]!.entree.a, /équation/);
  });
  it('comprend le langage de terrain (règle des signes)', () => {
    const r = index.suggerer({ objectif: 'Règle des signes', annee: 'S2' });
    assert.match(r[0]!.entree.a, /relatifs/);
  });
  it('ne propose rien pour un objectif vague', () => {
    assert.deepEqual(index.suggerer({ objectif: 'Révisions interro', annee: 'S2' }), []);
    assert.deepEqual(index.suggerer({ objectif: '', annee: 'S2' }), []);
  });
  it('signale une année différente de celle de l’élève', () => {
    const r = index.suggerer({ objectif: 'Périmètre du rectangle', annee: 'S2' });
    assert.equal(r[0]!.ecartAnnee, 'S1');
  });
  it('filtre selon la forme d’enseignement', () => {
    const sinus = (forme: 'G' | 'P') => index.suggerer({ objectif: 'sinus', annee: 'S3', forme });
    assert.equal(sinus('P').length, 0);
    assert.equal(sinus('G').length, 1);
  });
  it('limite le nombre de pistes', () => {
    assert.ok(index.suggerer({ objectif: 'calculer nombres grandeurs problème', annee: 'S2' }, 2).length <= 2);
  });
});

describe('alias de terrain par matière', () => {
  it('une expression agit dans sa matière seulement', () => {
    assert.match(developper('règle des signes', 'Mathématiques'), /positif/);
    assert.equal(developper('les signes de ponctuation', 'Français'), 'les signes de ponctuation');
    assert.equal(developper('x', 'Sciences'), 'x');
    assert.equal(developper('règle des signes'), 'règle des signes');
  });
});

describe('en vigueur à partir de', () => {
  const idx = new IndexReferentiel([
    e('Additionner des fractions de même dénominateur.', { n: 'S1', i: 'Fractions' }),
    e('Additionner des fractions de dénominateurs différents.', { n: 'S2', i: 'Fractions' }),
    e('Additionner des fractions algébriques.', { n: 'S3', f: 'HGT', i: 'Fractions' })
  ]);
  it('calcule la rentrée d’une date et d’une ligne', () => {
    assert.equal(rentreeDeDate('2026-11-09'), 2026);
    assert.equal(rentreeDeDate('2027-03-02'), 2026);
    assert.equal(rentreeDeDate('2026-08-24'), 2026);
    assert.equal(rentreeDeDate('n’importe quoi'), undefined);
    assert.equal(rentreeDeLigne({ f: 'TC', n: 'S2' }), RENTREE_TRONC_COMMUN.S2);
    assert.equal(rentreeDeLigne({ f: 'TC', n: 'P3' }), 0);
    assert.equal(rentreeDeLigne({ f: 'HGT', n: 'S3' }), 0);
  });
  it('écarte le tronc commun pas encore en vigueur', () => {
    const textes = (rentree: number | undefined) => idx.suggerer({ objectif: 'fractions', annee: 'S2', rentree }, 8).map((p) => p.entree.n);
    assert.ok(!textes(2026).includes('S2'), 'S2 n’est au tronc commun qu’en 2027');
    assert.ok(textes(2026).includes('S1'));
    assert.ok(textes(2027).includes('S2'));
    assert.ok(textes(undefined).includes('S2'), 'sans rentrée, tout est proposé');
  });
  it('propose les Socles seulement jusqu’à la rentrée 2026, et seulement si la rentrée est connue', () => {
    const socle = e('Additionner des fractions simples.', { n: 'S2', f: 'SOC', i: 'Fractions' });
    assert.equal(enVigueur(socle, 2026), true);
    assert.equal(enVigueur(socle, 2027), false);
    assert.equal(enVigueur(socle, undefined), false);
    const i2 = new IndexReferentiel([socle, e('Additionner des fractions.', { n: 'S2', i: 'Fractions' })]);
    assert.equal(i2.suggerer({ objectif: 'fractions', annee: 'S2', rentree: 2026 }, 4)[0]?.entree.f, 'SOC');
    assert.equal(i2.suggerer({ objectif: 'fractions', annee: 'S2', rentree: 2027 }, 4)[0]?.entree.f, 'TC');
  });
  it('garde la compétence terminale de S3 avant 2028', () => {
    const r = idx.suggerer({ objectif: 'fractions algébriques', annee: 'S3', rentree: 2026 }, 8);
    assert.ok(r.some((p) => p.entree.f === 'HGT'));
  });
});

describe('contexte', () => {
  it('reconnaît la matière', () => {
    assert.equal(cibleDeMatiere('Maths')?.jeu, 'mathematiques');
    assert.equal(cibleDeMatiere('Français')?.jeu, 'francais');
    assert.deepEqual(cibleDeMatiere('Néerlandais'), { jeu: 'langues', langue: 'Néerlandais' });
    assert.equal(cibleDeMatiere('Géographie')?.jeu, 'histoire-geographie');
    assert.equal(cibleDeMatiere('Histoire')?.jeu, 'histoire-geographie');
    assert.equal(cibleDeMatiere('Technologie')?.jeu, 'technique');
    assert.equal(cibleDeMatiere('Informatique')?.jeu, 'technique');
    assert.equal(cibleDeMatiere('Éducation physique')?.jeu, 'education-physique', 'l’éducation physique ne relève pas des sciences');
    assert.equal(cibleDeMatiere('EPS')?.jeu, 'education-physique');
    assert.equal(cibleDeMatiere('FMTTN')?.jeu, 'technique');
    assert.equal(cibleDeMatiere('Géo')?.jeu, 'histoire-geographie');
    assert.equal(cibleDeMatiere('TIC')?.jeu, 'technique');
    assert.equal(cibleDeMatiere('Latin')?.jeu, 'langues-anciennes');
    assert.equal(cibleDeMatiere('Éducation artistique')?.jeu, 'arts');
    assert.equal(cibleDeMatiere('Philosophie et citoyenneté')?.jeu, 'philosophie');
  });
  it('reconnaît le niveau et la forme', () => {
    assert.equal(anneeDeNiveau('S2'), 'S2');
    assert.equal(anneeDeNiveau('3e secondaire'), 'S3');
    assert.equal(anneeDeNiveau(''), undefined);
    assert.equal(formeDeTexte('Général'), 'G');
    assert.equal(formeDeTexte('professionnel'), 'P');
    assert.equal(anneeDeNiveau('4e primaire'), 'P4');
    assert.equal(formeDeFiliere('cefa'), 'P');
    assert.equal(formeDeFiliere('primaire'), undefined);
    assert.equal(formeDeFiliere('technique_qualification'), 'TQ');
  });
});

describe('notation des classes', () => {
  it('lit 3CB, 1DB, 4TQ, 5P', () => {
    assert.deepEqual(analyserClasse('3CB'), { annee: 'S3', filiere: 'secondaire' });
    assert.deepEqual(analyserClasse('1DB'), { annee: 'S1', filiere: 'secondaire' });
    assert.deepEqual(analyserClasse('4TQ'), { annee: 'S4', filiere: 'technique_qualification' });
    assert.deepEqual(analyserClasse('5P'), { annee: 'S5', filiere: 'professionnel' });
    assert.deepEqual(analyserClasse('4 TTB'), { annee: 'S4', filiere: 'technique_transition' });
    assert.equal(analyserClasse('Classe de Mme X'), undefined);
    assert.equal(anneeDeNiveau('3CB'), 'S3');
  });
});

describe('nouvelles matières et degrés', () => {
  it('une compétence de degré vaut pour chaque année du degré', () => {
    const idx = new IndexReferentiel([e('Expliquer la réaction chimique.', { n: 'S3', nf: 'S4', f: 'HGT', i: 'Réaction chimique' })]);
    assert.equal(idx.suggerer({ objectif: 'réaction chimique', annee: 'S4' })[0]?.ecartAnnee, null);
    assert.equal(idx.suggerer({ objectif: 'réaction chimique', annee: 'S6' })[0]?.ecartAnnee, 'S3');
  });
  it('reconnaît sciences et économie', () => {
    assert.equal(cibleDeMatiere('Sciences')?.jeu, 'sciences');
    assert.equal(cibleDeMatiere('Biologie')?.jeu, 'sciences');
    assert.equal(cibleDeMatiere('Sciences économiques')?.jeu, 'economie');
    assert.equal(cibleDeMatiere('Droit')?.jeu, 'economie');
  });
});

describe('données réelles', () => {
  const charger = (f: string): EntreeReferentiel[] => JSON.parse(readFileSync(new URL(`../src/data/referentiel/${f}.json`, import.meta.url), 'utf8'));
  it('maths : fractions en S2', () => {
    const r = new IndexReferentiel(charger('mathematiques')).suggerer({ objectif: 'Additionner des fractions', annee: 'S2' });
    assert.ok(r.length > 0 && r.length <= 4);
    assert.ok(r.some((p) => /fraction/i.test(p.entree.a + (p.entree.i ?? ''))));
  });
  it('français : une piste pour la compréhension de texte', () => {
    const r = new IndexReferentiel(charger('francais')).suggerer({ objectif: 'Lire un texte et repérer l’idée principale', annee: 'S1' });
    assert.ok(r.length > 0);
  });
  it('langues : respecte la langue du dossier', () => {
    const r = new IndexReferentiel(charger('langues')).suggerer({ objectif: 'Conjuguer les verbes au présent', annee: 'S2', langue: 'Néerlandais' });
    assert.ok(r.every((p) => !p.entree.l || p.entree.l === 'Néerlandais'));
  });
  it('sciences : photosynthèse en S3', () => {
    const r = new IndexReferentiel(charger('sciences')).suggerer({ objectif: 'La photosynthèse', annee: 'S3' });
    assert.ok(r.some((p) => /photosynth|plante|amidon/i.test(p.entree.a + (p.entree.i ?? ''))));
  });
  it('langues : grammaire du néerlandais au secondaire supérieur', () => {
    const r = new IndexReferentiel(charger('langues')).suggerer({ objectif: 'Le plus-que-parfait', annee: 'S4', forme: 'G', langue: 'Néerlandais' });
    assert.ok(r.length > 0 && r.every((p) => !p.entree.l || p.entree.l === 'Néerlandais'));
  });
  it('français : une unité du secondaire supérieur', () => {
    const r = new IndexReferentiel(charger('francais')).suggerer({ objectif: 'Défendre une opinion par écrit', annee: 'S5', forme: 'G' });
    assert.ok(r.length > 0);
  });
});
