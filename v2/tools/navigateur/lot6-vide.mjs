// Audit lot 6.4 : enregistrer une séance où rien n'est noté demande confirmation ; une absence ne la demande pas.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-vide.mjs
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
const nb = async () => { await page.waitForTimeout(600); return (await lireBase(page, 'seances')).length; };
const remplir = async (date, absent) => {
  await page.evaluate(() => { location.hash = '#/seance'; });
  await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Bêta' });
  await page.getByLabel('Date', { exact: true }).fill(date);
  await page.getByLabel('Matière').fill('Sciences');
  if (absent) await page.locator('input[name="presence"][value="absent_eleve"]').check({ force: true });
  await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
};

const avant = await nb();
await remplir('2026-09-08', false);
const dlg = page.getByRole('dialog', { name: /Aucun point noté/ });
await dlg.waitFor({ timeout: 4000 }).catch(() => undefined);
ok(await dlg.count() === 1, 'une séance sans aucun point noté demande confirmation');
if (await dlg.count() === 1) {
  await dlg.getByRole('button', { name: 'Revenir à la séance' }).click();
  ok(await nb() === avant, '« Revenir » n’enregistre rien');
  await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
  await page.getByRole('dialog', { name: /Aucun point noté/ }).getByRole('button', { name: 'Enregistrer quand même' }).click();
  await page.getByText('Séance enregistrée').first().waitFor();
  ok(await nb() === avant + 1, '« Enregistrer quand même » enregistre');
}
await remplir('2026-09-09', true);
await page.getByText('Séance enregistrée').first().waitFor({ timeout: 4000 }).catch(() => undefined);
ok(await page.getByRole('dialog', { name: /Aucun point noté/ }).count() === 0 && await nb() === avant + 2, 'une séance d’absence s’enregistre sans question');
// Avec l'objectif de la leçon noté : rien à confirmer (le Journalier écrit « Séance sans observation particulière. »).
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Bêta' });
await page.getByLabel('Date', { exact: true }).fill('2026-09-10');
await page.getByLabel('Matière').fill('Sciences');
await page.getByLabel(/Objectif de la leçon/).fill('Le cycle de l’eau');
await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
await page.getByText('Séance enregistrée').first().waitFor({ timeout: 4000 }).catch(() => undefined);
ok(await page.getByRole('dialog', { name: /Aucun point noté/ }).count() === 0 && await nb() === avant + 3, 'avec l’objectif noté, la séance s’enregistre sans question');
await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
