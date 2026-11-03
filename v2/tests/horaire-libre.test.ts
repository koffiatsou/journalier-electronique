import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  PERIODES_AGENDA, creer, heuresLibresDe, heuresOccurrence, occurrences, periodesCouvertes, planifierSemaineType, semaineTypeDepuis,
  normaliserSemaineType, periodesUtilisees, verifierHeuresLibres
} from '../src/domain/agenda/index.ts';
import type { Ecole } from '../src/domain/agenda/index.ts';
import { evenementsSouhaites } from '../src/domain/synchro/outlook.ts';
import { geometrie, yDeMinutes, PH } from '../src/features/agenda/geometrie.ts';

const periodes = PERIODES_AGENDA.map((p) => ({ ...p }));
const ecole: Ecole = { id: 'e1', nom: 'École test', periodes };

/** Mardi 3 novembre 2026 : travail de groupe de 13h30 à 16h. */
const groupe = creer({ type: 'collaboration', titre: 'Travail de groupe', date: '2026-11-03', debut: 5, fin: 7, heureDebut: '13:30', heureFin: '16:00' });

test('heures libres : lues seulement si les deux heures sont valides et dans l’ordre', () => {
  assert.deepEqual(heuresLibresDe(groupe), { debut: '13:30', fin: '16:00' });
  assert.equal(heuresLibresDe({ heureDebut: '16:00', heureFin: '13:30' }), null);
  assert.equal(heuresLibresDe({ heureDebut: '13:30' }), null);
  assert.equal(heuresLibresDe({ heureDebut: '25:00', heureFin: '26:00' }), null);
  assert.equal(heuresLibresDe({}), null);
});

test('heures libres : messages d’erreur à la saisie', () => {
  assert.equal(verifierHeuresLibres('13:30', '16:00'), null);
  assert.match(verifierHeuresLibres('', '16:00') ?? '', /Indiquez/);
  assert.match(verifierHeuresLibres('16:00', '13:30') ?? '', /fin doit venir après/);
  assert.match(verifierHeuresLibres('13:30', '13:30') ?? '', /fin doit venir après/);
});

test('périodes couvertes : de la première période qui finit après le début à la dernière qui commence avant la fin', () => {
  assert.deepEqual(periodesCouvertes(periodes, { debut: '13:30', fin: '16:00' }), { debut: 5, fin: 7 });
  assert.deepEqual(periodesCouvertes(periodes, { debut: '09:00', fin: '09:30' }), { debut: 1, fin: 1 });
  assert.deepEqual(periodesCouvertes(periodes, { debut: '12:30', fin: '13:00' }), { debut: 5, fin: 5 });
  assert.deepEqual(periodesCouvertes(periodes, { debut: '17:00', fin: '18:00' }), { debut: 7, fin: 7 });
  assert.deepEqual(periodesCouvertes(periodes, { debut: '06:00', fin: '07:00' }), { debut: 0, fin: 0 });
});

test('l’occurrence garde les périodes couvertes, et ses heures réelles sont les heures libres', () => {
  const [o] = occurrences([groupe], '2026-11-02', '2026-11-06');
  assert.equal(o?.debut, 5);
  assert.equal(o?.fin, 7);
  assert.deepEqual(heuresOccurrence(ecole, o!), { debut: '13:30', fin: '16:00' });
  const ordinaire = creer({ type: 'collaboration', titre: 'x', date: '2026-11-03', debut: 0, fin: 1 });
  assert.deepEqual(heuresOccurrence(ecole, { activite: ordinaire, debut: 0, fin: 1 }), { debut: '08:00', fin: '09:40' });
});

test('Outlook : l’événement prend les heures libres', () => {
  const [e] = evenementsSouhaites([groupe], [], [], periodes, '2026-11-02', '2026-11-06', { nom: 'complet', lieu: false } as never);
  assert.equal(e?.debut, '2026-11-03T13:30');
  assert.equal(e?.fin, '2026-11-03T16:00');
});

test('semaine type : les heures libres sont gardées, relues et replacées', () => {
  const occ = occurrences([groupe], '2026-11-02', '2026-11-06');
  const modele = semaineTypeDepuis(occ, '2026-11-03', '2026-11-03');
  assert.equal(modele.elements[0]?.heureDebut, '13:30');
  const relu = normaliserSemaineType(JSON.parse(JSON.stringify(modele)));
  assert.equal(relu?.elements[0]?.heureFin, '16:00');
  const plan = planifierSemaineType(relu!, ['2026-11-09'], [], { ignorerSansClasse: false, eleveIds: new Set() });
  assert.equal(plan.aCreer[0]?.heureDebut, '13:30');
  assert.equal(plan.aCreer[0]?.date, '2026-11-10');
  const encore = planifierSemaineType(relu!, ['2026-11-02'], occ, { ignorerSansClasse: false, eleveIds: new Set() });
  assert.equal(encore.dejaPresents, 1);
});

test('grille : une heure se place au prorata de sa période, la pause entre deux, et la grille se prolonge après la dernière', () => {
  const utilisees = periodesUtilisees(periodes);
  const geo = geometrie(utilisees);
  assert.equal(yDeMinutes(geo, utilisees, 8 * 60), geo.y[0]);
  assert.equal(yDeMinutes(geo, utilisees, 8 * 60 + 25), geo.y[0]! + PH / 2);
  const milieuPause = yDeMinutes(geo, utilisees, 10 * 60 + 37.5);
  assert.ok(milieuPause > geo.y[2]! + PH && milieuPause < geo.y[3]!);
  assert.equal(yDeMinutes(geo, utilisees, 5 * 60), geo.y[0]);
  assert.ok(yDeMinutes(geo, utilisees, 16 * 60) > geo.total);
  assert.ok(yDeMinutes(geo, utilisees, 13 * 60 + 30) > geo.y[5]! && yDeMinutes(geo, utilisees, 13 * 60 + 30) < geo.y[6]!);
});
