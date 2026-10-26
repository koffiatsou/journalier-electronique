import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { annuler, changementDepuisPlan, creer, lundisEntre, normaliserSemaineType, occurrences, planifierSemaineType, semaineTypeDepuis } from '../src/domain/agenda/index.ts';
import type { Activite } from '../src/domain/agenda/index.ts';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { creerMagasin } from '../src/state/store.ts';

// Semaine du lundi 16 novembre 2026 (jour de classe normal)
const modeleSource = (): Activite[] => [
  creer({ type: 'eleve', eleveId: 'alpha', date: '2026-11-16', debut: 0, fin: 1, matiere: 'Mathématiques', lieu: 'Salle 3' }),
  creer({ type: 'eleve', eleveId: 'beta', date: '2026-11-17', debut: 2, fin: 2 }),
  creer({ type: 'eleve', eleveId: 'gamma', date: '2026-11-18', debut: 4, fin: 4 }),
  creer({ type: 'formation', titre: 'Formation', date: '2026-11-19', debut: 3, fin: 4 })
];
const elevesOk = new Set(['alpha', 'beta', 'gamma']);
const options = { ignorerSansClasse: true, eleveIds: elevesOk };
const semaineTypeDe = (acts: Activite[]) => semaineTypeDepuis(occurrences(acts, '2026-11-16', '2026-11-20'), '2026-11-18', '2026-11-20');

describe('semaine type : enregistrer', () => {
  it('reprend les activités de la semaine, jour par jour, dans l’ordre', () => {
    const m = semaineTypeDe(modeleSource());
    assert.deepEqual(m.elements.map((e) => [e.jour, e.debut, e.fin, e.type]), [[0, 0, 1, 'eleve'], [1, 2, 2, 'eleve'], [2, 4, 4, 'eleve'], [3, 3, 4, 'formation']]);
    assert.equal(m.elements[0]?.matiere, 'Mathématiques');
    assert.equal(m.elements[0]?.lieu, 'Salle 3');
    assert.equal(m.enregistreeLe, '2026-11-20');
  });
  it('laisse de côté les activités annulées et celles d’une autre semaine', () => {
    const acts = modeleSource();
    acts.push(creer({ type: 'eleve', eleveId: 'alpha', date: '2026-11-23', debut: 0, fin: 0 }));
    const occ = occurrences(acts, '2026-11-16', '2026-11-27');
    const annulee = occ.find((o) => o.activite.eleveId === 'beta')!;
    const avecAnnulation = acts.map((a) => (a.id === annulee.activite.id ? annuler(annulee).enregistrer[0]! : a));
    const m = semaineTypeDepuis(occurrences(avecAnnulation, '2026-11-16', '2026-11-27'), '2026-11-16', '2026-11-20');
    assert.equal(m.elements.length, 3);
    assert.ok(!m.elements.some((e) => e.eleveId === 'beta'));
  });
  it('une activité hebdomadaire est prise une seule fois pour la semaine', () => {
    const serie = creer({ type: 'eleve', eleveId: 'alpha', date: '2026-11-02', debut: 0, fin: 0, repetition: 'hebdomadaire' });
    const m = semaineTypeDepuis(occurrences([serie], '2026-11-16', '2026-11-20'), '2026-11-16', '2026-11-20');
    assert.equal(m.elements.length, 1);
    assert.equal(m.elements[0]?.jour, 0);
  });
});

describe('semaine type : relire', () => {
  it('relit ce qui a été enregistré', () => {
    const m = semaineTypeDe(modeleSource());
    assert.deepEqual(normaliserSemaineType(JSON.parse(JSON.stringify(m))), m);
  });
  it('écarte les éléments illisibles et refuse un modèle vide', () => {
    assert.equal(normaliserSemaineType(null), null);
    assert.equal(normaliserSemaineType('x'), null);
    assert.equal(normaliserSemaineType({ elements: [] }), null);
    assert.equal(normaliserSemaineType({ elements: [{ jour: 7, debut: 0, fin: 0, type: 'eleve' }] }), null);
    const m = normaliserSemaineType({ elements: [{ jour: 1, debut: 3, fin: 1, type: 'eleve', eleveId: 'a' }, { jour: 'x' }, { jour: 2, debut: 0, fin: 0, type: 'inconnu' }], enregistreeLe: '2026-11-20' });
    assert.equal(m?.elements.length, 1);
    assert.equal(m?.elements[0]?.fin, 3);
    assert.equal(m?.elements[0]?.titre, '');
  });
});

