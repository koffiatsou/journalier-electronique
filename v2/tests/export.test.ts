import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { construireJournalier, lireZip, ecrireZip } from '../src/domain/export/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const modele = new Uint8Array(readFileSync(new URL('../public/modeles/Journalier_modele_papier.docx', import.meta.url)));
const eleve: Eleve = { id: 'alpha', nom: 'Dupont', prenom: 'Léa', classe: '3CB', ecole: 'École test', titulaire: 'M. Test', dateNaissance: '2012-05-04', matieres: [] };
const lire = async (o: Uint8Array) => new TextDecoder().decode((await lireZip(o))['word/document.xml']);

describe('export Word', () => {
  it('relit ce qu’il écrit (zip)', async () => {
    const a = ecrireZip({ 'a.txt': new TextEncoder().encode('bonjour'), 'dossier/b.xml': new TextEncoder().encode('<x/>') });
    const r = await lireZip(a);
    assert.equal(new TextDecoder().decode(r['a.txt']), 'bonjour');
    assert.equal(Object.keys(r).length, 2);
  });
  it('remplit le modèle : identité et une séance par bloc', async () => {
    const { octets, nom } = await construireJournalier(modele, eleve, [seance({ date: '2026-09-22' }), seance({ date: '2026-10-06' })]);
    const xml = await lire(octets);
    assert.match(xml, /Dupont/);
    assert.match(xml, /Léa/);
    assert.match(xml, /04\/05\/2012/);
    assert.equal((xml.match(/Partie pédagogique/g) ?? []).length, 2);
    assert.match(xml, /Résoudre un problème additif/);
    assert.equal(nom, 'Journalier - Dupont - 2026-2027.docx');
  });
  it('sans nom : ni élève, ni titulaire, ni date de naissance', async () => {
    const s = seance({ objectifLecon: 'Lire le texte de Léa Dupont' });
    const { octets } = await construireJournalier(modele, eleve, [s], true);
    const xml = await lire(octets);
    assert.doesNotMatch(xml, /Dupont|Léa|M\. Test|04\/05\/2012|École test/);
  });
  it('échappe le XML', async () => {
    const { octets } = await construireJournalier(modele, eleve, [seance({ objectifLecon: 'a < b & c > d' })]);
    assert.match(await lire(octets), /a &lt; b &amp; c &gt; d/);
  });
  it('une absence tient en une ligne', async () => {
    const { octets } = await construireJournalier(modele, eleve, [seance({ presence: 'absent_eleve' })]);
    assert.equal(((await lire(octets)).match(/Partie pédagogique/g) ?? []).length, 0);
  });
});
