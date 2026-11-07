// Audit lot 6.6 : sans élève, l'accueil propose d'abord « Ajouter mon premier élève » ; les données d'essai passent au second plan.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-premier-eleve.mjs
import { aller } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
await aller(page, URL_APP);
const vide = page.locator('section.vide');
const premier = vide.getByRole('button', { name: 'Ajouter mon premier élève' });
ok(await premier.count() === 1, 'l’accueil sans élève propose « Ajouter mon premier élève »');
const essai = vide.getByRole('button', { name: 'Charger les données d’essai' });
ok(await essai.count() === 1, 'les données d’essai restent accessibles');
if (await premier.count() === 1 && await essai.count() === 1) {
  ok((await premier.getAttribute('class')).includes('btn-primary'), 'le premier élève est le bouton principal');
  ok(!((await essai.getAttribute('class')) ?? '').includes('btn-primary'), 'les données d’essai ne sont plus le bouton principal');
  await premier.click();
  await page.getByRole('heading', { name: 'Nouvel élève' }).waitFor({ timeout: 5000 }).catch(() => undefined);
  ok(await page.getByRole('heading', { name: 'Nouvel élève' }).count() === 1, 'le bouton ouvre directement la fiche d’un nouvel élève');
}
await nav.close();
ok(erreurs.length === 0, 'aucune erreur dans la console');
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
