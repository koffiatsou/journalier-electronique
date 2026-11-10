// Vérification dans un vrai navigateur du « lot 3 de l'audit » : tactile et lisibilité (7 novembre 2026).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot3-tactile.mjs
// En contexte tactile (pointeur grossier) à 390 et 768 px, sur tous les écrans :
//   Z : aucun contrôle visible de moins de 44 px ;  T : aucun texte de moins de 12 px ;  D : pas de défilement horizontal ;
//   C : contrastes (bordure des champs ≥ 3:1, texte des activités annulées ≥ 4,5:1), en clair et en sombre.
import { aller } from './_coffre.mjs';

const pw = await import(process.env.PLAYWRIGHT ?? 'playwright');
const { chromium } = pw;
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const TAILLE_MIN_TOUCHER = 44;
const TAILLE_MIN_TEXTE = 12;
const CONTRASTE_CHAMP = 3;
const CONTRASTE_TEXTE = 4.5;
const LIMITE = Number(process.env.LIMITE ?? 6);
const erreurs = [];
const echecs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };
const attendre = (page, ms) => page.waitForTimeout(ms);

/** Contrôles trop petits, textes trop petits, débordement horizontal : relevés dans la page telle qu'elle est affichée. */
function relever([minToucher, minTexte]) {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.right < 0 || r.bottom < 0) return false;
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  };
  const nom = (el) => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} « ${(el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 28)} »`;
  const petits = [];
  const commandes = document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]');
  for (const el of commandes) {
    if (el.closest('.lien-evitement, .sr-only')) continue;
    let cible = el;
    if (el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type)) cible = el.closest('label') ?? el;
    if (!visible(cible)) continue;
    const r = cible.getBoundingClientRect();
    if (r.height < minToucher - 0.5 || r.width < minToucher - 0.5) petits.push(`${nom(el)} ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  const textes = [];
  const arbre = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = arbre.nextNode(); t; t = arbre.nextNode()) {
    if (!t.textContent.trim()) continue;
    const el = t.parentElement;
    if (!el || el.closest('script, style, .sr-only') || !visible(el)) continue;
    const taille = parseFloat(getComputedStyle(el).fontSize);
    if (taille < minTexte - 0.01) textes.push(`${nom(el)} ${taille.toFixed(1)} px`);
  }
  const debord = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  return { petits: [...new Set(petits)], textes: [...new Set(textes)], debord };
}