describe('semaine type : appliquer', () => {
  const modele = semaineTypeDe(modeleSource());
  it('lundis entre deux dates', () => {
    assert.deepEqual(lundisEntre('2026-11-18', '2026-12-01'), ['2026-11-16', '2026-11-23', '2026-11-30']);
    assert.deepEqual(lundisEntre('2026-11-18', '2026-11-18'), ['2026-11-16']);
    assert.deepEqual(lundisEntre('2026-12-01', '2026-11-18'), []);
  });
  it('place les activités à la bonne date, sans répétition', () => {
    const plan = planifierSemaineType(modele, ['2026-11-30'], [], options);
    assert.deepEqual(plan.aCreer.map((a) => [a.date, a.debut, a.fin]), [['2026-11-30', 0, 1], ['2026-12-01', 2, 2], ['2026-12-02', 4, 4], ['2026-12-03', 3, 4]]);
    assert.ok(plan.aCreer.every((a) => a.repetition === 'aucune'));
    assert.equal(new Set(plan.aCreer.map((a) => a.id)).size, 4);
    assert.equal(plan.aCreer[0]?.matiere, 'Mathématiques');
    assert.deepEqual(changementDepuisPlan(plan).supprimer, []);
  });
  it('ignore un jour férié (Armistice, mercredi 11 novembre 2026) mais pas le reste', () => {
    const plan = planifierSemaineType(modele, ['2026-11-09'], [], options);
    assert.equal(plan.aCreer.length, 3);
    assert.equal(plan.joursIgnores, 1);
    assert.ok(!plan.aCreer.some((a) => a.date === '2026-11-11'));
  });
  it('ignore toute une semaine de vacances (hiver 2026-2027), sauf si on le demande autrement', () => {
    const plan = planifierSemaineType(modele, ['2026-12-21'], [], options);
    assert.equal(plan.aCreer.length, 0);
    assert.equal(plan.joursIgnores, 4);
    const tout = planifierSemaineType(modele, ['2026-12-21'], [], { ...options, ignorerSansClasse: false });
    assert.equal(tout.aCreer.length, 4);
  });
  it('plusieurs semaines : les vacances sautées, les autres semaines remplies', () => {
    const plan = planifierSemaineType(modele, lundisEntre('2026-12-14', '2027-01-08'), [], options);
    // 14 déc (classe), 21 déc et 28 déc (vacances), 4 janvier (classe)
    assert.equal(plan.aCreer.length, 8);
    assert.equal(plan.joursIgnores, 8);
  });
  it('ne crée pas de doublon d’une activité déjà présente', () => {
    const existantes = occurrences([creer({ type: 'eleve', eleveId: 'alpha', date: '2026-11-30', debut: 0, fin: 1 })], '2026-11-30', '2026-12-04');
    const plan = planifierSemaineType(modele, ['2026-11-30'], existantes, options);
    assert.equal(plan.dejaPresents, 1);
    assert.equal(plan.aCreer.length, 3);
  });
  it('une activité annulée ne bloque pas : on peut replacer la séance', () => {
    const base = creer({ type: 'eleve', eleveId: 'alpha', date: '2026-11-30', debut: 0, fin: 1 });
    const occ = occurrences([base], '2026-11-30', '2026-12-04');
    const annulee = occurrences([annuler(occ[0]!).enregistrer[0]!], '2026-11-30', '2026-12-04');
    assert.equal(planifierSemaineType(modele, ['2026-11-30'], annulee, options).dejaPresents, 0);
  });
  it('appliquer deux fois de suite ne double rien', () => {
    const premiere = planifierSemaineType(modele, ['2026-11-30'], [], options);
    const maintenant = occurrences(premiere.aCreer, '2026-11-30', '2026-12-04');
    const seconde = planifierSemaineType(modele, ['2026-11-30'], maintenant, options);
    assert.equal(seconde.aCreer.length, 0);
    assert.equal(seconde.dejaPresents, 4);
  });
  it('un élève supprimé n’est pas replacé', () => {
    const plan = planifierSemaineType(modele, ['2026-11-30'], [], { ...options, eleveIds: new Set(['alpha']) });
    assert.equal(plan.elevesIntrouvables, 2);
    assert.equal(plan.aCreer.length, 2);
  });
});

describe('semaine type : enregistrement', () => {
  it('conservée après rechargement, effaçable', async () => {
    const depot = creerDepotMemoire();
    const magasin = creerMagasin(depot);
    await magasin.charger();
    assert.equal(magasin.lire().semaineType, null);
    const m = semaineTypeDe(modeleSource());
    await magasin.enregistrerSemaineType(m);
    const relu = creerMagasin(depot);
    await relu.charger();
    assert.deepEqual(relu.lire().semaineType, m);
    await relu.enregistrerSemaineType(null);
    const apres = creerMagasin(depot);
    await apres.charger();
    assert.equal(apres.lire().semaineType, null);
  });
});
