// Vérification dans un vrai navigateur du « lot 4 de l'audit » : clavier et accessibilité (7 novembre 2026).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot4-clavier.mjs
// De vraies touches (page.keyboard : Tab, Maj+Tab, Échap, Entrée), jamais d'appel direct aux fonctions de l'application.
// A : tiroir « Feuille » (Séance) : Échap le ferme et rend le focus au bouton ; le fond est inerte ; Tab y reste.
// B : panneau de l'agenda : Échap le ferme et rend le focus à l'élément d'origine ; Échap dans la confirmation ne le ferme pas.
import { aller } from './_coffre.mjs';

const pw = await import(process.env.PLAYWRIGHT ?? 'playwright');
const { chromium } = pw;
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const erreurs = [];
const echecs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };
const attendre = (page, ms) => page.waitForTimeout(ms);

const nav = await chromium.launch();

async function ouvrir(largeur, hauteur = 900, options = {}) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: hauteur }, locale: 'fr-BE', ...options });
  await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await aller(page, URL_APP);
  await page.getByRole('button', { name: 'Charger les données de démonstration' }).click();
  await page.getByText('Données de démonstration chargées').waitFor();
  return { ctx, page };
}
const aller_ = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await attendre(page, 500); };
/** Qui a le focus : le texte d'aide pour les messages. */
const focus = (page) => page.evaluate(() => { const e = document.activeElement; return e ? `${e.tagName.toLowerCase()}${e.className ? '.' + String(e.className).split(' ')[0] : ''} « ${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 30)} »` : 'rien'; });

/* ───────── A : tiroir « Feuille » (jusqu'à 1099 px) ───────── */
{
  const { ctx, page } = await ouvrir(834);
  await aller_(page, '#/seance');
  const bouton = page.getByRole('button', { name: 'Feuille', exact: true });
  const tiroir = page.locator('#feuille-apercu');
  await bouton.focus();
  await page.keyboard.press('Enter');
  await attendre(page, 400);
  ok(await tiroir.getAttribute('data-tiroir') === 'true', 'A1 Feuille : Entrée sur le bouton ouvre le tiroir');
  ok(await page.evaluate(() => document.getElementById('feuille-apercu').contains(document.activeElement)), `A2 Feuille : le focus entre dans le tiroir (${await focus(page)})`);
  ok(await tiroir.getAttribute('role') === 'dialog' && await tiroir.getAttribute('aria-modal') === 'true', 'A3 Feuille : le tiroir qui recouvre la page est un dialogue modal (role + aria-modal)');
  ok(await page.evaluate(() => Boolean(document.querySelector('.seance-formulaire')?.closest('[inert]'))), 'A4 Feuille : le formulaire derrière est inerte');
  const sortis = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press('Tab');
    const dehors = await page.evaluate(() => { const e = document.activeElement; return !!e && e !== document.body && (!document.getElementById('feuille-apercu').contains(e) && !e.closest('.barre-action')); });
    if (dehors) sortis.push(await focus(page));
  }
  ok(sortis.length === 0, `A5 Feuille : 14 fois Tab ne mène ni au formulaire ni au menu${sortis.length ? ' — ' + sortis[0] : ''}`);
  await page.keyboard.press('Escape');
  await attendre(page, 400);
  ok(await tiroir.getAttribute('data-tiroir') === 'false', 'A6 Feuille : Échap ferme le tiroir');
  ok(await page.evaluate(() => document.activeElement?.textContent?.trim() === 'Feuille'), `A7 Feuille : le focus revient au bouton « Feuille » (${await focus(page)})`);
  ok(await page.evaluate(() => !document.querySelector('[inert]:not(.etape-corps):not(.etape-corps *)')), 'A8 Feuille : plus rien d’inerte hors des rubriques repliées');
  await ctx.close();
}

