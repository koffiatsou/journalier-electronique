import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { versTexte } from '../src/domain/synchro/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { creerMagasin } from '../src/state/store.ts';
import { portLocal, portRegistre } from '../src/synchro/adaptateurs.ts';
import { adresseTelechargementSure, creerCalendrierGraph, creerNuageGraph } from '../src/synchro/graph.ts';
import { ErreurAcces, ErreurVersion } from '../src/synchro/nuage.ts';
import { synchroniser } from '../src/synchro/synchroniser.ts';
import { FauxMicrosoft } from './fauxMicrosoft.ts';
import { seance } from './fabrique.ts';

const REDIRECTION = 'https://exemple.test/v2/msal-redirect.html';

/** Fait comme la page de connexion puis l'échange du code : renvoie un jeton d'accès valable pour ces droits. */
async function obtenirJeton(faux: FauxMicrosoft, scopes: string[]): Promise<string> {
  const verificateur = 'v'.repeat(50);
  const defi = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificateur))).toString('base64url');
  const retour = new URL(faux.autoriser(`https://login.microsoftonline.com/t/oauth2/v2.0/authorize?${new URLSearchParams({ scope: scopes.join(' '), state: 'e', redirect_uri: REDIRECTION, code_challenge: defi, code_challenge_method: 'S256' })}`));
  const code = new URLSearchParams(retour.hash.slice(1)).get('code')!;
  const r = await faux.fetch('https://login.microsoftonline.com/t/oauth2/v2.0/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECTION, code_verifier: verificateur }).toString() });
  return ((await r.json()) as { access_token: string }).access_token;
}

const eleve = (id: string): Eleve => ({ id, nom: `Nom-${id}`, prenom: 'Léa', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [] });

describe('OneDrive via Graph', () => {
  let faux: FauxMicrosoft;
  let jeton: string;
  let nuage: ReturnType<typeof creerNuageGraph>;
  const attendus: number[] = [];

  beforeEach(async () => {
    faux = new FauxMicrosoft();
    jeton = await obtenirJeton(faux, ['openid', 'profile', 'offline_access', 'Files.ReadWrite.AppFolder']);
    attendus.length = 0;
    nuage = creerNuageGraph({ jeton: { jeton: async () => jeton }, fetchFn: (...a) => faux.fetch(...a), attendre: async (ms) => { attendus.push(ms); } });
  });

  it('un dossier qui n’existe pas encore est vide', async () => {
    assert.deepEqual(await nuage.lister('seances'), []);
  });

  it('crée, relit, remplace avec la bonne version, supprime', async () => {
    const f1 = await nuage.ecrire('seances/a.json', 'un', null);
    assert.equal(await nuage.lire(f1), 'un');
    const f2 = await nuage.ecrire('seances/a.json', 'deux', f1.etag);
    assert.notEqual(f2.etag, f1.etag);
    assert.equal(f2.id, f1.id);
    assert.deepEqual((await nuage.lister('seances')).map((f) => f.chemin), ['seances/a.json']);
    await nuage.supprimer(f2);
    assert.deepEqual(await nuage.lister('seances'), []);
  });

  it('refuse d’écraser : création sur un fichier existant, mauvaise version, fichier disparu', async () => {
    const f = await nuage.ecrire('seances/a.json', 'un', null);
    await assert.rejects(() => nuage.ecrire('seances/a.json', 'autre', null), ErreurVersion);
    await assert.rejects(() => nuage.ecrire('seances/a.json', 'autre', '"{999},1"'), ErreurVersion);
    await assert.rejects(() => nuage.ecrire('seances/absent.json', 'x', '"{1},1"'), ErreurVersion);
    assert.equal(await nuage.lire(f), 'un');
    await assert.rejects(() => nuage.supprimer({ ...f, etag: '"{999},1"' }), ErreurVersion);
    await nuage.supprimer({ chemin: 'seances/zzz.json', id: 'inconnu', etag: '"x"' }); // déjà absent : réussi
  });

  it('lit toutes les pages d’un dossier', async () => {
    faux.taillePage = 2;
    for (let i = 0; i < 5; i += 1) await nuage.ecrire(`seances/f${i}.json`, String(i), null);
    assert.equal((await nuage.lister('seances')).length, 5);
    assert.ok(faux.journal.filter((l) => l.includes('/children')).length >= 3);
  });

  it('ralentit quand Microsoft le demande, puis réussit', async () => {
    faux.pannes = [429, 429];
    await nuage.ecrire('seances/a.json', 'un', null);
    assert.equal(attendus.length, 2);
    faux.pannes = [429, 429, 429, 429];
    await assert.rejects(() => nuage.lister('seances'), (e: unknown) => e instanceof ErreurAcces && e.code === 'inconnue');
  });

  it('dit clairement quand la connexion a expiré, quand le droit manque, quand le réseau est coupé', async () => {
    faux.expirerSessions();
    await assert.rejects(() => nuage.lister('seances'), (e: unknown) => e instanceof ErreurAcces && e.code === 'non-connecte');
    jeton = await obtenirJeton(faux, ['openid']);
    await assert.rejects(() => nuage.lister('seances'), (e: unknown) => e instanceof ErreurAcces && e.code === 'refuse');
    const coupe = creerNuageGraph({ jeton: { jeton: async () => jeton }, fetchFn: async () => { throw new TypeError('Failed to fetch'); } });
    await assert.rejects(() => coupe.lister('seances'), (e: unknown) => e instanceof ErreurAcces && e.code === 'reseau');
  });

  it('n’accepte de télécharger que depuis OneDrive ou SharePoint', () => {
    assert.equal(adresseTelechargementSure('https://contoso.sharepoint.com/x'), true);
    assert.equal(adresseTelechargementSure('https://public.files.1drv.com/y'), true);
    assert.equal(adresseTelechargementSure('http://contoso.sharepoint.com/x'), false);
    assert.equal(adresseTelechargementSure('https://sharepoint.com.pirate.example/x'), false);
    assert.equal(adresseTelechargementSure('https://evil.example/files.1drv.com'), false);
    assert.equal(adresseTelechargementSure('pas une adresse'), false);
  });

  it('synchronise vraiment deux appareils à travers Graph', async () => {
    const creerAppareil = async () => {
      const depot = creerDepotMemoire();
      const magasin = creerMagasin(depot);
      await magasin.charger();
      return { magasin, options: { nuage, local: portLocal(magasin), registre: portRegistre(depot), compteId: 'oid-agent-1', exclureDemo: true } };
    };
    const A = await creerAppareil();
    const B = await creerAppareil();
    await A.magasin.ajouterEleves([eleve('x')]);
    await A.magasin.enregistrerSeance(seance({ id: 's1', eleveId: 'x', matiere: 'Français' }));
    assert.equal((await synchroniser(A.options)).envoyes, 2);
    assert.deepEqual(faux.chemins(), ['eleves/x.json', 'seances/s1.json']);
    assert.equal((await synchroniser(B.options)).recus, 2);
    assert.equal(B.magasin.lire().seances[0]!.matiere, 'Français');
    assert.equal(JSON.parse(faux.fichiers.get('seances/s1.json')!.contenu).schema, 'journalier-v2/1');
  });

  it('ignore ce qui n’a pas été écrit par l’application (autre nom de fichier)', async () => {
    await nuage.ecrire('seances/LISEZ-MOI.txt', 'bonjour', null);
    await nuage.ecrire('seances/Majuscule.json', versTexte('seance', 'x', {}, ''), null);
    const A = creerMagasin(creerDepotMemoire());
    await A.charger();
    const r = await synchroniser({ nuage, local: portLocal(A), registre: portRegistre(creerDepotMemoire()), compteId: 'c', exclureDemo: true });
    assert.deepEqual([r.erreurs.length, r.recus], [0, 0]);
  });
});