/** Couleurs lues par un canevas : accepte tout ce que le navigateur sait écrire (color-mix compris). */
function installerOutilsContraste() {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { c.clearRect(0, 0, 1, 1); c.fillStyle = '#000'; c.fillStyle = css; c.fillRect(0, 0, 1, 1); const d = c.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const rapport = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const melange = (dessus, dessous) => dessus.slice(0, 3).map((v, i) => v * dessus[3] + dessous[i] * (1 - dessus[3]));
  const fond = (el) => {
    const pile = [];
    for (let n = el; n; n = n.parentElement) pile.push(rgba(getComputedStyle(n).backgroundColor));
    let sortie = [255, 255, 255];
    for (const f of pile.reverse()) if (f[3] > 0) sortie = melange(f, sortie);
    return sortie;
  };
  const opacite = (el) => { let o = 1; for (let n = el; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; };
  window.__contraste = {
    bordureChamp: (el) => { const cs = getComputedStyle(el); return rapport(rgba(cs.borderTopColor).slice(0, 3), fond(el.parentElement)); },
    texte: (el) => {
      const fondEl = fond(el);
      const o = opacite(el);
      const encre = rgba(getComputedStyle(el).color);
      const effective = melange([encre[0], encre[1], encre[2], encre[3] * o], fondEl);
      return rapport(effective, fondEl);
    }
  };
}

async function ouvrir(navigateur, largeur, theme) {
  const ctx = await navigateur.newContext({
    viewport: { width: largeur, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: 'fr-BE', colorScheme: theme
  });
  await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  page.on('pageerror', (e) => erreurs.push(String(e)));
  await aller(page, URL_APP);
  await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
  await page.getByText('Données d’essai chargées').waitFor();
  await page.evaluate(installerOutilsContraste);
  return { ctx, page };
}

const aller_ = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await attendre(page, 450); };

/** Compare un état de l'application aux trois règles de taille et de débordement. */
async function verifier(page, etiquette) {
  const r = await page.evaluate(relever, [TAILLE_MIN_TOUCHER, TAILLE_MIN_TEXTE]);
  ok(r.petits.length === 0, `${etiquette} : aucun contrôle sous ${TAILLE_MIN_TOUCHER} px${r.petits.length ? ' — ' + r.petits.slice(0, LIMITE).join(' ; ') + (r.petits.length > 6 ? ` (+${r.petits.length - LIMITE})` : '') : ''}`);
  ok(r.textes.length === 0, `${etiquette} : aucun texte sous ${TAILLE_MIN_TEXTE} px${r.textes.length ? ' — ' + r.textes.slice(0, LIMITE).join(' ; ') + (r.textes.length > 6 ? ` (+${r.textes.length - LIMITE})` : '') : ''}`);
  ok(r.debord <= 0, `${etiquette} : pas de défilement horizontal (${r.debord} px)`);
}

async function parcourir(page, label) {
  await aller_(page, '#/accueil');
  await verifier(page, `${label} Accueil`);
  await aller_(page, '#/agenda');
  await verifier(page, `${label} Agenda (affichage par défaut)`);
  for (const vue of ['Jour', 'Mois', 'Semaine']) {
    const bouton = page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: vue, exact: true });
    if (await bouton.count() === 0) continue;
    await bouton.click();
    await attendre(page, 350);
    await verifier(page, `${label} Agenda, vue ${vue}`);
  }
  await aller_(page, '#/seance');
  const etapes = page.locator('.barre-etape');
  const n = await etapes.count();
  ok(n === 5, `${label} Séance : cinq rubriques dans la barre (${n})`);
  for (let i = 0; i < n; i++) {
    await etapes.nth(i).click();
    await attendre(page, 500);
    await verifier(page, `${label} Séance, rubrique ${i + 1}`);
  }
  await aller_(page, '#/journalier');
  await verifier(page, `${label} Journalier`);
  await aller_(page, '#/eleves');
  await verifier(page, `${label} Élèves (liste)`);
  const premier = page.locator('main button, #contenu button').filter({ hasText: /Élève|Alpha|Beta/ }).first();
  if (await premier.count()) {
    await premier.click();
    await attendre(page, 350);
    await verifier(page, `${label} Élèves (dossier)`);
    const modifier = page.getByRole('button', { name: 'Modifier le dossier' });
    if (await modifier.count()) {
      await modifier.click();
      await attendre(page, 350);
      await verifier(page, `${label} Élèves (fiche)`);
    }
  }
  for (const onglet of ['preparer', 'identite', 'profil', 'pv1', 'pv2', 'amenagements']) {
    await aller_(page, `#/pia?eleve=demo-alpha&onglet=${onglet}`);
    await verifier(page, `${label} PIA, onglet ${onglet}`);
  }
  await aller_(page, '#/synchro');
  await verifier(page, `${label} Synchro`);
}

const nav = await chromium.launch();

/* ───────── Z, T, D : tactile, clair ───────── */
for (const largeur of [390, 768]) {
  const { ctx, page } = await ouvrir(nav, largeur, 'light');
  ok(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), `${largeur} px : le pointeur est grossier (le doigt)`);
  await parcourir(page, `[${largeur}]`);
  await ctx.close();
}

/* ───────── L : à 375 px, les sept libellés de la barre du bas tiennent dans leur case, sans être coupés ───────── */
{
  const { ctx, page } = await ouvrir(nav, 375, 'light');
  const mesures = await page.evaluate(() => [...document.querySelectorAll('.nav-lien')].map((a) => {
    const s = a.querySelector('span');
    const r = document.createRange();
    r.selectNodeContents(s);
    return { texte: s.textContent, texteLarg: r.getBoundingClientRect().width, caseLarg: a.getBoundingClientRect().width };
  }));
  ok(mesures.length === 7, `barre du bas : sept onglets (${mesures.length})`);
  for (const m of mesures) ok(m.texteLarg <= m.caseLarg + 0.5, `barre du bas, 375 px : « ${m.texte} » tient dans sa case (${m.texteLarg.toFixed(1)} sur ${m.caseLarg.toFixed(1)} px)`);
  await ctx.close();
}

