import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { creer } from '../src/domain/agenda/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { creerMagasin } from '../src/state/store.ts';
import { portLocal, portRegistre } from '../src/synchro/adaptateurs.ts';
import { NuageSimule } from '../src/synchro/simule.ts';
import { apercuRepartir, repartirDeOneDrive, synchroniser } from '../src/synchro/synchroniser.ts';
import type { OptionsSynchro } from '../src/synchro/synchroniser.ts';
import { seance } from './fabrique.ts';

const eleve = (id: string, extra: Partial<Eleve> = {}): Eleve => ({ id, nom: `Nom-${id}`, prenom: 'Léa', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [], ...extra });

async function appareil(nuage: NuageSimule, exclureDemo = false) {
  const depot = creerDepotMemoire();
  const magasin = creerMagasin(depot);
  await magasin.charger();
  const options: OptionsSynchro = { nuage, local: portLocal(magasin), registre: portRegistre(depot), compteId: 'compte-1', exclureDemo };
  return { depot, magasin, options, sync: () => synchroniser(options) };
}
type Appareil = Awaited<ReturnType<typeof appareil>>;

const contenus = (n: NuageSimule): string => JSON.stringify(n.resume());

describe('repartir de OneDrive', () => {
  let nuage: NuageSimule;
  let A: Appareil;
  let B: Appareil;

  beforeEach(async () => {
    nuage = new NuageSimule();
    A = await appareil(nuage);
    B = await appareil(nuage);
    await A.magasin.ajouterEleves([eleve('x'), eleve('y')]);
    await A.magasin.enregistrerSeance(seance({ id: 's1', eleveId: 'x' }));
    await A.magasin.enregistrerSeance(seance({ id: 's2', eleveId: 'y' }));
    await A.magasin.changerAgenda({ enregistrer: [creer({ id: 'a1', type: 'eleve', eleveId: 'x', date: '2026-10-26', debut: 0, fin: 0 })], supprimer: [] });
    await A.sync();
  });

  it('un appareil vide reprend tout, puis la synchronisation n’a plus rien à faire', async () => {
    const r = await repartirDeOneDrive(B.options);
    assert.deepEqual(r.nuage, { eleves: 2, seances: 2, activites: 1, pias: 0, reglages: 0 });
    assert.equal(r.ecrits, 5);
    assert.equal(r.retires, 0);
    const e = B.magasin.lire();
    assert.deepEqual([e.eleves.length, e.seances.length, e.activites.length], [2, 2, 1]);
    const s = await B.sync();
    assert.deepEqual([s.envoyes, s.recus, s.supprimesIci, s.supprimesLa, s.conflits.length, s.erreurs.length], [0, 0, 0, 0, 0, 0]);
  });

  it('l’aperçu compte ce qui serait remplacé et ne change rien', async () => {
    await B.magasin.ajouterEleves([eleve('vieux')]);
    await B.magasin.enregistrerSeance(seance({ id: 'sv', eleveId: 'vieux' }));
    const avant = contenus(nuage);
    const a = await apercuRepartir(B.options);
    assert.deepEqual(a.nuage, { eleves: 2, seances: 2, activites: 1, pias: 0, reglages: 0 });
    assert.deepEqual(a.ici, { eleves: 1, seances: 1, activites: 0, pias: 0, reglages: 0 });
    assert.deepEqual([...B.magasin.lire().eleves.map((x) => x.id)], ['vieux']);
    assert.equal(contenus(nuage), avant);
    assert.deepEqual(await B.options.registre.lire(), new Map());
  });

  it('remplace sans fusionner : ce qui n’est pas dans OneDrive disparaît d’ici, ce qui est différent est remplacé', async () => {
    await B.sync(); // B connaît déjà OneDrive
    await B.magasin.ajouterEleves([eleve('vieux')]);
    await B.magasin.enregistrerSeance(seance({ id: 'sv', eleveId: 'vieux' }));
    await B.magasin.enregistrerSeance(seance({ id: 's3', eleveId: 'x' })); // seulement ici, d'un élève qui existe aussi dans OneDrive
    await B.magasin.enregistrerSeance(seance({ id: 's1', eleveId: 'x', matiere: 'Modifiée ici' }));
    const r = await repartirDeOneDrive(B.options);
    const e = B.magasin.lire();
    assert.deepEqual(e.eleves.map((x) => x.id).sort(), ['x', 'y']);
    assert.deepEqual(e.seances.map((x) => x.id).sort(), ['s1', 's2']);
    assert.notEqual(e.seances.find((x) => x.id === 's1')!.matiere, 'Modifiée ici');
    assert.equal(r.retires, 2); // l'élève « vieux » (avec sa séance) et la séance s3
    assert.ok((await B.sync()).envoyes === 0);
  });

  it('ne modifie jamais OneDrive', async () => {
    const avant = contenus(nuage);
    await B.magasin.ajouterEleves([eleve('vieux')]);
    await repartirDeOneDrive(B.options);
    assert.equal(contenus(nuage), avant);
    assert.equal(nuage.resume().fichiers, 5);
  });

  it('OneDrive vide : on s’arrête sans toucher à cet appareil', async () => {
    const vide = new NuageSimule();
    const C = await appareil(vide);
    await C.magasin.ajouterEleves([eleve('local')]);
    await assert.rejects(() => repartirDeOneDrive(C.options), /aucune donnée/);
    assert.deepEqual(C.magasin.lire().eleves.map((x) => x.id), ['local']);
  });

  it('un fichier illisible n’est pas repris et la version d’ici est gardée', async () => {
    await B.sync();
    nuage.modifierSurAutreAppareil('seances', (_c, chemin) => (chemin.includes('s1') ? '{ abîmé' : null));
    const r = await repartirDeOneDrive(B.options);
    assert.equal(r.erreurs.length, 1);
    assert.match(r.erreurs[0]!, /seance:s1/);
    assert.deepEqual(B.magasin.lire().seances.map((x) => x.id).sort(), ['s1', 's2']); // s1 reste telle qu'elle était ici
    assert.equal(r.retires, 0);
  });

  it('un élève illisible dans OneDrive n’est pas retiré d’ici avec ses séances', async () => {
    await B.sync();
    nuage.modifierSurAutreAppareil('eleves', (_c, chemin) => (chemin.includes('x') ? '{ abîmé' : null));
    const r = await repartirDeOneDrive(B.options);
    assert.ok(r.erreurs.some((t) => t.startsWith('eleve:x')));
    assert.ok(B.magasin.lire().eleves.some((x) => x.id === 'x'));
    assert.ok(B.magasin.lire().seances.some((x) => x.id === 's1'));
    assert.ok(r.ignores.some((t) => t.includes('seance:s1'))); // la séance de x dans OneDrive est laissée de côté, pas perdue
  });

  it('les données de démonstration ne sont pas touchées avec un vrai compte', async () => {
    const vrai = await appareil(nuage, true);
    await vrai.magasin.ajouterEleves([eleve('demo-e1')]);
    await vrai.magasin.ajouterEleves([eleve('perso')]);
    await repartirDeOneDrive(vrai.options);
    assert.deepEqual(vrai.magasin.lire().eleves.map((x) => x.id).sort(), ['demo-e1', 'x', 'y']);
  });

  it('interrompu au milieu : la mémoire de synchronisation reste vide, donc rien ne sera écrasé en silence ensuite', async () => {
    await B.magasin.ajouterEleves([eleve('x', { nom: 'Différent ici' })]);
    await B.sync().catch(() => undefined);
    await B.options.registre.vider();
    const casse: OptionsSynchro = { ...B.options, local: { ...B.options.local, appliquer: async () => { throw new Error('panne'); } } };
    await assert.rejects(() => repartirDeOneDrive(casse), /panne/);
    assert.deepEqual(await B.options.registre.lire(), new Map());
    const s = await B.sync();
    assert.deepEqual(s.conflits.map((c) => c.cle), ['eleve:x']); // à décider par l'utilisateur
    assert.equal(B.magasin.lire().eleves.find((x) => x.id === 'x')!.nom, 'Différent ici');
  });
});
