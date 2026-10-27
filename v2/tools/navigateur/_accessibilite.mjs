// Audit d'accessibilité commun aux parcours navigateur (lot Q). Aucune dépendance : tout repose sur Playwright et sur
// l'arbre d'accessibilité réel de Chromium (celui que lisent les lecteurs d'écran).
// Ce fichier ne fait pas partie de l'application : il ne sert qu'aux vérifications.
//
// `auditerEcran(page, nom, options)` renvoie une liste de problèmes `{ nom, regle, detail }` (liste vide = rien à signaler).
// Les règles suivent les critères WCAG 2.2 niveau AA qu'un outil peut vérifier seul ; elles ne remplacent pas un essai
// avec un vrai lecteur d'écran.

const ROLES_A_NOMMER = new Set([
  'button', 'link', 'textbox', 'searchbox', 'combobox', 'listbox', 'PopUpButton', 'checkbox', 'radio', 'switch', 'tab',
  'slider', 'spinbutton', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'img', 'dialog', 'progressbar', 'meter'
]);

/** Noms accessibles manquants, lus dans l'arbre d'accessibilité de Chromium (calcul officiel du nom). */
async function nomsManquants(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('Accessibility.enable');
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const manquants = [];
    for (const n of nodes) {
      const role = n.role?.value;
      if (n.ignored || !ROLES_A_NOMMER.has(role)) continue;
      if ((n.name?.value ?? '').trim()) continue;
      let decrit = role;
      if (n.backendDOMNodeId) {
        const { node } = await cdp.send('DOM.describeNode', { backendNodeId: n.backendDOMNodeId }).catch(() => ({ node: null }));
        if (node) {
          const attrs = node.attributes ?? [];
          const classe = attrs[attrs.indexOf('class') + 1];
          decrit = `<${node.localName}${classe ? `.${String(classe).split(' ')[0]}` : ''}> (rôle ${role})`;
        }
      }
      manquants.push(decrit);
    }
    return manquants;
  } finally {
    await cdp.detach().catch(() => undefined);
  }
}

