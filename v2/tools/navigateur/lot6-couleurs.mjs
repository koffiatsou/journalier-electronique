// Audit lot 6.6 : le nom de la couleur choisie pour un élève ou une activité est écrit (pas seulement porté par une pastille).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-couleurs.mjs
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
await aller(page, `${URL_APP}#/eleves`);
await page.getByRole('button', { name: 'Nouvel élève' }).click();
const groupe = page.getByRole('group', { name: 'Couleur dans l’agenda' });
const nom = await groupe.locator('button').nth(3).getAttribute('aria-label');
await groupe.locator('button').nth(3).click();
const texte = await page.locator('.field', { has: groupe }).innerText();
ok(texte.includes(`Couleur choisie : ${nom}`), `fiche élève : « Couleur choisie : ${nom} » est écrit`);

await page.evaluate(() => { location.hash = '#/agenda'; });
await page.waitForTimeout(600);
await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click();
await page.getByRole('button', { name: 'Nouvelle activité', exact: true }).click();
const panneau = page.locator('.panneau');
await panneau.waitFor();
const g2 = page.getByRole('group', { name: 'Couleur', exact: true });
ok((await panneau.locator('.field').filter({ has: g2 }).innerText()).includes('Couleur choisie : automatique'), 'panneau : « Couleur choisie : automatique » par défaut');
const nom2 = await g2.locator('button[aria-label]').nth(5).getAttribute('aria-label');
await g2.locator('button[aria-label]').nth(5).click();
ok((await panneau.locator('.field').filter({ has: g2 }).innerText()).includes(`Couleur choisie : ${nom2}`), `panneau : « Couleur choisie : ${nom2} » est écrit`);
await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
