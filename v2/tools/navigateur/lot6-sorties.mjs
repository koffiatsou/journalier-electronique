// Audit lot 6.4b + 6.3 (série) : quitter sans enregistrer demande confirmation seulement s'il y a des modifications ;
// le bouton « Enregistrer » du panneau d'une série dit à quoi il s'applique.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-sorties.mjs
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
const attendre = (ms) => page.waitForTimeout(ms);

/* A : panneau de l'agenda */
await page.evaluate(() => { location.hash = '#/agenda'; });
await attendre(500);
await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click();
const ouvrirPanneau = async () => { await page.locator('.evt').first().click(); await page.locator('.panneau').waitFor(); await attendre(300); };
await ouvrirPanneau();
const enreg = await page.locator('.panneau .barre-fixe .btn-primary').innerText();
ok(/cette date/i.test(enreg), `A1 série : le bouton dit « cette date » (${enreg})`);
await page.getByLabel('Fermer le panneau').click();
await attendre(300);
ok(await page.locator('.panneau').count() === 0, 'A2 sans modification, « Fermer » ferme tout de suite');
await ouvrirPanneau();
await page.getByLabel('Lieu').fill('Local modifié');
await page.getByLabel('Fermer le panneau').click();
await attendre(300);
ok(await page.getByRole('dialog', { name: /Abandonner/ }).count() === 1, 'A3 avec une modification, « Fermer » demande confirmation');
await page.getByRole('button', { name: 'Continuer à modifier' }).click();
await attendre(300);
ok(await page.locator('.panneau').count() === 1 && await page.getByLabel('Lieu').inputValue() === 'Local modifié', 'A4 « Continuer à modifier » garde le panneau et la saisie');
await page.keyboard.press('Escape');
await attendre(300);
ok(await page.getByRole('dialog', { name: /Abandonner/ }).count() === 1, 'A5 Échap demande aussi confirmation');
await page.getByRole('button', { name: 'Abandonner les modifications' }).click();
await attendre(400);
ok(await page.locator('.panneau').count() === 0, 'A6 « Abandonner » ferme le panneau');

/* B : séance en modification */
await page.evaluate(() => { location.hash = '#/journalier'; });
await attendre(500);
await page.getByRole('button', { name: /^Modifier la séance/ }).first().click().catch(() => undefined);
await attendre(500);
if (await page.getByRole('button', { name: 'Annuler', exact: true }).count() === 0) {
  // pas de séance dans les données d'essai : on en crée une d'abord
  await page.evaluate(() => { location.hash = '#/seance'; });
  await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Alpha' });
  await page.getByLabel('Date', { exact: true }).fill('2026-11-03');
  await page.getByLabel('Matière').fill('Français');
  await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
  await page.getByText('Séance enregistrée').first().waitFor();
  await page.evaluate(() => { location.hash = '#/journalier'; });
  await attendre(500);
  await page.getByRole('button', { name: /^Modifier la séance/ }).first().click();
  await attendre(500);
}
await page.getByRole('button', { name: 'Annuler', exact: true }).click();
await attendre(500);
ok(page.url().includes('#/journalier'), 'B1 sans modification, « Annuler » retourne au Journalier sans question');
await page.getByRole('button', { name: /^Modifier la séance/ }).first().click();
await attendre(500);
await page.getByLabel('Matière').fill('Matière changée');
await page.getByRole('button', { name: 'Annuler', exact: true }).click();
await attendre(400);
ok(await page.getByRole('dialog', { name: /Abandonner/ }).count() === 1 && page.url().includes('#/seance'), 'B2 avec une modification, « Annuler » demande confirmation');
await page.getByRole('button', { name: 'Continuer à modifier' }).click();
await attendre(300);
ok(await page.getByLabel('Matière').inputValue() === 'Matière changée', 'B3 « Continuer à modifier » garde la saisie');
await page.getByRole('button', { name: 'Annuler', exact: true }).click();
await page.getByRole('button', { name: 'Abandonner les modifications' }).click();
await attendre(500);
ok(page.url().includes('#/journalier'), 'B4 « Abandonner » retourne au Journalier');

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
