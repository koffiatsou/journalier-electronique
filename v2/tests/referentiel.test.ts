import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { IndexReferentiel, anneeDeNiveau, cibleDeMatiere, formeDeFiliere, formeDeTexte } from '../src/domain/referentiel/index.ts';
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

describe('contexte', () => {
  it('reconnaît la matière', () => {
    assert.equal(cibleDeMatiere('Maths')?.jeu, 'mathematiques');
    assert.equal(cibleDeMatiere('Français')?.jeu, 'francais');
    assert.deepEqual(cibleDeMatiere('Néerlandais'), { jeu: 'langues', langue: 'Néerlandais' });
    assert.equal(cibleDeMatiere('Géographie'), null);
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
