// Vérification dans un vrai navigateur du « lot 5 de l'audit » : cohérence (7 novembre 2026).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot5-coherence.mjs
//   A : aucun texte en capitales forcées (`text-transform: uppercase`) ;
//   B : graisses de police : seulement 400, 600 et 700 (la police du système n'a pas les autres) ;
//   C : l'écran de reprise utilise des jetons qui existent (lisible en sombre, filets visibles) ;
//   D : un seul vocabulaire pour le mode sans compte (« mode essai », « données d'essai ») ;
//   E : un seul ordre des noms, prénom puis nom, sur tous les écrans.
import { aller } from './_coffre.mjs';

const pw = await import(process.env.PLAYWRIGHT ?? 'playwright');
const { chromium } = pw;
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const GRAISSES_PERMISES = new Set(['400', '600', '700']);
const CONTRASTE_TEXTE = 4.5;
const erreurs = [];
const echecs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };
const attendre = (page, ms) => page.waitForTimeout(ms);
const aller_ = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await attendre(page, 450); };

const nav = await chromium.launch();

async function ouvrir(theme = 'light', largeur = 1280, charger = true) {
  const ctx = await nav.newContext({ viewport: { width: largeur, height: 900 }, locale: 'fr-BE', colorScheme: theme });
  await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await aller(page, URL_APP);
  if (charger) {
    await page.getByRole('button', { name: /^Charger les données d’essai$/ }).click();
    await page.getByText(/Données d’essai chargées/).waitFor();
  }
  return { ctx, page };
}

