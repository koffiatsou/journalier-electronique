import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { aEncoder, basculerMemo, creerMemo, deplacements, journeeDu, memosDuCreneau, normaliserMemos, retirerMemo, suiteDerniereSeance, viderFaits } from '../src/domain/accueil/index.ts';
import { creer, PERIODES_AGENDA } from '../src/domain/agenda/index.ts';
import type { Ecole } from '../src/domain/agenda/index.ts';
import { normaliserObjet } from '../src/domain/synchro/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { creerMagasin } from '../src/state/store.ts';
import { seance, vide } from './fabrique.ts';

const eleve = (id: string, extra: Partial<Eleve> = {}): Eleve => ({ id, nom: id, prenom: 'X', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [], ...extra });
const ecole = (id: string, nom: string, debut: string): Ecole => ({
  id, nom,
  periodes: PERIODES_AGENDA.map((p, i) => {
    if (i >= 8) return { label: p.label, debut: '', fin: '' };
    const d = Number(debut.slice(0, 2)) * 60 + Number(debut.slice(3)) + i * 50;
    const h = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return { label: p.label, debut: h(d), fin: h(d + 50) };
  })
});
const A = ecole('a', 'École A', '08:00');
const B = ecole('b', 'École B', '08:00');
const suiteVide = vide.suite!;

describe('la suite notée à la dernière séance', () => {
  it('reprend la dernière séance de l’élève avant ce jour', () => {
    const vieille = seance({ date: '2026-10-01', suite: { ...suiteVide, objectif: 'ancien' } });
    const derniere = seance({ date: '2026-10-08', suite: { ...suiteVide, objectif: 'Refaire les fractions avec le gabarit', actions: ['Préparer un support'], modalite: 'Groupe' } });
    const autre = seance({ eleveId: 'beta', date: '2026-10-12', suite: { ...suiteVide, objectif: 'autre élève' } });
    const s = suiteDerniereSeance('alpha', '2026-10-13', [vieille, autre, derniere]);
    assert.equal(s?.objectif, 'Refaire les fractions avec le gabarit');
    assert.deepEqual(s?.actions, ['Préparer un support']);
    assert.equal(s?.date, '2026-10-08');
  });
  it('ne regarde ni le jour même ni l’avenir', () => {
    assert.equal(suiteDerniereSeance('alpha', '2026-10-08', [seance({ date: '2026-10-08', suite: { ...suiteVide, objectif: 'x' } })]), null);
  });
  it('ne remonte pas plus loin si la dernière séance n’a rien noté', () => {
    const vieille = seance({ date: '2026-10-01', suite: { ...suiteVide, objectif: 'ancien' } });
    const derniere = seance({ date: '2026-10-08', suite: suiteVide });
    assert.equal(suiteDerniereSeance('alpha', '2026-10-13', [vieille, derniere]), null);
  });
  it('rien sans élève ni séance', () => {
    assert.equal(suiteDerniereSeance(undefined, '2026-10-13', []), null);
    assert.equal(suiteDerniereSeance('alpha', '2026-10-13', []), null);
  });
});

describe('la journée', () => {
  const eleves = [eleve('alpha', { ecoleId: 'a' }), eleve('beta', { ecoleId: 'b' })];
  const act = (id: string, eleveId: string, debut: number, fin = debut) => creer({ id, type: 'eleve', eleveId, date: '2026-10-13', debut, fin });

  it('range les rendez-vous par heure et exclut les annulés', () => {
    const annule = { ...act('x3', 'alpha', 4), etats: { '2026-10-13': 'annule' as const } };
    const j = journeeDu('2026-10-13', [act('x2', 'beta', 3), act('x1', 'alpha', 1), annule], [], eleves, [A, B]);
    assert.deepEqual(j.map((c) => c.occ.activite.id), ['x1', 'x2']);
    assert.equal(j[0]!.heures, '08:50 – 09:40');
    assert.equal(j[0]!.ecole.id, 'a');
  });
  it('joint la suite de la dernière séance à chaque rendez-vous d’élève', () => {
    const s = seance({ date: '2026-10-06', suite: { ...suiteVide, objectif: 'Reprendre la lecture de consignes' } });
    const j = journeeDu('2026-10-13', [act('x1', 'alpha', 1)], [s], eleves, [A, B]);
    assert.equal(j[0]!.suite?.objectif, 'Reprendre la lecture de consignes');
  });
  it('compte comme réalisé un rendez-vous dont la séance est encodée', () => {
    const s = seance({ date: '2026-10-13', periodeDebut: '2e H', periodeFin: '2e H' });
    const j = journeeDu('2026-10-13', [act('x1', 'alpha', 1)], [s], eleves, [A, B]);
    assert.equal(j[0]!.occ.statut, 'realise');
  });
  it('signale un changement d’école trop serré, pas un changement tranquille', () => {
    const j = journeeDu('2026-10-13', [act('x1', 'alpha', 1), act('x2', 'beta', 2)], [], eleves, [A, B]);
    const d = deplacements(j, 30);
    assert.equal(d.length, 1);
    assert.equal(d[0]!.ecart, 0);
    assert.equal(d[0]!.serre, true);
    const loin = journeeDu('2026-10-13', [act('x1', 'alpha', 1), act('x2', 'beta', 4)], [], eleves, [A, B]);
    const d2 = deplacements(loin, 30);
    assert.equal(d2[0]!.ecart, 100);
    assert.equal(d2[0]!.serre, false);
  });
  it('ne signale rien dans une même école', () => {
    const j = journeeDu('2026-10-13', [act('x1', 'alpha', 1), act('x2', 'alpha', 2)], [], eleves, [A, B]);
    assert.equal(deplacements(j, 30).length, 0);
  });
});

