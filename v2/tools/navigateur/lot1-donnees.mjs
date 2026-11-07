// Vérification dans un vrai navigateur du « lot 1 de l'audit » : protéger les données (7 novembre 2026).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot1-donnees.mjs
// D1 : une séance commencée est retrouvée après un rechargement (« Reprendre ma saisie » / « Repartir de zéro »).
// D2 : un mémo supprimé peut être remis (« Annuler » dans la notification).
// D3 : la confirmation de suppression d'une séance donne le focus à « Annuler », jamais à « Supprimer ».
// D4 : l'agenda ne supprime plus d'un seul toucher : une confirmation s'ouvre, « Annuler » ne supprime rien.
import { aller, recharger } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };
/** Laisse passer l'écriture différée du brouillon (400 ms) avant de recharger. */
const attendreEcriture = (page) => page.waitForTimeout(900);

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1180, height: 820 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données de démonstration' }).click();
await page.getByText('Données de démonstration chargées').waitFor();
await recharger(page);

/* ───────── D1 : brouillon de séance ───────── */
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Nouvelle séance', level: 1 }).waitFor();
ok(await page.locator('.brouillon-retrouve').count() === 0, 'séance : aucun brouillon à proposer au départ');
await page.getByLabel('Élève accompagné').selectOption('demo-alpha');
await attendreEcriture(page);
await recharger(page);
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Nouvelle séance', level: 1 }).waitFor();
ok(await page.locator('.brouillon-retrouve').count() === 0, 'séance : choisir seulement l’élève ne crée pas de brouillon');

await page.getByLabel('Élève accompagné').selectOption('demo-alpha');
await page.getByLabel('Objectif de la leçon').fill('Résoudre des équations du premier degré');
await attendreEcriture(page);
await recharger(page);
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Nouvelle séance', level: 1 }).waitFor();
ok(await page.locator('.brouillon-retrouve').isVisible(), 'séance : après un rechargement, la séance non enregistrée est proposée');
ok((await page.getByLabel('Objectif de la leçon').inputValue()) === '', 'séance : rien n’est appliqué sans l’accord de la personne');
await page.getByRole('button', { name: 'Reprendre ma saisie' }).click();
ok((await page.getByLabel('Objectif de la leçon').inputValue()) === 'Résoudre des équations du premier degré', 'séance : « Reprendre » rend la saisie');
ok(await page.getByLabel('Élève accompagné').inputValue() === 'demo-alpha', 'séance : l’élève est rendu aussi');
ok(await page.locator('.brouillon-retrouve').count() === 0, 'séance : le message disparaît une fois la saisie reprise');

await attendreEcriture(page);
await recharger(page);
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('button', { name: 'Repartir de zéro' }).click();
ok(await page.locator('.brouillon-retrouve').count() === 0, 'séance : « Repartir de zéro » ferme la proposition');
await recharger(page);
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Nouvelle séance', level: 1 }).waitFor();
ok(await page.locator('.brouillon-retrouve').count() === 0, 'séance : après « Repartir de zéro », rien n’est reproposé');

/* ───────── D2 : mémo remis par « Annuler » ───────── */
await page.evaluate(() => { location.hash = '#/'; });
await page.getByPlaceholder('À ne pas oublier…').fill('Mémo du lot 1');
await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
const croix = page.getByRole('button', { name: 'Supprimer le mémo : Mémo du lot 1' });
await croix.waitFor();
await croix.click();
ok(await page.getByRole('button', { name: 'Supprimer le mémo : Mémo du lot 1' }).count() === 0, 'mémo : la croix retire le mémo');
await page.locator('.toast-action', { hasText: 'Annuler' }).click();
ok(await page.getByRole('button', { name: 'Supprimer le mémo : Mémo du lot 1' }).count() === 1, 'mémo : « Annuler » le remet');

/* ───────── D3 : confirmation de suppression d'une séance ───────── */
await page.evaluate(() => { location.hash = '#/journalier'; });
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
const avant = await page.locator('.journalier-liste li').count();
await page.getByRole('button', { name: 'Supprimer' }).first().click();
const dialogue = page.getByRole('dialog', { name: 'Supprimer cette séance ?' });
await dialogue.waitFor();
const focus = await page.evaluate(() => document.activeElement?.textContent?.trim());
ok(focus === 'Annuler', `suppression d’une séance : le focus est sur « Annuler » (${focus})`);
await page.keyboard.press('Enter');
ok(await page.locator('.journalier-liste li').count() === avant, 'suppression d’une séance : Entrée tout de suite ne supprime rien');

/* ───────── D4 : l'agenda demande confirmation ───────── */
await page.evaluate(() => { location.hash = '#/agenda'; });
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
const nbActivites = await page.locator('.evt').count();
ok(nbActivites > 0, `agenda : des activités sont visibles (${nbActivites})`);
await page.locator('.evt').first().click();
await page.getByRole('button', { name: /^Supprimer/ }).click();
const confirmation = page.getByRole('dialog', { name: 'Supprimer cette activité ?' });
await confirmation.waitFor();
ok(await page.locator('.evt').count() === nbActivites, 'agenda : « Supprimer » n’efface rien tout de suite');
ok(await page.evaluate(() => document.activeElement?.textContent?.trim()) === 'Annuler', 'agenda : le focus est sur « Annuler »');
await confirmation.getByRole('button', { name: 'Annuler' }).click();
ok(await page.locator('.evt').count() === nbActivites, 'agenda : « Annuler » ne supprime rien');
await page.getByRole('button', { name: /^Supprimer/ }).click();
await confirmation.getByRole('button', { name: 'Supprimer', exact: true }).click();
await page.getByText('Activité supprimée').waitFor();
ok(await page.locator('.evt').count() === nbActivites - 1, 'agenda : après confirmation, l’activité disparaît');
await nav.close();

ok(erreurs.length === 0, `aucune erreur console (${erreurs.slice(0, 2).join(' | ')})`);
console.log('Lot 1 (protéger les données) : tout est bon.');
