import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { canonique } from '../src/domain/synchro/index.ts';
import { dechiffrerRangee, lireCoffreV75, preparerReprise, trouverComptes } from '../src/domain/v75/index.ts';
import type { StockageV75 } from '../src/domain/v75/index.ts';
import { CHEMIN_V75, COMPTE, coffreV75, etatV75 } from './fabrique-v75.ts';

const CTX = { aujourdhui: '2026-10-26', maintenant: '2026-10-26T20:00:00.000Z' };

describe('coffre de la V75 : contrat avec le code de la V75', () => {
  it('la V75 utilise toujours la base et la version de format que la V2 sait lire', () => {
    const source = readFileSync(CHEMIN_V75, 'utf8');
    assert.match(source, /JOURNALIER_STORAGE_DB_NAME\s*=\s*'journalier-secure-v74'/);
    assert.match(source, /JOURNALIER_STORAGE_SCHEMA_VERSION\s*=\s*2\b/);
    for (const magasin of ['meta', 'students', 'sessions', 'agenda', 'pia', 'keys']) assert.match(source, new RegExp(`createObjectStore\\('${magasin}'`), magasin);
    assert.match(source, /`journalier-storage-v\$\{JOURNALIER_STORAGE_SCHEMA_VERSION\}\|\$\{accountKey\}\|\$\{type\}\|\$\{id\}`/, 'données authentifiées');
  });

  it('relit des enregistrements chiffrés par les vraies fonctions de la V75', async () => {
    const { rangees, cle } = await coffreV75(etatV75());
    const eleve = await dechiffrerRangee(rangees.students[0]!, cle);
    assert.equal((eleve as { nom: string }).nom, 'Séfora');
  });

  it('refuse un enregistrement déplacé, abîmé ou d’une autre version', async () => {
    const { rangees, cle } = await coffreV75(etatV75());
    const r = rangees.students[0]!;
    await assert.rejects(() => dechiffrerRangee({ ...r, id: 'autre' }, cle));
    await assert.rejects(() => dechiffrerRangee({ ...r, type: 'session' }, cle));
    await assert.rejects(() => dechiffrerRangee({ ...r, schemaVersion: 3 }, cle), /version/);
    const abime = new Uint8Array(r.ciphertext as ArrayBuffer).slice();
    abime[3] = abime[3]! ^ 1;
    await assert.rejects(() => dechiffrerRangee({ ...r, ciphertext: abime }, cle), /empreinte/);
    const autreCle = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await assert.rejects(() => dechiffrerRangee(r, autreCle));
  });
});

describe('coffre de la V75 : lecture', () => {
  it('trouve le coffre, à qui il appartient, sans lire les élèves', async () => {
    const { stockage } = await coffreV75(etatV75());
    assert.deepEqual(await trouverComptes(stockage), [{ id: COMPTE, nom: 'Agent Test', adresse: 'agent.test@exemple.be', eleves: 2, seances: 6 }]);
  });

  it('pas de coffre, ou un coffre pas encore migré par la V75 : rien à reprendre', async () => {
    const absent: StockageV75 = { existe: async () => false, rangees: async () => { throw new Error('ne doit pas être lu'); }, cles: async () => { throw new Error('ne doit pas être lu'); } };
    assert.deepEqual(await trouverComptes(absent), []);
    const { stockage } = await coffreV75(etatV75(), { migration: 'pending' });
    assert.deepEqual(await trouverComptes(stockage), []);
  });

  it('un coffre sans la clé du compte n’est pas proposé', async () => {
    const { stockage } = await coffreV75(etatV75());
    assert.deepEqual(await trouverComptes({ ...stockage, cles: async () => [] }), []);
  });

  it('lit tout : élèves, séances, agenda (avec réglages et dates retirées) et PIA', async () => {
    const original = etatV75();
    const { stockage } = await coffreV75(original);
    const { etat, illisibles } = await lireCoffreV75(stockage, COMPTE);
    assert.deepEqual(illisibles, []);
    const trier = (l: unknown[], cleTri: string) => [...l].sort((a, b) => String((a as Record<string, unknown>)[cleTri]).localeCompare(String((b as Record<string, unknown>)[cleTri])));
    assert.equal(canonique(trier(etat.eleves, 'studentId')), canonique(trier(original.eleves, 'studentId')));
    assert.equal(canonique(trier(etat.seances, 'id')), canonique(trier(original.seances, 'id')));
    const lu = etat.agenda as { __events: unknown[]; __exceptions: unknown; __config: unknown };
    const att = original.agenda as { __events: unknown[]; __exceptions: unknown; __config: unknown };
    assert.equal(canonique(trier(lu.__events, 'eventId')), canonique(trier(att.__events, 'eventId')));
    assert.equal(canonique(lu.__exceptions), canonique(att.__exceptions));
    assert.equal(canonique(lu.__config), canonique(att.__config));
    assert.equal(canonique(etat.pias), canonique(original.pias));
  });

  it('un enregistrement abîmé est signalé, pas ignoré en silence, et le reste est lu', async () => {
    const { stockage } = await coffreV75(etatV75(), { abimer: (r, m) => m === 'sessions' && r.id === '5001' });
    const { etat, illisibles } = await lireCoffreV75(stockage, COMPTE);
    assert.equal(etat.seances.length, 5);
    assert.equal(illisibles.length, 1);
    assert.match(illisibles[0]!.quoi, /Séance \(5001\)/);
  });

  it('ne lit que les enregistrements du compte demandé', async () => {
    const un = await coffreV75(etatV75());
    const autre = etatV75();
    autre.seances.length = 1;
    const deux = await coffreV75(autre, { compte: 'compte-2' });
    const melange: StockageV75 = {
      existe: async () => true,
      rangees: async (m) => [...un.rangees[m], ...deux.rangees[m]],
      cles: async () => [{ compte: COMPTE, cle: un.cle }, { compte: 'compte-2', cle: deux.cle }]
    };
    const comptes = await trouverComptes(melange);
    assert.deepEqual(comptes.map((c) => [c.id, c.seances]), [[COMPTE, 6], ['compte-2', 1]]);
    assert.equal((await lireCoffreV75(melange, COMPTE)).etat.seances.length, 6);
    assert.equal((await lireCoffreV75(melange, 'compte-2')).etat.seances.length, 1);
  });

  it('de bout en bout : coffre chiffré par la V75 → plan de reprise', async () => {
    const { stockage } = await coffreV75(etatV75());
    const { etat } = await lireCoffreV75(stockage, COMPTE);
    const plan = preparerReprise(etat, CTX);
    assert.deepEqual(plan.fiches.map((f) => [f.eleve.nom, f.seances.length, f.activites.length]), [['Nicoleta', 1, 0], ['Séfora', 3, 8]]);
    assert.equal(plan.agendaGeneral.length, 23);
    assert.equal(plan.ecarts.length, 3);
  });

  it('la lecture n’écrit rien : le stockage n’a aucune méthode d’écriture', async () => {
    const { stockage } = await coffreV75(etatV75());
    assert.deepEqual(Object.keys(stockage).sort(), ['cles', 'existe', 'rangees']);
  });
});