describe('Outlook via Graph', () => {
  let faux: FauxMicrosoft;
  const creerCal = async (scopes = ['openid', 'Calendars.ReadWrite']) => {
    faux = new FauxMicrosoft();
    const jeton = await obtenirJeton(faux, scopes);
    return creerCalendrierGraph({ jeton: { jeton: async () => jeton }, fetchFn: (...a) => faux.fetch(...a), attendre: async () => undefined });
  };
  const e = (cle: string, sujet = 'Accompagnement', debut = '2026-10-26T08:00') => ({ cle, sujet, debut, fin: debut.replace('08:00', '08:50'), lieu: 'Local 3' });

  it('crée le calendrier une seule fois', async () => {
    const cal = await creerCal();
    const id = await cal.trouverOuCreer('Journalier');
    assert.equal(await cal.trouverOuCreer('Journalier'), id);
    assert.equal(faux.calendriers.size, 1);
  });

  it('crée, retrouve par le repère, corrige, supprime', async () => {
    const cal = await creerCal();
    const id = await cal.trouverOuCreer('Journalier');
    await cal.creer(id, e('a1@2026-10-26'));
    await cal.creer(id, e('a2@2026-10-27', 'Autre', '2026-10-27T08:00'));
    const liste = await cal.evenements(id, '2026-10-26', '2026-10-30');
    assert.deepEqual(liste.map((x) => [x.cle, x.sujet, x.debut, x.fin, x.lieu]), [['a1@2026-10-26', 'Accompagnement', '2026-10-26T08:00', '2026-10-26T08:50', 'Local 3'], ['a2@2026-10-27', 'Autre', '2026-10-27T08:00', '2026-10-27T08:50', 'Local 3']]);
    await cal.modifier(id, liste[0]!.id, e('a1@2026-10-26', 'Corrigé'));
    assert.equal((await cal.evenements(id, '2026-10-26', '2026-10-26'))[0]!.sujet, 'Corrigé');
    await cal.supprimerEvenement(id, liste[1]!.id);
    await cal.supprimerEvenement(id, liste[1]!.id); // déjà supprimé : réussi
    assert.equal((await cal.evenements(id, '2026-10-01', '2026-10-31')).length, 1);
    await cal.supprimerCalendrier(id);
    assert.equal(faux.calendriers.size, 0);
  });

  it('ne rend que les dates demandées', async () => {
    const cal = await creerCal();
    const id = await cal.trouverOuCreer('Journalier');
    await cal.creer(id, e('a@1', 'Hier', '2026-10-25T08:00'));
    await cal.creer(id, e('b@1', 'Pile', '2026-10-26T08:00'));
    await cal.creer(id, e('c@1', 'Demain', '2026-10-28T08:00'));
    assert.deepEqual((await cal.evenements(id, '2026-10-26', '2026-10-27')).map((x) => x.sujet), ['Pile']);
  });

  it('signale que l’autorisation Outlook manque', async () => {
    const cal = await creerCal(['openid', 'Files.ReadWrite.AppFolder']);
    await assert.rejects(() => cal.trouverOuCreer('Journalier'), (er: unknown) => er instanceof ErreurAcces && er.code === 'consentement');
  });
});
