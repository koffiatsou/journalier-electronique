import assert from 'node:assert/strict';
import { test } from 'node:test';
import { etatsEtapes, niveauxManquants, progression, resumesEtapes, seanceVide, verifier } from '../src/features/seance/brouillon.ts';

test('séance vierge : rien de présélectionné', () => {
  const s = seanceVide('alpha', '2026-10-23');
  assert.equal(s.transfert, null);
  assert.deepEqual(s.observations, []);
  assert.deepEqual(etatsEtapes(s), ['vide', 'vide', 'vide', 'vide', 'vide']);
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

test('élève absent : étapes 2 à 4 sans objet, aucun niveau exigé', () => {
  const s = { ...seanceVide('alpha'), presence: 'absent_eleve' as const, matiere: 'Français', observations: [{ texte: 'x', niveau: null }] };
  assert.deepEqual(etatsEtapes(s), ['remplie', 'sans-objet', 'sans-objet', 'sans-objet', 'vide']);
  assert.equal(verifier(s).ok, true);
});

test('agent absent : la matière n’est pas exigée', () => {
  assert.equal(verifier({ ...seanceVide('alpha'), presence: 'absent_agent' }).ok, true);
});

test('résumés : rien tant que la rubrique est vide, une ligne dès qu’elle est renseignée', () => {
  const vide = seanceVide('alpha');
  assert.deepEqual(resumesEtapes(vide), [null, null, null, null, null]);
  const s = {
    ...vide, matiere: 'Français', periodeDebut: '2e H', periodeFin: '3e H',
    observations: [{ texte: 'Entre dans la tâche', niveau: 1 as const }, { texte: 'Accepte l’aide', niveau: 2 as const }, { texte: 'Persévère dans la tâche', niveau: 0 as const }],
    aides: [{ nom: 'Reformulation', effet: 2 as const }],
    suite: { ...vide.suite, objectif: 'Relire à voix haute' }
  };
  assert.deepEqual(resumesEtapes(s), ['Français · 2e H à 3e H', 'Entre dans la tâche, Accepte l’aide et 1 autre', null, 'Reformulation', 'Relire à voix haute']);
});

test('résumés : adaptations sans aide précise, remarque seule, rubriques sans objet', () => {
  const base = seanceVide('alpha');
  assert.equal(resumesEtapes({ ...base, situationAide: 'existing' })[3], 'Adaptations : déjà en place');
  assert.equal(resumesEtapes({ ...base, remarque: ' Calme aujourd’hui ' })[1], 'Calme aujourd’hui');
  const absent = { ...base, presence: 'absent_eleve' as const, matiere: 'Français', remarque: 'x' };
  assert.deepEqual(resumesEtapes(absent).slice(1, 4), [null, null, null]);
});

test('progression : les rubriques sans objet ne comptent pas dans le total', () => {
  const base = seanceVide('alpha');
  assert.deepEqual(progression(base), { faites: 0, total: 5 });
  const s = { ...base, matiere: 'Français', eleveId: 'alpha', remarque: 'ok' };
  assert.deepEqual(progression(s), { faites: 2, total: 5 });
  assert.deepEqual(progression({ ...s, presence: 'absent_eleve' }), { faites: 1, total: 2 });
});
