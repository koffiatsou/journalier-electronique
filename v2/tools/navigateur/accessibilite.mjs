// Accessibilité (lot Q) : audit automatique de tous les écrans (clair, sombre, téléphone, 320 px), clavier, fenêtres,
// changement d'écran (titre + focus) et lien d'évitement. Ne remplace pas un essai avec un lecteur d'écran.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/accessibilite.mjs
import { aller } from './_coffre.mjs';
import { afficher, auditerEcran } from './_accessibilite.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const ok = (c, m) => { if (!c) throw new Error(`ÉCHEC : ${m}`); console.log(`✓ ${m}`); };
const erreurs = [];
const problemes = [];
const nav = await chromium.launch();

async function ouvrir(viewport, schema = 'light') {
  const ctx = await nav.newContext({ viewport, locale: 'fr-BE', colorScheme: schema });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  return { ctx, page };
}

const attendre = async (page) => {
  await page.locator('.chargement').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(350);
};
const route = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await attendre(page); };

/** Les écrans à vérifier, chacun avec la façon d'y arriver. */
const ECRANS = [
  ['accueil', (p) => route(p, '#/accueil')],
  ['agenda semaine', async (p) => { await route(p, '#/agenda'); const b = p.getByRole('button', { name: 'Semaine', exact: true }); if (await b.isVisible()) await b.click(); }],
  ['agenda jour', async (p) => { await route(p, '#/agenda'); await p.getByRole('button', { name: 'Jour', exact: true }).click(); }],
  ['agenda mois', async (p) => { await route(p, '#/agenda'); await p.getByRole('button', { name: 'Mois', exact: true }).click(); }],
  ['séance', (p) => route(p, '#/seance')],
  ['journalier', (p) => route(p, '#/journalier')],
  ['élèves', (p) => route(p, '#/eleves')],
  ['pia préparer', (p) => route(p, '#/pia?eleve=demo-alpha&onglet=preparer')],
  ['pia identité', (p) => route(p, '#/pia?eleve=demo-alpha&onglet=identite')],
  ['pia profil', (p) => route(p, '#/pia?eleve=demo-alpha&onglet=profil')],
  ['pia pv1', (p) => route(p, '#/pia?eleve=demo-alpha&onglet=pv1')],
  ['pia pv2', (p) => route(p, '#/pia?eleve=demo-alpha&onglet=pv2')],
  ['pia aménagements', (p) => route(p, '#/pia?eleve=demo-alpha&onglet=amenagements')],
  ['synchro', (p) => route(p, '#/synchro')],
  ['reprise', (p) => route(p, '#/reprise')]
];

async function chargerDemo(page) {
  await route(page, '#/accueil');
  const bouton = page.getByRole('button', { name: 'Charger les données de démonstration' });
  if (await bouton.isVisible().catch(() => false)) {
    await bouton.click();
    await page.locator('.bandeau-demo').waitFor();
    await page.waitForTimeout(800);
  }
}

// 1. Écran verrouillé (avant d'entrer).
{
  const { ctx, page } = await ouvrir({ width: 1280, height: 800 });
  await page.goto(URL_APP);
  await page.getByRole('button', { name: 'Essayer avec des données fictives' }).waitFor({ timeout: 15_000 });
  problemes.push(...await auditerEcran(page, 'verrou', { clavier: 12 }));
  await ctx.close();
}

// 2. Tous les écrans : bureau clair + clavier, bureau sombre, téléphone, 320 px.
const VARIANTES = [
  ['bureau clair', { width: 1280, height: 800 }, 'light', { clavier: 70 }],
  ['bureau sombre', { width: 1280, height: 800 }, 'dark', {}],
  ['téléphone', { width: 390, height: 844 }, 'light', { reflux: true }],
  ['320 px', { width: 320, height: 640 }, 'light', { reflux: true }]
];
for (const [nomVariante, taille, schema, options] of VARIANTES) {
  const { ctx, page } = await ouvrir(taille, schema);
  await aller(page, URL_APP);
  await chargerDemo(page);
  for (const [nom, arriver] of ECRANS) {
    await arriver(page);
    await attendre(page);
    problemes.push(...await auditerEcran(page, `${nom} (${nomVariante})`, options));
  }
  await ctx.close();
}

