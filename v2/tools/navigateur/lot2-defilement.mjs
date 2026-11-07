// Vérification dans un vrai navigateur du « lot 2 de l'audit » : le défilement natif (7 novembre 2026).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot2-defilement.mjs
// S1 : « Étape suivante » et les pastilles amènent le titre de la rubrique visée sous la barre d'étapes, jamais caché ni hors écran.
// S2 : un champ qui reçoit le focus n'est jamais recouvert par la barre « Enregistrer » ni par la barre d'onglets.
// S3 : la bande des rubriques suit la rubrique active et montre qu'elle déborde.
// S4 : le défilement ne passe pas derrière un dialogue ou le tiroir « Feuille » ; pas de saut de 15 px de la barre de défilement.
// S5 : changer d'écran ramène en haut de page.
import { aller } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const erreurs = [];
const echecs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };
const attendre = (page, ms = 1100) => page.waitForTimeout(ms);

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-BE', hasTouch: true, isMobile: true });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données de démonstration' }).click();
await page.getByText('Données de démonstration chargées').waitFor();

/** Bas de la zone collée en haut (barre du haut + barre d'étapes) et haut de la zone cachée en bas (barre « Enregistrer », barre d'onglets). */
const zones = () => page.evaluate(() => {
  const bas = (s) => { const e = document.querySelector(s); const r = e?.getBoundingClientRect(); return r && r.height > 0 ? r.bottom : 0; };
  const haut = (s) => { const e = document.querySelector(s); const r = e?.getBoundingClientRect(); return r && r.height > 0 ? r.top : innerHeight; };
  return { collerHaut: Math.max(bas('.barre-haut'), bas('.barre-etapes')), cacherBas: Math.min(haut('.barre-action'), haut('.nav')), hauteur: innerHeight };
});

await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Nouvelle séance', level: 1 }).waitFor();

/* ───────── S1 : atterrissage des rubriques ───────── */
for (let i = 1; i <= 4; i++) {
  await page.getByRole('button', { name: new RegExp(`^Étape suivante : ${i + 1}`) }).click();
  await attendre(page);
  const { collerHaut } = await zones();
  const haut = await page.locator(`#etape-${i + 1} .etape-bouton`).evaluate((e) => e.getBoundingClientRect().top);
  const bas = await page.locator(`#etape-${i + 1} .etape-bouton`).evaluate((e) => e.getBoundingClientRect().bottom);
  ok(haut >= collerHaut - 1 && bas <= (await zones()).hauteur, `« Étape suivante » vers la rubrique ${i + 1} : le titre est visible sous la barre (haut ${Math.round(haut)}, barre ${Math.round(collerHaut)})`);
}
for (const n of [1, 3]) {
  await page.locator('.barre-etape').nth(n - 1).click();
  await attendre(page);
  const { collerHaut } = await zones();
  const haut = await page.locator(`#etape-${n} .etape-bouton`).evaluate((e) => e.getBoundingClientRect().top);
  ok(haut >= collerHaut - 1 && haut < 400, `pastille ${n} : le titre est visible sous la barre (haut ${Math.round(haut)}, barre ${Math.round(collerHaut)})`);
}

/* ───────── S3 : la bande suit la rubrique active ───────── */
await page.locator('.barre-etape').nth(4).click();
await attendre(page);
const bande = await page.evaluate(() => {
  const l = document.querySelector('.barre-etapes-liste');
  const a = l.querySelector('[aria-current="step"]').getBoundingClientRect();
  const r = l.getBoundingClientRect();
  return { gauche: a.left - r.left, droite: r.right - a.right, debord: l.scrollWidth > l.clientWidth };
});
ok(bande.debord, 'bande des rubriques : elle déborde sur téléphone');
ok(bande.gauche >= -1 && bande.droite >= -1, `bande : la pastille active est entièrement visible (marges ${Math.round(bande.gauche)} / ${Math.round(bande.droite)})`);
await page.locator('.barre-etape').nth(0).click();
await attendre(page);
const indice = await page.evaluate(() => document.querySelector('.barre-etapes-liste').getAttribute('data-debord'));
ok(indice !== null && indice.includes('droite'), `bande : un indice montre qu'il y a des rubriques à droite (${indice})`);

/* ───────── S2 : le focus n'est jamais sous les barres fixes ───────── */
await page.evaluate(() => window.scrollTo(0, 0));
await page.locator('.barre-etape').nth(0).click();
await attendre(page);
const champs = page.locator('#etape-1 input, #etape-1 select, #etape-1 textarea, #etape-1 button.chip');
const nbChamps = await champs.count();
let caches = 0;
for (let i = 0; i < nbChamps; i++) {
  await champs.nth(i).focus();
  await page.waitForTimeout(150);
  const { collerHaut, cacherBas } = await zones();
  const r = await champs.nth(i).evaluate((e) => { const b = e.getBoundingClientRect(); return { haut: b.top, bas: b.bottom, h: b.height }; });
  if (r.h > 0 && (r.bas > cacherBas + 1 || r.haut < collerHaut - 1)) caches += 1;
}
ok(nbChamps > 5 && caches === 0, `focus : ${nbChamps} champs de la rubrique 1 essayés, ${caches} recouvert(s) par une barre`);

/* ───────── S4 : pas de défilement derrière les dialogues et le tiroir ───────── */
const contenu = await page.evaluate(() => ({
  dialogue: (() => { const d = document.createElement('dialog'); d.className = 'dialog'; document.body.append(d); const v = getComputedStyle(d).overscrollBehaviorY; d.remove(); return v; })(),
  tiroir: getComputedStyle(document.querySelector('.apercu')).overscrollBehaviorY,
  gouttiere: getComputedStyle(document.documentElement).scrollbarGutter
}));
ok(contenu.dialogue === 'contain', `dialogue : overscroll-behavior contain (${contenu.dialogue})`);
ok(contenu.tiroir === 'contain', `tiroir « Feuille » : overscroll-behavior contain (${contenu.tiroir})`);
ok(contenu.gouttiere.startsWith('stable'), `page : scrollbar-gutter stable (${contenu.gouttiere})`);

/* ───────── S5 : changer d'écran ramène en haut ───────── */
await page.evaluate(() => window.scrollTo(0, 700));
await page.waitForTimeout(200);
ok(await page.evaluate(() => scrollY) > 300, 'la page séance est bien défilée avant de changer d’écran');
await page.evaluate(() => { location.hash = '#/eleves'; });
await page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
await page.waitForTimeout(300);
ok(await page.evaluate(() => scrollY) === 0, 'changer d’écran : on arrive en haut de la page');

await nav.close();
ok(erreurs.length === 0, `aucune erreur console (${erreurs.slice(0, 2).join(' | ')})`);
if (echecs.length) { console.log(`\n${echecs.length} vérification(s) en échec.`); process.exit(1); }
console.log('Lot 2 (défilement natif) : tout est bon.');
