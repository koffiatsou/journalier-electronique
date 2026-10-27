import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creer } from '../src/domain/agenda/index.ts';
import { construireCopie, lireCopie, lireEnveloppe, normaliserObjet, versTexte } from '../src/domain/synchro/index.ts';
import { Connexion, lireCompte } from '../src/synchro/connexion.ts';
import type { ConfigMicrosoft, Stockage } from '../src/synchro/connexion.ts';
import { creerCalendrierGraph, creerNuageGraph } from '../src/synchro/graph.ts';
import { ErreurAcces } from '../src/synchro/nuage.ts';
import { schemaReponseJeton } from '../src/synchro/schemas-microsoft.ts';
import { seance } from './fabrique.ts';

/*
 * Lot Q : les schémas de vérification. Ces tests protègent deux choses à la fois :
 *  - ce qui est abîmé est refusé avec le MÊME message qu'avant le lot Q ;
 *  - ce qui était lisible reste lisible (champs en plus, champs facultatifs absents, valeurs `null` de Microsoft).
 */

const enveloppe = (surcharge: Record<string, unknown>) => JSON.stringify({ schema: 'journalier-v2/1', type: 'seance', id: 'x', enregistreLe: '2026-10-27T10:00:00.000Z', donnees: {}, ...surcharge });
const sans = (cle: string): string => { const o = JSON.parse(enveloppe({})) as Record<string, unknown>; delete o[cle]; return JSON.stringify(o); };
const erreur = (r: { ok: boolean; erreur?: string }): string => (r.ok ? '' : r.erreur ?? '');

describe('schéma : fichier OneDrive (enveloppe)', () => {
  it('garde les messages d’erreur, dans le même ordre qu’avant', () => {
    assert.equal(erreur(lireEnveloppe('pas du json')), 'Fichier illisible (ce n’est pas du JSON).');
    assert.equal(erreur(lireEnveloppe('"texte"')), 'Fichier inattendu.');
    assert.equal(erreur(lireEnveloppe('null')), 'Fichier inattendu.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ schema: 'autre/1' }))), 'Ce fichier n’a pas été écrit par le Journalier V2.');
    assert.equal(erreur(lireEnveloppe(sans('schema'))), 'Ce fichier n’a pas été écrit par le Journalier V2.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ schema: 12 }))), 'Ce fichier n’a pas été écrit par le Journalier V2.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ schema: 'journalier-v2/2' }))), 'Ce fichier vient d’une version plus récente de l’application : mettez-la à jour.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ type: 'chose' }))), 'Type d’objet inconnu.');
    assert.equal(erreur(lireEnveloppe(sans('type'))), 'Type d’objet inconnu.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ id: '' }))), 'Identifiant manquant.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ id: 5 }))), 'Identifiant manquant.');
    assert.equal(erreur(lireEnveloppe(sans('donnees'))), 'Contenu manquant.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ donnees: null }))), 'Contenu manquant.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ donnees: 'texte' }))), 'Contenu manquant.');
    assert.equal(erreur(lireEnveloppe(`{"a":"${'x'.repeat(5_000_001)}"}`)), 'Fichier trop volumineux.');
  });
  it('si deux choses vont mal, le message est celui de la première (comme avant)', () => {
    assert.equal(erreur(lireEnveloppe(enveloppe({ schema: 'autre/1', type: 'chose', id: '' }))), 'Ce fichier n’a pas été écrit par le Journalier V2.');
    assert.equal(erreur(lireEnveloppe(enveloppe({ type: 'chose', id: '' }))), 'Type d’objet inconnu.');
  });
  it('accepte un fichier sans date d’écriture et garde le contenu tel quel', () => {
    const r = lireEnveloppe(sans('enregistreLe'));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.enveloppe.enregistreLe, '');
    const plein = lireEnveloppe(versTexte('seance', 's1', { a: 1, imbrique: { b: [1, 2] } }, '2026-10-27T10:00:00.000Z'));
    assert.equal(plein.ok, true);
    if (plein.ok) assert.deepEqual(plein.enveloppe.donnees, { a: 1, imbrique: { b: [1, 2] } });
  });
});