// 3. Fenêtres de dialogue : nom, focus dedans, Échap, focus rendu au bouton d'origine.
{
  const { ctx, page } = await ouvrir({ width: 1280, height: 800 });
  await aller(page, URL_APP);
  await chargerDemo(page);
  await route(page, '#/agenda');
  for (const bouton of ['Horaires', 'Semaine type']) {
    const ouvreur = page.getByRole('button', { name: bouton, exact: true });
    await ouvreur.focus();
    await ouvreur.press('Enter');
    const fenetre = page.getByRole('dialog');
    await fenetre.waitFor();
    ok((await fenetre.getAttribute('aria-label')) || (await fenetre.locator('h2').first().textContent()), `« ${bouton} » : la fenêtre a un nom`);
    ok(await page.evaluate(() => !!document.activeElement?.closest('dialog')), `« ${bouton} » : le focus est dans la fenêtre`);
    problemes.push(...await auditerEcran(page, `fenêtre ${bouton}`, { sansTitre1: true, clavier: 25 }));
    await page.keyboard.press('Escape');
    await fenetre.waitFor({ state: 'hidden' });
    ok(await ouvreur.evaluate((el) => el === document.activeElement), `« ${bouton} » : Échap ferme et rend le focus au bouton`);
  }
  await ctx.close();
}

// 4. Changement d'écran : titre de l'onglet et focus (WCAG 2.4.2 et 4.1.3 pour une application à une seule page).
{
  const { ctx, page } = await ouvrir({ width: 1280, height: 800 });
  await aller(page, URL_APP);
  const titres = new Set();
  for (const nom of ['Agenda', 'Journalier', 'Élèves', 'PIA', 'Synchro']) {
    await page.getByRole('link', { name: nom, exact: true }).click();
    await attendre(page);
    const titre = await page.title();
    titres.add(titre);
    if (!titre.includes(nom === 'Synchro' ? 'Synchronisation' : nom)) problemes.push({ nom: 'changement d’écran', regle: 'titre de la page', detail: `après « ${nom} », le titre de l’onglet reste « ${titre} »` });
    const focus = await page.evaluate(() => { const a = document.activeElement; return a?.closest('main') || a?.id === 'contenu' ? 'dans le contenu' : `${a?.localName ?? 'rien'}.${a?.className ?? ''}`; });
    if (focus !== 'dans le contenu') problemes.push({ nom: 'changement d’écran', regle: 'focus', detail: `après « ${nom} », le focus reste sur ${focus} au lieu de passer au contenu` });
  }
  // Lien d'évitement : premier arrêt de Tab sur une page neuve.
  await page.goto(`${URL_APP}#/accueil`);
  await page.reload();
  await page.locator('.nav').waitFor();
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Tab');
  const premier = await page.evaluate(() => { const a = document.activeElement; return { texte: a?.textContent?.trim() ?? '', href: a?.getAttribute('href') ?? '' }; });
  if (!/contenu/i.test(premier.texte) || !premier.href.includes('contenu')) problemes.push({ nom: 'accueil', regle: 'lien d’évitement', detail: `le premier arrêt de Tab est « ${premier.texte} », pas un lien « Aller au contenu »` });
  await ctx.close();
}

await nav.close();
const nb = afficher(problemes);
if (erreurs.length) { console.log(`✗ erreurs console :\n  ${[...new Set(erreurs)].join('\n  ')}`); }
ok(erreurs.length === 0, 'aucune erreur console');
ok(nb === 0, `aucun problème d’accessibilité signalé (${nb})`);
