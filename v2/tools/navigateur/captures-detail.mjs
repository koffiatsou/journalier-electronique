// Captures détaillées pour la relecture du lot F : Séance (5 étapes ouvertes une à une), fiche élève, onglets du PIA.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/captures-detail.mjs [préfixe] [largeur] [hauteur] [clair|sombre]
// Images dans SORTIE (par défaut <dossier temporaire>/journalier-navigateur/captures). Données : démonstration (fictives).
import { mkdirSync } from 'node:fs';
import os from 'node:os';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur/captures`;
const prefixe = process.argv[2] ?? 'detail';
const largeur = Number(process.argv[3] ?? 820);
const hauteur = Number(process.argv[4] ?? 1180);
const theme = process.argv[5] === 'sombre' ? 'dark' : 'light';
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, locale: 'fr-BE', colorScheme: theme, hasTouch: largeur < 1100 });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
const photo = (nom) => page.screenshot({ path: `${SORTIE}/${prefixe}-${nom}.png`, fullPage: true });
await page.goto(URL_APP);
await page.getByRole('button', { name: 'Essayer avec des données fictives' }).click();
await page.getByRole('link', { name: 'Accueil' }).first().waitFor({ timeout: 15_000 });
await page.locator('.chargement').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
await page.getByRole('button', { name: 'Charger les données de démonstration' }).click();
await page.locator('.bandeau-demo').waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);
await page.waitForTimeout(3800);

// Séance : chaque étape ouverte
await page.evaluate(() => { location.hash = '#/seance'; });
await page.waitForTimeout(600);
await page.locator('.etape-bouton').first().waitFor();
const nb = await page.locator('.etape-bouton').count();
for (let i = 0; i < nb; i += 1) {
  if (i > 0) { await page.locator('.etape-bouton').nth(i).click(); await page.waitForTimeout(700); }
  if (i === 0) {
    const choix = page.getByLabel('Élève accompagné');
    if (await choix.count()) await choix.selectOption({ index: 1 }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
  await photo(`seance-etape-${i + 1}`);
}

// Élèves : liste, dossier, fiche
await page.evaluate(() => { location.hash = '#/eleves'; });
await page.waitForTimeout(600);
await page.locator('.eleve-carte, .carte-eleve, [class*="eleve-carte"]').first().click().catch(() => undefined);
await page.waitForTimeout(600);
await photo('eleves-dossier');
const modifier = page.getByRole('button', { name: /Modifier/ }).first();
if (await modifier.count()) { await modifier.click(); await page.waitForTimeout(600); await photo('eleves-fiche'); }

// PIA : exemple fictif puis chaque onglet
await page.evaluate(() => { location.hash = '#/pia'; });
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Charger un exemple fictif' }).click().catch(() => undefined);
await page.waitForTimeout(1500);
await photo('pia-0');
const onglets = page.getByRole('tab');
const nbOnglets = await onglets.count();
for (let i = 0; i < nbOnglets; i += 1) {
  await onglets.nth(i).click();
  await page.waitForTimeout(600);
  await photo(`pia-onglet-${i + 1}`);
}
await nav.close();
console.log(`captures écrites dans ${SORTIE}`);
if (erreurs.length) { console.log(erreurs.join('\n')); process.exit(1); }
console.log('✓ aucune erreur console');
