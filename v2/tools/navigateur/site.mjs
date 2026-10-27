// Lot S : la V2 prend l'adresse principale du site. Ce parcours la sert « comme GitHub Pages » (sous /journalier-electronique/,
// rien ailleurs) et vérifie dans un vrai navigateur :
//   - l'écran de connexion s'ouvre et l'application démarre sous ce chemin (modèles Word, logo, essai) sans erreur ;
//   - l'adresse de retour envoyée à Microsoft est <site>/journalier-electronique/msal-redirect.html : celle que la V75
//     utilisait déjà, avec la même inscription (même client_id), donc rien à ajouter chez Microsoft pour la V2 ;
//   - la page de retour répond.
// Il sert le dossier dist/ (compilé s'il manque). Lancer : LANG=C.UTF-8 node tools/navigateur/site.mjs
import { createServer } from 'node:http';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { entrer } from './_coffre.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dist = path.join(racine, 'dist');
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const PORT = Number(process.env.PORT_SITE ?? 5198);
const BASE = '/journalier-electronique/';
// Inscription Microsoft (Entra) de la V75, reprise telle quelle par la V2 : mêmes adresses de retour déclarées.
const CLIENT_ID_V75 = '65c3db78-9bad-4a08-8eac-404b83e368cb';
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log(`✓ ${m}`); };

if (!existsSync(path.join(dist, 'index.html'))) {
  const { compiler } = await import('../../scripts/build.mjs');
  await compiler({ minify: false });
}

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml', '.json': 'application/json', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (!url.pathname.startsWith(BASE)) { res.writeHead(404).end('Hors du site'); return; }   // comme GitHub Pages : rien hors du dossier du site
  const relatif = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html';
  const fichier = path.join(dist, relatif);
  if (!fichier.startsWith(dist)) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' }).end(await readFile(fichier)); }
  catch { res.writeHead(404).end('Introuvable'); }
});
await new Promise((resolve) => serveur.listen(PORT, resolve));
const site = `http://localhost:${PORT}${BASE}`;

const erreurs = [];
const nav = await chromium.launch();
try {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-BE', bypassCSP: false });
  await ctx.route('https://login.microsoftonline.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<p>Faux Microsoft (essai)</p>' }));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));

  await page.goto(site);
  await page.getByRole('heading', { name: 'Journalier verrouillé' }).waitFor();
  ok(true, 'à l’adresse principale du site, la V2 s’ouvre sur l’écran de connexion');
  ok(await page.locator('.verrou-logo').evaluate((img) => img.complete && img.naturalWidth > 0), 'le logo se charge sous ce chemin');

  // Adresse de retour envoyée à Microsoft
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Se connecter avec Microsoft' }).click()]);
  await popup.waitForLoadState();
  const adresse = new URL(popup.url());
  ok(adresse.hostname === 'login.microsoftonline.com', 'la fenêtre de connexion mène chez Microsoft');
  ok(adresse.searchParams.get('client_id') === CLIENT_ID_V75, 'même inscription Microsoft que la V75 (même client_id)');
  ok(adresse.searchParams.get('redirect_uri') === `${site}msal-redirect.html`, `adresse de retour = <site>/journalier-electronique/msal-redirect.html (reçu : ${adresse.searchParams.get('redirect_uri')})`);
  await popup.close();
  await page.getByRole('button', { name: 'Annuler' }).click();

  // La page de retour répond (et ne fait rien d'autre sans réponse de Microsoft)
  const retour = await ctx.newPage();
  await retour.goto(`${site}msal-redirect.html`);
  await retour.getByText('Cette page sert uniquement au retour de la connexion Microsoft').waitFor();
  ok(true, 'la page de retour de Microsoft répond à l’adresse principale');
  await retour.close();

  // L'application fonctionne sous ce chemin : essai, puis modèles Word relatifs
  await entrer(page);
  ok(await page.getByRole('link', { name: 'Accueil' }).first().isVisible(), 'le mode essai ouvre l’application sous ce chemin');
  for (const modele of ['Journalier_modele_papier.docx', 'PIA_modele_officiel_2025-09-11.docx']) {
    const statut = await page.evaluate(async (m) => (await fetch(`./modeles/${m}`, { cache: 'no-store' })).status, modele);
    ok(statut === 200, `le modèle Word « ${modele} » se charge (adresse relative)`);
  }
  await page.getByRole('link', { name: 'Agenda' }).click();
  await page.getByRole('heading', { name: 'Agenda' }).first().waitFor();
  await page.screenshot({ path: `${SORTIE}/site-agenda.png` });
  ok(await page.evaluate(() => location.pathname === '/journalier-electronique/' && location.hash.startsWith('#/agenda')), 'les écrans se choisissent dans l’adresse après # (aucun chemin de plus à gérer)');
  ok(erreurs.length === 0, `aucune erreur console (${erreurs.join(' | ') || 'aucune'})`);
} finally {
  await nav.close();
  serveur.close();
}
