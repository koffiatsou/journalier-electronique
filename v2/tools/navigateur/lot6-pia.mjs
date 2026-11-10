// Audit lot 6.5 : détails du PIA — pas de déplié « Idées » vide, aménagement sur plusieurs lignes, onglet actif ramené à l'écran (téléphone),
// dernière frappe sauvée à la fermeture brutale.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-pia.mjs
import { aller, lireBase } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
await page.getByText('Données d’essai chargées').waitFor();
const attendre = (ms) => page.waitForTimeout(ms);
const vers = async (onglet) => { await page.evaluate((o) => { location.hash = `#/pia?eleve=demo-alpha&onglet=${o}`; }, onglet); await attendre(600); };

await vers('profil');
const vides = await page.evaluate(() => [...document.querySelectorAll('details.pia-idees')].filter((d) => d.children.length <= 1).length);
ok(vides === 0, `aucun déplié « Idées » vide (${vides})`);
ok(await page.locator('details.pia-idees').count() > 0, 'les dépliés qui ont des idées restent');

await vers('amenagements');
await page.getByRole('button', { name: /^Ajouter un aménagement/ }).click().catch(() => undefined);
await attendre(300);
const champ = page.getByLabel('Aménagement 1', { exact: true });
ok(await champ.count() === 1, 'une ligne d’aménagement existe');
if (await champ.count() === 1) {
  ok(await champ.evaluate((e) => e.tagName) === 'TEXTAREA', 'la description d’un aménagement est une zone à plusieurs lignes');
  await champ.fill('Temps supplémentaire pour les évaluations écrites et possibilité de passer certaines épreuves à l’oral');
  await attendre(100);
  ok(await champ.evaluate((e) => e.scrollHeight <= e.clientHeight + 2 || e.clientHeight >= 40), 'le texte long reste lisible (pas tronqué sur une ligne)');
  // Fermeture brutale juste après la frappe : la dernière frappe doit être en base.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await attendre(500);
  const pias = await lireBase(page, 'pia');
  ok(pias.some((p) => JSON.stringify(p).includes('Temps supplémentaire')), 'la dernière frappe est sauvée au « pagehide »');
}

await vers('preparer');
await vers('amenagements');
const visible = await page.evaluate(() => {
  const bande = document.querySelector('.pia-onglets').getBoundingClientRect();
  const actif = document.querySelector('.pia-onglet[aria-selected="true"]').getBoundingClientRect();
  return actif.left >= bande.left - 1 && actif.right <= bande.right + 1;
});
ok(visible, 'téléphone : l’onglet actif « Aménagements » est entièrement visible dans la bande');
const retour = await page.evaluate(() => { document.querySelector('#pia-onglet-preparer')?.click(); return true; });
await attendre(600);
const visible2 = await page.evaluate(() => {
  const bande = document.querySelector('.pia-onglets').getBoundingClientRect();
  const actif = document.querySelector('.pia-onglet[aria-selected="true"]').getBoundingClientRect();
  return actif.left >= bande.left - 1 && actif.right <= bande.right + 1;
});
ok(retour && visible2, 'et le premier onglet redevient visible quand on y revient');

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
