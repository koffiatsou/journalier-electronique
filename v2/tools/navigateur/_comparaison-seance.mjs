// Outil de décision (pas un parcours de test : le nom commence par « _ ») : compare des variantes de mise en page de la rubrique
// « Fonctionnement » de l'écran Séance sur plusieurs appareils, avec un formulaire fictif réellement rempli.
// Lancer : npm run dev (port 5199), puis  SORTIE=<dossier> LANG=C.UTF-8 node tools/navigateur/_comparaison-seance.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { aller } from './_coffre.mjs';

const { chromium, devices } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? 'comparaison';
mkdirSync(SORTIE, { recursive: true });

const APPAREILS = {
  'grand-ecran-1920': { viewport: { width: 1920, height: 1080 } },
  'portable-13p-1440': { viewport: { width: 1440, height: 900 } },
  'portable-13p-1280': { viewport: { width: 1280, height: 800 } },
  'ipad-portrait-834': { ...devices['iPad Pro 11'] },
  'ipad-paysage-1194': { ...devices['iPad Pro 11 landscape'] }
};

const POINTS_FEUILLE_COLONNE = '@media (min-width: 1100px) and (max-width: 1399px) { .seance-colonnes { grid-template-columns: minmax(0, 1fr) 320px !important; } }';
const CARTES_220 = '.points { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)) !important; }';
const VARIANTES = {
  'A-actuel': { css: '' },
  'B-cartes-220': { css: CARTES_220 },
  'C-cartes-220-feuille-320': { css: `${CARTES_220} ${POINTS_FEUILLE_COLONNE}` },
  'D-menu-replie': { css: '', menu: 'reduit' },
  'E-menu-replie-cartes-220': { css: CARTES_220, menu: 'reduit' }
};

const NIVEAUX = ['Partiellement', 'Suffisamment', 'Totalement', 'Suffisamment', 'Partiellement', 'Suffisamment', 'Totalement', 'Suffisamment'];

async function remplir(page) {
  await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Alpha' });
  await page.getByLabel('Matière').fill('Mathématiques');
  await page.getByLabel(/Objectif de la leçon/).fill('Résoudre des équations du premier degré');
  await page.getByRole('button', { name: /Fonctionnement/ }).first().click();
  await page.waitForTimeout(500);
  // Clics faits dans la page (DOM) : les clics « réels » de Playwright en rafale font planter le rendu de Chromium sous Playwright
  // (pas dans l'application : le volet navigateur de l'application tient 8 niveaux d'affilée sans problème).
  await page.evaluate(async (niveaux) => {
    const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
    for (const niveau of niveaux) {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Choisir un niveau');
      if (!b) break;
      b.click();
      await attendre(200);
      const o = [...(document.querySelector('.point[data-etat="ouvert"]')?.querySelectorAll('button') ?? [])].find((x) => x.textContent.includes(niveau));
      if (o) o.click();
      await attendre(250);
    }
  }, NIVEAUX);
}

const resultats = [];
const FILTRE = process.env.APPAREIL;
for (const [nomAppareil, options] of Object.entries(APPAREILS)) {
  if (FILTRE && nomAppareil !== FILTRE) continue;
  for (const [nomVariante, v] of Object.entries(VARIANTES)) {
    if (process.env.VARIANTE && !nomVariante.startsWith(process.env.VARIANTE)) continue;
    // Un navigateur neuf par essai : l'enchaînement de nombreux contextes finit par faire planter Chromium (page crashed).
    const nav = await chromium.launch({ args: ['--disable-gpu', '--disable-dev-shm-usage'] });
    const ctx = await nav.newContext({ locale: 'fr-BE', colorScheme: 'dark', ...options });
    await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
    // La CSP interdit les styles en ligne : la variante est ajoutée à la fin du fichier CSS de l'application au moment où il est servi.
    if (v.css) await ctx.route(/\.css(\?.*)?$/, async (route) => { const r = await route.fetch(); await route.fulfill({ response: r, body: `${await r.text()}
${v.css}` }); });
    const page = await ctx.newPage();
    await aller(page, URL_APP);
    await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
    await page.getByText('Données d’essai chargées').waitFor();
    await page.evaluate(() => { location.hash = '#/seance'; });
    await page.waitForTimeout(600);
    if (v.menu) await page.evaluate((m) => { document.documentElement.dataset.menu = m; }, v.menu);
    try { await remplir(page); } catch (e) { console.log(`remplissage ${nomAppareil}/${nomVariante} : ${String(e).slice(0, 100)}`); }
    await page.waitForTimeout(500);
    // Placer le titre de la rubrique en haut de l'écran, comme après un clic sur la barre d'étapes.
    await page.locator('.etape-corps:not([inert])').first().evaluate((e) => e.scrollIntoView({ block: 'start' })).catch(() => undefined);
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const pts = [...document.querySelectorAll('.etape-corps:not([inert]) .point')];
      const grille = document.querySelector('.etape-corps:not([inert]) .points');
      const colonnes = grille ? getComputedStyle(grille).gridTemplateColumns.split(' ').length : 0;
      const basUtile = window.innerHeight - 96; // barre « Enregistrer » collée en bas
      const visibles = pts.filter((p) => { const r = p.getBoundingClientRect(); return r.top >= 90 && r.bottom <= basUtile; }).length;
      const corps = document.querySelector('.etape-corps:not([inert])');
      const form = document.querySelector('.seance-formulaire');
      const feuille = document.querySelector('.apercu');
      return {
        colonnes, points: pts.length, visibles,
        hauteurRubrique: corps ? Math.round(corps.getBoundingClientRect().height) : 0,
        largeurFormulaire: form ? Math.round(form.getBoundingClientRect().width) : 0,
        feuilleVisible: feuille ? getComputedStyle(feuille).visibility !== 'hidden' && feuille.getBoundingClientRect().width > 100 : false,
        defilementHorizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    });
    await page.screenshot({ path: `${SORTIE}/${nomAppareil}__${nomVariante}.png` });
    resultats.push({ appareil: nomAppareil, variante: nomVariante, ...m });
    console.log(nomAppareil.padEnd(20), nomVariante.padEnd(26), JSON.stringify(m));
    await ctx.close();
    await nav.close();
  }
}
writeFileSync(`${SORTIE}/resultats-${FILTRE ?? 'tous'}.json`, JSON.stringify(resultats, null, 2));
