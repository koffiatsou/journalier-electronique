// Vérification dans un vrai navigateur (hors CI pour l'instant, voir lot Q).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/avatars.mjs
// Playwright n'est pas une dépendance du projet : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.
// Parcours Lot 2b : choix d'un avatar dessiné dans la fiche, aperçu en direct, enregistrement (vérifié dans la base),
// affichage dans les cartes / le dossier / le passage d'année, retour aux initiales, thème sombre, téléphone,
// aucune photo, aucune erreur console (donc aucune violation de la politique de sécurité).
import { mkdirSync } from 'node:fs';
import os from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

const lireBase = (magasin) => page.evaluate((nom) => new Promise((resolve, reject) => {
  const ouverture = indexedDB.open('journalier-v2');
  ouverture.onerror = () => reject(ouverture.error);
  ouverture.onsuccess = () => {
    const req = ouverture.result.transaction(nom, 'readonly').objectStore(nom).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  };
}), magasin);

const versEleves = async () => {
  await page.evaluate(() => { location.hash = '#/accueil'; });
  await page.getByRole('link', { name: 'Élèves' }).click();
  await page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
};
const cartes = () => page.locator('.liste-carte:not(.archives) .carte-eleve');
const carte = (nom) => cartes().filter({ hasText: nom }).first();
const ouvrirFiche = async (nom) => {
  await versEleves();
  await carte(nom).click();
  await page.getByRole('button', { name: 'Modifier le dossier' }).click();
  await page.getByRole('heading', { name: 'Modifier le dossier' }).waitFor();
};
const groupe = (nom) => page.getByRole('radiogroup', { name: nom, exact: true });
const choisir = async (nomGroupe, option) => { await groupe(nomGroupe).getByRole('radio', { name: option, exact: true }).click(); };
const apercu = () => page.locator('.choix-avatar-tete .avatar');
const coche = async (nomGroupe, option) => (await groupe(nomGroupe).getByRole('radio', { name: option, exact: true }).getAttribute('aria-checked')) === 'true';

/* ───────── Départ : deux élèves, sans avatar ───────── */
await page.goto(URL_APP);
await page.getByRole('button', { name: 'Ajouter des élèves fictifs' }).click();
await versEleves();
ok((await carte('Alpha').locator('.avatar').innerText()).trim() === 'ÉA', 'sans avatar : initiales ÉA sur la carte');
ok(await carte('Alpha').locator('.avatar svg').count() === 0, 'sans avatar : aucun dessin');

/* ───────── Fiche : choisir un avatar ───────── */
await ouvrirFiche('Alpha');
ok(await page.locator('input[type="file"]').count() === 0, 'aucun envoi de photo possible (pas de champ fichier)');
ok(await page.getByRole('radio', { name: 'Initiales', exact: true }).getAttribute('aria-checked') === 'true', 'au départ : « Initiales » choisi');
ok(await page.getByRole('radiogroup', { name: 'Style' }).count() === 0, 'les réglages n’apparaissent qu’avec « Avatar dessiné »');
await page.getByRole('radio', { name: 'Avatar dessiné', exact: true }).click();
ok(await apercu().locator('svg').count() === 1, 'un dessin apparaît dans l’aperçu');
ok(await page.getByRole('radio', { name: 'Avatar dessiné', exact: true }).getAttribute('aria-checked') === 'true', '« Avatar dessiné » est coché');
for (const [g, n] of [['Style', 5], ['Teint', 6], ['Coiffure', 8], ['Couleur des cheveux', 8], ['Visage', 5], ['Accessoire', 5]]) {
  ok(await groupe(g).getByRole('radio').count() === n, `${g} : ${n} choix`);
  ok(await groupe(g).getByRole('radio', { checked: true }).count() === 1, `${g} : exactement un choix coché`);
}
ok(await groupe('Style').getByRole('radio').allInnerTexts().then((t) => t.join('|') === 'Manga|Bande dessinée|Dessin animé|Pixel|Minimaliste'), 'les cinq styles : Manga, Bande dessinée, Dessin animé, Pixel, Minimaliste');

