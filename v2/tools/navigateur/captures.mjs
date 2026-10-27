// Captures d'écran de tous les écrans, à plusieurs tailles et dans les deux thèmes (outil de relecture visuelle du lot F).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/captures.mjs [préfixe]
// Les images sont écrites dans SORTIE (par défaut <dossier temporaire>/journalier-navigateur/captures).
// Tailles : tablette en paysage, tablette en portrait, ordinateur, téléphone. Données : démonstration (fictives).
import { mkdirSync } from 'node:fs';
import os from 'node:os';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur/captures`;
const prefixe = process.argv[2] ?? 'captures';
mkdirSync(SORTIE, { recursive: true });

const APPAREILS = [
  ['tablette-paysage', { width: 1180, height: 820 }],
  ['tablette-portrait', { width: 820, height: 1180 }],
  ['pc', { width: 1440, height: 900 }],
  ['telephone', { width: 390, height: 844 }]
];
const ECRANS = ['accueil', 'agenda', 'seance', 'journalier', 'eleves', 'pia', 'synchro'];
const erreurs = [];
const nav = await chromium.launch();
for (const [nom, taille] of APPAREILS) {
  for (const theme of ['light', 'dark']) {
    const ctx = await nav.newContext({ viewport: taille, locale: 'fr-BE', colorScheme: theme, hasTouch: nom !== 'pc' });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') erreurs.push(`${nom}/${theme}: ${m.text()}`); });
    page.on('pageerror', (e) => erreurs.push(`${nom}/${theme}: ${e}`));
    await page.goto(URL_APP);
    const essai = page.getByRole('button', { name: 'Essayer avec des données fictives' });
    await essai.waitFor({ timeout: 15_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SORTIE}/${prefixe}-${nom}-${theme}-connexion.png` });
    await essai.click();
    await page.getByRole('link', { name: 'Accueil' }).first().waitFor({ timeout: 15_000 });
    await page.locator('.chargement').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
    await page.getByRole('button', { name: 'Charger les données de démonstration' }).click();
    await page.waitForTimeout(3800); // laisse partir le message de confirmation
    for (const ecran of ECRANS) {
      await page.evaluate((x) => { location.hash = `#/${x}`; }, ecran);
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SORTIE}/${prefixe}-${nom}-${theme}-${ecran}.png` });
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)) {
        erreurs.push(`${nom}/${theme}: défilement horizontal sur « ${ecran} »`);
      }
    }
    await ctx.close();
  }
}
await nav.close();
console.log(`captures écrites dans ${SORTIE}`);
if (erreurs.length) { console.log(erreurs.join('\n')); process.exit(1); }
console.log('✓ aucune erreur console, aucun défilement horizontal');
