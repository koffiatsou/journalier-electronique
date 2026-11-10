// Audit lot 6.3 : enregistrer une séance sur un créneau déjà pris prévient (sans bloquer) et nomme la séance en conflit.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-doublon.mjs
import { aller, lireBase } from './_coffre.mjs';

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
await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
await page.getByText('Données d’essai chargées').waitFor();

async function saisir(matiere) {
  await page.evaluate(() => { location.hash = '#/seance'; });
  await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Bêta' });
  await page.getByLabel('Date', { exact: true }).fill('2026-10-02');
  await page.getByLabel('Première période').selectOption({ index: 2 });
  await page.getByLabel('Matière').fill(matiere);
  await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
  await page.getByRole('dialog', { name: /Aucun point noté/ }).getByRole('button', { name: 'Enregistrer quand même' }).click({ timeout: 1500 }).catch(() => undefined); // séance volontairement sans point noté
}
await saisir('Sciences');
await page.getByText('Séance enregistrée').first().waitFor();
await page.waitForTimeout(600);
const avant = (await lireBase(page, 'seances')).length;

await saisir('Français');
const dialogue = page.getByRole('dialog', { name: /déjà une séance/ });
await dialogue.waitFor({ timeout: 4000 }).catch(() => undefined);
ok(await dialogue.count() === 1, 'une séance sur le même créneau déclenche un avertissement');
if (await dialogue.count() === 1) {
  ok((await dialogue.innerText()).includes('Sciences'), 'l’avertissement nomme la séance en conflit (matière)');
  await dialogue.getByRole('button', { name: 'Revenir à la séance' }).click();
  await page.waitForTimeout(500);
  ok((await lireBase(page, 'seances')).length === avant, '« Revenir » n’enregistre rien');
  await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
  await page.getByRole('dialog', { name: /Aucun point noté/ }).getByRole('button', { name: 'Enregistrer quand même' }).click({ timeout: 1500 }).catch(() => undefined); // séance volontairement sans point noté
  await page.getByRole('dialog', { name: /déjà une séance/ }).getByRole('button', { name: 'Enregistrer quand même' }).click();
  await page.getByText('Séance enregistrée').first().waitFor();
  await page.waitForTimeout(600);
  ok((await lireBase(page, 'seances')).length === avant + 1, '« Enregistrer quand même » enregistre (jamais bloqué)');
}
await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
