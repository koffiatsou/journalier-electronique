import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appliquerPassage, enseignantDeSeance, enseignantDuDossier, fixerEnseignant, normaliserEleve, normaliserEnseignants
} from '../src/domain/eleves/index.ts';
import { preparerBlocs } from '../src/domain/export/journalier.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const eleve = (extra: Partial<Eleve> = {}): Eleve => ({
  id: 'alpha', nom: 'Alpha', prenom: 'Élève', classe: '3CB', ecole: '', titulaire: 'Mme Titu', dateNaissance: '',
  matieres: ['Mathématiques', 'Français'], enseignants: [{ matiere: 'Mathématiques', nom: 'M. Maths' }], ...extra
});

test('enseignant du cours : la matière du dossier (accents et majuscules ignorés), sinon le titulaire de classe', () => {
  assert.equal(enseignantDuDossier(eleve(), 'mathematiques'), 'M. Maths');
  assert.equal(enseignantDuDossier(eleve(), 'Français'), 'Mme Titu');
  assert.equal(enseignantDuDossier(eleve({ titulaire: '' }), 'Français'), '');
  assert.equal(enseignantDuDossier(undefined, 'Français'), '');
});

test('séance : le nom noté dans la séance l’emporte sur le dossier', () => {
  const e = eleve();
  assert.equal(enseignantDeSeance(seance({ enseignant: 'Mme Remplaçante' }), e), 'Mme Remplaçante');
  assert.equal(enseignantDeSeance(seance(), e), 'M. Maths');
});

test('fixerEnseignant : le nom du dossier est gardé dans la séance, et ne bouge plus si le dossier change', () => {
  const fixee = fixerEnseignant(seance(), eleve());
  assert.equal(fixee.enseignant, 'M. Maths');
  const apres = eleve({ enseignants: [{ matiere: 'Mathématiques', nom: 'Mme Nouvelle' }] });
  assert.equal(enseignantDeSeance(fixee, apres), 'M. Maths');
  assert.equal(fixerEnseignant(seance({ enseignant: 'Remplaçant' }), eleve()).enseignant, 'Remplaçant');
});

test('fixerEnseignant : rien à noter sans enseignant ni titulaire', () => {
  assert.equal('enseignant' in fixerEnseignant(seance(), eleve({ titulaire: '', enseignants: [] })), false);
});

test('liste d’enseignants : lignes incomplètes écartées, une seule ligne par matière', () => {
  assert.deepEqual(
    normaliserEnseignants([{ matiere: ' Français ', nom: ' M. F ' }, { matiere: 'francais', nom: 'Autre' }, { matiere: '', nom: 'X' }, { matiere: 'Sciences', nom: '' }, null]),
    [{ matiere: 'Français', nom: 'M. F' }]
  );
  assert.deepEqual(normaliserEnseignants('pas une liste'), []);
  assert.equal('enseignants' in normaliserEleve(eleve({ enseignants: [] })), false);
});

test('Journalier : la colonne « Titulaire » suit la matière de chaque séance', () => {
  const blocs = preparerBlocs([seance(), seance({ matiere: 'Français', date: '2026-09-23' })], eleve(), false);
  assert.deepEqual(blocs.map((b) => b.entete.titulaire), ['M. Maths', 'Mme Titu']);
  assert.deepEqual(preparerBlocs([seance()], eleve(), true).map((b) => b.entete.titulaire), ['']);
});

test('passage d’année : les enseignants par cours sont effacés avec le titulaire, sinon gardés', () => {
  const ligne = { eleveId: 'alpha', action: 'passer', classe: '4CB' } as Parameters<typeof appliquerPassage>[1];
  const efface = appliquerPassage(eleve(), ligne, '2027-2028', { viderTitulaire: true, aujourdhui: '2027-08-25' });
  assert.equal(efface.titulaire, '');
  assert.equal('enseignants' in efface, false);
  const garde = appliquerPassage(eleve(), ligne, '2027-2028', { viderTitulaire: false, aujourdhui: '2027-08-25' });
  assert.equal(garde.enseignants?.length, 1);
});
