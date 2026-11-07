// Audit lot 6.4 : après « Enregistrer la séance », la notification propose « Voir dans le Journalier ».
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-apres-seance.mjs
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
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Bêta' });
await page.getByLabel('Date', { exact: true }).fill('2026-11-03');
await page.getByLabel('Matière').fill('Sciences');
await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
await page.getByText('Séance enregistrée').first().waitFor();
const geste = page.getByRole('button', { name: 'Voir dans le Journalier' });
ok(await geste.count() === 1, 'la notification propose « Voir dans le Journalier »');
if (await geste.count() === 1) {
  await geste.click();
  await page.waitForTimeout(500);
  ok(page.url().includes('#/journalier'), 'le geste mène au Journalier');
  ok(decodeURIComponent(page.url()).includes('demo-beta'), 'sur l’élève concerné');
}
await nav.close();
ok(erreurs.length === 0, 'aucune erreur dans la console');
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