/** Écrans à parcourir : chacun est une suite d'actions qui l'amène à l'état à mesurer. */
const ECRANS = [
  ['Accueil', async (p) => aller_(p, '#/accueil')],
  ['Agenda, semaine', async (p) => aller_(p, '#/agenda')],
  ['Agenda, mois', async (p) => { await aller_(p, '#/agenda'); await p.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Mois', exact: true }).click(); await attendre(p, 350); }],
  ['Agenda, panneau', async (p) => { await aller_(p, '#/agenda'); await p.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click(); await p.getByRole('button', { name: 'Nouvelle activité', exact: true }).click(); await attendre(p, 400); }],
  ['Séance', async (p) => aller_(p, '#/seance')],
  ['Journalier, aperçu', async (p) => { await aller_(p, '#/journalier'); await p.getByRole('button', { name: /^Voir/ }).first().click(); await attendre(p, 400); }],
  ['Élèves', async (p) => aller_(p, '#/eleves')],
  ['PIA, préparer', async (p) => aller_(p, '#/pia?eleve=demo-alpha&onglet=preparer')],
  ['PIA, identité', async (p) => aller_(p, '#/pia?eleve=demo-alpha&onglet=identite')],
  ['PIA, profil', async (p) => aller_(p, '#/pia?eleve=demo-alpha&onglet=profil')],
  ['PIA, procès-verbal 1', async (p) => aller_(p, '#/pia?eleve=demo-alpha&onglet=pv1')],
  ['PIA, aménagements', async (p) => aller_(p, '#/pia?eleve=demo-alpha&onglet=amenagements')],
  ['Synchro', async (p) => aller_(p, '#/synchro')],
  ['Reprise', async (p) => aller_(p, '#/reprise')]
];

/* ───────── A + B + D + E : relevés sur chaque écran ───────── */
{
  const { ctx, page } = await ouvrir('light');
  const majuscules = [];
  const graisses = [];
  const mots = [];
  const ordre = [];
  for (const [nom, preparer] of ECRANS) {
    await preparer(page);
    const r = await page.evaluate(() => {
      const nomDe = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''} « ${(el.textContent ?? '').trim().slice(0, 24)} »`;
      const visible = (el) => { for (let n = el; n; n = n.parentElement) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') return false; } return true; };
      const maj = new Set();
      const gr = new Map();
      const arbre = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let t = arbre.nextNode(); t; t = arbre.nextNode()) {
        const el = t.parentElement;
        if (!t.textContent.trim() || !el || el.closest('script, style') || !visible(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.textTransform === 'uppercase') maj.add(nomDe(el));
        if (!gr.has(cs.fontWeight)) gr.set(cs.fontWeight, nomDe(el));
      }
      const libelles = [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')).join(' | ');
      const toutLeTexte = `${document.body.textContent} | ${libelles}`;
      return { maj: [...maj], gr: [...gr], texte: toutLeTexte };
    });
    for (const m of r.maj) majuscules.push(`${nom} : ${m}`);
    for (const [poids, exemple] of r.gr) if (!GRAISSES_PERMISES.has(poids)) graisses.push(`${nom} : ${poids} (${exemple})`);
    const ancien = r.texte.match(/démonstration|fictif|fictive|faux (OneDrive|Outlook)|V75/i);
    if (ancien) mots.push(`${nom} : « ${ancien[0]} »`);
    const inverse = r.texte.match(/(Alpha|Bêta) Élève/);
    if (inverse) ordre.push(`${nom} : « ${inverse[0]} »`);
  }
  ok(majuscules.length === 0, `A aucun texte en capitales forcées${majuscules.length ? ' — ' + majuscules.slice(0, 4).join(' ; ') : ''}`);
  ok(graisses.length === 0, `B graisses : seulement 400, 600 et 700${graisses.length ? ' — ' + graisses.slice(0, 5).join(' ; ') : ''}`);
  ok(mots.length === 0, `D vocabulaire unique pour le mode sans compte${mots.length ? ' — ' + mots.slice(0, 5).join(' ; ') : ''}`);
  ok(ordre.length === 0, `E prénom puis nom partout (jamais « Alpha Élève »)${ordre.length ? ' — ' + ordre.slice(0, 5).join(' ; ') : ''}`);
  await ctx.close();
}

/* ───────── C : l'écran de reprise en thème sombre (le texte doit rester lisible, les filets visibles) ───────── */
for (const theme of ['dark', 'light']) {
  const { ctx, page } = await ouvrir(theme, 1280, false);
  await aller_(page, '#/accueil');
  const r = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    const rgba = (css) => { c.clearRect(0, 0, 1, 1); c.fillStyle = '#000'; c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]]; };
    const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const rapport = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const hote = document.querySelector('.contenu') ?? document.body;
    hote.insertAdjacentHTML('beforeend', '<div class="reprise-fiche"><pre class="reprise-pia">Texte de contrôle</pre></div>');
    const pre = hote.querySelector('.reprise-pia');
    const fiche = hote.querySelector('.reprise-fiche');
    const sonde = document.createElement('div');
    sonde.style.borderColor = 'var(--line)';
    sonde.style.backgroundColor = 'var(--surface-2)';
    sonde.style.borderStyle = 'solid';
    hote.appendChild(sonde);
    const cs = getComputedStyle(pre);
    const csSonde = getComputedStyle(sonde);
    const sortie = {
      contraste: rapport(rgba(cs.color), rgba(cs.backgroundColor)),
      filetOk: getComputedStyle(fiche).borderTopColor === csSonde.borderTopColor,
      fondOk: cs.backgroundColor === csSonde.backgroundColor
    };
    return sortie;
  });
  ok(r.contraste >= CONTRASTE_TEXTE, `C ${theme} : texte de la fiche de reprise ≥ ${CONTRASTE_TEXTE}:1 (${r.contraste.toFixed(2)}:1)`);
  ok(r.filetOk, `C ${theme} : le filet d'une fiche de reprise est la couleur « --line »`);
  ok(r.fondOk, `C ${theme} : le fond du texte repris est la couleur « --surface-2 »`);
  await ctx.close();
}

/* ───────── F : les couleurs de l'agenda viennent de jetons (tokens.css), pas de valeurs recopiées ───────── */
{
  const { ctx, page } = await ouvrir('light', 1280, false);
  const r = await page.evaluate(() => {
    const racine = getComputedStyle(document.documentElement);
    const sonde = document.createElement('div');
    sonde.className = 'c-0';
    document.body.appendChild(sonde);
    const bord = getComputedStyle(sonde).getPropertyValue('--c-bord').trim();
    return { palette: racine.getPropertyValue('--pal-0').trim(), voile: racine.getPropertyValue('--voile').trim(), plaque: racine.getPropertyValue('--plaque-logo').trim(), bord };
  });
  ok(r.palette !== '' && r.bord === r.palette, `F la couleur c-0 de l'agenda est le jeton --pal-0 (${r.palette || 'jeton absent'})`);
  ok(r.voile !== '' && r.plaque !== '', 'F jetons du voile des dialogues et de la plaque du logo définis');
  await ctx.close();
}

/* ───────── G : petits points de présentation ───────── */
{
  const { ctx, page } = await ouvrir('light', 1280, false);
  await aller_(page, '#/agenda');
  await page.emulateMedia({ media: 'print' });
  const transformation = await page.evaluate(() => getComputedStyle(document.querySelector('.agenda-impression-titre')).textTransform);
  ok(transformation === 'none', `G titre imprimé de l'agenda : pas de majuscule forcée au mois (« novembre »), transformation : ${transformation}`);
  await page.emulateMedia({ media: 'screen' });
  const metas = await page.evaluate(() => ({
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') ?? '',
    couleurs: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => `${m.getAttribute('media')} => ${m.getAttribute('content')}`)
  }));
  ok(metas.description.length > 20, 'G la page a une description');
  ok(metas.couleurs.length === 2 && metas.couleurs.some((c) => /light.*#f3f0ea/.test(c)) && metas.couleurs.some((c) => /dark.*#12151e/.test(c)),
    `G theme-color : une valeur pour le clair (fond crème) et une pour le sombre${metas.couleurs.length ? ' — ' + metas.couleurs.join(' ; ') : ''}`);
  await ctx.close();
}

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