describe('schéma : copie de secours', () => {
  const copie = (surcharge: Record<string, unknown>) => JSON.stringify({ schema: 'journalier-v2-copie/1', creeLe: '2026-10-27T10:00:00.000Z', eleves: [], seances: [], activites: [], pias: [], reglages: [], ...surcharge });
  it('garde les messages d’erreur', () => {
    assert.equal(erreur(lireCopie('pas du json')), 'Ce fichier n’est pas une copie du Journalier (lecture impossible).');
    assert.equal(erreur(lireCopie('null')), 'Ce fichier n’est pas une copie du Journalier.');
    assert.equal(erreur(lireCopie('"texte"')), 'Ce fichier n’est pas une copie du Journalier.');
    assert.equal(erreur(lireCopie(copie({ schema: 'autre/1' }))), 'Ce fichier n’est pas une copie du Journalier V2.');
    assert.equal(erreur(lireCopie(copie({ schema: 'journalier-v2-copie/2' }))), 'Cette copie vient d’une version plus récente de l’application : mettez-la à jour.');
    assert.equal(erreur(lireCopie(copie({ seances: 'non' }))), 'La copie est incomplète ou abîmée.');
    assert.equal(erreur(lireCopie(copie({ pias: undefined }))), 'La copie est incomplète ou abîmée.');
    assert.equal(erreur(lireCopie(copie({ eleves: [{ nom: 'sans identifiant' }] }))), 'La copie est incomplète ou abîmée.');
    assert.equal(erreur(lireCopie(copie({ activites: [null] }))), 'La copie est incomplète ou abîmée.');
  });
  it('refait la même copie qu’elle a reçue (rien ajouté, rien perdu, champs en plus gardés)', () => {
    const s = { ...seance({ eleveId: 'x', date: '2026-10-05' }), champInconnu: { a: [1, 2, 3] } };
    const ecrite = construireCopie({ eleves: [], seances: [s], activites: [], pias: [], reglages: [] }, '2026-10-27T10:00:00.000Z');
    const lue = lireCopie(JSON.stringify(ecrite));
    assert.equal(lue.ok, true);
    if (lue.ok) assert.deepEqual(lue.copie, ecrite);
  });
});

describe('schéma : séances et activités reçues', () => {
  it('accepte une séance complète, une séance ancienne sans les champs récents, et garde les champs en plus', () => {
    const complete = seance({ eleveId: 'x' });
    assert.equal(normaliserObjet('seance', complete), complete);
    const { transfert: _t, competences: _c, aides: _a, suite: _s, interventions: _i, ...ancienne } = seance({ eleveId: 'x' });
    assert.equal(normaliserObjet('seance', ancienne), ancienne);
    const plus = { ...complete, venuDuFutur: 'oui' };
    assert.equal(normaliserObjet('seance', plus), plus);
  });
  it('refuse une séance abîmée : date, observations, listes, identité', () => {
    const base = seance({ eleveId: 'x' });
    const abimees: Record<string, unknown>[] = [
      { ...base, date: '05/10/2026' }, { ...base, date: '' }, { ...base, date: 20261005 },
      { ...base, observations: 'texte' }, { ...base, observations: undefined },
      { ...base, aides: 'aucune' }, { ...base, competences: {} }, { ...base, interventions: 3 },
      { ...base, matiere: 12 }, { ...base, suite: 'plus tard' },
      { ...base, id: '' }, { ...base, eleveId: '' }, { ...base, eleveId: undefined }
    ];
    for (const s of abimees) assert.equal(normaliserObjet('seance', s), null, JSON.stringify(s).slice(0, 80));
  });
  it('accepte une activité complète ou minimale, et refuse une activité abîmée', () => {
    const complete = creer({ id: 'a1', type: 'eleve', eleveId: 'x', date: '2026-10-05', debut: 0, fin: 1, titre: 'Fractions' });
    assert.equal(normaliserObjet('activite', complete), complete);
    const minimale = { id: 'a2', type: 'libre', date: '2026-10-05', debut: 0, fin: 1 };
    assert.equal(normaliserObjet('activite', minimale), minimale);
    const serie = { ...complete, repetition: 'hebdomadaire', jusquau: '2026-12-18', exceptions: ['2026-11-02'], etats: { '2026-10-12': 'annule' }, couleur: 3 };
    assert.equal(normaliserObjet('activite', serie), serie);
    const abimees: Record<string, unknown>[] = [
      { ...minimale, type: 'inconnu' }, { ...minimale, date: 'lundi' }, { ...minimale, debut: -1 }, { ...minimale, debut: 1.5 },
      { ...minimale, fin: '2' }, { ...minimale, repetition: 'mensuelle' }, { ...minimale, jusquau: 'bientôt' },
      { ...minimale, exceptions: 'aucune' }, { ...minimale, exceptions: ['demain'] }, { ...minimale, etats: { '2026-10-12': 'perdu' } },
      { ...minimale, couleur: 12 }, { ...minimale, id: '' }
    ];
    for (const a of abimees) assert.equal(normaliserObjet('activite', a), null, JSON.stringify(a));
  });
  it('refuse un élève sans nom ou sans identifiant', () => {
    assert.equal(normaliserObjet('eleve', { id: 'e', nom: 'A', prenom: 'B' }) !== null, true);
    assert.equal(normaliserObjet('eleve', { id: 'e', nom: 'A' }), null);
    assert.equal(normaliserObjet('eleve', { id: '', nom: 'A', prenom: 'B' }), null);
    assert.equal(normaliserObjet('eleve', { id: 'e', nom: 1, prenom: 'B' }), null);
  });
});