const dessin = () => apercu().locator('svg').innerHTML();
await choisir('Style', 'Pixel');
const rectsPixel = await apercu().locator('svg rect').count();
ok(rectsPixel >= 15, `style Pixel : dessin fait de carrés (${rectsPixel})`);
let avant = await dessin();
for (const [g, o] of [['Teint', 'Foncé'], ['Coiffure', 'Bouclée'], ['Couleur des cheveux', 'Bleus'], ['Visage', 'Surpris'], ['Accessoire', 'Casque audio']]) {
  // L'avatar de départ est tiré au hasard : s'il a déjà cette valeur, on en prend d'abord une autre.
  if (await coche(g, o)) { await groupe(g).getByRole('radio', { checked: false }).first().click(); avant = await dessin(); }
  await choisir(g, o);
  const apres = await dessin();
  ok(apres !== avant, `l’aperçu change quand on choisit : ${g} → ${o}`);
  ok(await coche(g, o), `${g} : « ${o} » est coché`);
  avant = apres;
}
await page.screenshot({ path: `${SORTIE}/avatar-fiche-pixel-bureau.png`, fullPage: true });

// « Au hasard » garde le style
await page.getByRole('button', { name: 'Au hasard' }).click();
ok(await coche('Style', 'Pixel'), '« Au hasard » garde le style choisi');

// Retour aux initiales puis au dessin : le dernier dessin est retrouvé
await choisir('Style', 'Manga');
await choisir('Teint', 'Hâlé');
await choisir('Coiffure', 'Queue de cheval');
await choisir('Couleur des cheveux', 'Roux');
await choisir('Visage', 'Clin d’œil');
await choisir('Accessoire', 'Lunettes rondes');
await page.getByRole('radio', { name: 'Initiales', exact: true }).click();
ok(await apercu().locator('svg').count() === 0 && (await apercu().innerText()).trim() === 'ÉA', 'retour aux initiales : le dessin disparaît');
ok(await page.getByRole('radiogroup', { name: 'Style' }).count() === 0, 'réglages masqués avec les initiales');
await page.getByRole('radio', { name: 'Avatar dessiné', exact: true }).click();
ok(await coche('Style', 'Manga') && await coche('Coiffure', 'Queue de cheval') && await coche('Visage', 'Clin d’œil') && await coche('Accessoire', 'Lunettes rondes'),
  'revenir au dessin retrouve le dernier choix');
await page.screenshot({ path: `${SORTIE}/avatar-fiche-manga-bureau.png`, fullPage: true });

// La couleur de l'agenda colore le vêtement et le fond
const fondAvant = await apercu().evaluate((e) => getComputedStyle(e.querySelector('.av-haut')).fill);
await page.getByRole('button', { name: 'Vert' }).click().catch(async () => { await page.locator('.pastilles-couleur button').nth(2).click(); });
const fondApres = await apercu().evaluate((e) => getComputedStyle(e.querySelector('.av-haut')).fill);
ok(fondAvant !== fondApres, `changer la couleur de l’agenda recolore l’avatar (${fondAvant} → ${fondApres})`);

/* ───────── Enregistrement : vérifié dans la base ───────── */
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Alpha Élève enregistré').first().waitFor();
const attendu = { style: 'manga', teint: 2, cheveux: 4, coiffure: 5, visage: 4, accessoire: 1 };
let alpha = (await lireBase('eleves')).find((e) => e.id === 'demo-alpha');
ok(JSON.stringify(alpha.avatar) === JSON.stringify(attendu), `base : avatar enregistré ${JSON.stringify(alpha.avatar)}`);
ok(JSON.stringify(Object.keys(alpha.avatar).sort()) === JSON.stringify(Object.keys(attendu).sort()), 'base : rien d’autre que les six réglages (aucune image)');
await page.reload();

/* ───────── Affichage ───────── */
await versEleves();
ok(await carte('Alpha').locator('.avatar svg').count() === 1, 'carte : l’avatar dessiné remplace les initiales après rechargement');
ok(await carte('Bêta').locator('.avatar svg').count() === 0 && (await carte('Bêta').locator('.avatar').innerText()).trim() === 'ÉB', 'carte de Bêta : toujours ses initiales');
ok(await carte('Alpha').locator('.avatar').getAttribute('aria-hidden') === 'true', 'avatar masqué aux lecteurs d’écran (le nom est écrit à côté)');
await page.screenshot({ path: `${SORTIE}/avatar-cartes-bureau.png`, fullPage: true });
ok(await carte('Alpha').locator('.avatar').evaluate((e) => getComputedStyle(e).overflow) === 'hidden', 'le dessin est découpé dans le rond (pas de coins carrés)');
await carte('Alpha').click();
ok(await page.locator('.dossier-identite .avatar-l svg').count() === 1, 'dossier : grand avatar dessiné');
await page.screenshot({ path: `${SORTIE}/avatar-dossier-bureau.png`, fullPage: true });
await versEleves();
await page.getByRole('button', { name: 'Passage d’année' }).click();
ok(await page.locator('.passage-ligne .avatar svg').count() === 1, 'passage d’année : l’avatar est aussi affiché');
await page.getByRole('button', { name: 'Annuler' }).click();