describe('séances à encoder', () => {
  const unique = (id: string, date: string, eleveId = 'alpha') => creer({ id, type: 'eleve', eleveId, date, debut: 1, fin: 1 });
  it('liste les rendez-vous passés sans séance, jamais ceux d’aujourd’hui ni de demain', () => {
    const l = aEncoder('2026-10-13', [unique('hier', '2026-10-12'), unique('auj', '2026-10-13'), unique('dem', '2026-10-14')], []);
    assert.deepEqual(l.map((o) => o.activite.id), ['hier']);
  });
  it('écarte ce qui est encodé, annulé, trop ancien ou sans élève', () => {
    const encodee = seance({ date: '2026-10-09', periodeDebut: '2e H', periodeFin: '2e H' });
    const annule = { ...unique('ann', '2026-10-08'), etats: { '2026-10-08': 'annule' as const } };
    const ancien = unique('vieux', '2026-09-01');
    const reunion = creer({ id: 'reu', type: 'collaboration', date: '2026-10-12', debut: 1, fin: 1 });
    const l = aEncoder('2026-10-13', [unique('enc', '2026-10-09'), annule, ancien, reunion], [encodee]);
    assert.deepEqual(l, []);
  });
  it('range du plus ancien au plus récent', () => {
    const l = aEncoder('2026-10-13', [unique('b', '2026-10-12'), unique('a', '2026-10-08')], []);
    assert.deepEqual(l.map((o) => o.activite.id), ['a', 'b']);
  });
});

describe('mémos', () => {
  it('crée, coche, retire et vide', () => {
    const m1 = creerMemo('  Apporter le jeu de cartes  ', { eleveId: 'alpha' }, 'm1', 'now')!;
    const m2 = creerMemo('Appeler la direction', {}, 'm2', 'now')!;
    assert.equal(m1.texte, 'Apporter le jeu de cartes');
    assert.equal(creerMemo('   '), null);
    let liste = basculerMemo([m1, m2], 'm1');
    assert.equal(liste[0]!.fait, true);
    assert.deepEqual(viderFaits(liste).map((m) => m.id), ['m2']);
    liste = retirerMemo(liste, 'm2');
    assert.deepEqual(liste.map((m) => m.id), ['m1']);
  });
  it('un mémo n’est jamais rattaché à un élève et à une école à la fois', () => {
    const m = normaliserMemos([{ id: 'm', texte: 't', eleveId: 'alpha', ecoleId: 'a' }]);
    assert.equal(m[0]!.eleveId, 'alpha');
    assert.equal(m[0]!.ecoleId, undefined);
  });
  it('écarte ce qui est abîmé, les doublons, et coupe les textes trop longs', () => {
    const m = normaliserMemos([null, 3, { id: '', texte: 'x' }, { id: 'a', texte: '' }, { id: 'b', texte: 'ok' }, { id: 'b', texte: 'doublon' }, { id: 'c', texte: 'x'.repeat(500) }]);
    assert.deepEqual(m.map((x) => x.id), ['b', 'c']);
    assert.equal(m[1]!.texte.length, 180);
    assert.deepEqual(normaliserMemos('n’importe quoi'), []);
  });
  it('réapparaît sur le créneau de l’élève ou de l’école, tant qu’il n’est pas fait', () => {
    const memos = [
      creerMemo('élève', { eleveId: 'alpha' }, 'e')!,
      creerMemo('école', { ecoleId: 'a' }, 'c')!,
      creerMemo('libre', {}, 'l')!,
      { ...creerMemo('fait', { eleveId: 'alpha' }, 'f')!, fait: true }
    ];
    assert.deepEqual(memosDuCreneau(memos, 'alpha', 'a').map((m) => m.id), ['e', 'c']);
    assert.deepEqual(memosDuCreneau(memos, 'beta', 'b').map((m) => m.id), []);
    assert.deepEqual(memosDuCreneau(memos, undefined, 'a').map((m) => m.id), ['c']);
  });
  it('sont enregistrés, rechargés et acceptés par la synchronisation', async () => {
    const depot = creerDepotMemoire();
    const magasin = creerMagasin(depot);
    await magasin.charger();
    await magasin.enregistrerMemos([creerMemo('À ne pas oublier', {}, 'm1', 'now')!]);
    const autre = creerMagasin(depot);
    await autre.charger();
    assert.deepEqual(autre.lire().memos.map((m) => m.texte), ['À ne pas oublier']);
    // deux ajouts rapprochés ne s'écrasent pas
    await Promise.all([
      autre.enregistrerMemos([creerMemo('un', {}, 'a1', 'now')!, ...autre.lire().memos]),
      autre.enregistrerMemos([creerMemo('deux', {}, 'a2', 'now')!, ...autre.lire().memos])
    ]);
    assert.deepEqual(autre.lire().memos.map((m) => m.id), ['a2', 'a1', 'm1']);
    const recu = normaliserObjet('reglage', { id: 'memos', valeur: [{ id: 'm9', texte: 'reçu' }, { texte: 'sans identifiant' }] });
    assert.deepEqual(recu, { id: 'memos', valeur: [{ id: 'm9', texte: 'reçu', fait: false, creeLe: '' }] });
    assert.equal(normaliserObjet('reglage', { id: 'memos', valeur: 'abîmé' }), null);
  });
});
