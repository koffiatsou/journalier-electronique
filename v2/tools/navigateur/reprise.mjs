// Vérification dans un vrai navigateur du Lot 9 : la reprise des données de la V75.
// 1) En mode essai, l'écran refuse la reprise (jamais de vraies données en essai) et ne crée AUCUNE base V75.
// 2) Une base au format de la V75 est fabriquée dans le navigateur ; la lecture réelle (IndexedDB + WebCrypto) la retrouve,
//    la déchiffre, prépare la reprise, et la base de la V75 reste intacte.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/reprise.mjs
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { aller } from './_coffre.mjs';

// Le serveur local ne sert que l'application compilée : on compile à part le code de lecture pour l'exécuter dans la page.
const dossier = mkdtempSync(path.join(os.tmpdir(), 'reprise-'));
const lecteur = path.join(dossier, 'lecteur.js');
await build({
  stdin: { contents: "export * from './src/data/stockage-v75.ts'; export * from './src/domain/v75/index.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'iife', globalName: 'Lecteur', outfile: lecteur, logLevel: 'silent'
});

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE', bypassCSP: true });
await ctx.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

await aller(page, `${URL_APP}#/reprise`);
await page.getByRole('heading', { name: 'Reprendre mes données de la V75' }).waitFor();
ok(await page.getByText('réservé aux données fictives').isVisible(), 'mode essai : la reprise est refusée avec une explication');
ok(!(await page.getByRole('button', { name: /Chercher/ }).count()), 'mode essai : aucun bouton de recherche');
const bases = await page.evaluate(async () => (await indexedDB.databases()).map((b) => b.name));
ok(!bases.includes('journalier-secure-v74'), 'aucune base V75 n’a été créée par la V2');

// Fabrique une base au format V75 (mêmes données authentifiées que storage-vault.js de la V75).
await page.evaluate(async () => {
  const COMPTE = 'compte-test';
  const db = await new Promise((res, rej) => {
    const o = indexedDB.open('journalier-secure-v74', 1);
    o.onupgradeneeded = () => {
      const d = o.result;
      d.createObjectStore('meta', { keyPath: 'storageKey' });
      for (const n of ['students', 'sessions', 'agenda', 'pia', 'sync', 'migration']) d.createObjectStore(n, { keyPath: 'storageKey' });
      d.createObjectStore('keys', { keyPath: 'accountKey' });
    };
    o.onsuccess = () => res(o.result); o.onerror = () => rej(o.error);
  });
  const cle = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const canon = (v) => Array.isArray(v) ? `[${v.map(canon).join(',')}]` : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}` : JSON.stringify(v);
  const hex = async (b) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b))).map((x) => x.toString(16).padStart(2, '0')).join('');
  const chiffrer = async (type, id, valeur) => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(`journalier-storage-v2|${COMPTE}|${type}|${id}`) }, cle, new TextEncoder().encode(canon(valeur)));
    return { storageKey: `${COMPTE}:${id}`, id: String(id), ownerId: COMPTE, type, schemaVersion: 2, iv: iv.buffer, ciphertext, digest: await hex(ciphertext), updatedAt: new Date().toISOString() };
  };
  const meta = await chiffrer('meta', COMPTE, { ownerId: COMPTE, migrationStatus: 'complete', identity: { displayName: 'Agent Test', microsoftAccount: 'agent@exemple.be' } });
  const eleve = await chiffrer('student', 'e1', { studentId: 'e1', nom: 'Élève Témoin', classe: '3A' });
  const tx = db.transaction(['meta', 'students', 'keys'], 'readwrite');
  tx.objectStore('meta').put({ ...meta, migrationStatus: 'complete', ownerId: COMPTE });
  tx.objectStore('students').put(eleve);
  tx.objectStore('keys').put({ accountKey: COMPTE, key: cle });
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  db.close();
});

await page.addScriptTag({ path: lecteur });
const resultat = await page.evaluate(async () => {
  const { stockageV75, trouverComptes, lireCoffreV75, preparerReprise } = window.Lecteur;
  const st = stockageV75();
  try {
    const comptes = await trouverComptes(st);
    const { etat, illisibles } = await lireCoffreV75(st, comptes[0].id);
    const reprise = preparerReprise(etat, { aujourdhui: '2026-10-26', maintenant: '2026-10-26T12:00:00.000Z' });
    return { comptes: comptes.map((c) => [c.nom, c.eleves]), illisibles: illisibles.length, fiches: reprise.fiches.map((f) => f.eleve.nom) };
  } finally { await st.fermer?.(); }
});
ok(JSON.stringify(resultat.comptes) === '[["Agent Test",1]]', 'le coffre au format V75 est retrouvé dans le navigateur');
ok(resultat.illisibles === 0 && resultat.fiches[0] === 'Élève Témoin', 'l’élève est déchiffré et préparé pour la reprise');
const intact = await page.evaluate(async () => {
  const db = await new Promise((res) => { const o = indexedDB.open('journalier-secure-v74'); o.onsuccess = () => res(o.result); });
  const n = await new Promise((res) => { const r = db.transaction('students').objectStore('students').count(); r.onsuccess = () => res(r.result); });
  const v = db.version; db.close(); return { n, v };
});
ok(intact.n === 1 && intact.v === 1, 'la base de la V75 est restée intacte (lecture seule)');
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
await navigateur.close();
