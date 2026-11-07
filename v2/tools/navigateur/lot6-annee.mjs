// Audit lot 6.2 : le PIA propose d'ouvrir la nouvelle année scolaire depuis le sélecteur d'année (sans passer par l'adresse).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-annee.mjs
import { aller } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
await page.getByText('Données d’essai chargées').waitFor();
await page.evaluate(() => { location.hash = '#/pia?eleve=demo-alpha&onglet=identite'; });
await page.waitForTimeout(600);

const choix = page.getByLabel('Année scolaire');
const options = await choix.locator('option').allInnerTexts();
console.log('options :', options.join(' | '));
ok(options.some((o) => o.startsWith('2027-2028')), 'le sélecteur propose la nouvelle année 2027-2028');
ok(options.some((o) => /2027-2028.*nouvelle année/.test(o)), 'elle est présentée comme une nouvelle année');
ok(!options.some((o) => o.startsWith('2028-2029')), 'une seule année d’avance est proposée');
if (options.some((o) => o.startsWith('2027-2028'))) {
  await choix.selectOption({ index: options.findIndex((o) => o.startsWith('2027-2028')) });
  await page.waitForTimeout(500);
  ok(page.url().includes('annee=2027-2028'), 'choisir la nouvelle année ouvre un PIA de 2027-2028');
}
await nav.close();
ok(erreurs.length === 0, 'aucune erreur dans la console');
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