/** Vérifications qui lisent la page (structure, repères, références, contraste, cibles, débordement). */
function lirePage(options) {
  const problemes = [];
  const signaler = (regle, detail) => problemes.push({ regle, detail });
  const visible = (el) => el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
  const decrire = (el) => {
    const classe = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '';
    const texte = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40);
    return `<${el.localName}${classe}>${texte ? ` « ${texte} »` : ''}`;
  };

  // Document : langue, titre, zoom.
  if (!document.documentElement.lang) signaler('langue', 'l’élément <html> n’a pas d’attribut lang');
  if (!document.title.trim()) signaler('titre', 'la page n’a pas de titre');
  const viewport = document.querySelector('meta[name=viewport]')?.getAttribute('content') ?? '';
  if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(viewport)) signaler('zoom', 'le zoom est bloqué par la balise viewport');

  // Repères : un seul <main>, navigations nommées.
  const mains = [...document.querySelectorAll('main, [role=main]')].filter(visible);
  if (mains.length !== 1) signaler('repères', `${mains.length} zone(s) principale(s) (une seule attendue)`);
  const navs = [...document.querySelectorAll('nav, [role=navigation]')].filter(visible);
  if (navs.length > 1) for (const n of navs) if (!n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby')) signaler('repères', 'plusieurs navigations dont une sans nom');

  // Titres : un seul niveau 1, pas de niveau sauté.
  const titres = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].filter(visible)
    .map((h) => ({ h, niveau: /^h[1-6]$/.test(h.localName) ? Number(h.localName[1]) : Number(h.getAttribute('aria-level') ?? 2) }));
  if (!options.sansTitre1) {
    const n1 = titres.filter((t) => t.niveau === 1).length;
    if (n1 !== 1) signaler('titres', `${n1} titre(s) de niveau 1 (un seul attendu)`);
  }
  let precedent = 0;
  for (const { h, niveau } of titres) {
    if (precedent && niveau > precedent + 1) signaler('titres', `niveau sauté : ${decrire(h)} est un niveau ${niveau} après un niveau ${precedent}`);
    precedent = niveau;
  }

  // Identifiants uniques et références valides.
  const ids = new Map();
  for (const el of document.querySelectorAll('[id]')) ids.set(el.id, (ids.get(el.id) ?? 0) + 1);
  for (const [id, n] of ids) if (n > 1) signaler('identifiants', `identifiant « ${id} » utilisé ${n} fois`);
  for (const attr of ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns']) {
    for (const el of document.querySelectorAll(`[${attr}]`)) {
      for (const id of el.getAttribute(attr).split(/\s+/).filter(Boolean)) {
        if (!document.getElementById(id)) signaler('références', `${decrire(el)} : ${attr} pointe vers « ${id} », introuvable`);
      }
    }
  }
  for (const l of document.querySelectorAll('label[for]')) if (!document.getElementById(l.htmlFor)) signaler('références', `étiquette « ${l.textContent.trim().slice(0, 30)} » : champ « ${l.htmlFor} » introuvable`);

  // Images sans texte alternatif ; boutons dans des boutons.
  for (const img of document.querySelectorAll('img:not([alt])')) signaler('images', `image sans attribut alt : ${img.getAttribute('src')}`);
  for (const b of document.querySelectorAll('button button, a button, button a')) signaler('imbrication', `contrôle interactif dans un autre : ${decrire(b)}`);

  // Débordement horizontal de la page (reflux à 320 px).
  if (options.reflux && document.documentElement.scrollWidth > window.innerWidth + 1) {
    signaler('reflux', `la page déborde en largeur (${document.documentElement.scrollWidth} px pour ${window.innerWidth} px)`);
  }

  // Contraste du texte (WCAG 1.4.3) : couleur du texte contre le fond réellement dessiné.
  const canevas = document.createElement('canvas');
  canevas.width = 1; canevas.height = 1;
  const ctx = canevas.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const melanger = (dessus, dessous) => {
    const a = dessus[3] + dessous[3] * (1 - dessus[3]);
    if (a === 0) return [0, 0, 0, 0];
    return [0, 1, 2].map((i) => (dessus[i] * dessus[3] + dessous[i] * dessous[3] * (1 - dessus[3])) / a).concat(a);
  };
  const lum = ([r, g, b]) => {
    const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const fondDe = (el) => {
    const couches = [];
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.backgroundImage !== 'none') return null;
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) couches.push(c);
      if (c[3] >= 0.999) break;
    }
    let fond = rgba(getComputedStyle(document.documentElement).colorScheme.includes('dark') && !getComputedStyle(document.documentElement).colorScheme.includes('light') ? '#121212' : '#ffffff');
    for (let i = couches.length - 1; i >= 0; i -= 1) fond = melanger(couches[i], fond);
    return fond;
  };
  const opaciteDe = (el) => { let o = 1; for (let e = el; e; e = e.parentElement) o *= Number(getComputedStyle(e).opacity); return o; };
  const contrastes = new Map();
  const verifierTexte = (el, couleurCss, libelle) => {
    const s = getComputedStyle(el);
    const fond = fondDe(el);
    if (!fond) { contrastes.set(`image|${decrire(el)}`, { inconnu: true }); return; }
    let texte = rgba(couleurCss);
    texte[3] *= opaciteDe(el);
    texte = melanger(texte, fond);
    const l1 = lum(texte); const l2 = lum(fond);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const px = parseFloat(s.fontSize);
    const gras = Number(s.fontWeight) >= 700;
    const seuil = px >= 24 || (px >= 18.66 && gras) ? 3 : 4.5;
    if (ratio < seuil) contrastes.set(`${libelle}|${decrire(el)}|${couleurCss}`, { ratio: Math.round(ratio * 100) / 100, seuil, el: decrire(el) });
  };
  for (const el of document.body.querySelectorAll('*')) {
    if (!visible(el) || el.closest('.sr-only, [aria-hidden=true], [inert]') || el.closest(':disabled, [aria-disabled=true]')) continue;
    const aTexte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (aTexte) verifierTexte(el, getComputedStyle(el).color, 'texte');
    if (/^(input|textarea)$/.test(el.localName) && el.placeholder && !el.value) verifierTexte(el, getComputedStyle(el, '::placeholder').color, 'indice');
  }
  for (const [, v] of contrastes) {
    if (v.inconnu) continue;
    signaler('contraste', `${v.el} : contraste ${v.ratio}:1 pour ${v.seuil}:1 attendu`);
  }

  // Taille des cibles tactiles (WCAG 2.5.8 : 24 × 24 px au moins ; les liens au milieu d'un texte sont exemptés).
  const cibles = document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=tab], summary');
  for (const el of cibles) {
    if (!visible(el) || el.closest('.sr-only') || el.disabled) continue;
    const s = getComputedStyle(el);
    if (s.display === 'inline' && el.localName === 'a') continue;
    let r = el.getBoundingClientRect();
    if (/^(checkbox|radio)$/.test(el.type ?? '')) {
      const etiquette = el.labels?.[0] ?? el.closest('label');
      if (etiquette) r = etiquette.getBoundingClientRect();
    }
    if (r.width < 24 || r.height < 24) signaler('cible', `${decrire(el)} mesure ${Math.round(r.width)} × ${Math.round(r.height)} px (24 × 24 attendu)`);
  }
  return problemes;
}

