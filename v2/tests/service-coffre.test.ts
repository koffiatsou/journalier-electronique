import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exempleDemo } from '../src/data/demo.ts';
import { ouvrirCoffre } from '../src/data/depot-chiffre.ts';
import { creerStockageBrutMemoire } from '../src/data/stockage-brut.ts';
import { creerMagasin } from '../src/state/store.ts';
import { Connexion, aleatoire } from '../src/synchro/connexion.ts';
import type { Stockage } from '../src/synchro/connexion.ts';
import { NuageSimule } from '../src/synchro/simule.ts';
import { CLE_MODE_SYNCHRO, creerSynchro } from '../src/synchro/service.ts';

const JOUR = '2026-10-26';
const memoire = (): Stockage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } }; };
const connexionInutile = () => new Connexion({
  config: { clientId: 'c', tenantId: 't', adresseRetour: 'https://exemple.test/v2/msal-redirect.html' }, stockage: memoire(),
  fetchFn: async () => { throw new Error('aucun appel réseau attendu'); }, ecouterRetour: () => () => undefined, ouvrirFenetre: () => null
});

/** Un vrai coffre chiffré (en mémoire) rempli avec l'exemple fictif, relié à un magasin et à la synchronisation. */
async function monter(options: { autoriserMicrosoft?: boolean; preferences?: Stockage } = {}) {
  const brut = creerStockageBrutMemoire();
  const ouverture = await ouvrirCoffre(brut, 'c0123456789abcdef');
  assert.ok(ouverture.ok);
  const depot = ouverture.depot;
  const magasin = creerMagasin(depot);
  await magasin.charger();
  await magasin.chargerExemple(exempleDemo(JOUR));
  const demo = new NuageSimule(null, () => JOUR);
  const synchro = creerSynchro({
    magasin, depot, connexion: connexionInutile(), demo, preferences: options.preferences ?? memoire(),
    aujourdhui: () => JOUR, maintenant: () => `${JOUR}T10:00:00.000Z`, delaiAutoMs: 20, ...(options.autoriserMicrosoft === undefined ? {} : { autoriserMicrosoft: options.autoriserMicrosoft })
  });
  await synchro.demarrer();
  return { brut, depot, magasin, synchro, demo };
}

describe('mode essai : jamais relié à un vrai compte Microsoft', () => {
  it('annonce que Microsoft n’est pas possible, et refuse de se connecter', async () => {
    const { synchro } = await monter({ autoriserMicrosoft: false });
    assert.equal(synchro.lire().microsoftPossible, false);
    await synchro.connecter();
    assert.equal(synchro.lire().mode, 'aucun');
    assert.equal(synchro.lire().message?.genre, 'erreur');
    assert.match(synchro.lire().message?.texte ?? '', /mode essai/);
  });

  it('ignore un réglage « microsoft » resté d’un autre usage de l’appareil', async () => {
    const prefs = memoire();
    prefs.setItem(CLE_MODE_SYNCHRO, 'microsoft');
    assert.equal((await monter({ autoriserMicrosoft: false, preferences: prefs })).synchro.lire().mode, 'aucun');
    assert.equal((await monter({ preferences: prefs })).synchro.lire().mode, 'microsoft', 'avec un compte, le réglage est gardé');
  });

  it('peut toujours essayer la démonstration (faux OneDrive)', async () => {
    const { synchro, demo } = await monter({ autoriserMicrosoft: false });
    synchro.utiliserDemonstration();
    await synchro.synchroniser();
    assert.ok(demo.resume().fichiers > 10);
  });
});

describe('éléments illisibles : la synchronisation attend', () => {
  it('ne supprime rien dans OneDrive à cause d’un élément illisible, tant qu’on ne l’a pas écarté', async () => {
    const { synchro, demo, magasin, depot, brut } = await monter();
    synchro.utiliserDemonstration();
    await synchro.synchroniser();
    const nuageAvant = demo.resume().fichiers;
    assert.ok(nuageAvant > 10);

    // Une séance s'abîme sur cet appareil.
    const abimee = brut.rangees('seances')[0]!;
    brut.remplacer('seances', { ...abimee, c: abimee.c.slice(0, -6) });
    await magasin.charger();
    assert.equal(magasin.lire().illisibles, 1);
    assert.equal(depot.illisibles().length, 1);

    await synchro.synchroniser();
    assert.equal(synchro.lire().message?.genre, 'erreur');
    assert.match(synchro.lire().message?.texte ?? '', /en pause/);
    assert.equal(synchro.lire().illisibles, 1);
    assert.equal(demo.resume().fichiers, nuageAvant, 'OneDrive n’a rien perdu');

    // On l'écarte : la synchronisation la reçoit de nouveau depuis OneDrive.
    assert.equal(await synchro.ecarterIllisibles(), 1);
    assert.equal(synchro.lire().illisibles, 0);
    assert.equal(magasin.lire().illisibles, 0);
    await synchro.synchroniser();
    assert.equal(synchro.lire().derniere?.recus, 1, 'la séance revient depuis OneDrive');
    assert.equal(demo.resume().fichiers, nuageAvant);
    assert.equal(magasin.lire().seances.length, exempleDemo(JOUR).seances.length);
    assert.equal(depot.illisibles().length, 0);
  });

  it('l’envoi automatique et Outlook restent aussi en pause', async () => {
    const { synchro, demo, magasin, brut } = await monter();
    synchro.utiliserDemonstration();
    const abimee = brut.rangees('activites')[0]!;
    brut.remplacer('activites', { ...abimee, c: 'j2c1.xx.yy' });
    await magasin.charger();
    await magasin.enregistrerSeance({ ...exempleDemo(JOUR).seances[0]!, remarque: 'modifiée' });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(demo.resume().fichiers, 0, 'aucun envoi automatique');
    await synchro.activerOutlook();
    assert.equal(demo.resume().evenements, 0, 'rien n’est envoyé vers Outlook');
  });
});

describe('verrouillage', () => {
  it('après arreter(), plus rien ne se lance : ni envoi automatique ni synchronisation', async () => {
    const { synchro, demo, magasin } = await monter();
    synchro.utiliserDemonstration();
    await magasin.enregistrerSeance({ ...exempleDemo(JOUR).seances[0]!, remarque: 'modifiée avant le verrouillage' });
    synchro.arreter();
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(demo.resume().fichiers, 0);
    await synchro.synchroniser();
    assert.equal(demo.resume().fichiers, 0);
  });

  it('les identifiants aléatoires de la connexion restent utilisables (rien n’a bougé)', () => {
    assert.notEqual(aleatoire(), aleatoire());
  });
});
