// Audit lot 6.6 : le dossier d'un élève a sa propre adresse (#/eleves?eleve=…) : rechargement et « Précédent » le retrouvent.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-adresse-fiche.mjs
import { aller, recharger } from './_coffre.mjs';

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
const attendre = (ms) => page.waitForTimeout(ms);
const dossierOuvert = async () => (await page.getByRole('button', { name: 'Voir le Journalier' }).count()) === 1;

await page.evaluate(() => { location.hash = '#/eleves'; });
await attendre(500);
await page.locator('.carte-nom', { hasText: 'Alpha' }).first().click();
await attendre(500);
ok(await dossierOuvert(), 'le dossier s’ouvre');
ok(decodeURIComponent(page.url()).includes('#/eleves?eleve=demo-alpha'), `l’adresse désigne l’élève (${page.url().split('#')[1]})`);
await attendre(900);
await recharger(page);
await attendre(600);
ok(await dossierOuvert(), 'après un rechargement, le dossier est toujours ouvert');
await page.getByRole('button', { name: /Tous les élèves/ }).click();
await attendre(500);
ok(!(await dossierOuvert()) && !page.url().includes('eleve='), '« Tous les élèves » revient à la liste (adresse sans élève)');
await page.goBack();
await attendre(500);
ok(await dossierOuvert(), '« Précédent » du navigateur rouvre le dossier');
await page.goBack();
await attendre(500);
ok(!(await dossierOuvert()), 'et encore « Précédent » revient à la liste');
await page.evaluate(() => { location.hash = '#/eleves?eleve=inconnu'; });
await attendre(500);
ok(await page.getByRole('heading', { name: 'Élèves', level: 1 }).count() === 1 && !(await dossierOuvert()), 'un élève inconnu dans l’adresse donne la liste, sans erreur');
await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