// Archiver ne perd pas l'avatar
await carte('Alpha').click();
await page.getByRole('button', { name: 'Archiver', exact: true }).click();
await page.getByText('Alpha Élève archivé').first().waitFor();
alpha = (await lireBase('eleves')).find((e) => e.id === 'demo-alpha');
ok(JSON.stringify(alpha.avatar) === JSON.stringify(attendu), 'archiver conserve l’avatar');
await page.getByRole('button', { name: 'Suivre à nouveau' }).click();
await page.getByText('est de nouveau suivi').first().waitFor();

/* ───────── Modifier un autre réglage sans tout perdre, puis retirer l'avatar ───────── */
await ouvrirFiche('Alpha');
ok(await coche('Style', 'Manga') && await coche('Accessoire', 'Lunettes rondes'), 'rouvrir la fiche : le choix enregistré est affiché');
await choisir('Style', 'Minimaliste');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Alpha Élève enregistré').first().waitFor();
alpha = (await lireBase('eleves')).find((e) => e.id === 'demo-alpha');
ok(alpha.avatar.style === 'minimal' && alpha.avatar.coiffure === 5, 'changer le style garde les autres réglages');
await ouvrirFiche('Alpha');
await page.getByRole('radio', { name: 'Initiales', exact: true }).click();
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Alpha Élève enregistré').first().waitFor();
alpha = (await lireBase('eleves')).find((e) => e.id === 'demo-alpha');
ok(!('avatar' in alpha), 'base : « Initiales » retire complètement l’avatar');
await versEleves();
ok(await carte('Alpha').locator('.avatar svg').count() === 0, 'carte : retour aux initiales');

/* ───────── Un avatar abîmé dans la base est réparé, un style inconnu donne les initiales ───────── */
await page.evaluate(() => new Promise((resolve) => {
  const o = indexedDB.open('journalier-v2');
  o.onsuccess = () => {
    const tx = o.result.transaction('eleves', 'readwrite');
    const s = tx.objectStore('eleves');
    const g = s.get('demo-alpha');
    g.onsuccess = () => { s.put({ ...g.result, avatar: { style: 'pixel', teint: 99, cheveux: 'x', url: 'http://exemple.test/photo.png' } }); };
    const g2 = s.get('demo-beta');
    g2.onsuccess = () => { s.put({ ...g2.result, avatar: { style: 'photo' } }); };
    tx.oncomplete = () => resolve(undefined);
  };
}));
await page.reload();
await versEleves();
ok(await carte('Alpha').locator('.avatar svg').count() === 1, 'avatar abîmé dans la base : réparé, l’application ne plante pas');
ok(await carte('Bêta').locator('.avatar svg').count() === 0, 'style inconnu dans la base : initiales');
ok(await page.locator('img').count() === 0, 'aucune image dans la page');

/* ───────── Thème sombre et téléphone ───────── */
await page.emulateMedia({ colorScheme: 'dark' });
await ouvrirFiche('Alpha');
await page.getByRole('radio', { name: 'Avatar dessiné', exact: true }).click();
await choisir('Style', 'Bande dessinée');
await page.screenshot({ path: `${SORTIE}/avatar-fiche-bd-sombre.png`, fullPage: true });
await page.emulateMedia({ colorScheme: 'light' });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500); // laisse finir les transitions de couleur avant la capture
await page.screenshot({ path: `${SORTIE}/avatar-fiche-telephone.png`, fullPage: true });
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'téléphone : fiche sans défilement horizontal');
const tailleBouton = await groupe('Coiffure').getByRole('radio').first().boundingBox();
ok(tailleBouton.width >= 44 && tailleBouton.height >= 44, `téléphone : cibles tactiles d’au moins 44 px (${Math.round(tailleBouton.width)} px)`);

await navigateur.close();
ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
console.log(`\nCaptures dans ${SORTIE}`);
