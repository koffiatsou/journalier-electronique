// Vérification dans un vrai navigateur du lot V (retouches après les essais sur tablette, 4 novembre 2026).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot-v.mjs
// V1 : matière sans liste native (pastilles) ; fiche élève : langues juste sous les matières ; plus de question « Utilisé ailleurs ».
// V2 : points de vigilance (échelle de fréquence, jamais classés parmi les acquis).
// V3 : menu de gauche réductible (icônes seules), choix retenu après rechargement.
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

/* ───────── V1 : matière, fiche élève, transfert ───────── */
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Séance', level: 1 }).waitFor();
await page.getByLabel('Élève accompagné').selectOption('demo-alpha');
ok(await page.locator('datalist').count() === 0, 'séance : plus de liste native (datalist)');
const champ = page.getByLabel('Matière', { exact: true });
const pastilles = page.locator('.suggestions .chip');
ok(await pastilles.count() > 0, 'séance : les matières du dossier sont proposées en pastilles');
const nom = (await pastilles.first().innerText()).trim();
await pastilles.first().click();
ok((await champ.inputValue()) === nom, `séance : un toucher remplit la matière (${nom})`);
await pastilles.first().click();
ok((await champ.inputValue()) === '', 'séance : un second toucher la retire');
await champ.fill('Éducation physique');
ok((await champ.inputValue()) === 'Éducation physique', 'séance : la saisie libre reste possible');
await page.evaluate(() => { location.hash = '#/agenda'; });
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
ok(await page.locator('datalist').count() === 0, 'agenda : aucune liste native');

await page.evaluate(() => { location.hash = '#/eleves'; });
await page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
await page.getByRole('button', { name: 'Nouvel élève' }).click();
await page.getByText('Enseignants par cours').waitFor();
const y = async (texte) => (await page.getByText(texte).first().boundingBox()).y;
const yMatieres = await y('Matières suivies');
const yLangues = await y('Langues modernes');
const yEnseignants = await y('Enseignants par cours');
ok(yMatieres < yLangues && yLangues < yEnseignants, 'fiche élève : matières, puis langues, puis enseignants par cours');
await page.getByRole('button', { name: 'Ajouter un cours' }).click();
ok(await page.getByLabel('Matière 1', { exact: true }).evaluate((e) => e.tagName) === 'SELECT', 'fiche élève : la matière d’un cours se choisit dans une liste');
await page.screenshot({ path: `${SORTIE}/v-fiche-eleve.png`, fullPage: true });

/* ───────── V2 : points de vigilance ───────── */
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Séance', level: 1 }).waitFor();
await page.getByLabel('Élève accompagné').selectOption('demo-alpha');
await page.getByLabel('Matière', { exact: true }).fill('Mathématiques');
await page.locator('.barre-etape', { hasText: 'Fonctionnement' }).click();
await page.getByText('Points de vigilance').first().waitFor();
const ligne = page.locator('li.point', { hasText: 'Se désengage / évite la tâche' });
await ligne.getByRole('button', { name: /choisir un niveau/i }).click();
const choix = (await ligne.locator('.pastille').allInnerTexts()).map((t) => t.trim());
ok(JSON.stringify(choix.slice(0, 3)) === JSON.stringify(['Ponctuellement', 'Souvent', 'Tout au long']), `vigilance : échelle de fréquence (${choix.slice(0, 3)})`);
await ligne.getByRole('radio', { name: 'Tout au long' }).click();
await page.getByLabel('Autre point de vigilance').fill('Se décourage vite');
await page.getByLabel('Autre point de vigilance').press('Enter');
const libre = page.locator('li.point', { hasText: 'Se décourage vite' });
await libre.waitFor();
await libre.getByRole('button', { name: /choisir un niveau/i }).click();
await libre.getByRole('radio', { name: 'Souvent' }).click();
const feuille = await page.locator('.feuille').first().innerText();
ok(/Point de vigilance, tout au long/i.test(feuille) && /se désengage/i.test(feuille), 'vigilance : la feuille écrit la fréquence, pas « Totalement »');
ok(!/Totalement\s*:\s*se désengage/i.test(feuille), 'vigilance : jamais classé parmi les acquis');
await page.screenshot({ path: `${SORTIE}/v-vigilance.png`, fullPage: true });
ok(await page.getByText('Utilisé ailleurs que pendant la séance').count() === 0, 'séance : la question « Utilisé ailleurs » n’existe plus');

/* ───────── V3 : menu réductible ───────── */
const largeur = async () => (await page.locator('.nav').boundingBox()).width;
// Sur l'écran Séance le menu se replie tout seul (lot 6, voir lot6-seance-colonnes) : la largeur « par défaut » se mesure ailleurs.
await page.evaluate(() => { location.hash = '#/accueil'; });
await page.waitForTimeout(400);
ok(await largeur() > 200, `menu : large par défaut en paysage (${Math.round(await largeur())} px)`);
await page.getByRole('button', { name: 'Réduire le menu' }).click();
ok(await largeur() < 90, `menu : réduit (${Math.round(await largeur())} px)`);
ok(await page.locator('html').getAttribute('data-menu') === 'reduit', 'menu : le choix est posé sur la page');
ok(await page.locator('.nav-lien').count() === 7 && await page.locator('.nav-lien').last().isVisible(), 'menu réduit : les 7 icônes restent visibles');
ok(await page.getByRole('link', { name: 'Journalier' }).count() === 1, 'menu réduit : chaque icône garde son nom pour les lecteurs d’écran');
const icones = await page.locator('.nav-lien svg').evaluateAll((l) => l.map((s) => s.innerHTML));
ok(new Set(icones).size === 7, 'menu réduit : les 7 icônes sont toutes différentes');
await page.screenshot({ path: `${SORTIE}/v-menu-reduit.png` });
await recharger(page);
ok(await largeur() < 90, 'menu : le choix « réduit » est retenu après rechargement');
await page.getByRole('button', { name: 'Agrandir le menu' }).click();
ok(await largeur() > 200, 'menu : agrandi de nouveau');
await page.setViewportSize({ width: 820, height: 1100 });
ok(await largeur() > 200, 'portrait : « ouvert » donne le menu large, même sur 820 px');
await page.getByRole('button', { name: 'Réduire le menu' }).click();
ok(await largeur() < 90, 'portrait : « réduit » donne les icônes seules');
await page.setViewportSize({ width: 390, height: 800 });
ok(await page.locator('.nav-bascule').isHidden(), 'téléphone : pas de bouton, la barre du bas reste');
await nav.close();

ok(erreurs.length === 0, `aucune erreur console (${erreurs.slice(0, 2).join(' | ')})`);
console.log('Lot V : tout est bon.');
