import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { lireOneDriveV75, preparerReprise } from '../src/domain/v75/index.ts';
import { creerLecteurV75Graph } from '../src/synchro/graph.ts';
import { ErreurAcces } from '../src/synchro/nuage.ts';
import { FauxMicrosoft } from './fauxMicrosoft.ts';
import { deposerEtatV75, etatV75 } from './fabrique-v75.ts';

const REDIRECTION = 'https://exemple.test/v2/msal-redirect.html';
const CTX = { aujourdhui: '2026-10-26', maintenant: '2026-10-26T12:00:00.000Z' };

async function obtenirJeton(faux: FauxMicrosoft, scopes: string[]): Promise<string> {
  const verificateur = 'v'.repeat(50);
  const defi = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificateur))).toString('base64url');
  const retour = new URL(faux.autoriser(`https://login.microsoftonline.com/t/oauth2/v2.0/authorize?${new URLSearchParams({ scope: scopes.join(' '), state: 'e', redirect_uri: REDIRECTION, code_challenge: defi, code_challenge_method: 'S256', response_type: 'code' })}`));
  const code = new URLSearchParams(retour.hash.slice(1)).get('code')!;
  const r = await faux.fetch('https://login.microsoftonline.com/t/oauth2/v2.0/token', { method: 'POST', body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECTION, code_verifier: verificateur }) });
  return ((await r.json()) as { access_token: string }).access_token;
}

/** Résumé comparable d'une reprise : qui, quelles séances, quels rendez-vous, ce qui est écarté. */
const resume = (etat: Parameters<typeof preparerReprise>[0]) => {
  const r = preparerReprise(etat, CTX);
  return {
    fiches: r.fiches.map((f) => ({ id: f.eleve.id, nom: f.eleve.nom, seances: f.seances.map((s) => s.seance.id).sort(), activites: f.activites.map((a) => a.activite.id).sort(), pia: f.pia.texte, ecarts: f.ecarts.length })).sort((a, b) => a.id.localeCompare(b.id)),
    agendaGeneral: r.agendaGeneral.map((a) => a.activite.id).sort(),
    ecarts: r.ecarts.map((e) => `${e.quoi}|${e.raison}`).sort(),
    horaires: r.horaires
  };
};

