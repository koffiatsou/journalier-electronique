import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { COULEURS_WORD, couleurDeMatiere, normaliserReglageCouleurs } from '../src/domain/export/couleurs.ts';
import { construireJournalier, lireZip } from '../src/domain/export/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const modele = new Uint8Array(readFileSync(new URL('../public/modeles/Journalier_modele_papier.docx', import.meta.url)));
const eleve: Eleve = { id: 'alpha', nom: 'Dupont', prenom: 'Léa', classe: '3CB', ecole: 'École test', titulaire: 'M. Test', dateNaissance: '2012-05-04', matieres: [] };
const lire = async (o: Uint8Array) => new TextDecoder().decode((await lireZip(o))['word/document.xml']);
const GRIS_DU_MODELE = 'C9C9C9';
const fonds = (xml: string): string[] => [...xml.matchAll(/<w:shd [^>]*w:fill="([0-9A-F]{6})"/g)].map((m) => m[1]!);

describe('couleur des matières (export Word)', () => {
  it('automatique : toujours la même couleur pour une matière, accents et majuscules ignorés', () => {
    assert.equal(couleurDeMatiere('Mathématiques', {}).fond, couleurDeMatiere('  mathematiques ', {}).fond);
    assert.notEqual(couleurDeMatiere('Mathématiques', {}).fond, couleurDeMatiere('Français', {}).fond);
    assert.ok(COULEURS_WORD.some((c) => c.fond === couleurDeMatiere('Une matière inventée', {}).fond));
  });
  it('un code couleur choisi par l’agent l’emporte sur l’automatique', () => {
    const choisie = COULEURS_WORD[3]!;
    assert.equal(couleurDeMatiere('Mathématiques', { mathematiques: 3 }).fond, choisie.fond);
  });
  it('un réglage abîmé est ramené à « rien de coloré, tout automatique »', () => {
    assert.deepEqual(normaliserReglageCouleurs('n’importe quoi'), { actif: false, choix: {} });
    assert.deepEqual(normaliserReglageCouleurs({ actif: true, choix: { maths: 99, francais: 2, x: 'rouge' } }), { actif: true, choix: { francais: 2 } });
  });
});

describe('Journalier Word : en-têtes colorés par matière', () => {
  it('par défaut rien ne change : les en-têtes restent gris', async () => {
    const xml = await lire((await construireJournalier(modele, eleve, [seance({ matiere: 'Mathématiques' })])).octets);
    assert.ok(fonds(xml).every((f) => f === GRIS_DU_MODELE));
  });
  it('coché : « Partie pédagogique » et « Partie orthopédagogique » prennent la couleur de la matière', async () => {
    const maths = couleurDeMatiere('Mathématiques', {}).fond;
    const xml = await lire((await construireJournalier(modele, eleve, [seance({ matiere: 'Mathématiques' })], { couleurs: { actif: true, choix: {} } })).octets);
    assert.deepEqual(fonds(xml).filter((f) => f === maths).length, 2);
    assert.ok(!fonds(xml).includes(GRIS_DU_MODELE));
  });
  it('deux matières, deux couleurs ; la couleur choisie est respectée', async () => {
    const rose = COULEURS_WORD[4]!.fond;
    const opts = { couleurs: { actif: true, choix: { francais: 4 } } };
    const xml = await lire((await construireJournalier(modele, eleve, [seance({ matiere: 'Mathématiques' }), seance({ matiere: 'Français' })], opts)).octets);
    assert.equal(fonds(xml).filter((f) => f === rose).length, 2);
    assert.equal(new Set(fonds(xml)).size, 2);
  });
  it('la mention « (professeur absent) » ne change pas la couleur de la matière', async () => {
    const maths = couleurDeMatiere('Mathématiques', {}).fond;
    const xml = await lire((await construireJournalier(modele, eleve, [seance({ matiere: 'Mathématiques', profAbsent: true })], { couleurs: { actif: true, choix: {} } })).octets);
    assert.equal(fonds(xml).filter((f) => f === maths).length, 2);
  });
  it('une séance sans matière garde le gris du modèle', async () => {
    const xml = await lire((await construireJournalier(modele, eleve, [seance({ matiere: '' })], { couleurs: { actif: true, choix: {} } })).octets);
    assert.ok(fonds(xml).every((f) => f === GRIS_DU_MODELE));
  });
  it('une absence colore sa ligne « Date / Cours / Titulaire »', async () => {
    const maths = couleurDeMatiere('Mathématiques', {}).fond;
    const xml = await lire((await construireJournalier(modele, eleve, [seance({ presence: 'absent_eleve', matiere: 'Mathématiques' })], { couleurs: { actif: true, choix: {} } })).octets);
    assert.ok(fonds(xml).includes(maths));
  });
});
