// Retours des agents (9/11/2026) : professeur absent mais élève vu, types d'accompagnement précisés, lexique, quatre niveaux,
// en-têtes du Journalier Word colorés par matière.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/retours-agents.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aller, lireBase } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE', acceptDownloads: true });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
await page.getByText('Données d’essai chargées').waitFor();
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Alpha' });
await page.getByLabel('Matière').fill('Mathématiques');

// 1. Présence : « professeur absent, élève vu en individuel » est une séance tenue.
const radios = await page.getByRole('radio').evaluateAll((l) => l.map((r) => r.closest('label')?.textContent?.trim()));
ok(radios.includes('Professeur absent — élève vu en individuel'), `la présence propose « Professeur absent — élève vu en individuel » (${radios.slice(0, 3).join(' | ')})`);
await page.getByRole('radio', { name: 'Professeur absent — élève vu en individuel' }).check();
ok(await page.getByLabel(/Objectif de la leçon/).isVisible(), 'les champs de la séance restent disponibles (ce n’est pas une absence)');

// 2. Types d'accompagnement précisés, avec lexique.
const accomp = await page.locator('.chips').filter({ hasText: 'Accompagnement individuel' }).first().innerText();
ok(/Accompagnement collectif \(en classe\)/.test(accomp) && /Atelier groupe classe/.test(accomp) && /Co-intervention/.test(accomp) && /Co-enseignement/.test(accomp), 'les types d’accompagnement ont les nouveaux noms');
ok(!/Accompagnement groupe classe|Atelier \/ sous-groupe|Cointervention|Coenseignement/.test(accomp), 'les anciens noms ne sont plus proposés');
await page.getByRole('button', { name: 'Accompagnement individuel', exact: true }).click();
await page.getByRole('button', { name: 'Lexique' }).first().click();
const lexique = page.getByRole('dialog', { name: /Lexique des types d’accompagnement/ });
await lexique.waitFor();
ok(/hors de la classe/.test(await lexique.innerText()) && /programme/.test(await lexique.innerText()), 'le lexique des accompagnements s’ouvre avec les définitions');
await lexique.getByRole('button', { name: 'Fermer' }).click();

// 3. Quatre niveaux + lexique des niveaux.
await page.getByRole('button', { name: /Fonctionnement/ }).first().click();
await page.waitForTimeout(500);
await page.locator('.etape-corps:not([inert]) li.point').first().getByRole('button', { name: /choisir un niveau/i }).click();
const mots = await page.locator('.point[data-etat="ouvert"] [role="radio"]').allInnerTexts();
ok(JSON.stringify(mots.map((m) => m.trim())) === JSON.stringify(['Pas du tout', 'Un peu', 'Assez', 'Tout à fait']), `quatre niveaux proposés (${mots.join(' / ')})`);
await page.locator('.point[data-etat="ouvert"]').getByRole('radio', { name: 'Pas du tout' }).click();
await page.locator('.etape-corps:not([inert])').getByRole('button', { name: 'Lexique' }).first().click();
ok(await page.getByRole('dialog', { name: 'Lexique des niveaux' }).count() === 1, 'le lexique des niveaux existe');
await page.getByRole('dialog', { name: 'Lexique des niveaux' }).getByRole('button', { name: 'Fermer' }).click();

// 4. Lexique des aides.
await page.getByRole('button', { name: /Ce qui a aidé/ }).first().click();
await page.waitForTimeout(600);
await page.locator('.etape-corps:not([inert])').getByRole('button', { name: 'Lexique' }).first().click();
const lexiqueAides = page.getByRole('dialog', { name: 'Lexique des aides' });
await lexiqueAides.waitFor();
ok(/Support visuel/.test(await lexiqueAides.innerText()), 'le lexique des aides explique « Support visuel »');
await lexiqueAides.getByRole('button', { name: 'Fermer' }).click();

// 4 bis. « Format de la prochaine séance » reprend les mêmes mots que « Mon intervention ».
await page.getByRole('button', { name: /Suite/ }).first().click();
await page.waitForTimeout(600);
const formats = await page.getByLabel('Format de la prochaine séance').locator('option').allInnerTexts();
ok(JSON.stringify(formats) === JSON.stringify(['Sans changement', 'Accompagnement individuel', 'Accompagnement collectif (en classe)', 'Atelier groupe classe', 'Co-intervention', 'Co-enseignement']), `le format de la prochaine séance reprend les nouveaux mots (${formats.join(' | ')})`);

// 5. Enregistrement puis export Word coloré.
await page.getByRole('button', { name: /Rubrique 1|Séance|Créneau/ }).first().click().catch(() => undefined);
await page.getByLabel(/Objectif de la leçon/).fill('Les fractions');
await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
await page.getByText('Séance enregistrée').first().waitFor();
await page.waitForTimeout(600);
const [seanceBase] = (await lireBase(page, 'seances')).filter((s) => s.profAbsent === true);
ok(seanceBase?.presence === 'present' && seanceBase.observations[0]?.niveau === -1, 'la séance est enregistrée : présence normale, professeur absent, niveau « Pas du tout » (-1)');
await page.evaluate(() => { location.hash = '#/journalier'; });
await page.getByRole('checkbox', { name: /Colorer les en-têtes par matière/ }).check();
ok(await page.getByRole('button', { name: 'Choisir les couleurs' }).isVisible(), 'une fois la case cochée, on peut choisir ses couleurs');
await page.getByRole('button', { name: 'Choisir les couleurs' }).click();
const tableau = page.getByRole('dialog', { name: 'Couleurs des matières' });
await tableau.waitFor();
await tableau.getByLabel('Couleur de Mathématiques').selectOption({ label: 'Violet' });
await tableau.getByRole('button', { name: 'Fermer' }).click();
const choixAlpha = await page.locator('.journalier-filtres select').first().locator('option', { hasText: 'Alpha' }).first().getAttribute('value');
await page.locator('.journalier-filtres select').first().selectOption(choixAlpha);
const [telechargement] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter le Journalier (Word)' }).click()]);
const fichier = path.join(mkdtempSync(path.join(os.tmpdir(), 'retours-')), 'journalier.docx');
await telechargement.saveAs(fichier);
const xml = execFileSync('python', ['-c', 'import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read("word/document.xml").decode())', fichier], { encoding: 'utf8', maxBuffer: 50_000_000 });
ok(xml.includes('w:fill="D9C3E6"'), 'le Journalier Word colore les en-têtes avec la couleur choisie (violet)');
ok(/Mathématiques \(professeur absent\)/.test(xml), 'la case « Cours » dit « professeur absent »');
ok(/Pas du tout/.test(xml), 'le niveau « Pas du tout » est écrit dans le Journalier');

// Le choix est retenu sur l'appareil.
await page.reload();
await page.waitForTimeout(800);
ok(await page.getByRole('checkbox', { name: /Colorer les en-têtes par matière/ }).isChecked(), 'la case « Colorer par matière » est retenue sur l’appareil');

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
