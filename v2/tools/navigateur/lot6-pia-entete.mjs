// Audit lot 6.5 : le PIA n'a qu'un seul sélecteur d'année, et sa barre d'onglets reste collée en haut quand on défile (tablette, téléphone).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-pia-entete.mjs
import { aller } from './_coffre.mjs';

const { chromium, devices } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
async function ouvrir(options) {
  const ctx = await nav.newContext({ locale: 'fr-BE', ...options });
  await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await aller(page, URL_APP);
  await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
  await page.getByText('Données d’essai chargées').waitFor();
  return { ctx, page };
}
const vers = async (page, onglet, annee = '') => { await page.evaluate(([o, a]) => { location.hash = `#/pia?eleve=demo-alpha&onglet=${o}${a ? `&annee=${a}` : ''}`; }, [onglet, annee]); await page.waitForTimeout(700); };

/* A : un seul sélecteur d'année */
{
  const { ctx, page } = await ouvrir({ viewport: { width: 1280, height: 900 } });
  await vers(page, 'preparer');
  ok(await page.getByLabel('Année scolaire', { exact: true }).count() === 1, 'A1 un seul sélecteur « Année scolaire » dans l’onglet Préparer');
  ok(/Année scolaire 2026-2027/.test(await page.locator('.reunion-grille').nth(1).innerText().catch(() => '')) || /Année scolaire 2026-2027/.test(await page.locator('main, .page').first().innerText()), 'A2 le résumé dit quelle année il couvre');
  await vers(page, 'preparer', '2027-2028');
  ok(/Année scolaire 2027-2028 \(du 1er août/.test(await page.locator('.page').first().innerText()), 'A3 changer l’année en haut change celle du résumé');
  await ctx.close();
}

/* B : onglets collés */
for (const [nom, options] of [['tablette', { ...devices['iPad Pro 11'] }], ['téléphone', { viewport: { width: 375, height: 700 }, hasTouch: true, isMobile: true }]]) {
  const { ctx, page } = await ouvrir(options);
  await vers(page, 'profil');
  await page.evaluate(() => window.scrollTo(0, 700));
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const t = document.querySelector('.pia-onglets').getBoundingClientRect();
    const haut = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--barre-haut')) || 0;
    const barre = document.querySelector('.barre-haut');
    const bas = barre ? barre.getBoundingClientRect().bottom : 0;
    return { top: t.top, bas: Math.max(haut, bas), scrollY: window.scrollY };
  });
  ok(r.scrollY > 300, `B ${nom} : la page a défilé (${Math.round(r.scrollY)} px)`);
  ok(r.top >= -1 && r.top <= r.bas + 4, `B ${nom} : la barre d'onglets reste collée en haut (haut ${Math.round(r.top)} px, sous la barre à ${Math.round(r.bas)} px)`);
  await ctx.close();
}
await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
