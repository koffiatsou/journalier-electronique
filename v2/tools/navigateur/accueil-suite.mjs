// De bout en bout : on remplit une vraie séance (objectif, observation, aide, étape « Suite ») dans l'écran Séance, on l'enregistre,
// puis on vérifie que l'accueil l'affiche sur le rendez-vous suivant du même élève.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/accueil-suite.mjs
// Date figée au mardi 27 octobre 2026, 8 h (la démonstration place un rendez-vous d'Élève Bêta ce jour-là).
import { aller } from './_coffre.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log(`✓ ${m}`); };
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-10-27T08:00:00'));
const page = await ctx.newPage();
const erreurs = [];
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données de démonstration' }).click();
await page.locator('.bandeau-demo').waitFor();
await page.locator('.creneau').first().waitFor();

// 1. séance saisie à la main, hier, pour Élève Bêta, avec l'étape « Suite » remplie
await page.getByRole('link', { name: 'Séance' }).first().click();
await page.getByLabel('Élève accompagné').selectOption({ label: 'Bêta Élève' });
await page.getByLabel('Date', { exact: true }).fill('2026-10-26');
await page.getByLabel('Matière').fill('Sciences');
await page.getByLabel('Mon objectif').fill('Retenir le vocabulaire du cycle de l’eau');
await page.locator('#etape-2 .etape-bouton').click();
await page.locator('#etape-corps-2').getByRole('button', { name: 'Maintient son attention' }).click();
await page.locator('#etape-corps-2 li', { hasText: 'Maintient son attention' }).getByRole('radio', { name: 'Partiellement' }).click();
await page.locator('#etape-4 .etape-bouton').click();
await page.locator('#etape-corps-4 li', { hasText: 'Support visuel' }).getByRole('button', { name: 'choisir un niveau' }).click();
await page.locator('#etape-corps-4 li', { hasText: 'Support visuel' }).getByRole('radio', { name: 'Effet positif' }).click();
await page.locator('#etape-corps-4 li', { hasText: 'Guidage verbal' }).getByRole('button', { name: 'choisir un niveau' }).click();
await page.locator('#etape-corps-4 li', { hasText: 'Guidage verbal' }).getByRole('radio', { name: 'Effet partiel' }).click();
await page.locator('#etape-5 .etape-bouton').click();
await page.getByRole('button', { name: 'Préparer un support' }).click();
await page.getByLabel('Format de la prochaine séance').selectOption('Groupe');
await page.getByLabel('Objectif pour la prochaine séance').fill('Légender seul le schéma du cycle de l’eau');
await page.getByRole('button', { name: 'Adaptation à partager avec l’équipe' }).click();
await page.locator('#etape-corps-5').getByLabel('Précision').fill('Apporter la fiche plastifiée.');
await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
await page.getByText('Séance enregistrée').first().waitFor();
console.log('✓ séance saisie et enregistrée par l’écran Séance');

// 2. l'accueil la reprend, avec chacune des informations saisies
await page.getByRole('link', { name: 'Accueil' }).first().click();
await page.locator('.creneau-suite').waitFor();
const bloc = await page.locator('.creneau-suite').innerText();
ok(bloc.includes('26/10/2026') && bloc.includes('Sciences'), 'la date et la matière de la séance d’origine sont indiquées');
ok(bloc.includes('Mon objectif') && bloc.includes('Retenir le vocabulaire du cycle de l’eau'), 'mon objectif repris');
ok(/Ce qui a aidé\s+Support visuel/.test(bloc) && !bloc.includes('Guidage verbal'), 'seule l’aide à effet positif est reprise');
ok(/À retravailler\s+Maintient son attention/.test(bloc), 'le point observé « Partiellement » est repris');
ok(bloc.includes('Légender seul le schéma du cycle de l’eau'), 'objectif prévu repris');
ok(bloc.includes('Préparer un support'), 'action reprise');
ok(!bloc.includes('Groupe') && !bloc.includes('Format'), 'le format de la prochaine séance n’est pas repris');
ok(bloc.includes('Adaptation à partager avec l’équipe'), 'concertation reprise');
ok(bloc.includes('Apporter la fiche plastifiée.'), 'précision reprise');
ok(!bloc.includes('Reformuler la consigne'), 'la note de la séance de démonstration plus ancienne n’est plus affichée');

// le rappel se replie et se déplie d'un toucher
await page.locator('.creneau-suite summary').click();
ok(!(await page.getByText('Retenir le vocabulaire du cycle de l’eau').isVisible()), 'le rappel se replie');
await page.locator('.creneau-suite summary').click();
ok(await page.getByText('Retenir le vocabulaire du cycle de l’eau').isVisible(), '… et se déplie');
await page.waitForTimeout(4000); // laisse partir les messages de confirmation
if (process.env.SORTIE) await page.locator('.journee').screenshot({ path: `${process.env.SORTIE}/accueil-rappel.png` });
await nav.close();
if (erreurs.length) { console.log(erreurs.join('\n')); process.exit(1); }
console.log('✓ aucune erreur console');
