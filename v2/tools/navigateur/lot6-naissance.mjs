// Audit lot 6.1 : la date de naissance se saisit dans la fiche de l'élève, reste facultative,
// se retrouve dans l'identité du PIA et dans la base (et partira dans les exports Word, testés ailleurs).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-naissance.mjs
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
await aller(page, `${URL_APP}#/eleves`);

await page.getByRole('button', { name: 'Nouvel élève' }).click();
const champ = page.getByLabel('Date de naissance');
ok(await champ.count() === 1, 'la fiche a un champ « Date de naissance »');
if (await champ.count() === 1) {
  ok(await champ.getAttribute('type') === 'date', 'c’est un champ de date');
  ok(await champ.getAttribute('aria-required') !== 'true', 'il est facultatif');
}

// Sans date : l'enregistrement reste possible.
await page.getByRole('textbox', { name: /^Nom( |$)/ }).fill('Sansdate');
await page.getByRole('textbox', { name: /^Prénom( |$)/ }).fill('Anne');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Anne Sansdate enregistré').first().waitFor();

// Avec une date.
await page.getByRole('button', { name: 'Nouvel élève' }).click();
await page.getByRole('textbox', { name: /^Nom( |$)/ }).fill('Avecdate');
await page.getByRole('textbox', { name: /^Prénom( |$)/ }).fill('Paul');
if (await page.getByLabel('Date de naissance').count() === 1) await page.getByLabel('Date de naissance').fill('2012-03-05');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Paul Avecdate enregistré').first().waitFor();
await page.waitForTimeout(800);
const eleves = await lireBase(page, 'eleves');
const paul = eleves.find((e) => e.nom === 'Avecdate');
ok(paul?.dateNaissance === '2012-03-05', `la date est enregistrée dans la base (${paul?.dateNaissance ?? 'absente'})`);
ok(eleves.find((e) => e.nom === 'Sansdate')?.dateNaissance === '', 'sans saisie, la date reste vide');

// Elle se retrouve dans l'identité du PIA.
if (paul) {
  await page.evaluate((id) => { location.hash = `#/pia?eleve=${id}&onglet=identite`; }, paul.id);
  await page.waitForTimeout(600);
  const texte = await page.locator('.dossier-infos').innerText();
  ok(/05\/03\/2012|5 mars 2012/.test(texte), `l’identité du PIA affiche la date (${texte.replace(/\s+/g, ' ').slice(0, 120)})`);
}

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
