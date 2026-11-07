// Vérification dans un vrai navigateur du « lot 2b de l'audit » : gestes tactiles de l'agenda et position au retour (7 novembre 2026).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot2b-tactile.mjs
// Profil « iPad Pro 11 » de Playwright (834 px, tactile, pointeur grossier) ; de vrais événements tactiles sont envoyés au navigateur
// par le protocole de Chromium (Input.dispatchTouchEvent), donc les actions par défaut (défilement) sont réellement appliquées.
// T1 : un balayage du doigt fait défiler la page de l'agenda.
// T2 : appui long puis glissement sur une activité : elle est déplacée ET la page ne défile pas pendant le geste.
// T3 : au repos, aucun écouteur « touchmove » non passif sur la page (chaque geste tactile attendrait le fil principal) ;
//      pendant un geste actif, il est en place.
// T4 : « Précédent » du navigateur ramène à la position de défilement que l'on avait quittée ; un lien du menu arrive en haut.
// T5 : mêmes contrôles de base dans WebKit (le moteur de Safari), si WebKit est installé (npx playwright install webkit).
import { aller } from './_coffre.mjs';

const pw = await import(process.env.PLAYWRIGHT ?? 'playwright');
const { chromium, devices } = pw;
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const erreurs = [];
const echecs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };
const attendre = (page, ms) => page.waitForTimeout(ms);

const ipad = devices['iPad Pro 11'];
const nav = await chromium.launch();

/** Contexte tactile du profil iPad, plus bas que l'original pour que l'agenda doive défiler. */
async function ouvrir(navigateur, options = {}) {
  const ctx = await navigateur.newContext({ ...ipad, viewport: { width: 834, height: 640 }, locale: 'fr-BE', ...options });
  await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await aller(page, URL_APP);
  await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
  await page.getByText('Données d’essai chargées').waitFor();
  return { ctx, page };
}

/* ───────── Chromium, profil iPad ───────── */
const { ctx, page } = await ouvrir(nav);
ok(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), 'profil iPad : le pointeur est grossier (le doigt)');
await page.evaluate(() => { location.hash = '#/agenda'; });
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
await attendre(page, 500);

const cdp = await ctx.newCDPSession(page);
const doigt = {
  pose: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }),
  bouge: (x, y) => cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] }),
  leve: () => cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
};
/** Écouteurs « touchmove » posés sur la fenêtre, avec leur caractère passif ou non. */
const ecouteursTouchmove = async () => {
  const { result } = await cdp.send('Runtime.evaluate', { expression: 'window' });
  const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
  return listeners.filter((l) => l.type === 'touchmove');
};
const scrollY = () => page.evaluate(() => scrollY);
const centre = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };

ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 100), 'agenda : la page est plus haute que l’écran (on peut défiler)');

/* T3 : au repos */
const auRepos = await ecouteursTouchmove();
const nonPassifsRepos = auRepos.filter((l) => !l.passive).length;
ok(nonPassifsRepos === 0, `au repos : aucun écouteur touchmove non passif sur la fenêtre (${nonPassifsRepos})`);

/* T1 : balayage */
const vide = await centre(page.locator('button.cellule').first());
await doigt.pose(vide.x, 560);
for (let i = 1; i <= 12; i++) { await doigt.bouge(vide.x, 560 - i * 25); await attendre(page, 16); }
await doigt.leve();
await attendre(page, 600);
const apresBalayage = await scrollY();
ok(apresBalayage > 100, `balayage du doigt : la page défile (scrollY ${apresBalayage})`);
await page.evaluate(() => window.scrollTo(0, 0));
await attendre(page, 200);

