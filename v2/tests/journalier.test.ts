import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { construireJournalier, construireJournaliers, lireZip } from '../src/domain/export/index.ts';
import { anneesDisponibles, bornes, libellePeriode, seancesDuJournalier } from '../src/domain/journalier/index.ts';
import type { Bornes } from '../src/domain/journalier/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const AUJOURDHUI = '2026-10-24';
const ok = (r: ReturnType<typeof bornes>): Bornes => { assert.ok(r.ok, r.ok ? '' : r.raison); return r.bornes; };

const seances = [
  seance({ id: 'juin', eleveId: 'alpha', date: '2026-06-15' }),
  seance({ id: 'sept', eleveId: 'alpha', date: '2026-09-22' }),
  seance({ id: 'oct-1', eleveId: 'alpha', date: '2026-10-06', periodeDebut: '1e H' }),
  seance({ id: 'oct-3', eleveId: 'alpha', date: '2026-10-06', periodeDebut: '3e H' }),
  seance({ id: 'beta', eleveId: 'beta', date: '2026-10-20' }),
  seance({ id: 'futur', eleveId: 'alpha', date: '2026-11-10' })
];

describe('Journalier : période', () => {
  it('année scolaire : du 1er août au 31 juillet', () => {
    assert.deepEqual(ok(bornes({ genre: 'annee', annee: '2026-2027' }, AUJOURDHUI)), { du: '2026-08-01', au: '2027-07-31' });
    assert.equal(bornes({ genre: 'annee', annee: '2026-2028' }, AUJOURDHUI).ok, false);
  });
  it('état à ce jour : début de l’année en cours jusqu’à aujourd’hui', () => {
    assert.deepEqual(ok(bornes({ genre: 'a-ce-jour' }, AUJOURDHUI)), { du: '2026-08-01', au: '2026-10-24' });
    assert.deepEqual(ok(bornes({ genre: 'a-ce-jour' }, '2027-03-02')), { du: '2026-08-01', au: '2027-03-02' });
  });
  it('dates libres : refus si incomplètes ou inversées', () => {
    assert.deepEqual(ok(bornes({ genre: 'dates', du: '2026-09-01', au: '2026-09-30' }, AUJOURDHUI)), { du: '2026-09-01', au: '2026-09-30' });
    assert.equal(bornes({ genre: 'dates', du: '', au: '2026-09-30' }, AUJOURDHUI).ok, false);
    const inv = bornes({ genre: 'dates', du: '2026-10-01', au: '2026-09-01' }, AUJOURDHUI);
    assert.equal(inv.ok, false);
    assert.match(inv.ok ? '' : inv.raison, /après/);
  });
  it('filtre par élève et par période, plus récentes d’abord (bornes incluses)', () => {
    const b = ok(bornes({ genre: 'a-ce-jour' }, AUJOURDHUI));
    assert.deepEqual(seancesDuJournalier(seances, 'alpha', b).map((s) => s.id), ['oct-3', 'oct-1', 'sept']);
    assert.deepEqual(seancesDuJournalier(seances, '', b).map((s) => s.id), ['beta', 'oct-3', 'oct-1', 'sept']);
    const jour = ok(bornes({ genre: 'dates', du: '2026-10-06', au: '2026-10-06' }, AUJOURDHUI));
    assert.deepEqual(seancesDuJournalier(seances, 'alpha', jour).map((s) => s.id), ['oct-3', 'oct-1']);
  });
  it('années proposées : celles des séances et l’année en cours', () => {
    assert.deepEqual(anneesDisponibles(seances, AUJOURDHUI), ['2026-2027', '2025-2026']);
    assert.deepEqual(anneesDisponibles([], AUJOURDHUI), ['2026-2027']);
  });
  it('libellés lisibles, et sans « / » pour un nom de fichier', () => {
    assert.equal(libellePeriode({ genre: 'annee', annee: '2025-2026' }, AUJOURDHUI), '2025-2026');
    assert.equal(libellePeriode({ genre: 'a-ce-jour' }, AUJOURDHUI), '2026-2027 au 24/10/2026');
    assert.equal(libellePeriode({ genre: 'dates', du: '2026-09-01', au: '2026-10-31' }, AUJOURDHUI, true), 'du 01-09-2026 au 31-10-2026');
  });
});

