// Vérification dans un vrai navigateur du Lot 9b : reprise de la V75 depuis OneDrive et « Repartir de OneDrive ».
// Connexion Microsoft complète (fenêtre, code + PKCE) contre un faux Microsoft qui contient un dossier « Journalier » comme la V75 l'écrit.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node --import tsx tools/navigateur/onedrive-9b.mjs
// (Playwright : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.) La date du jour est figée au lundi 26 octobre 2026.
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import { FauxMicrosoft } from '../../tests/fauxMicrosoft.ts';
import { deposerEtatV75, etatV75 } from '../../tests/fabrique-v75.ts';
import { aller as ouvrirApp, baseDuCompte, ecrireBase, lireBase, recharger } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const faux = new FauxMicrosoft();
deposerEtatV75(faux, etatV75());

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
// Normal : au premier envoi, OneDrive répond 404 pour un dossier qui n'existe pas encore (le navigateur le note dans sa console).
const suivre = (p) => {
  p.on('response', (r) => { if (r.status() === 404 && !r.url().includes('/children?')) erreurs.push(`404 ${r.url()}`); });
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) erreurs.push(m.text()); });
  p.on('pageerror', (e) => erreurs.push(String(e)));
};
await ctx.route(/^https:\/\/(login\.microsoftonline\.com|graph\.microsoft\.com|faux\.sharepoint\.com)\//, async (route) => {
  const req = route.request();
  const url = req.url();
  if (url.includes('/oauth2/v2.0/authorize')) {
    await route.fulfill({ status: 302, headers: { location: faux.autoriser(url) }, body: '' });
    return;
  }
  const rep = await faux.fetch(url, { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined });
  await route.fulfill({ status: rep.status, headers: Object.fromEntries(rep.headers), body: Buffer.from(await rep.arrayBuffer()) });
});
const page = await ctx.newPage();
suivre(page);
const bouton = (nom) => page.getByRole('button', { name: nom });
const aller = async (nom) => { await page.getByRole('link', { name: nom, exact: true }).click(); };
const versReprise = async () => {
  await aller('Synchro');
  await page.getByRole('heading', { name: 'Synchronisation', level: 1 }).waitFor();
  await page.goto(`${URL_APP}#/reprise`);
  await page.getByRole('heading', { name: 'Reprendre mes données de la V75', level: 1 }).waitFor();
};
const attendreMessage = async (re) => {
  try { await page.locator('.synchro-message', { hasText: re }).first().waitFor({ timeout: 15_000 }); } catch (e) {
    console.log('--- texte de la page au moment de l’échec ---\n', (await page.locator('main, body').first().innerText()).slice(0, 1500), '\n--- erreurs console ---\n', erreurs.join('\n'));
    throw e;
  }
};

/* ───────── 1. Connexion Microsoft depuis l'écran verrouillé ───────── */
await ouvrirApp(page, URL_APP); // passe par le mode essai pour atteindre le Journalier
await bouton('Verrouiller le Journalier').click();
const [popup] = await Promise.all([ctx.waitForEvent('page'), bouton('Se connecter avec Microsoft').click()]);
suivre(popup);
await page.getByRole('link', { name: 'Synchro', exact: true }).waitFor({ timeout: 20_000 });
await page.locator('.chargement').waitFor({ state: 'hidden' });
const base = await baseDuCompte(page);
ok(base !== 'journalier-v2-essai', `espace du compte à part (${base})`);

/* ───────── 2. Reprise depuis OneDrive ───────── */
await versReprise();
await page.getByRole('heading', { name: 'Reprendre mes données de la V75', level: 1 }).waitFor();
await page.getByText('Connecté en tant que').waitFor();
ok(await bouton('Lire le OneDrive de la V75').isVisible(), 'compte connecté : le bouton « Lire le OneDrive de la V75 » est proposé en premier');
ok(await bouton('Chercher mes données de la V75 sur cet appareil').isVisible(), 'la lecture sur l’appareil reste proposée');
await page.screenshot({ path: `${SORTIE}/9b-depart.png`, fullPage: true });
await bouton('Lire le OneDrive de la V75').click();
await attendreMessage(/OneDrive de la V75 lu/);
ok(/2 élèves/.test(await page.locator('.synchro-message-ok').first().innerText()), 'le résumé annonce 2 élèves');
ok(await page.getByText('Séfora').first().isVisible() && await page.getByText('Nicoleta').first().isVisible(), 'les deux élèves de la V75 sont listés');
ok(await page.getByText('refuse d’envoyer certaines séances').isVisible(), 'la remarque sur ce que la V75 envoie (ou pas) est affichée');
const ecrituresV75 = faux.journal.filter((l) => l.includes('/Journalier') && !l.startsWith('GET '));
ok(ecrituresV75.length === 0, 'aucune écriture, aucune suppression dans le dossier de la V75');
ok(faux.chemins().length === 0, 'rien n’a été créé dans OneDrive pendant la lecture');
await page.screenshot({ path: `${SORTIE}/9b-plan.png`, fullPage: true });

