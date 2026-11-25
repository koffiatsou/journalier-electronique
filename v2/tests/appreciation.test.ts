import assert from 'node:assert/strict';
import { test } from 'node:test';
import { preparerBlocs } from '../src/domain/export/journalier.ts';
import { NBSP as N, SEPARATEUR_APPRECIATION, construireBloc, couperAppreciation } from '../src/domain/redaction/index.ts';
import type { Bloc } from '../src/domain/redaction/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const eleve = (): Eleve => ({
  id: 'alpha', nom: 'Alpha', prenom: 'Élève', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: ['Mathématiques']
});

const fonctionnement = (b: Bloc) => b.ortho.find((o) => o.label === 'Fonctionnement observé');

test('éléments d’abord, trait, puis appréciation : la ligne finit par le séparateur et le mot', () => {
  const ligne = fonctionnement(construireBloc(seance()))?.lignes?.[0] ?? '';
  assert.equal(ligne, `• Entre dans la tâche${N}; maintient son attention${SEPARATEUR_APPRECIATION}tout à fait`);
});

test('chaque ligne a son appréciation et sa teinte, dans le même ordre ; la remarque n’en a pas', () => {
  const f = fonctionnement(construireBloc(seance()));
  assert.equal(f?.appreciations?.length, f?.lignes?.length);
  assert.deepEqual(f?.appreciations?.map((a) => a?.teinte), ['fort', 'moyen', 'faible', undefined]);
  assert.equal(f?.appreciations?.at(-1), null);
  assert.match(f?.lignes?.at(-1) ?? '', /^Remarque/);
});

test('« pas du tout » : teinte d’attention soutenue, pas le gris neutre', () => {
  const s = seance({ observations: [{ texte: 'Lit la consigne', niveau: -1 }], remarque: '' });
  const f = fonctionnement(construireBloc(s));
  assert.equal(f?.lignes?.[0], `• Lit la consigne${SEPARATEUR_APPRECIATION}pas du tout`);
  assert.equal(f?.appreciations?.[0]?.teinte, 'attention-fort');
});

test('point de vigilance : sa propre teinte, jamais celle d’un niveau d’acquisition', () => {
  const s = seance({ observations: [{ texte: 'Se désengage / évite la tâche', niveau: 1 }], remarque: '' });
  const f = fonctionnement(construireBloc(s));
  assert.equal(f?.lignes?.[0], `• Se désengage / évite la tâche${SEPARATEUR_APPRECIATION}point de vigilance, souvent`);
  assert.equal(f?.appreciations?.[0]?.teinte, 'vigilance-2');
});

test('aides : l’effet est l’appréciation', () => {
  const b = construireBloc(seance({ aides: [{ nom: 'Support visuel', effet: 2 }] }));
  const aides = b.ortho.find((o) => o.label?.includes('mises en place'));
  assert.equal(aides?.lignes?.[0], `• Support visuel${SEPARATEUR_APPRECIATION}effet positif`);
  assert.equal(aides?.appreciations?.[0]?.teinte, 'fort');
});

test('couper une ligne : éléments et appréciation ; sans correspondance, rien n’est coupé', () => {
  const f = fonctionnement(construireBloc(seance()));
  const ligne = f?.lignes?.[0] ?? '';
  const coupe = couperAppreciation(ligne, f?.appreciations?.[0]);
  assert.equal(coupe?.appreciation, 'tout à fait');
  assert.equal(coupe?.elements, `• Entre dans la tâche${N}; maintient son attention`);
  assert.equal(couperAppreciation(ligne, null), null);
  assert.equal(couperAppreciation('• autre chose', f?.appreciations?.[0]), null);
});

test('version dé-identifiée : le prénom disparaît des éléments, et la ligne se coupe encore', () => {
  const s = seance({ observations: [{ texte: 'Élève Alpha explique sa démarche', niveau: 2 }], remarque: '' });
  const blocs = preparerBlocs([s], eleve(), true);
  const f = blocs[0] && fonctionnement(blocs[0]);
  const ligne = f?.lignes?.[0] ?? '';
  assert.ok(!/Alpha|Élève/.test(ligne), ligne);
  assert.ok(ligne.endsWith(`${SEPARATEUR_APPRECIATION}tout à fait`), ligne);
  assert.equal(couperAppreciation(ligne, f?.appreciations?.[0])?.appreciation, 'tout à fait');
  assert.ok(!JSON.stringify(f?.appreciations).match(/Alpha|Élève/), 'les appréciations ne portent aucun nom');
});
