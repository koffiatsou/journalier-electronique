import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { COULEURS_APPRECIATION, normaliserReglageAppreciations } from '../src/domain/export/appreciations.ts';
import { construireJournalier, lireZip } from '../src/domain/export/index.ts';
import { sansBalises } from '../src/domain/export/journalier.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const modele = new Uint8Array(readFileSync(new URL('../public/modeles/Journalier_modele_papier.docx', import.meta.url)));
const eleve: Eleve = { id: 'alpha', nom: 'Dupont', prenom: 'Léa', classe: '3CB', ecole: 'École test', titulaire: 'M. Test', dateNaissance: '2012-05-04', matieres: [] };
const lire = async (o: Uint8Array) => new TextDecoder().decode((await lireZip(o))['word/document.xml']);
const fonds = (xml: string): string[] => [...xml.matchAll(/<w:shd [^>]*w:fill="([0-9A-F]{6})"/g)].map((m) => m[1]!);
const texteBrut = (xml: string): string => sansBalises(xml).replace(/\u00a0/g, ' ');

describe('Journalier Word : appréciation après les éléments', () => {
  it('par défaut : le trait et le mot sont écrits, sans aucune couleur', async () => {
    const xml = await lire((await construireJournalier(modele, eleve, [seance()])).octets);
    assert.match(texteBrut(xml), /Entre dans la tâche ; maintient son attention \| tout à fait/);
    for (const c of Object.values(COULEURS_APPRECIATION)) assert.ok(!fonds(xml).includes(c.fond), `fond ${c.fond} inattendu`);
  });
  it('case cochée : la même ligne, avec un fond de la teinte de l’appréciation', async () => {
    const xml = await lire((await construireJournalier(modele, eleve, [seance()], { appreciations: { actif: true } })).octets);
    assert.match(texteBrut(xml), /maintient son attention \| +tout à fait/);
    assert.ok(fonds(xml).includes(COULEURS_APPRECIATION.fort.fond), 'tout à fait : sarcelle');
    assert.ok(fonds(xml).includes(COULEURS_APPRECIATION.moyen.fond), 'assez : bleu');
    assert.ok(fonds(xml).includes(COULEURS_APPRECIATION.faible.fond), 'un peu : ambre');
  });
  it('version dé-identifiée et colorée : aucun nom, et l’appréciation garde sa couleur', async () => {
    const s = seance({ observations: [{ texte: 'Léa Dupont explique sa démarche', niveau: 2 }], remarque: '' });
    const xml = await lire((await construireJournalier(modele, eleve, [s], { deidentifie: true, appreciations: { actif: true } })).octets);
    assert.ok(!/Dupont|Léa/.test(texteBrut(xml)), 'un nom est resté dans le document');
    assert.match(texteBrut(xml), /\| +tout à fait/);
    assert.ok(fonds(xml).includes(COULEURS_APPRECIATION.fort.fond));
  });
  it('un réglage abîmé est ramené à « sans couleur »', () => {
    assert.deepEqual(normaliserReglageAppreciations('n’importe quoi'), { actif: false });
    assert.deepEqual(normaliserReglageAppreciations({ actif: 'oui' }), { actif: false });
    assert.deepEqual(normaliserReglageAppreciations({ actif: true }), { actif: true });
  });
});