describe('Reprise depuis le OneDrive de la V75', () => {
  let faux: FauxMicrosoft;
  let lecteur: ReturnType<typeof creerLecteurV75Graph>;
  const lecteurAvec = async (scopes = ['openid', 'profile', 'offline_access', 'Files.ReadWrite.AppFolder']) => {
    const jeton = await obtenirJeton(faux, scopes);
    return creerLecteurV75Graph({ jeton: { jeton: async () => jeton }, fetchFn: (...a) => faux.fetch(...a), attendre: async () => undefined });
  };

  beforeEach(async () => {
    faux = new FauxMicrosoft();
    lecteur = await lecteurAvec();
  });

  it('lit ce que la V75 a envoyé et donne la même reprise que la lecture du coffre local', async () => {
    deposerEtatV75(faux, etatV75());
    const lu = await lireOneDriveV75(lecteur);
    assert.equal(lu.trouve, true);
    assert.deepEqual(lu.illisibles, []);
    assert.deepEqual(resume(lu.etat), resume(etatV75()));
    assert.equal(lu.etat.eleves.length, 2);
    assert.ok(lu.etat.seances.length >= 5);
    assert.ok(lu.etat.pias['1001']);
  });

  it('ne fait que des lectures : aucune écriture, aucune suppression', async () => {
    deposerEtatV75(faux, etatV75());
    const avant = new Map([...faux.fichiersV75].map(([c, f]) => [c, `${f.etag}|${f.contenu}`]));
    await lireOneDriveV75(lecteur);
    assert.ok(faux.journal.length > 5);
    assert.ok(faux.journal.every((l) => l.startsWith('GET ')), faux.journal.filter((l) => !l.startsWith('GET ')).join(', '));
    assert.deepEqual(new Map([...faux.fichiersV75].map(([c, f]) => [c, `${f.etag}|${f.contenu}`])), avant);
    assert.deepEqual(faux.chemins(), []); // rien n'est créé dans le dossier de la V2
  });

  it('dit simplement qu’il n’y a rien quand la V75 n’a jamais envoyé de données', async () => {
    const lu = await lireOneDriveV75(lecteur);
    assert.equal(lu.trouve, false);
    assert.equal(lu.etat.eleves.length, 0);
    assert.deepEqual(faux.chemins(), []);
  });

  it('un fichier abîmé est signalé, les autres sont lus', async () => {
    deposerEtatV75(faux, etatV75());
    faux.deposerV75('eleves/1001/seances/5001.json', '{ pas du json');
    faux.deposerV75('pia/1001/pia.json', 'xxx');
    const lu = await lireOneDriveV75(lecteur);
    assert.deepEqual(lu.illisibles.map((x) => x.quoi), ['PIA (1001)', 'Séance (1001/5001.json)']);
    assert.ok(lu.illisibles.every((x) => /abîmé/.test(x.raison)));
    assert.equal(lu.etat.eleves.length, 2);
    assert.ok(!lu.etat.seances.some((s) => (s as { id: unknown }).id === 5001));
    assert.ok(lu.etat.seances.some((s) => (s as { id: unknown }).id === 'sess_abc'));
  });

  it('lit toutes les pages d’une liste longue', async () => {
    deposerEtatV75(faux, etatV75());
    for (let i = 0; i < 12; i += 1) faux.deposerV75(`eleves/1002/seances/extra-${i}.json`, { id: `extra-${i}`, type: 'SEANCE', identification: { eleve: 'Nicoleta', eleveId: 'student_1002', date: '2026-09-30', periode: { start: '1e H', end: '1e H' } } });
    faux.taillePage = 3;
    const lu = await lireOneDriveV75(lecteur);
    assert.equal(lu.etat.seances.filter((s) => String((s as { id: unknown }).id).startsWith('extra-')).length, 12);
  });

  it('un nom de dossier avec espace ou accent se lit correctement', async () => {
    faux.deposerV75('eleves/élève 7/profil.json', { studentId: 'élève 7', nom: 'Zoé', classe: '2A', matieres: [] });
    faux.deposerV75('eleves/élève 7/seances/s1.json', { id: 's1', type: 'SEANCE', identification: { eleve: 'Zoé', eleveId: 'élève 7', date: '2026-09-22', periode: { start: '1e H', end: '1e H' } }, contexte: { matiere: 'Français', presenceStatus: 'present' } });
    const lu = await lireOneDriveV75(lecteur);
    assert.equal(lu.etat.eleves.length, 1);
    assert.equal(lu.etat.seances.length, 1);
    assert.equal(preparerReprise(lu.etat, CTX).fiches[0]?.seances.length, 1);
  });

  it('à défaut d’identifiant dans le profil, le nom du dossier en tient lieu (comme la V75)', async () => {
    faux.deposerV75('eleves/abc/profil.json', { nom: 'Léo', classe: '1A' });
    const lu = await lireOneDriveV75(lecteur);
    assert.equal((lu.etat.eleves[0] as { studentId: string }).studentId, 'abc');
  });

  it('une session Microsoft expirée arrête tout avec un message clair (jamais un résultat incomplet)', async () => {
    deposerEtatV75(faux, etatV75());
    faux.pannes = [401];
    await assert.rejects(() => lireOneDriveV75(lecteur), (e: unknown) => e instanceof ErreurAcces && e.code === 'non-connecte');
  });

  it('un droit refusé arrête tout', async () => {
    deposerEtatV75(faux, etatV75());
    const sansDroit = await lecteurAvec(['openid', 'profile', 'offline_access']);
    await assert.rejects(() => lireOneDriveV75(sansDroit), (e: unknown) => e instanceof ErreurAcces && e.code === 'refuse');
  });
});
