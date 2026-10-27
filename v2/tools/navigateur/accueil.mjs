// Accueil (lot A) : ma journée avec la note de la dernière séance, séances passées à encoder, mémos (rattachés à un élève,
// cochés, retirés, conservés après rechargement), état de la synchronisation, téléphone.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/accueil.mjs
// La date du jour est figée au mardi 27 octobre 2026, 8 h (donc : un accompagnement d'Élève Bêta aujourd'hui, un d'Élève Alpha hier).
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import { aller, recharger } from './_coffre.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log(`✓ ${m}`); };
const erreurs = [];
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1180, height: 820 }, locale: 'fr-BE', hasTouch: true });
await ctx.clock.setFixedTime(new Date('2026-10-27T08:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données de démonstration' }).click();
await page.locator('.bandeau-demo').waitFor();
await page.locator('.creneau').first().waitFor();
const journee = page.locator('.journee');
ok(await journee.locator('.creneau').count() === 1, 'ma journée : un seul rendez-vous aujourd’hui');
ok((await journee.locator('.creneau-titre').innerText()).includes('Bêta'), 'c’est celui d’Élève Bêta');
ok(await journee.getByText('Reformuler la consigne avec ses mots avant de commencer').isVisible(), 'la suite notée à la dernière séance est affichée');
ok(await journee.getByRole('button', { name: 'Encoder' }).isVisible(), 'un bouton pour encoder la séance');
ok(await page.getByText('séance passée pas encore encodée').isVisible(), 'la séance d’hier est signalée comme à encoder');

// séance passée à encoder → ouvre la séance préparée
await page.locator('.rattrapage summary').click();
await page.locator('.rattrapage').getByRole('button', { name: 'Encoder' }).click();
await page.waitForFunction(() => location.hash.startsWith('#/seance'));
ok(true, 'le bouton « Encoder » ouvre l’écran Séance');
await page.evaluate(() => { location.hash = '#/accueil'; });
await page.getByRole('heading', { name: 'Ma journée' }).waitFor();

// mémos
await page.getByLabel('Nouveau mémo').fill('Apporter le jeu de cartes');
await page.getByLabel('Pour qui').selectOption({ label: 'Élève Bêta' });
await page.getByRole('button', { name: 'Ajouter' }).click();
await page.getByLabel('Nouveau mémo').fill('Appeler la direction');
await page.getByRole('button', { name: 'Ajouter' }).click();
const liste = page.locator('.memo-liste');
ok(await liste.locator('li').count() === 2, 'deux mémos dans la liste');
ok(await page.locator('.creneau-memos').getByText('Apporter le jeu de cartes').isVisible(), 'le mémo d’Élève Bêta réapparaît sur son rendez-vous');
ok(await page.locator('.creneau-memos li').count() === 1, 'le mémo libre n’y est pas');
await recharger(page);
await page.getByRole('heading', { name: 'Ma journée' }).waitFor();
ok(await page.locator('.memo-liste li').count() === 2, 'les mémos survivent au rechargement');
await page.locator('.creneau-memos').getByRole('checkbox').click();
ok(await page.locator('.creneau-memos').count() === 0, 'cocher le mémo sur le rendez-vous le retire du rendez-vous');
ok(await page.locator('.memo-liste li[data-fait="true"]').count() === 1, '… et le barre dans la liste');
await page.getByRole('button', { name: /Retirer les mémos faits \(1\)/ }).click();
ok(await page.locator('.memo-liste li').count() === 1, 'les mémos faits sont retirés');
await page.getByRole('button', { name: /Supprimer le mémo : Appeler la direction/ }).click();
ok(await page.getByText('Aucun mémo.').isVisible(), 'un mémo se supprime');

// synchronisation
ok(await page.getByText('Pas de synchronisation : vos données restent sur cet appareil.').isVisible(), 'l’état de la synchronisation est rappelé');
await page.screenshot({ path: `${SORTIE}/accueil.png`, fullPage: true });

// téléphone
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)), 'téléphone : pas de défilement horizontal');
ok(await page.getByRole('heading', { name: 'Ma journée' }).isVisible(), 'téléphone : ma journée reste visible');

await nav.close();
if (erreurs.length) { console.log(erreurs.join('\n')); process.exit(1); }
console.log('✓ aucune erreur console');
