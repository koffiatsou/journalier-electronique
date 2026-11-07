// Audit lot 6.0 : « Nouvel élève » et « Nouvelle activité » survivent à un rechargement ; la reprise est proposée, jamais imposée.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-brouillons.mjs
import { aller, recharger } from './_coffre.mjs';

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
const banniere = () => page.locator('.brouillon-retrouve');
const nom = () => page.getByRole('textbox', { name: /^Nom( |$)/ });

/* ───────── Élève ───────── */
await page.evaluate(() => { location.hash = '#/eleves'; });
await attendre(500);
await page.getByRole('button', { name: 'Nouvel élève' }).click();
ok(await banniere().count() === 0, 'A1 une fiche vierge ne propose rien');
await attendre(900);
await recharger(page);
await page.evaluate(() => { location.hash = '#/eleves'; });
await attendre(500);
await page.getByRole('button', { name: 'Nouvel élève' }).click();
ok(await banniere().count() === 0, 'A2 ouvrir puis quitter une fiche vierge ne laisse aucun brouillon');
await nom().fill('Brouillon');
await page.getByRole('textbox', { name: /^Prénom( |$)/ }).fill('Camille');
await attendre(900);
await recharger(page);
await page.evaluate(() => { location.hash = '#/eleves'; });
await attendre(500);
await page.getByRole('button', { name: 'Nouvel élève' }).click();
ok(await banniere().count() === 1, 'A3 après un rechargement, la fiche commencée est proposée');
ok(await nom().inputValue() === '', 'A4 rien n’est appliqué sans accord (champ Nom vide)');
await page.getByRole('button', { name: 'Reprendre ma saisie' }).click();
ok(await nom().inputValue() === 'Brouillon' && await page.getByRole('textbox', { name: /^Prénom( |$)/ }).inputValue() === 'Camille', 'A5 « Reprendre » remet la saisie');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Camille Brouillon enregistré').first().waitFor();
await attendre(900);
await recharger(page);
await page.evaluate(() => { location.hash = '#/eleves'; });
await attendre(500);
await page.getByRole('button', { name: 'Nouvel élève' }).click();
ok(await banniere().count() === 0, 'A6 après l’enregistrement, plus de brouillon');
await nom().fill('Autre');
await attendre(900);
await recharger(page);
await page.evaluate(() => { location.hash = '#/eleves'; });
await attendre(500);
await page.getByRole('button', { name: 'Nouvel élève' }).click();
await page.getByRole('button', { name: 'Repartir de zéro' }).click();
ok(await banniere().count() === 0 && await nom().inputValue() === '', 'A7 « Repartir de zéro » efface');

/* ───────── Activité ───────── */
await page.evaluate(() => { location.hash = '#/agenda'; });
await attendre(600);
await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click();
await page.getByRole('button', { name: 'Nouvelle activité', exact: true }).click();
await page.locator('.panneau').waitFor();
ok(await banniere().count() === 0, 'B1 un panneau vierge ne propose rien');
await page.getByLabel('Lieu').fill('Salle brouillon');
await attendre(900);
await recharger(page);
await page.evaluate(() => { location.hash = '#/agenda'; });
await attendre(600);
await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click();
await page.getByRole('button', { name: 'Nouvelle activité', exact: true }).click();
await page.locator('.panneau').waitFor();
ok(await banniere().count() === 1, 'B2 après un rechargement, l’activité commencée est proposée');
ok(await page.getByLabel('Lieu').inputValue() === '', 'B3 rien n’est appliqué sans accord');
await page.getByRole('button', { name: 'Reprendre ma saisie' }).click();
ok(await page.getByLabel('Lieu').inputValue() === 'Salle brouillon', 'B4 « Reprendre » remet la saisie');
await page.getByRole('button', { name: 'Fermer le panneau' }).click();
await page.getByRole('button', { name: 'Abandonner les modifications' }).click();
await attendre(900);
await recharger(page);
await page.evaluate(() => { location.hash = '#/agenda'; });
await attendre(600);
await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click();
await page.getByRole('button', { name: 'Nouvelle activité', exact: true }).click();
await page.locator('.panneau').waitFor();
ok(await banniere().count() === 0, 'B5 abandonner le panneau efface le brouillon');

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
