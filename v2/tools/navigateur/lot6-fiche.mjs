// Audit lot 6.6 : fiche élève (« Supprimer… » loin d'« Archiver ») et « Copier le texte » d'une séance au Journalier.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-fiche.mjs
import { aller } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE', permissions: ['clipboard-read', 'clipboard-write'] });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
await page.getByText('Données d’essai chargées').waitFor();
const attendre = (ms) => page.waitForTimeout(ms);

await page.evaluate(() => { location.hash = '#/eleves'; });
await attendre(500);
await page.getByText('Alpha', { exact: false }).first().click();
await attendre(400);
const archiver = page.getByRole('button', { name: 'Archiver' });
const supprimer = page.getByRole('button', { name: 'Supprimer…' });
const voir = page.getByRole('button', { name: 'Voir le Journalier' });
ok(await archiver.count() === 1 && await supprimer.count() === 1, 'la fiche a « Archiver » et « Supprimer… »');
if (await archiver.count() === 1 && await supprimer.count() === 1) {
  const a = await archiver.boundingBox();
  const s = await supprimer.boundingBox();
  const v = await voir.boundingBox();
  const ecart = s.x - (a.x + a.width);
  ok(ecart >= 48, `« Supprimer… » est à ${Math.round(ecart)} px d'« Archiver » (48 px au moins)`);
  ok(Math.min(a.y, s.y) > v.y + v.height + 8, '« Archiver » et « Supprimer… » sont sur une ligne à part des actions de tous les jours');
}

await page.evaluate(() => { location.hash = '#/journalier'; });
await attendre(500);
await page.getByRole('button', { name: /^Voir la séance/ }).first().click();
await attendre(400);
const copier = page.getByRole('button', { name: /^Copier le texte de la séance/ });
ok(await copier.count() === 1, 'l’aperçu d’une séance propose « Copier le texte » (nom unique)');
if (await copier.count() === 1) {
  await copier.click();
  await page.getByText('Texte de la séance copié').first().waitFor({ timeout: 4000 }).catch(() => undefined);
  ok(await page.getByText('Texte de la séance copié').count() >= 1, 'la copie est annoncée');
  const presse = await page.evaluate(() => navigator.clipboard.readText());
  ok(/Date/.test(presse) && /Cours/.test(presse) && /ORTHOPÉDAGOGIQUE|Partie/i.test(presse), `le presse-papiers contient le texte de la séance (${presse.replace(/\s+/g, ' ').slice(0, 70)}…)`);
}
await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