/* ───────── B : panneau d'activité de l'agenda ───────── */
for (const largeur of [834, 1280]) {
  const { ctx, page } = await ouvrir(largeur);
  await aller_(page, '#/agenda');
  const evt = page.locator('.evt:not(.annule)').first();
  await evt.focus();
  await page.keyboard.press('Enter');
  await attendre(page, 400);
  const panneau = page.locator('.panneau').first();
  ok(await panneau.count() === 1, `B1 [${largeur}] agenda : Entrée sur une activité ouvre le panneau`);
  ok(await page.evaluate(() => document.querySelector('.panneau').contains(document.activeElement)), `B2 [${largeur}] agenda : le focus entre dans le panneau (${await focus(page)})`);
  const recouvre = await page.evaluate(() => getComputedStyle(document.querySelector('.panneau')).position === 'fixed');
  if (recouvre) {
    ok(await panneau.getAttribute('role') === 'dialog' && await panneau.getAttribute('aria-modal') === 'true', `B3 [${largeur}] agenda : le panneau qui recouvre la page est un dialogue modal`);
    ok(await page.evaluate(() => Boolean(document.querySelector('.grille')?.closest('[inert]'))), `B4 [${largeur}] agenda : la grille derrière est inerte`);
  } else {
    ok(await panneau.getAttribute('aria-modal') === null, `B3 [${largeur}] agenda : à côté de la grille, le panneau n’est pas modal`);
    ok(await page.evaluate(() => !document.querySelector('.grille')?.closest('[inert]')), `B4 [${largeur}] agenda : la grille reste utilisable`);
  }
  // Échap dans la confirmation de suppression : seule la fenêtre se ferme.
  const supprimer = panneau.getByRole('button', { name: /^Supprimer/ });
  if (await supprimer.count()) {
    await supprimer.first().click();
    await attendre(page, 400);
    const dialogue = page.getByRole('dialog', { name: 'Supprimer cette activité ?' });
    ok(await dialogue.isVisible(), `B5 [${largeur}] agenda : la confirmation de suppression s’ouvre`);
    await page.keyboard.press('Escape');
    await attendre(page, 400);
    ok(!(await dialogue.isVisible()) && await page.locator('.panneau').count() === 1, `B6 [${largeur}] agenda : Échap ferme la confirmation sans fermer le panneau`);
  } else ok(false, `B5 [${largeur}] agenda : bouton « Supprimer » introuvable dans le panneau`);
  await page.locator('.panneau').first().focus();
  await page.keyboard.press('Escape');
  await attendre(page, 400);
  ok(await page.locator('.panneau').count() === 0, `B7 [${largeur}] agenda : Échap ferme le panneau`);
  ok(await page.evaluate(() => document.activeElement?.classList.contains('evt')), `B8 [${largeur}] agenda : le focus revient à l’activité d’origine (${await focus(page)})`);
  await ctx.close();
}

/* ───────── C : grille de l'agenda : rôles ARIA valides, un seul parcours de Tab, création au clavier ───────── */
{
  const { ctx, page } = await ouvrir(1280);
  await aller_(page, '#/agenda');
  const arret = await page.evaluate(() => {
    const g = document.querySelector('.grille');
    const arrets = [...g.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')].filter((e) => e.tabIndex >= 0);
    return { cellules: arrets.filter((e) => e.classList.contains('cellule')).length, evenements: arrets.filter((e) => e.classList.contains('evt')).length, total: arrets.length };
  });
  ok(arret.cellules === 0, `C1 grille : aucune case de création dans l’ordre de Tab (${arret.cellules})`);
  ok(arret.evenements > 0 && arret.total === arret.evenements, `C2 grille : seules les activités sont des arrêts de Tab (${arret.total} arrêts, ${arret.evenements} activités)`);
  const orphelins = await page.evaluate(() => [...document.querySelectorAll('[role=row], [role=gridcell], [role=columnheader]')].filter((e) => !e.closest('[role=grid], [role=table], [role=treegrid]')).length);
  ok(orphelins === 0, `C3 grille : aucun rôle row / gridcell / columnheader sans grille ou tableau autour (${orphelins})`);
  ok(await page.locator('.grille .colonne[role=group][aria-label]').count() > 0, 'C4 grille : chaque jour est un groupe étiqueté');
  // La création reste possible au clavier : « Nouvelle activité » de la barre d'outils.
  await page.getByRole('button', { name: 'Nouvelle activité' }).first().focus();
  await page.keyboard.press('Enter');
  await attendre(page, 400);
  ok(await page.locator('.panneau').count() === 1 && await page.evaluate(() => document.querySelector('.panneau').contains(document.activeElement)), 'C5 grille : « Nouvelle activité » ouvre le panneau au clavier, focus dedans');
  await page.keyboard.press('Escape');
  await attendre(page, 300);
  ok(await page.evaluate(() => document.activeElement?.textContent?.includes('Nouvelle activité')), `C6 grille : Échap rend le focus à « Nouvelle activité » (${await focus(page)})`);
  await ctx.close();
}

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
