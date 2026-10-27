// De bout en bout : on remplit l'étape « Suite » d'une vraie séance dans l'écran Séance, on l'enregistre,
// puis on vérifie que l'accueil l'affiche sur le rendez-vous suivant du même élève.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/accueil-suite.mjs
// Date figée au mardi 27 octobre 2026, 8 h (la démonstration place un rendez-vous d'Élève Bêta ce jour-là).
import { aller } from './_coffre.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log(`✓ ${m}`); };
const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1180, height: 820 }, locale: 'fr-BE' });
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
ok(bloc.includes('26/10/2026'), 'la date de la séance d’origine est indiquée');
ok(bloc.includes('Légender seul le schéma du cycle de l’eau'), 'objectif repris');
ok(bloc.includes('Préparer un support'), 'action reprise');
ok(bloc.includes('Format : Groupe'), 'format repris');
ok(bloc.includes('Adaptation à partager avec l’équipe'), 'concertation reprise');
ok(bloc.includes('Apporter la fiche plastifiée.'), 'précision reprise');
ok(!bloc.includes('Reformuler la consigne'), 'la note de la séance de démonstration plus ancienne n’est plus affichée');

await nav.close();
if (erreurs.length) { console.log(erreurs.join('\n')); process.exit(1); }
console.log('✓ aucune erreur console');
