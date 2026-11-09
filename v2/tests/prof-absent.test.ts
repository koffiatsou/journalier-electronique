import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sansPointNote } from '../src/domain/journalier/index.ts';
import { texteSeance } from '../src/domain/journalier/recherche.ts';
import { blocEnTexte, construireBloc } from '../src/domain/redaction/index.ts';
import { seance, vide } from './fabrique.ts';

describe('professeur absent, élève vu en individuel', () => {
  const s = seance({ ...vide, presence: 'present', profAbsent: true, matiere: 'Mathématiques', objectifLecon: 'Les fractions', observations: [{ texte: 'Entre dans la tâche', niveau: 1 }] });

  it('reste une vraie séance : partie orthopédagogique complète, pas une absence', () => {
    const bloc = construireBloc(s);
    assert.equal(bloc.type, 'seance');
    assert.ok(bloc.ortho.some((l) => l.label === 'Fonctionnement observé'));
  });
  it('le Journalier le dit dans la case « Cours », sans effacer la matière', () => {
    assert.equal(construireBloc(s).entete.cours, 'Mathématiques (professeur absent)');
    assert.match(blocEnTexte(construireBloc(s)), /Cours\s*: Mathématiques \(professeur absent\)/);
  });
  it('sans matière, la mention reste lisible', () => {
    assert.equal(construireBloc(seance({ ...vide, profAbsent: true, matiere: '' })).entete.cours, 'Professeur absent');
  });
  it('une séance ordinaire ne change pas', () => {
    assert.equal(construireBloc(seance({ ...vide, matiere: 'Français' })).entete.cours, 'Français');
  });
  it('une séance vide sans point noté se demande toujours confirmation', () => {
    assert.equal(sansPointNote(seance({ ...vide, profAbsent: true, objectifLecon: '' })), true);
  });
  it('la recherche du Journalier le retrouve', () => {
    assert.match(texteSeance(s), /professeur absent/);
  });
});