const modele = new Uint8Array(readFileSync(new URL('../public/modeles/Journalier_modele_papier.docx', import.meta.url)));
const alpha: Eleve = { id: 'alpha', nom: 'Dupont', prenom: 'Léa', classe: '3CB', ecole: 'École test', titulaire: 'M. Test', dateNaissance: '2012-05-04', matieres: [] };
const beta: Eleve = { id: 'beta', nom: 'Martin', prenom: 'Sam', classe: '3CB', ecole: 'École test', titulaire: 'Mme Exemple', dateNaissance: '', matieres: [] };
const xmlDe = async (o: Uint8Array) => new TextDecoder().decode((await lireZip(o))['word/document.xml']);

describe('Journalier : export par période', () => {
  it('le fichier ne contient que les séances de la période et la nomme', async () => {
    const p = { genre: 'dates', du: '2026-09-01', au: '2026-09-30' } as const;
    const choisies = seancesDuJournalier(seances, 'alpha', ok(bornes(p, AUJOURDHUI)));
    const { octets, nom } = await construireJournalier(modele, alpha, choisies, { periode: libellePeriode(p, AUJOURDHUI, true) });
    const xml = await xmlDe(octets);
    assert.equal((xml.match(/Partie pédagogique/g) ?? []).length, 1);
    assert.match(xml, /22\/09\/2026/);
    assert.doesNotMatch(xml, /06\/10\/2026|15\/06\/2026/);
    assert.equal(nom, 'Journalier - Dupont - du 01-09-2026 au 30-09-2026.docx');
  });
  it('dans le fichier, les séances restent dans l’ordre chronologique', async () => {
    const choisies = seancesDuJournalier(seances, 'alpha', ok(bornes({ genre: 'a-ce-jour' }, AUJOURDHUI)));
    const xml = await xmlDe((await construireJournalier(modele, alpha, choisies)).octets);
    assert.ok(xml.indexOf('22/09/2026') < xml.indexOf('06/10/2026'));
  });
  it('tous les élèves : une archive avec un fichier par élève', async () => {
    const b = ok(bornes({ genre: 'a-ce-jour' }, AUJOURDHUI));
    const groupes = [alpha, beta].map((eleve) => ({ eleve, seances: seancesDuJournalier(seances, eleve.id, b) }));
    const r = await construireJournaliers(modele, groupes, { periode: '2026-2027 au 24-10-2026' });
    assert.equal(r.nombre, 2);
    assert.equal(r.nom, 'Journaliers - 2026-2027 au 24-10-2026.zip');
    const fichiers = await lireZip(r.octets);
    assert.deepEqual(Object.keys(fichiers).sort(), ['Journalier - Dupont - 2026-2027 au 24-10-2026.docx', 'Journalier - Martin - 2026-2027 au 24-10-2026.docx']);
  });
  it('tous les élèves, dé-identifiés : noms distincts et aucune identité', async () => {
    const b = ok(bornes({ genre: 'a-ce-jour' }, AUJOURDHUI));
    const groupes = [alpha, beta].map((eleve) => ({ eleve, seances: seancesDuJournalier(seances, eleve.id, b) }));
    const r = await construireJournaliers(modele, groupes, { deidentifie: true, periode: '2026-2027' });
    const fichiers = await lireZip(r.octets);
    const noms = Object.keys(fichiers).sort();
    assert.deepEqual(noms, ['Journalier - dé-identifié - 3CB - 2026-2027 (2).docx', 'Journalier - dé-identifié - 3CB - 2026-2027.docx']);
    for (const n of noms) assert.doesNotMatch(await xmlDe(fichiers[n]!), /Dupont|Léa|Martin|M\. Test|Mme Exemple/);
  });
  it('aucune séance dans la période : message clair', async () => {
    await assert.rejects(construireJournaliers(modele, [{ eleve: alpha, seances: [] }]), /Aucune séance/);
  });
});