/* T2 + T3 : appui long puis glissement sur une activité */
const evt = page.locator('.evt:not(.annule)').first();
await evt.scrollIntoViewIfNeeded();
const depart = await centre(evt);
const hauteurCase = (await page.locator('button.cellule').first().boundingBox()).height;
const bas = depart.y + 2 * hauteurCase < 600;
const cibleY = bas ? depart.y + 2 * hauteurCase : depart.y - 2 * hauteurCase;
const yAvant = await scrollY();
await doigt.pose(depart.x, depart.y);
await attendre(page, 480); // appui long : 320 ms
const pendant = (await ecouteursTouchmove()).filter((l) => !l.passive).length;
ok(pendant >= 1, `pendant un geste actif : un écouteur touchmove non passif bloque le défilement (${pendant})`);
const etapes = 14;
for (let i = 1; i <= etapes; i++) { await doigt.bouge(depart.x, depart.y + ((cibleY - depart.y) * i) / etapes); await attendre(page, 16); }
const yPendant = await scrollY();
await doigt.leve();
await attendre(page, 500);
ok(Math.abs(yPendant - yAvant) <= 2, `appui long + glissement : la page ne défile pas pendant le geste (${yAvant} → ${yPendant})`);
ok(await page.getByText('Activité déplacée').count() > 0, 'appui long + glissement : l’activité est déplacée (notification)');
await attendre(page, 3200);
const apres = (await ecouteursTouchmove()).filter((l) => !l.passive).length;
ok(apres === 0, `après le geste : plus aucun écouteur touchmove non passif (${apres})`);

/* ───────── T4 : position au retour (téléphone) ───────── */
const tel = await ouvrir(nav, { viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true });
await tel.page.evaluate(() => { location.hash = '#/journalier'; });
await tel.page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
await attendre(tel.page, 500);
const hauteur = await tel.page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
await tel.page.evaluate(() => window.scrollTo(0, 800));
await attendre(tel.page, 300);
ok(hauteur > 800 && await tel.page.evaluate(() => scrollY) >= 790, `journalier : la page est défilée avant de partir (${await tel.page.evaluate(() => scrollY)})`);
await tel.page.getByRole('link', { name: 'Élèves' }).click();
await tel.page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
await attendre(tel.page, 400);
ok(await tel.page.evaluate(() => scrollY) === 0, 'menu : un lien du menu arrive en haut de la page');
await tel.page.goBack();
await tel.page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
await attendre(tel.page, 700);
const retour = await tel.page.evaluate(() => scrollY);
ok(Math.abs(retour - 800) <= 20, `« Précédent » : on retrouve la position quittée (${retour}, attendu ≈ 800)`);
await tel.page.getByRole('link', { name: 'Élèves' }).click();
await tel.page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
await tel.page.getByRole('link', { name: 'Journalier' }).click();
await tel.page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
await attendre(tel.page, 500);
ok(await tel.page.evaluate(() => scrollY) === 0, 'un lien du menu vers un écran déjà visité arrive en haut (pas de position rappelée)');
await tel.ctx.close();
await ctx.close();
await nav.close();

/* ───────── T5 : WebKit (moteur de Safari) ───────── */
let webkit = null;
try { webkit = await pw.webkit.launch(); } catch (e) { console.log(`⚠ WebKit indisponible, partie ignorée (${String(e).split('\n')[0]}) : npx playwright install webkit`); }
if (webkit) {
  const w = await ouvrir(webkit);
  await w.page.evaluate(() => { location.hash = '#/seance'; });
  await w.page.getByRole('heading', { name: 'Nouvelle séance', level: 1 }).waitFor();
  await w.page.getByRole('button', { name: /^Étape suivante : 2/ }).tap();
  await attendre(w.page, 1200);
  const titreVisible = await w.page.evaluate(() => {
    const b = document.querySelector('#etape-2 .etape-bouton').getBoundingClientRect();
    const barre = document.querySelector('.barre-etapes').getBoundingClientRect();
    return { haut: b.top, barre: barre.bottom, hauteur: innerHeight };
  });
  ok(titreVisible.haut >= titreVisible.barre - 1 && titreVisible.haut < titreVisible.hauteur, `WebKit : « Étape suivante » amène le titre sous la barre (haut ${Math.round(titreVisible.haut)}, barre ${Math.round(titreVisible.barre)})`);
  await w.page.evaluate(() => { location.hash = '#/agenda'; });
  await w.page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
  await attendre(w.page, 500);
  await w.page.locator('.evt').first().tap();
  ok(await w.page.getByRole('region', { name: 'Modifier l’activité' }).isVisible(), 'WebKit : un toucher sur une activité ouvre son panneau');
  await w.ctx.close();
  await webkit.close();
}

ok(erreurs.length === 0, `aucune erreur console (${erreurs.slice(0, 2).join(' | ')})`);
if (echecs.length) { console.log(`\n${echecs.length} vérification(s) en échec.`); process.exit(1); }
console.log('Lot 2b (gestes tactiles, position au retour) : tout est bon.');
