import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sansPointNote } from '../src/domain/journalier/index.ts';
import { seance, vide } from './fabrique.ts';

describe('séance sans aucun point noté', () => {
  it('élève présent et rien de noté : vide', () => {
    assert.equal(sansPointNote(seance({ ...vide, presence: 'present' })), true);
  });
  it('une observation, une compétence ou une aide suffit', () => {
    assert.equal(sansPointNote(seance({ ...vide, observations: [{ texte: 'Entre dans la tâche', niveau: 1 }] })), false);
    assert.equal(sansPointNote(seance({ ...vide, competences: [{ texte: 'Lire un graphique', niveau: 1 }] })), false);
    assert.equal(sansPointNote(seance({ ...vide, aides: [{ nom: 'Support visuel', effet: 1, statut: 'nouvelle' }] as never })), false);
  });
  it('une séance d’absence n’est jamais vide : il n’y a rien à noter', () => {
    assert.equal(sansPointNote(seance({ ...vide, presence: 'absent_eleve' })), false);
  });
});
