// Audit lot 6 : sur l'écran Séance, les cartes de la rubrique « Fonctionnement » se disposent sur 2 ou 3 colonnes
// (tablette en paysage, portable 13 pouces), le menu se replie tout seul de 1100 à 1499 px sans jamais écraser un choix de l'utilisateur.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-seance-colonnes.mjs
import { aller } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-BE' });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
await page.getByText('Données d’essai chargées').waitFor();

const menu = () => page.evaluate(() => document.documentElement.getAttribute('data-menu'));
const colonnes = () => page.evaluate(() => {
  const g = document.querySelector('.etape-corps:not([inert]) .points');
  return g ? getComputedStyle(g).gridTemplateColumns.split(' ').length : 0;
});
const ouvrirSeance = async (largeur) => {
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.evaluate(() => { location.hash = '#/seance'; });
  await page.waitForTimeout(500);
  if (await colonnes() === 0) {
    await page.getByRole('button', { name: /Fonctionnement/ }).first().click();
    await page.waitForTimeout(600);
  }
};

// [largeur, menu attendu, colonnes au moins]
const CAS = [[1194, 'reduit', 2], [1280, 'reduit', 3], [1440, 'reduit', 3], [1920, null, 3], [834, null, 2]];
for (const [largeur, attendu, minCol] of CAS) {
  await ouvrirSeance(largeur);
  ok(await menu() === attendu, `${largeur} px : menu ${attendu ?? 'inchangé'} (${await menu()})`);
  const n = await colonnes();
  ok(n >= minCol, `${largeur} px : au moins ${minCol} colonnes de cartes (${n})`);
}

// Le repli est provisoire : il n'est pas retenu et disparaît hors de l'écran Séance.
await ouvrirSeance(1280);
ok(await page.evaluate(() => localStorage.getItem('journalier-menu')) === null, 'le repli automatique n’est pas enregistré comme un choix');
await page.evaluate(() => { location.hash = '#/accueil'; });
await page.waitForTimeout(400);
ok(await menu() === null, 'hors de la Séance, le menu reste large');
await page.evaluate(() => { location.hash = '#/seance'; });
await page.waitForTimeout(400);
ok(await menu() === 'reduit', 'revenu sur la Séance, le menu se replie de nouveau');

// Agrandir le menu = un choix : il est gardé, sur la Séance comme ailleurs.
await page.getByRole('button', { name: 'Agrandir le menu' }).click();
await page.waitForTimeout(300);
ok(await menu() === 'ouvert', 'le bouton « Agrandir le menu » ouvre le menu');
await page.evaluate(() => { location.hash = '#/accueil'; });
await page.waitForTimeout(300);
await page.evaluate(() => { location.hash = '#/seance'; });
await page.waitForTimeout(400);
ok(await menu() === 'ouvert', 'le choix « ouvert » n’est pas écrasé par le repli automatique');

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
