import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exempleDemo } from '../src/data/demo.ts';
import { creerDepotChiffre, ouvrirCoffre } from '../src/data/depot-chiffre.ts';
import { migrerVersCoffre } from '../src/data/migration.ts';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { creerStockageBrutMemoire } from '../src/data/stockage-brut.ts';
import { nouvelleCle } from '../src/domain/coffre/index.ts';
import { creerMagasin } from '../src/state/store.ts';
import type { Depot } from '../src/data/repository.ts';
import { portRegistre } from '../src/synchro/adaptateurs.ts';

const JOUR = '2026-10-26';
const PROP = 'c0123456789abcdef';

async function ouvert(brut = creerStockageBrutMemoire(), proprietaire = PROP) {
  const r = await ouvrirCoffre(brut, proprietaire);
  assert.ok(r.ok);
  return { brut, depot: r.depot, nouveau: r.nouveau };
}

async function remplir(depot: Depot) {
  const ex = exempleDemo(JOUR);
  for (const e of ex.eleves) await depot.enregistrerEleve(e);
  for (const s of ex.seances) await depot.enregistrerSeance(s);
  for (const a of ex.activites) await depot.enregistrerActivite(a);
  for (const p of ex.pias) await depot.enregistrerPia(p);
  await depot.enregistrerReglage({ id: 'agenda-horaires', valeur: [{ nom: '1e H', debut: '08:30', fin: '09:20' }] });
  return ex;
}

describe('dépôt chiffré', () => {
  it('rend ce qu’on y a rangé', async () => {
    const { depot } = await ouvert();
    const ex = await remplir(depot);
    assert.deepEqual((await depot.chargerEleves()).map((e) => e.id).sort(), ex.eleves.map((e) => e.id).sort());
    assert.equal((await depot.chargerSeances()).length, ex.seances.length);
    assert.equal((await depot.chargerActivites()).length, ex.activites.length);
    assert.equal((await depot.chargerPias()).length, ex.pias.length);
    assert.deepEqual(await depot.chargerReglages(), [{ id: 'agenda-horaires', valeur: [{ nom: '1e H', debut: '08:30', fin: '09:20' }] }]);
    const s = ex.seances[0]!;
    assert.deepEqual((await depot.chargerSeances()).find((x) => x.id === s.id), s);
  });

  it('ne laisse aucun texte de l’utilisateur lisible dans la base', async () => {
    const { depot, brut } = await ouvert();
    const ex = await remplir(depot);
    const tout = JSON.stringify(['eleves', 'seances', 'activites', 'pia', 'reglages', 'meta'].map((t) => brut.rangees(t as 'eleves')));
    const secrets = [ex.eleves[0]!.nom, ex.eleves[0]!.prenom, ex.seances[0]!.objectifLecon, ex.seances[0]!.remarque, ex.seances[0]!.observations[0]?.texte, '08:30'].filter((x): x is string => !!x && x.length > 3);
    assert.ok(secrets.length >= 4);
    for (const s of secrets) assert.ok(!tout.includes(s), `« ${s} » est lisible dans la base`);
  });

  it('ne garde en clair que des identifiants (id, lien) et le texte chiffré', async () => {
    const { depot, brut } = await ouvert();
    await remplir(depot);
    for (const t of ['eleves', 'seances', 'activites', 'pia', 'reglages'] as const) {
      for (const r of brut.rangees(t)) assert.deepEqual(Object.keys(r).filter((k) => k !== 'id' && k !== 'lien' && k !== 'c'), []);
    }
    assert.ok(brut.rangees('seances').every((r) => typeof r.lien === 'string'));
    assert.ok(brut.rangees('eleves').every((r) => r.lien === undefined));
  });

  it('supprime un élève avec tout ce qui le concerne, et seulement lui', async () => {
    const { depot } = await ouvert();
    const ex = await remplir(depot);
    const id = ex.eleves[0]!.id;
    const autre = ex.eleves[1]!.id;
    await depot.supprimerEleve(id);
    assert.ok(!(await depot.chargerEleves()).some((e) => e.id === id));
    assert.ok(!(await depot.chargerSeances()).some((s) => s.eleveId === id));
    assert.ok(!(await depot.chargerActivites()).some((a) => a.eleveId === id));
    assert.ok(!(await depot.chargerPias()).some((p) => p.eleveId === id));
    assert.ok((await depot.chargerSeances()).some((s) => s.eleveId === autre));
  });

  it('met de côté une rangée abîmée sans empêcher de lire les autres', async () => {
    const { depot, brut } = await ouvert();
    const ex = await remplir(depot);
    const abimee = brut.rangees('seances')[0]!;
    brut.remplacer('seances', { ...abimee, c: abimee.c.slice(0, -4) });
    const lues = await depot.chargerSeances();
    assert.equal(lues.length, ex.seances.length - 1);
    assert.deepEqual(depot.illisibles(), [{ type: 'seance', id: abimee.id }]);
    assert.equal((await depot.chargerEleves()).length, ex.eleves.length);
  });

  it('refuse une rangée recopiée sous un autre identifiant', async () => {
    const { depot, brut } = await ouvert();
    await remplir(depot);
    const [a, b] = brut.rangees('seances');
    brut.remplacer('seances', { ...b!, c: a!.c });
    await depot.chargerSeances();
    assert.deepEqual(depot.illisibles().map((x) => x.id), [b!.id]);
  });

  it('une rangée réécrite n’est plus illisible', async () => {
    const { depot, brut } = await ouvert();
    const ex = await remplir(depot);
    const abimee = brut.rangees('seances')[0]!;
    brut.remplacer('seances', { ...abimee, c: 'j2c1.xx.yy' });
    await depot.chargerSeances();
    assert.equal(depot.illisibles().length, 1);
    await depot.enregistrerSeance(ex.seances.find((s) => s.id === abimee.id)!);
    assert.equal(depot.illisibles().length, 0);
    assert.equal((await depot.chargerSeances()).length, ex.seances.length);
  });

  it('écarter les illisibles les retire aussi du registre de synchro (sinon OneDrive les perdrait)', async () => {
    const { depot, brut } = await ouvert();
    await remplir(depot);
    const abimee = brut.rangees('seances')[0]!;
    await depot.enregistrerSynchro([{ cle: `seance:${abimee.id}`, empreinte: 'e', etag: 'x' }, { cle: 'seance:autre', empreinte: 'e', etag: 'x' }]);
    brut.remplacer('seances', { ...abimee, c: 'j2c1.xx.yy' });
    await depot.chargerSeances();
    assert.equal(await depot.ecarterIllisibles(), 1);
    assert.equal(depot.illisibles().length, 0);
    assert.ok(!brut.rangees('seances').some((r) => r.id === abimee.id));
    assert.deepEqual((await depot.chargerSynchro()).map((x) => x.cle), ['seance:autre']);
  });

  it('range le registre de synchronisation en clair mais ne le mélange pas aux données', async () => {
    const { depot } = await ouvert();
    await depot.enregistrerSynchro([{ cle: 'eleve:a', empreinte: 'e1', etag: 't1' }]);
    assert.deepEqual(await depot.chargerSynchro(), [{ cle: 'eleve:a', empreinte: 'e1', etag: 't1' }]);
    await depot.viderSynchro();
    assert.deepEqual(await depot.chargerSynchro(), []);
  });

  it('range le faux OneDrive de la démonstration chiffré, et le rend', async () => {
    const { depot, brut } = await ouvert();
    assert.equal(await depot.chargerNuageDemo(), null);
    await depot.enregistrerNuageDemo('{"fichiers":{"x":"Élève Dupont"}}');
    assert.equal(await depot.chargerNuageDemo(), '{"fichiers":{"x":"Élève Dupont"}}');
    assert.ok(!JSON.stringify(brut.rangees('meta')).includes('Dupont'));
    await depot.enregistrerNuageDemo(null);
    assert.equal(await depot.chargerNuageDemo(), null);
  });

  it('le registre de synchro d’un espace n’apparaît pas dans les objets à envoyer', async () => {
    const { depot } = await ouvert();
    const magasin = creerMagasin(depot);
    await magasin.charger();
    await portRegistre(depot).definirCompte('compte-1');
    assert.equal(await portRegistre(depot).compte(), 'compte-1');
    assert.equal((await magasin.lireObjets()).reglages.length, 0);
  });
});

