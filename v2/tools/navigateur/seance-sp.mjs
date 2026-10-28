// Lot SP : repères et progression de l'écran Séance (barre d'étapes, jauge, résumés, « Étape suivante », zones de texte).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/seance-sp.mjs
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import { aller } from './_coffre.mjs';
import { afficher, auditerEcran } from './_accessibilite.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log(`✓ ${m}`); };
const erreurs = [];
const nav = await chromium.launch();

for (const schema of ['light', 'dark']) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 }, locale: 'fr-BE', colorScheme: schema });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await aller(page, URL_APP);
  await page.getByRole('button', { name: 'Charger les données de démonstration' }).click().catch(() => undefined);
  await page.evaluate(() => { location.hash = '#/seance'; });
  await page.locator('.barre-etapes').waitFor();

  const jauge = () => page.locator('.jauge-texte').innerText();
  ok(await jauge() === '0/5 rubriques renseignées', `${schema} : la jauge démarre à 0/5`);
  ok(await page.locator('.barre-etape').count() === 5, `${schema} : cinq rubriques dans la barre`);
  ok(await page.locator('.etape[data-zone="peda"]').count() === 2, `${schema} : deux rubriques pédagogiques (1 et 3)`);
  ok(await page.locator('.legende-zones').isVisible(), `${schema} : légende des deux zones dans la Feuille`);

  await page.locator('#etape-corps-1 select').first().selectOption('demo-alpha');
  await page.locator('#etape-corps-1 .field', { hasText: 'Matière' }).locator('input, select').first().fill('Français').catch(async () => {
    await page.locator('#etape-corps-1 .field', { hasText: 'Matière' }).locator('select').selectOption({ index: 1 });
  });
  ok(await jauge() === '1/5 rubriques renseignées', `${schema} : la jauge avance à 1/5`);

  await page.locator('#etape-1 .etape-pied button').click();
  await page.waitForTimeout(500);
  ok(await page.locator('#etape-1 .etape-bouton').getAttribute('aria-expanded') === 'false', `${schema} : « Étape suivante » referme la rubrique 1`);
  ok(await page.locator('#etape-2 .etape-bouton').getAttribute('aria-expanded') === 'true', `${schema} : … et ouvre la rubrique 2`);
  ok((await page.locator('#etape-1 .etape-resume').innerText()).startsWith('Français'), `${schema} : résumé d'une ligne sous la rubrique fermée`);
  ok(await page.locator('.barre-etape[data-etat="remplie"]').count() === 1, `${schema} : ✓ sur la rubrique faite dans la barre`);
  ok(await page.locator('.barre-etape[aria-current="step"]').innerText().then((t) => t.includes('Fonctionnement')), `${schema} : la rubrique ouverte est marquée`);

  await page.locator('.barre-etape', { hasText: 'Suite' }).click();
  await page.waitForTimeout(500);
  ok(await page.locator('#etape-5 .etape-bouton').getAttribute('aria-expanded') === 'true', `${schema} : un clic sur la barre ouvre la rubrique`);
  ok(await page.locator('#etape-5 .etape-pied').count() === 0, `${schema} : pas de bouton « suivante » sur la dernière rubrique`);
  await page.locator('.barre-etape', { hasText: 'Fonctionnement' }).click();
  await page.waitForTimeout(500);
  ok(await page.getByText('Astuce : le micro du clavier de la tablette dicte directement dans ce champ.').isVisible(), `${schema} : astuce de dictée visible`);
  const hauteur = await page.locator('#etape-corps-2 .textarea').evaluate((e) => e.getBoundingClientRect().height);
  ok(hauteur >= 120, `${schema} : zone de texte d'au moins 120 px (${Math.round(hauteur)})`);
  const haut = await page.locator('#etape-2 .etape-titre').evaluate((e) => e.getBoundingClientRect().top);
  const bas = await page.locator('.barre-etapes').evaluate((e) => e.getBoundingClientRect().bottom);
  ok(haut >= bas - 1, `${schema} : le titre de la rubrique n'est pas caché sous la barre collée`);

  const defauts = await auditerEcran(page, `séance ${schema}`);
  ok(defauts.length === 0, `${schema} : audit d'accessibilité à 0 défaut${defauts.length ? ` — ${afficher(defauts)}` : ''}`);
  await page.screenshot({ path: `${SORTIE}/seance-sp-${schema}.png` });
  await ctx.close();
}

await nav.close();
ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
