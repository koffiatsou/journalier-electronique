import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  annuler, couleursEleves, editer, creer, deplacer, disposer, dupliquer, lundiDe, marquerRealisee, modifier, occurrences, occurrencesAgenda, redimensionner, semaine,
  statutDe, supprimer, teinteDe, titreSemaine
} from '../src/domain/agenda/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const eleve = (id: string, extra: Partial<Eleve> = {}): Eleve => ({ id, nom: id, prenom: 'X', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [], ...extra });
// 2026-10-19 est un lundi
const serie = () => creer({ type: 'eleve', eleveId: 'alpha', date: '2026-10-19', debut: 1, fin: 2, repetition: 'hebdomadaire', jusquau: '2026-11-09' });

describe('dates', () => {
  it('semaine scolaire du lundi au vendredi', () => {
    assert.equal(lundiDe('2026-10-23'), '2026-10-19');
    assert.deepEqual(semaine('2026-10-25'), ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']);
    assert.equal(titreSemaine('2026-10-21'), '19 – 23 octobre 2026');
    assert.equal(titreSemaine('2026-10-28'), '26 octobre – 30 octobre 2026'.replace('26 octobre – 30 octobre', '26 – 30 octobre'));
  });
});

describe('occurrences', () => {
  it('répète chaque semaine jusqu’à la fin, sans dépasser', () => {
    const o = occurrences([serie()], '2026-10-01', '2026-12-31');
    assert.deepEqual(o.map((x) => x.date), ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
  });
  it('ne donne que ce qui est dans la fenêtre', () => {
    assert.deepEqual(occurrences([serie()], '2026-10-27', '2026-11-03').map((x) => x.date), ['2026-11-02']);
  });
  it('une activité unique apparaît une fois', () => {
    const a = creer({ type: 'formation', titre: 'Formation', date: '2026-10-21', debut: 0, fin: 3 });
    assert.equal(occurrences([a], '2026-10-19', '2026-10-23').length, 1);
    assert.equal(occurrences([a], '2026-10-26', '2026-10-30').length, 0);
  });
});

describe('statut', () => {
  it('passe à réalisé quand la séance est encodée sur le créneau', () => {
    const a = serie();
    const s = seance({ eleveId: 'alpha', date: '2026-10-26', periodeDebut: '3e H', periodeFin: '3e H' });
    assert.equal(statutDe(a, '2026-10-26', [s]), 'realise');
    assert.equal(statutDe(a, '2026-11-02', [s]), 'prevu');
    assert.equal(statutDe(a, '2026-10-26', [seance({ eleveId: 'beta', date: '2026-10-26', periodeDebut: '3e H', periodeFin: '3e H' })]), 'prevu');
  });
  it('annulé reste annulé même si une séance existe', () => {
    const a = serie();
    const { enregistrer: [b] } = annuler(occurrences([a], '2026-10-19', '2026-10-19')[0]!);
    assert.equal(statutDe(b!, '2026-10-19', []), 'annule');
  });
  it('une activité sans élève se marque réalisée à la main', () => {
    const a = creer({ type: 'administratif', date: '2026-10-21', debut: 0, fin: 0 });
    const { enregistrer: [b] } = marquerRealisee(occurrences([a], '2026-10-21', '2026-10-21')[0]!);
    assert.equal(statutDe(b!, '2026-10-21', []), 'realise');
  });
});

describe('modifications', () => {
  const premiere = () => occurrences([serie()], '2026-10-26', '2026-10-26')[0]!;
  it('déplacer une occurrence détache cette date de la série', () => {
    const c = deplacer(premiere(), '2026-10-28', 4);
    const [serieMaj, unique] = c.enregistrer;
    assert.deepEqual(serieMaj!.exceptions, ['2026-10-26']);
    assert.equal(unique!.date, '2026-10-28');
    assert.equal(unique!.repetition, 'aucune');
    assert.equal(unique!.fin - unique!.debut, 1);
    const tout = occurrences(c.enregistrer, '2026-10-19', '2026-11-09');
    assert.equal(tout.length, 4);
    assert.ok(tout.some((x) => x.date === '2026-10-28' && x.debut === 4));
    assert.ok(!tout.some((x) => x.date === '2026-10-26'));
  });
  it('déplacer toute la série la décale', () => {
    const c = deplacer(premiere(), '2026-10-27', 1, 'serie');
    assert.equal(c.enregistrer.length, 1);
    assert.equal(c.enregistrer[0]!.date, '2026-10-20');
    assert.equal(c.enregistrer[0]!.jusquau, '2026-11-10');
  });
  it('ne sort jamais de la grille des périodes', () => {
    // neuf périodes (1e H à 9e H) : la dernière est l'index 8
    const c = deplacer(premiere(), '2026-10-26', 8);
    const u = c.enregistrer[1]!;
    assert.equal(u.fin, 8);
    assert.equal(u.debut, 7);
  });
  it('redimensionne sans passer sous le début', () => {
    assert.equal(redimensionner(premiere(), 0).enregistrer[1]!.fin, 1);
    assert.equal(redimensionner(premiere(), 5).enregistrer[1]!.fin, 5);
  });
  it('duplique en copie unique', () => {
    const c = dupliquer(premiere(), '2026-10-30', 0);
    const copie = c.enregistrer[0]!;
    assert.equal(copie.repetition, 'aucune');
    assert.equal(copie.exceptions, undefined);
    assert.notEqual(copie.id, serie().id);
  });
  it('supprime une occurrence ou toute la série', () => {
    const o = premiere();
    assert.deepEqual(supprimer(o, 'serie').supprimer, [o.activite.id]);
    assert.deepEqual(supprimer(o).enregistrer[0]!.exceptions, ['2026-10-26']);
  });
  it('modifie une occurrence sans toucher aux autres', () => {
    const c = modifier(premiere(), { lieu: 'Local 12' });
    const tout = occurrences(c.enregistrer, '2026-10-19', '2026-11-09');
    assert.equal(tout.filter((x) => x.activite.lieu === 'Local 12').length, 1);
  });
});

describe('édition', () => {
  const o = () => occurrences([serie()], '2026-10-26', '2026-10-26')[0]!;
  it('une occurrence seulement : détachée, les autres inchangées', () => {
    const c = editer(o(), { date: '2026-10-26', debut: 1, fin: 2, lieu: 'Local 3', repetition: 'aucune' }, 'occurrence');
    const tout = occurrences(c.enregistrer, '2026-10-19', '2026-11-09');
    assert.equal(tout.length, 4);
    assert.equal(tout.filter((x) => x.activite.lieu === 'Local 3').length, 1);
  });
  it('toute la série : champs et décalage de date', () => {
    const c = editer(o(), { date: '2026-10-27', debut: 2, fin: 3, titre: 'Remédiation' }, 'serie');
    const tout = occurrences(c.enregistrer, '2026-10-19', '2026-11-30');
    assert.deepEqual(tout.map((x) => x.date), ['2026-10-20', '2026-10-27', '2026-11-03', '2026-11-10']);
    assert.ok(tout.every((x) => x.activite.titre === 'Remédiation' && x.debut === 2));
  });
  it('fin de série modifiable', () => {
    const c = editer(o(), { date: '2026-10-26', debut: 1, fin: 2, jusquau: '2026-10-30' }, 'serie');
    assert.equal(occurrences(c.enregistrer, '2026-10-19', '2026-12-31').length, 2);
  });
  it('activité unique : tout peut changer', () => {
    const a = creer({ type: 'libre', date: '2026-10-21', debut: 0, fin: 0 });
    const occ = occurrences([a], '2026-10-21', '2026-10-21')[0]!;
    const c = editer(occ, { date: '2026-10-22', debut: 2, fin: 1, type: 'formation', titre: 'Journée' });
    assert.equal(c.enregistrer[0]!.fin, 2);
    assert.equal(c.enregistrer[0]!.type, 'formation');
  });
});

describe('colonnes', () => {
  it('place côte à côte ce qui se recouvre', () => {
    const a = creer({ type: 'libre', date: '2026-10-19', debut: 0, fin: 2 });
    const b = creer({ type: 'libre', date: '2026-10-19', debut: 1, fin: 1 });
    const c = creer({ type: 'libre', date: '2026-10-19', debut: 4, fin: 4 });
    const d = disposer(occurrences([a, b, c], '2026-10-19', '2026-10-19'));
    assert.deepEqual(d.get(`${a.id}@2026-10-19`), { colonne: 0, colonnes: 2 });
    assert.deepEqual(d.get(`${b.id}@2026-10-19`), { colonne: 1, colonnes: 2 });
    assert.deepEqual(d.get(`${c.id}@2026-10-19`), { colonne: 0, colonnes: 1 });
  });
});

describe('couleurs', () => {
  it('une couleur par élève, stable et distincte', () => {
    const eleves = ['a1', 'b2', 'c3', 'd4', 'e5'].map((id) => eleve(id));
    const c1 = couleursEleves(eleves);
    const c2 = couleursEleves([...eleves].reverse());
    assert.equal(new Set(c1.values()).size, 5);
    assert.deepEqual([...c1.entries()].sort(), [...c2.entries()].sort());
  });
  it('la couleur choisie dans le dossier l’emporte', () => {
    const c = couleursEleves([eleve('a1', { couleur: 7 }), eleve('b2')]);
    assert.equal(c.get('a1'), 7);
    assert.notEqual(c.get('b2'), 7);
  });
  it('élève : couleur de l’élève ; autre activité : couleur du type', () => {
    const c = couleursEleves([eleve('alpha', { couleur: 3 })]);
    assert.deepEqual(teinteDe(serie(), c), { kind: 'couleur', index: 3 });
    assert.deepEqual(teinteDe(creer({ type: 'formation', date: '2026-10-19', debut: 0, fin: 0 }), c), { kind: 'type', type: 'formation' });
  });
});

describe('séances réalisées dans l’agenda (même sans planification)', () => {
  const sc = (id: string, extra = {}) => seance({ id, eleveId: 'alpha', date: '2026-10-21', periodeDebut: '2e H', periodeFin: '2e H', ...extra });
  it('une séance sans aucune planification apparaît, réalisée, au bon créneau', () => {
    const o = occurrencesAgenda([], '2026-10-19', '2026-10-23', [sc('s1', { matiere: 'Mathématiques' })]);
    assert.equal(o.length, 1);
    assert.equal(o[0]!.statut, 'realise');
    assert.equal(o[0]!.seanceId, 's1');
    assert.deepEqual([o[0]!.date, o[0]!.debut, o[0]!.fin, o[0]!.activite.eleveId, o[0]!.activite.matiere], ['2026-10-21', 1, 1, 'alpha', 'Mathématiques']);
  });
  it('fonctionne rétroactivement, sur n’importe quelle date de la fenêtre', () => {
    const o = occurrencesAgenda([], '2025-09-01', '2025-09-05', [sc('vieille', { date: '2025-09-02' })]);
    assert.equal(o.length, 1);
  });
  it('une séance déjà couverte par une planification n’est pas affichée en double', () => {
    const a = creer({ type: 'eleve', eleveId: 'alpha', date: '2026-10-21', debut: 1, fin: 2 });
    const o = occurrencesAgenda([a], '2026-10-19', '2026-10-23', [sc('s1')]);
    assert.equal(o.length, 1);
    assert.equal(o[0]!.seanceId, undefined);
    assert.equal(o[0]!.statut, 'realise');
  });
  it('la planification d’un autre élève ou d’un autre jour ne cache pas la séance', () => {
    const autre = creer({ type: 'eleve', eleveId: 'beta', date: '2026-10-21', debut: 1, fin: 1 });
    const autreJour = creer({ type: 'eleve', eleveId: 'alpha', date: '2026-10-22', debut: 1, fin: 1 });
    const o = occurrencesAgenda([autre, autreJour], '2026-10-19', '2026-10-23', [sc('s1')]);
    assert.equal(o.filter((x) => x.seanceId === 's1').length, 1);
    assert.equal(o.length, 3);
  });
  it('une séance en dehors de la fenêtre, ou sur des périodes inconnues, n’est pas affichée', () => {
    assert.equal(occurrencesAgenda([], '2026-10-26', '2026-10-30', [sc('s1')]).length, 0);
    assert.equal(occurrencesAgenda([], '2026-10-19', '2026-10-23', [sc('s2', { periodeDebut: 'Étude', periodeFin: 'Étude' })]).length, 0);
  });
  it('une séance sur plusieurs périodes occupe tout le créneau', () => {
    const o = occurrencesAgenda([], '2026-10-19', '2026-10-23', [sc('s1', { periodeDebut: '3e H', periodeFin: '4e H' })]);
    assert.deepEqual([o[0]!.debut, o[0]!.fin], [2, 3]);
  });
  it('rien n’est enregistré : `occurrences` seule reste inchangée (semaine type, Outlook)', () => {
    assert.equal(occurrences([], '2026-10-19', '2026-10-23', [sc('s1')]).length, 0);
  });
});
