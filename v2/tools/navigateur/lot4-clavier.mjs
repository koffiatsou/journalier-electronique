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
  await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
  await page.getByText('Données d’essai chargées').waitFor();
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

/* ───────── D : Journalier : chaque bouton d'une ligne a un nom qui dit de quelle séance il s'agit ───────── */
{
  const { ctx, page } = await ouvrir(1280);
  await aller_(page, '#/journalier');
  const noms = await page.locator('.journalier-liste .journalier-actions button').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-label') ?? b.textContent.trim()));
  ok(noms.length >= 6, `D1 Journalier : des lignes à mesurer (${noms.length} boutons)`);
  ok(new Set(noms).size === noms.length, `D2 Journalier : tous les noms de boutons sont différents (${new Set(noms).size} sur ${noms.length})`);
  ok(noms.every((n) => /\d{2}\/\d{2}\/\d{4}/.test(n)), `D3 Journalier : chaque nom contient la date de la séance (ex. « ${noms[0]} »)`);
  ok(noms.every((n) => /^(Voir|Masquer|Modifier|Supprimer)/.test(n)), 'D4 Journalier : chaque nom commence par le mot visible (étiquette dans le nom, WCAG 2.5.3)');
  const voir = page.locator('.journalier-liste .journalier-actions button[aria-expanded]').first();
  ok(await voir.getAttribute('aria-controls') === null, 'D5 Journalier : fermé, « Voir » ne pointe vers rien (aria-controls absent)');
  await voir.focus();
  await page.keyboard.press('Enter');
  await attendre(page, 300);
  const cible = await voir.getAttribute('aria-controls');
  ok(Boolean(cible) && await page.evaluate((id) => Boolean(document.getElementById(id)), cible), `D6 Journalier : ouvert, aria-controls désigne l'aperçu affiché (${cible})`);
  ok(await voir.getAttribute('aria-expanded') === 'true', 'D7 Journalier : aria-expanded passe à vrai');
  await ctx.close();
}

/* ───────── E : formulaires : erreur annoncée et focalisée, bouton grisé qui explique pourquoi ───────── */
{
  const { ctx, page } = await ouvrir(1024);
  /** Texte de ce qui décrit un élément (aria-describedby). */
  const decrit = (loc) => loc.evaluate((e) => (e.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent ?? '').join(' '));

  await aller_(page, '#/seance');
  await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
  await attendre(page, 500);
  const invalide = page.locator('.seance-formulaire [aria-invalid="true"]');
  ok(await invalide.count() === 2, `E1 Séance : élève et matière manquants sont marqués aria-invalid (${await invalide.count()})`);
  ok(await page.evaluate(() => document.activeElement?.getAttribute('aria-invalid') === 'true'), `E2 Séance : le focus est sur le premier champ en erreur (${await focus(page)})`);
  ok((await decrit(invalide.first())).includes('Choisissez l’élève'), 'E3 Séance : le champ en erreur est décrit par son message (aria-describedby)');
  const barre = await page.locator('.barre-erreur').innerText();
  ok(barre.includes('Choisissez l’élève') && barre.includes('Indiquez la matière') && !barre.includes('(+'), `E4 Séance : la barre du bas liste toutes les erreurs, sans « (+1) » (« ${barre} »)`);

  await aller_(page, '#/accueil');
  const ajouter = page.getByRole('button', { name: 'Ajouter', exact: true });
  ok(await ajouter.getAttribute('aria-disabled') === 'true' && await ajouter.getAttribute('disabled') === null, 'E5 Accueil : « Ajouter » sans mémo est aria-disabled, pas disabled');
  ok((await decrit(ajouter)).includes('mémo'), `E6 Accueil : « Ajouter » dit pourquoi (« ${await decrit(ajouter)} »)`);
  const avant = await page.locator('.memo-liste li').count();
  await ajouter.click({ force: true });
  await attendre(page, 300);
  ok(await page.locator('.memo-liste li').count() === avant, 'E7 Accueil : cliquer sur le bouton inactif n’ajoute rien');
  await page.getByLabel('Nouveau mémo').fill('Un mémo de test');
  ok(await ajouter.getAttribute('aria-disabled') === null, 'E8 Accueil : une fois le mémo écrit, le bouton est actif');

  await aller_(page, '#/agenda');
  await page.getByRole('button', { name: 'Nouvelle activité' }).first().click();
  await attendre(page, 400);
  const ajouterActivite = page.getByRole('button', { name: 'Ajouter à l’agenda' });
  ok(await ajouterActivite.getAttribute('aria-disabled') === 'true' && await ajouterActivite.getAttribute('disabled') === null, 'E9 Agenda : « Ajouter à l’agenda » sans élève est aria-disabled');
  ok((await decrit(ajouterActivite)).includes('élève'), `E10 Agenda : le bouton dit « Choisissez d’abord l’élève » (« ${await decrit(ajouterActivite)} »)`);

  await aller_(page, '#/eleves');
  await page.getByRole('button', { name: 'Nouvel élève' }).click();
  await attendre(page, 400);
  const enregistrer = page.getByRole('button', { name: 'Enregistrer', exact: true });
  ok(await enregistrer.getAttribute('aria-disabled') === 'true' && await enregistrer.getAttribute('disabled') === null, 'E11 Élèves : « Enregistrer » sans nom est aria-disabled');
  ok((await decrit(enregistrer)).includes('nom'), `E12 Élèves : le bouton dit quoi remplir (« ${await decrit(enregistrer)} »)`);
  ok(await page.getByRole('textbox', { name: /^Nom( |$)/ }).getAttribute('aria-required') === 'true' && await page.getByRole('textbox', { name: /^Prénom( |$)/ }).getAttribute('aria-required') === 'true', 'E13 Élèves : « Nom » et « Prénom » sont marqués obligatoires (aria-required)');
  ok(await page.locator('label:has-text("Nom") .opt', { hasText: 'obligatoire' }).count() > 0, 'E14 Élèves : « obligatoire » est écrit à côté de « Nom »');
  await ctx.close();
}