/* ───────── Réponses de Microsoft ───────── */

const reponseJson = (corps: unknown, statut = 200): Response => new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json' } });
const avec = (reponse: () => Response) => ({ jeton: { jeton: async () => 'jeton' }, fetchFn: (async () => reponse()) as typeof fetch, attendre: async () => undefined });
const refuse = async (f: () => Promise<unknown>, motif: RegExp) => assert.rejects(f, (e: unknown) => e instanceof ErreurAcces && motif.test(e.message));

describe('schéma : réponses de OneDrive (Graph)', () => {
  it('une liste illisible est refusée avec un message clair, jamais utilisée de travers', async () => {
    await refuse(() => creerNuageGraph(avec(() => reponseJson({ value: [{ name: 'a.json' }] }))).lister('seances'), /liste illisible/);
    await refuse(() => creerNuageGraph(avec(() => reponseJson({ value: 'oups' }))).lister('seances'), /liste illisible/);
    await refuse(() => creerNuageGraph(avec(() => reponseJson([]))).lister('seances'), /liste illisible/);
    await refuse(() => creerNuageGraph(avec(() => new Response('<html>proxy</html>', { status: 200 }))).lister('seances'), /liste illisible/);
  });
  it('accepte les champs vides (null) et les champs en plus que Microsoft ajoute', async () => {
    const liste = await creerNuageGraph(avec(() => reponseJson({ value: [
      { id: '1', name: 'a.json', eTag: '"v1"', file: { mimeType: 'text/plain' }, size: 12, createdBy: { user: {} } },
      { id: '2', name: 'b.json', eTag: null, file: {} },
      { id: '3', name: 'dossier', folder: { childCount: 2 } }
    ] }))).lister('seances');
    assert.deepEqual(liste, [{ chemin: 'seances/a.json', id: '1', etag: '"v1"' }]);
  });
  it('une écriture sans réponse complète est signalée', async () => {
    await refuse(() => creerNuageGraph(avec(() => reponseJson({ id: 'x' }))).ecrire('seances/a.json', '{}', null), /incomplète/);
    await refuse(() => creerNuageGraph(avec(() => reponseJson('ok'))).ecrire('seances/a.json', '{}', null), /incomplète/);
    const ecrit = await creerNuageGraph(avec(() => reponseJson({ id: 'x', eTag: '"v2"', name: 'a.json' }))).ecrire('seances/a.json', '{}', null);
    assert.deepEqual(ecrit, { chemin: 'seances/a.json', id: 'x', etag: '"v2"' });
  });
  it('une demande de téléchargement sans adresse sûre est refusée', async () => {
    const fichier = { chemin: 'seances/a.json', id: 'x', etag: '"v1"' };
    await refuse(() => creerNuageGraph(avec(() => reponseJson({}))).lire(fichier), /adresse de téléchargement sûre/);
    await refuse(() => creerNuageGraph(avec(() => reponseJson({ '@microsoft.graph.downloadUrl': 12 }))).lire(fichier), /adresse de téléchargement sûre/);
    await refuse(() => creerNuageGraph(avec(() => reponseJson({ '@microsoft.graph.downloadUrl': 'https://pirate.example/x' }))).lire(fichier), /adresse de téléchargement sûre/);
  });
  it('le code d’une erreur Graph est repris dans le message, un corps inattendu est ignoré', async () => {
    await refuse(() => creerNuageGraph(avec(() => reponseJson({ error: { code: 'generalException' } }, 500))).lister('seances'), /500 \(generalException\)/);
    await refuse(() => creerNuageGraph(avec(() => reponseJson({ error: 'texte' }, 500))).lister('seances'), /Microsoft a répondu 500\./);
    await refuse(() => creerNuageGraph(avec(() => new Response('plantage', { status: 500 }))).lister('seances'), /Microsoft a répondu 500\./);
  });
});