/** Mouvement réduit : aucune transition ni animation longue quand l'appareil le demande (WCAG 2.3.3). */
function lireMouvement() {
  const longs = [];
  const duree = (v) => Math.max(0, ...v.split(',').map((x) => { const t = x.trim(); return t.endsWith('ms') ? parseFloat(t) / 1000 : parseFloat(t) || 0; }));
  for (const el of document.body.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    const t = duree(s.transitionDuration); const a = s.animationName !== 'none' ? duree(s.animationDuration) : 0;
    if (t > 0.05 || a > 0.05) longs.push(`<${el.localName}${typeof el.className === 'string' && el.className ? `.${el.className.split(' ')[0]}` : ''}> transition ${t}s animation ${a}s`);
  }
  return longs;
}

/**
 * Parcourt la page à la touche Tab : chaque arrêt doit se voir, rien ne doit piéger ni disparaître.
 * Un élément est reconnu par un numéro propre (pas par sa position : elle change quand la page défile). Un champ de date
 * ou d'heure a plusieurs arrêts internes (jour, mois, année) : plusieurs Tab de suite sur le même champ sont normaux,
 * mais plus de ARRETS_PAR_CHAMP signale un piège.
 */
const ARRETS_PAR_CHAMP = 8;
async function lireClavier(page, maxArrets) {
  const problemes = [];
  await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, 0); });
  await page.keyboard.press('Tab');
  const vus = new Set();
  let depart = null;
  let dernier = null;
  let repetes = 0;
  for (let i = 0; i < maxArrets; i += 1) {
    const arret = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      window.__a11yIds ??= new WeakMap();
      window.__a11yN ??= 0;
      let id = window.__a11yIds.get(el);
      if (!id) { window.__a11yN += 1; id = window.__a11yN; window.__a11yIds.set(el, id); }
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const anneau = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      const classe = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '';
      const nom = (el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
      return { id, lib: `<${el.localName}${classe}>${nom ? ` « ${nom} »` : ''}`, anneau, taille: r.width * r.height, dans: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
    });
    if (!arret) { await page.keyboard.press('Tab'); continue; }
    if (arret.id === dernier) {
      repetes += 1;
      if (repetes > ARRETS_PAR_CHAMP) { problemes.push({ regle: 'clavier', detail: `focus bloqué sur ${arret.lib} (${repetes} Tab de suite)` }); break; }
      await page.keyboard.press('Tab');
      continue;
    }
    repetes = 0;
    dernier = arret.id;
    if (depart === null) depart = arret.id;
    else if (arret.id === depart) break; // le tour de la page est fini : retour au premier arrêt
    if (vus.has(arret.id)) { problemes.push({ regle: 'clavier', detail: `focus en boucle : retour sur ${arret.lib} avant la fin du tour` }); break; }
    vus.add(arret.id);
    if (!arret.anneau) problemes.push({ regle: 'focus visible', detail: `${arret.lib} n’a ni contour ni ombre quand il a le focus` });
    if (arret.taille === 0) problemes.push({ regle: 'clavier', detail: `${arret.lib} reçoit le focus mais n’a aucune taille (invisible)` });
    else if (!arret.dans) problemes.push({ regle: 'clavier', detail: `${arret.lib} reçoit le focus mais reste hors de l’écran` });
    await page.keyboard.press('Tab');
  }
  return { problemes, arrets: vus.size };
}

/**
 * Audite l'écran affiché. options : reflux (vérifie le débordement), sansTitre1 (écran sans titre de niveau 1 attendu),
 * clavier (nombre d'arrêts de Tab à parcourir, 0 = pas de parcours).
 */
export async function auditerEcran(page, nom, options = {}) {
  const trouves = [];
  // On attend la fin des animations d'ouverture (fenêtre, message) : un contraste mesuré en plein fondu serait faux.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  await page.waitForTimeout(60);
  for (const d of await nomsManquants(page)) trouves.push({ regle: 'nom accessible', detail: `${d} n’a pas de nom` });
  for (const p of await page.evaluate(lirePage, options)) trouves.push(p);
  if (options.clavier) {
    const { problemes } = await lireClavier(page, options.clavier);
    trouves.push(...problemes);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const d of await page.evaluate(lireMouvement)) trouves.push({ regle: 'mouvement réduit', detail: d });
  await page.emulateMedia({ reducedMotion: null });
  return trouves.map((p) => ({ nom, ...p }));
}

/** Écrit les problèmes regroupés par règle ; renvoie leur nombre. */
export function afficher(problemes) {
  const parRegle = new Map();
  for (const p of problemes) {
    const cle = `${p.regle} — ${p.detail}`;
    const liste = parRegle.get(cle) ?? [];
    liste.push(p.nom);
    parRegle.set(cle, liste);
  }
  for (const [cle, ecrans] of parRegle) console.log(`✗ ${cle}\n    écrans : ${[...new Set(ecrans)].join(' ; ')}`);
  return problemes.length;
}