describe('ouverture du coffre', () => {
  it('crée la clé à la première ouverture, la retrouve ensuite', async () => {
    const brut = creerStockageBrutMemoire();
    const premier = await ouvert(brut);
    assert.equal(premier.nouveau, true);
    await remplir(premier.depot);
    const second = await ouvert(brut);
    assert.equal(second.nouveau, false);
    assert.equal((await second.depot.chargerSeances()).length, exempleDemo(JOUR).seances.length);
  });

  it('dit « clé perdue » quand les données sont là mais pas la clé, sans rien effacer', async () => {
    const brut = creerStockageBrutMemoire();
    await remplir((await ouvert(brut)).depot);
    const avant = JSON.stringify(brut.rangees('seances'));
    const sansCle = { ...brut, lireCle: async () => null };
    const r = await ouvrirCoffre(sansCle, PROP);
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.raison, 'cle-perdue');
    assert.equal(JSON.stringify(brut.rangees('seances')), avant);
  });

  it('dit « clé perdue » quand la clé ne correspond plus aux données', async () => {
    const brut = creerStockageBrutMemoire();
    await remplir((await ouvert(brut)).depot);
    const autreCle = await nouvelleCle();
    const r = await ouvrirCoffre({ ...brut, lireCle: async () => autreCle }, PROP);
    assert.equal(!r.ok && r.raison, 'cle-perdue');
  });

  it('refuse d’ouvrir l’espace d’un autre propriétaire avec la même clé', async () => {
    const brut = creerStockageBrutMemoire();
    await remplir((await ouvert(brut)).depot);
    const r = await ouvrirCoffre(brut, 'cffffffffffffffff');
    assert.equal(r.ok, false);
  });

  it('reprend une création interrompue après l’écriture de la clé', async () => {
    const brut = creerStockageBrutMemoire();
    await brut.ecrireCle(await nouvelleCle());
    const r = await ouvrirCoffre(brut, PROP);
    assert.ok(r.ok && !r.nouveau);
  });

  it('un espace de test est utilisable directement avec creerDepotChiffre', async () => {
    const depot = creerDepotChiffre(creerStockageBrutMemoire(), await nouvelleCle(), PROP);
    await depot.enregistrerEleve(exempleDemo(JOUR).eleves[0]!);
    assert.equal((await depot.chargerEleves()).length, 1);
  });
});