/* ───────── H : sur un appareil tactile, un survol ne laisse aucune trace (sinon il « colle » après le toucher) ───────── */
{
  const { ctx, page } = await ouvrir(nav, 768, 'light');
  ok(await page.evaluate(() => matchMedia('(hover: none)').matches), 'tactile : le navigateur annonce « hover: none »');
  const fond = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; }, sel);
  const survolee = async (sel, etiquette) => {
    const cible = page.locator(sel).first();
    if (await cible.count() === 0) { ok(false, `survol : ${etiquette} introuvable (${sel})`); return; }
    await page.mouse.move(0, 0);
    await attendre(page, 450);
    const avant = await fond(sel);
    const b = await cible.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await attendre(page, 450);
    const apres = await fond(sel);
    ok(avant === apres, `survol : ${etiquette} ne change pas de fond au toucher (${avant} → ${apres})`);
  };
  await survolee('.nav-lien:not([aria-current="page"])', 'lien du menu');
  await survolee('.theme-bouton', 'bouton du thème');
  await aller_(page, '#/accueil');
  await survolee('button.creneau-tete', 'rendez-vous de « Ma journée »');
  await aller_(page, '#/agenda');
  await survolee('button.cellule', 'case de la grille');
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Mois', exact: true }).click();
  await attendre(page, 350);
  await survolee('.mois-case:not(.aujourdhui):not(.hors-mois)', 'case du mois');
  await ctx.close();
}

/* ───────── C : contrastes, clair et sombre ───────── */
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await ouvrir(nav, 768, theme);
  await aller_(page, '#/eleves');
  const champ = page.locator('.input, .select').first();
  await page.getByRole('button', { name: /Nouvel élève|Ajouter un élève/ }).first().click().catch(() => undefined);
  await attendre(page, 300);
  const champs = page.locator('.input:visible, .select:visible, .textarea:visible');
  const nbChamps = await champs.count();
  ok(nbChamps > 0 || (await champ.count()) > 0, `${theme} : des champs de saisie à mesurer (${nbChamps})`);
  if (nbChamps > 0) {
    const rapports = await champs.evaluateAll((els) => els.map((e) => window.__contraste.bordureChamp(e)));
    const pire = Math.min(...rapports);
    ok(pire >= CONTRASTE_CHAMP, `${theme} : bordure des champs ≥ ${CONTRASTE_CHAMP}:1 (pire : ${pire.toFixed(2)}:1)`);
  }
  await aller_(page, '#/agenda');
  await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click().catch(() => undefined);
  await attendre(page, 350);
  const textes = (sel) => page.locator(sel).evaluateAll((els) => els.map((e) => window.__contraste.texte(e)));
  const nbNormaux = await page.locator('.evt:not(.annule)').count();
  ok(nbNormaux > 0, `${theme} : des activités à mesurer (${nbNormaux})`);
  const normaux = await textes('.evt:not(.annule) strong, .evt:not(.annule) small');
  ok(Math.min(...normaux) >= CONTRASTE_TEXTE, `${theme} : texte des activités (titre et 2e ligne) ≥ ${CONTRASTE_TEXTE}:1 (pire : ${Math.min(...normaux).toFixed(2)}:1, ${normaux.length} textes)`);
  /* Les 14 couleurs d'activité (c-0 à c-9, t-*), l'une après l'autre sur la première activité de la grille. */
  const COULEURS = ['c-0', 'c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6', 'c-7', 'c-8', 'c-9', 't-collaboration', 't-formation', 't-administratif', 't-libre'];
  for (const cl of COULEURS) {
    const r = await page.evaluate((classe) => {
      const e = document.querySelector('.evt:not(.annule)');
      e.className = `evt ${classe}`;
      return [...e.querySelectorAll('strong, small')].map((t) => window.__contraste.texte(t));
    }, cl);
    ok(r.length > 0 && Math.min(...r) >= CONTRASTE_TEXTE, `${theme} : couleur ${cl} ≥ ${CONTRASTE_TEXTE}:1 (pire : ${Math.min(...r).toFixed(2)}:1)`);
  }
  await page.evaluate(() => { for (const e of document.querySelectorAll('.evt')) e.classList.add('annule'); });
  const annules = await textes('.evt.annule strong, .evt.annule small');
  ok(Math.min(...annules) >= CONTRASTE_TEXTE, `${theme} : texte d'une activité annulée ≥ ${CONTRASTE_TEXTE}:1 (pire : ${Math.min(...annules).toFixed(2)}:1, ${annules.length} textes)`);
  await ctx.close();
}

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 3).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