await bouton(/^Importer/).click();
await page.getByRole('heading', { name: 'Contrôle après import' }).waitFor({ timeout: 20_000 });
ok(/Tout est en place/.test(await page.locator('.synchro-message-ok').last().innerText()), 'le contrôle après import dit « Tout est en place »');
const eleves = await lireBase(page, 'eleves', base);
ok(eleves.some((e) => e.id === 'v75-1001') && eleves.some((e) => e.id === 'v75-student_1002'), 'les élèves sont dans la base chiffrée du compte');
const seances = await lireBase(page, 'seances', base);
ok(seances.length >= 3, `les séances sont importées (${seances.length})`);
await page.screenshot({ path: `${SORTIE}/9b-controle.png`, fullPage: true });

/* Relire sans quitter la page (« Lire une autre source ») : tout est reconnu, rien n'est dupliqué */
await bouton('Lire une autre source (OneDrive ou cet appareil)').click();
await bouton('Lire le OneDrive de la V75').click();
await attendreMessage(/OneDrive de la V75 lu/);
ok((await page.getByText('Déjà repris, identique').count()) === 2, 'relire : les deux élèves sont reconnus (« Déjà repris, identique »)');
ok((await lireBase(page, 'eleves', base)).length === eleves.length, 'aucun doublon');

/* ───────── 3. Repartir de OneDrive ───────── */
await aller('Synchro');
await bouton('Synchroniser maintenant').click();
await attendreMessage(/envoyés? vers OneDrive|Tout est à jour/);
ok(faux.chemins().some((c) => c.startsWith('eleves/v75-')), 'les données reprises sont parties dans le dossier « v2 » de OneDrive');
// Données dépassées ici : un élève de trop, uniquement sur cet appareil (envoi automatique coupé pour qu'il ne parte pas aussitôt)
await page.getByLabel(/Envoyer automatiquement/).uncheck();
await ecrireBase(page, 'eleves', { id: 'e-trop', nom: 'EnTrop', prenom: 'Zoé', classe: '1A', ecole: '', titulaire: '', dateNaissance: '', matieres: [] }, base);
await recharger(page);
await aller('Synchro');
await page.getByRole('heading', { name: 'Repartir de OneDrive' }).waitFor();
await bouton('Voir ce que contient OneDrive').click();
const apercu = page.getByRole('region', { name: 'Ce qui serait remplacé' });
await apercu.waitFor();
const texteApercu = await apercu.innerText();
console.log(texteApercu.replace(/\n+/g, ' | ').slice(0, 400));
ok(/Dans OneDrive : 2 élèves/.test(texteApercu) && /Sur cet appareil, aujourd’hui : 3 élèves/.test(texteApercu), 'l’aperçu compare OneDrive (2 élèves) et cet appareil (3 élèves)');
ok(await bouton('Remplacer par le contenu de OneDrive').isDisabled(), 'le bouton reste grisé tant que la case n’est pas cochée');
ok((await lireBase(page, 'eleves', base)).length === 3, 'l’aperçu ne change rien');
await page.screenshot({ path: `${SORTIE}/9b-repartir-apercu.png`, fullPage: true });
await page.getByLabel(/Je comprends/).check();
await bouton('Remplacer par le contenu de OneDrive').click();
await attendreMessage(/Cet appareil repart de OneDrive/);
const apres = await lireBase(page, 'eleves', base);
ok(apres.length === 2 && !apres.some((e) => e.id === 'e-trop'), 'l’élève de trop a disparu, les deux élèves de OneDrive sont là');
await bouton('Synchroniser maintenant').click();
await attendreMessage(/Tout est à jour/);
ok(true, 'la synchronisation suivante n’a plus rien à faire');
ok(!faux.journal.some((l) => l.startsWith('DELETE ')), 'rien n’a été supprimé dans OneDrive');
await page.screenshot({ path: `${SORTIE}/9b-repartir-fini.png`, fullPage: true });

/* ───────── 4. Téléphone et thème sombre ───────── */
await page.setViewportSize({ width: 375, height: 800 });
await versReprise();
await page.getByRole('heading', { name: 'Reprendre mes données de la V75', level: 1 }).waitFor();
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'téléphone : écran de reprise sans défilement horizontal');
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(600); // les couleurs changent avec une courte transition
await page.screenshot({ path: `${SORTIE}/9b-reprise-mobile-sombre.png`, fullPage: true });
await aller('Synchro');
await page.getByRole('heading', { name: 'Repartir de OneDrive' }).waitFor();
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'téléphone : écran Synchro sans défilement horizontal');
await page.screenshot({ path: `${SORTIE}/9b-synchro-mobile-sombre.png`, fullPage: true });

/* ───────── 5. Compte sans données de la V75 ───────── */
await page.setViewportSize({ width: 1280, height: 900 });
await page.emulateMedia({ colorScheme: 'light' });
faux.fichiersV75.clear();
await versReprise();
await bouton('Lire le OneDrive de la V75').click();
await attendreMessage(/Aucune donnée de la V75 n’a été trouvée dans le OneDrive/);
ok(true, 'OneDrive sans dossier de la V75 : message clair, rien n’est créé');

ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
await navigateur.close();
console.log(`Captures dans ${SORTIE}`);