describe('schéma : réponses d’Outlook (Graph)', () => {
  it('un événement sans heure, sans lieu ou sans texte (null) ne fait rien planter', async () => {
    const evenements = await creerCalendrierGraph(avec(() => reponseJson({ value: [
      { id: 'e1', subject: null, start: { dateTime: '2026-10-05T08:00:00.0000000' }, end: null, location: null, body: null },
      { id: 'e2', subject: 'Hors fenêtre', start: { dateTime: '2026-12-25T08:00:00.0000000' }, end: { dateTime: '2026-12-25T08:50:00.0000000' } }
    ] }))).evenements('cal', '2026-10-01', '2026-10-31');
    assert.deepEqual(evenements, [{ id: 'e1', cle: '', sujet: '', debut: '2026-10-05T08:00', fin: '', lieu: '' }]);
  });
  it('un événement sans identifiant ou une liste illisible est refusé', async () => {
    await refuse(() => creerCalendrierGraph(avec(() => reponseJson({ value: [{ subject: 'sans id' }] }))).evenements('cal', '2026-10-01', '2026-10-31'), /liste illisible/);
  });
  it('la création du calendrier doit être confirmée par Microsoft', async () => {
    let appel = 0;
    const cal = creerCalendrierGraph(avec(() => { appel += 1; return appel === 1 ? reponseJson({ value: [] }) : reponseJson({ value: 'oups' }); }));
    await refuse(() => cal.trouverOuCreer('Journalier'), /pas confirmé la création/);
    let n = 0;
    const bon = creerCalendrierGraph(avec(() => { n += 1; return n === 1 ? reponseJson({ value: [] }) : reponseJson({ id: 'nouveau', name: 'Journalier' }); }));
    assert.equal(await bon.trouverOuCreer('Journalier'), 'nouveau');
  });
});

describe('schéma : connexion Microsoft', () => {
  const CONFIG: ConfigMicrosoft = { clientId: 'c', tenantId: 't', adresseRetour: 'https://exemple.test/v2/msal-redirect.html' };
  const stockage = (initial?: unknown): Stockage => {
    const m = new Map<string, string>();
    if (initial !== undefined) m.set('journalier-microsoft-session', typeof initial === 'string' ? initial : JSON.stringify(initial));
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } };
  };
  const connexion = (initial?: unknown) => new Connexion({ config: CONFIG, stockage: stockage(initial), ouvrirFenetre: () => null, ecouterRetour: () => () => undefined });
  const session = { compte: { id: 'u1', nom: 'Léa', courriel: 'lea@exemple.be' }, refresh: 'r', droits: ['https://graph.microsoft.com/Files.ReadWrite.AppFolder'], acces: {} };

  it('relit une session valable, même sans la partie « acces »', () => {
    assert.equal(connexion(session).compte()?.id, 'u1');
    const { acces: _a, ...ancienne } = session;
    assert.equal(connexion(ancienne).compte()?.id, 'u1');
  });
  it('ignore une session abîmée au lieu de planter plus loin', () => {
    for (const abimee of ['pas du json', 'null', '[]', { ...session, compte: {} }, { ...session, compte: undefined }, { ...session, refresh: 4 }, { ...session, droits: 'aucun' }]) {
      assert.equal(connexion(abimee).compte(), null, JSON.stringify(abimee));
    }
  });
  it('la réponse du jeton accepte un temps de validité écrit en texte, et refuse ce qui n’est pas un objet', () => {
    assert.equal(schemaReponseJeton.parse({ access_token: 'a', expires_in: '3599', ext_expires_in: 7200 }).expires_in, 3599);
    assert.equal(schemaReponseJeton.safeParse('texte').success, false);
    assert.equal(schemaReponseJeton.safeParse({ access_token: 5 }).success, false);
  });
  it('le jeton d’identité : champ du mauvais type = champ absent, jeton abîmé = pas de compte', () => {
    const jeton = (charge: unknown) => `e30.${Buffer.from(JSON.stringify(charge)).toString('base64url')}.signature`;
    assert.deepEqual(lireCompte(jeton({ oid: 'o1', preferred_username: 'a@b.be', name: 'Léa', nonce: 'n' }), 'n'), { id: 'o1', nom: 'Léa', courriel: 'a@b.be' });
    assert.deepEqual(lireCompte(jeton({ oid: 12, sub: 's1', email: 'x@y.be' })), { id: 's1', nom: 'x@y.be', courriel: 'x@y.be' });
    assert.equal(lireCompte(jeton({ oid: 'o1', nonce: 'autre' }), 'n'), null);
    assert.equal(lireCompte(jeton({ name: 'sans identifiant' })), null);
    assert.equal(lireCompte(jeton([])), null);
    assert.equal(lireCompte('pas-un-jeton'), null);
  });
});
