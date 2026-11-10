import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sansPointNote } from '../src/domain/journalier/index.ts';
import { construireBloc } from '../src/domain/redaction/index.ts';
import { seance, vide } from './fabrique.ts';

describe('séance où il n’y a rien à écrire', () => {
  it('élève présent, ni objectif ni point noté : vide', () => {
    assert.equal(sansPointNote(seance({ ...vide, presence: 'present', objectifLecon: '' })), true);
    assert.equal(sansPointNote(seance({ ...vide, presence: 'present', objectifLecon: '   ' })), true);
  });
  it('l’objectif de la leçon suffit : le Journalier écrit « Séance sans observation particulière. »', () => {
    const s = seance({ ...vide, presence: 'present', objectifLecon: 'Résoudre des équations' });
    assert.equal(sansPointNote(s), false);
    assert.deepEqual(construireBloc(s).ortho, [{ label: null, texte: 'Séance sans observation particulière.' }]);
  });
  it('une observation, une compétence ou une aide suffit aussi', () => {
    assert.equal(sansPointNote(seance({ ...vide, observations: [{ texte: 'Entre dans la tâche', niveau: 1 }] })), false);
    assert.equal(sansPointNote(seance({ ...vide, competences: [{ texte: 'Lire un graphique', niveau: 1 }] })), false);
    assert.equal(sansPointNote(seance({ ...vide, aides: [{ nom: 'Support visuel', effet: 1 }] as never })), false);
  });
  it('une séance d’absence n’est jamais vide : il n’y a rien à noter', () => {
    assert.equal(sansPointNote(seance({ ...vide, presence: 'absent_eleve', objectifLecon: '' })), false);
  });
});
