// Vérification dans un vrai navigateur : la matière saisie à la main devient une pastille cochée à « Entrée ».
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/matiere-pastille.mjs
// M1 : séance : Entrée sur une matière absente du dossier → pastille cochée, champ remplacé, valeur gardée.
// M2 : toucher la pastille rouvre le champ avec le texte ; Entrée sur une matière connue reprend la bonne graphie.
// M3 : agenda : même comportement dans le panneau « Nouvelle activité ».
import { mkdirSync } from 'node:fs';
import os from 'node:os';

import { ajouterElevesFictifs, aller, recharger } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1180, height: 820 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

await aller(page, URL_APP);
await ajouterElevesFictifs(page);
await recharger(page);

/* ───────── M1 et M2 : écran Séance ───────── */
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Séance', level: 1 }).waitFor();
await page.getByLabel('Élève accompagné').selectOption('demo-alpha');
const champ = page.getByLabel('Matière', { exact: true });
await champ.fill('Éducation physique');
await champ.press('Enter');
const libre = page.getByRole('button', { name: 'Modifier : Éducation physique' });
await libre.waitFor();
ok(await libre.getAttribute('aria-pressed') === 'true', 'séance : Entrée → la matière devient une pastille cochée');
ok(await page.getByLabel('Matière', { exact: true }).count() === 0, 'séance : le champ est remplacé par la pastille');
ok(await libre.evaluate((e) => e === document.activeElement), 'séance : le focus est sur la pastille (rien n’est perdu)');
await page.screenshot({ path: `${SORTIE}/matiere-pastille.png` });

await libre.click();
const rouvert = page.getByLabel('Matière', { exact: true });
await rouvert.waitFor();
ok((await rouvert.inputValue()) === 'Éducation physique', 'séance : toucher la pastille rouvre le champ avec le texte');
ok(await rouvert.evaluate((e) => e === document.activeElement), 'séance : le curseur est dans le champ');

await rouvert.fill('mathematiques');
await rouvert.press('Enter');
ok((await rouvert.inputValue()) === 'Mathématiques', 'séance : une matière connue reprend sa graphie exacte');
ok(await page.locator('.suggestions .chip[aria-pressed="true"]').count() === 1, 'séance : la pastille de la matière connue est cochée');

/* ───────── M3 : panneau de l'agenda ───────── */
await page.evaluate(() => { location.hash = '#/agenda'; });
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
await page.getByRole('button', { name: 'Nouvelle activité' }).first().click();
await page.getByLabel('Élève', { exact: true }).selectOption('demo-alpha');
const matiere = page.getByPlaceholder('Choisir ou saisir');
await matiere.fill('Éducation physique');
await matiere.press('Enter');
await page.getByRole('button', { name: 'Modifier : Éducation physique' }).waitFor();
ok(await page.getByRole('button', { name: 'Ajouter à l’agenda' }).isVisible(), 'agenda : Entrée n’a pas enregistré ni fermé le panneau');

await nav.close();
ok(erreurs.length === 0, `aucune erreur console (${erreurs.slice(0, 2).join(' | ')})`);