describe('migration des anciennes données', () => {
  async function ancien() {
    const ex = exempleDemo(JOUR);
    const source = creerDepotMemoire(ex.eleves, ex.seances, ex.activites, ex.pias, [{ id: 'agenda-horaires', valeur: [] }]);
    await source.enregistrerSynchro([{ cle: 'eleve:x', empreinte: 'e', etag: 't' }, { cle: '#compte', empreinte: '', etag: 'compte-1' }]);
    return { ex, source };
  }

  it('chiffre tout, vérifie, et le dit', async () => {
    const { ex, source } = await ancien();
    const { depot, brut } = await ouvert();
    const bilan = await migrerVersCoffre(source, depot);
    assert.equal(bilan.statut, 'migre');
    assert.deepEqual([bilan.eleves, bilan.seances, bilan.activites, bilan.pias], [ex.eleves.length, ex.seances.length, ex.activites.length, ex.pias.length]);
    assert.equal((await depot.chargerSeances()).length, ex.seances.length);
    assert.deepEqual((await depot.chargerSynchro()).map((x) => x.cle).sort(), ['#compte', 'eleve:x']);
    assert.ok(!JSON.stringify(brut.rangees('seances')).includes(ex.seances[0]!.objectifLecon));
    assert.equal(depot.illisibles().length, 0);
  });

  it('ne fait rien quand l’ancienne base est vide', async () => {
    const { depot } = await ouvert();
    assert.equal((await migrerVersCoffre(creerDepotMemoire(), depot)).statut, 'rien');
  });

  it('ne mélange pas avec des données chiffrées différentes déjà présentes', async () => {
    const { source } = await ancien();
    const { depot } = await ouvert();
    await depot.enregistrerEleve({ ...exempleDemo(JOUR).eleves[0]!, id: 'autre', nom: 'Autre' });
    assert.equal((await migrerVersCoffre(source, depot)).statut, 'reporte');
    assert.equal((await depot.chargerEleves()).length, 1);
  });

  it('reconnaît une migration déjà faite (suppression de l’ancienne base restée en suspens)', async () => {
    const { source } = await ancien();
    const { depot } = await ouvert();
    assert.equal((await migrerVersCoffre(source, depot)).statut, 'migre');
    assert.equal((await migrerVersCoffre(source, depot)).statut, 'migre');
    assert.equal((await depot.chargerEleves()).length, exempleDemo(JOUR).eleves.length);
  });

  it('échoue, sans rien promettre, si la copie ne se relit pas à l’identique', async () => {
    const { source } = await ancien();
    const { depot } = await ouvert();
    const menteur: Depot = { ...depot, chargerSeances: async () => (await depot.chargerSeances()).map((s, i) => (i === 0 ? { ...s, remarque: 'modifiée en route' } : s)) };
    const bilan = await migrerVersCoffre(source, menteur);
    assert.equal(bilan.statut, 'echec');
    assert.match(bilan.message, /vérification a échoué/);
    assert.match(bilan.message, /pas été touchées/);
    assert.equal(bilan.aReinitialiser, true, 'le coffre a reçu des écritures : il faut le remettre à zéro');
  });

  it('échoue si l’écriture plante en cours de route', async () => {
    const { source } = await ancien();
    const { depot } = await ouvert();
    let n = 0;
    const fragile: Depot = { ...depot, enregistrerSeance: async (s) => { n += 1; if (n === 3) throw new Error('disque plein'); await depot.enregistrerSeance(s); } };
    const bilan = await migrerVersCoffre(source, fragile);
    assert.equal(bilan.statut, 'echec');
    assert.match(bilan.message, /disque plein/);
    assert.equal(bilan.aReinitialiser, true);
  });

  it('échoue proprement si l’ancienne base ne se lit pas', async () => {
    const { depot } = await ouvert();
    const cassee = { ...creerDepotMemoire(), chargerEleves: async () => { throw new Error('base illisible'); } };
    const bilan = await migrerVersCoffre(cassee, depot);
    assert.equal(bilan.statut, 'echec');
    assert.match(bilan.message, /base illisible/);
    assert.equal(bilan.aReinitialiser, undefined, 'rien n’a été écrit : on ne touche pas au coffre');
  });
});
