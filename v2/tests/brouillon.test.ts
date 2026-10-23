import assert from 'node:assert/strict';
import { test } from 'node:test';
import { etatsEtapes, niveauxManquants, seanceVide, verifier } from '../src/features/seance/brouillon.ts';

test('séance vierge : rien de présélectionné', () => {
  const s = seanceVide('alpha', '2026-10-23');
  assert.equal(s.transfert, null);
  assert.deepEqual(s.observations, []);
  assert.deepEqual(etatsEtapes(s), ['vide', 'vide', 'vide', 'vide', 'vide', 'vide']);
});

test('niveaux manquants : observations, compétences et aides sans choix', () => {
  const s = { ...seanceVide('alpha'), observations: [{ texte: 'Entre dans la tâche', niveau: null }], aides: [{ nom: 'Support visuel', effet: null }] };
  assert.deepEqual(niveauxManquants(s), ['Entre dans la tâche', 'Support visuel']);
  assert.equal(verifier({ ...s, matiere: 'Français' }).ok, false);
});

test('enregistrement possible une fois tout renseigné', () => {
  const s = { ...seanceVide('alpha'), matiere: 'Français', observations: [{ texte: 'Entre dans la tâche', niveau: 2 as const }] };
  assert.deepEqual(verifier(s), { ok: true, raisons: [] });
});

test('élève absent : étapes 2 à 5 sans objet, aucun niveau exigé', () => {
  const s = { ...seanceVide('alpha'), presence: 'absent_eleve' as const, matiere: 'Français', observations: [{ texte: 'x', niveau: null }] };
  assert.deepEqual(etatsEtapes(s), ['remplie', 'sans-objet', 'sans-objet', 'sans-objet', 'sans-objet', 'vide']);
  assert.equal(verifier(s).ok, true);
});

test('agent absent : la matière n’est pas exigée', () => {
  assert.equal(verifier({ ...seanceVide('alpha'), presence: 'absent_agent' }).ok, true);
});