/* ───────── F : mouvement réduit : plus de translation ni d'échelle, mais les fondus restent ───────── */
{
  /** Images clés (propriétés animées) et durée de chaque animation CSS en cours sur les éléments qui correspondent. */
  const animations = (page, sel) => page.evaluate((s) => document.getAnimations()
    .filter((a) => a.effect?.target?.matches?.(s))
    .map((a) => ({ nom: a.animationName, duree: a.effect.getTiming().duration, proprietes: [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)).filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)))] })), sel);
  const memo = async (page, texte) => { await page.getByLabel('Nouveau mémo').fill(texte); await page.getByRole('button', { name: 'Ajouter', exact: true }).click(); };

  for (const reduit of [false, true]) {
    const etiquette = reduit ? 'mouvement réduit' : 'mouvement normal';
    const { ctx, page } = await ouvrir(1024);
    await page.emulateMedia({ reducedMotion: reduit ? 'reduce' : 'no-preference' });
    ok(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches) === reduit, `F0 ${etiquette} : la préférence est bien émulée`);
    await aller_(page, '#/accueil');
    await memo(page, 'Mémo de mouvement');
    const toast = await animations(page, '.toast');
    ok(toast.length > 0, `F1 ${etiquette} : une notification s’anime (${toast.length})`);
    const avecDeplacement = toast.some((a) => a.proprietes.includes('transform'));
    ok(reduit ? !avecDeplacement : avecDeplacement, `F2 ${etiquette} : l’apparition de la notification ${reduit ? 'n’a plus de translation ni d’échelle' : 'garde son déplacement'} (${toast.map((a) => a.proprietes.join('+')).join(' ; ')})`);
    ok(toast.every((a) => a.proprietes.includes('opacity')), `F3 ${etiquette} : l’apparition est un fondu (opacité animée)`);
    if (reduit) ok(toast.every((a) => a.duree >= 100 && a.duree <= 300), `F4 ${etiquette} : le fondu garde une durée visible, ${toast.map((a) => a.duree).join(', ')} ms (ni 1 ms, ni plus de 300 ms)`);
    // Appui : pas de réduction d'échelle en mouvement réduit (une teinte la remplace).
    const bouton = page.getByRole('button', { name: 'Ajouter', exact: true });
    const b = await bouton.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await attendre(page, 250);
    const transformAppui = await bouton.evaluate((e) => getComputedStyle(e).transform);
    await page.mouse.up();
    ok(reduit ? transformAppui === 'none' : transformAppui !== 'none', `F5 ${etiquette} : à l’appui, ${reduit ? 'le bouton ne change pas d’échelle' : 'le bouton rétrécit légèrement'} (${transformAppui})`);
    // Fenêtre de dialogue.
    await aller_(page, '#/journalier');
    await page.locator('.journalier-liste .journalier-actions .btn-danger').first().click();
    await attendre(page, 60);
    const dialogue = await animations(page, '.dialog');
    ok(dialogue.length > 0 && (reduit ? !dialogue.some((a) => a.proprietes.includes('transform')) : dialogue.some((a) => a.proprietes.includes('transform'))), `F6 ${etiquette} : l’ouverture d’une fenêtre ${reduit ? 'est un simple fondu' : 'garde son déplacement'} (${dialogue.map((a) => a.proprietes.join('+')).join(' ; ')})`);
    await page.keyboard.press('Escape');
    // Rubrique de la séance : pas de décalage de 60 ms, pas de translation du contenu, chevron sans rotation animée.
    await aller_(page, '#/seance');
    const rubrique = await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector('.etape[data-ouvert="true"] .etape-contenu'));
      const chev = getComputedStyle(document.querySelector('.etape[data-ouvert="true"] .etape-chevron'));
      return { delai: c.transitionDelay, transform: c.transform, chevron: chev.transitionDuration };
    });
    ok(reduit ? rubrique.delai.split(', ').every((d) => d === '0s') : true, `F7 ${etiquette} : pas de décalage de 60 ms à l’ouverture d’une rubrique (${rubrique.delai})`);
    ok(reduit ? parseFloat(rubrique.chevron) <= 0.001 : parseFloat(rubrique.chevron) > 0.1, `F8 ${etiquette} : le chevron ${reduit ? 'ne tourne plus en douceur' : 'tourne en douceur'} (${rubrique.chevron})`);
    // Le défilement vers une rubrique reste juste quand le repli est instantané.
    await page.locator('.barre-etape').nth(2).click();
    await attendre(page, 900);
    const haut = await page.evaluate(() => document.getElementById('etape-3').getBoundingClientRect().top);
    ok(haut >= 0 && haut < 300, `F9 ${etiquette} : la rubrique 3 est amenée en haut de l’écran (${Math.round(haut)} px)`);
    await ctx.close();
  }
  // Durée de sortie de la notification : un jeton, pas un nombre écrit en dur.
  const { ctx, page } = await ouvrir(1024);
  await aller_(page, '#/accueil');
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--t-sortie').trim()) !== '', 'F10 la durée de sortie des notifications est un jeton (--t-sortie)');
  await ctx.close();
}

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
