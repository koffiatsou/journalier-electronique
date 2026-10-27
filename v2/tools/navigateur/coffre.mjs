// Vérification dans un vrai navigateur du Lot 7 : le coffre chiffré.
// Écran verrouillé, mode essai, rien en clair dans la base, réouverture, nouvel onglet, « Verrouiller », clé perdue,
// migration de l'ancienne base en clair, copie de secours protégée par un mot de passe, téléphone et thème sombre.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/coffre.mjs
// (Playwright : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.) La date du jour est figée au lundi 26 octobre 2026.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { BASE_ESSAI, aller, basesPresentes, entrer, lireBase, recharger, viderTable } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const navigateur = await chromium.launch();
const nouveauContexte = async (options = {}) => {
  const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE', acceptDownloads: true, ...options });
  await ctx.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
  return ctx;
};
const suivre = (p) => {
  p.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
  p.on('pageerror', (e) => erreurs.push(String(e)));
};
const bouton = (page, nom) => page.getByRole('button', { name: nom });
const essayer = (page) => bouton(page, 'Essayer avec des données fictives');
const verrouille = (page) => page.getByRole('heading', { name: 'Journalier verrouillé', level: 1 });
const attendreVerrou = async (page) => { await verrouille(page).waitFor({ timeout: 15_000 }); };

/** Contenu BRUT (tel qu'enregistré) de toute une base : c'est ce que lirait quelqu'un qui ouvre le disque. */
const contenuBrut = (page, nomBase) => page.evaluate(async (nom) => {
  const base = await new Promise((resolve, reject) => { const o = indexedDB.open(nom); o.onerror = () => reject(o.error); o.onsuccess = () => resolve(o.result); });
  const tables = {};
  for (const t of base.objectStoreNames) {
    if (t === 'cles') continue; // la clé elle-même n'est pas lisible (CryptoKey non extractable)
    tables[t] = await new Promise((resolve, reject) => { const r = base.transaction(t).objectStore(t).getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  }
  base.close();
  return tables;
}, nomBase);

/** Attend que l'écriture chiffrée du jeu de démonstration soit terminée. */
async function attendreDemo(page) {
  for (let i = 0; i < 100; i += 1) {
    const [s, a, p] = await Promise.all(['seances', 'activites', 'pia'].map((t) => lireBase(page, t).then((x) => x.length)));
    if (s >= 10 && a >= 5 && p >= 1) return;
    await page.waitForTimeout(100);
  }
  throw new Error('la démonstration n’a pas fini de s’écrire');
}

/* ───────── 1. Écran verrouillé ───────── */
const ctx = await nouveauContexte();
const page = await ctx.newPage();
suivre(page);
await page.goto(URL_APP);
await attendreVerrou(page);
ok(true, 'au premier lancement, le Journalier est verrouillé');
ok(await bouton(page, 'Se connecter avec Microsoft').isVisible(), 'on peut se connecter avec Microsoft');
ok(await essayer(page).isVisible(), 'ou essayer avec des données fictives');
ok(await page.getByRole('link', { name: 'Élèves' }).count() === 0, 'aucun menu ni aucune donnée derrière le verrou');
ok((await page.locator('body').innerText()).includes('chiffrées sur cet appareil'), 'le texte explique que les données sont chiffrées');
ok(!(await basesPresentes(page)).some((n) => n === 'journalier-v2'), 'aucune base en clair n’est créée');

/* ───────── 2. Mode essai et rien en clair ───────── */
await essayer(page).click();
await page.getByRole('link', { name: 'Accueil' }).waitFor();
await page.locator('.bandeau-essai').waitFor();
ok(true, 'le mode essai ouvre le Journalier avec un bandeau « Mode essai »');
await bouton(page, 'Charger les données de démonstration').click();
await page.locator('.bandeau-demo').waitFor();
await attendreDemo(page);
const bases = await basesPresentes(page);
ok(bases.length === 1 && bases[0] === BASE_ESSAI, `une seule base, à part : ${bases.join(', ')}`);

const brut = await contenuBrut(page, BASE_ESSAI);
const texteBrut = JSON.stringify(brut);
ok(Object.keys(brut).includes('eleves') && brut.eleves.length === 2, 'la base contient bien les deux élèves fictifs…');
for (const mot of ['Alpha', 'Bêta', 'Remédiation', 'Mathématiques', 'École fictive', 'Reformulation', 'Maintient son attention']) ok(!texteBrut.includes(mot), `…mais « ${mot} » n’apparaît nulle part en clair`);
ok(['eleves', 'seances', 'activites', 'pia', 'reglages', 'meta'].every((t) => !brut[t] || brut[t].every((r) => typeof r.c === 'string' && r.c.startsWith('j2c1.'))), 'toutes les rangées sont des textes chiffrés « j2c1.… »');
ok(brut.seances.every((r) => r.lien && !r.c.includes(r.lien)), 'chaque séance garde seulement le lien technique vers l’élève (pour tout supprimer d’un coup)');
ok(new Set(brut.eleves.map((r) => r.c)).size === brut.eleves.length && new Set(brut.seances.map((r) => r.c.split('.')[1])).size === brut.seances.length, 'chaque rangée a son propre vecteur aléatoire');
ok((await lireBase(page, 'eleves')).some((e) => e.nom === 'Alpha'), 'avec la clé du navigateur, on relit bien « Alpha »');

/* ───────── 3. Rechargement et nouvel onglet ───────── */
await recharger(page);
ok(await page.locator('.bandeau-essai').isVisible(), 'rechargement : le Journalier se rouvre tout seul (même onglet)');
await page.getByRole('link', { name: 'Élèves' }).click();
await page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
ok(await page.locator('.carte-eleve').filter({ hasText: 'Alpha' }).count() === 1, 'les élèves sont là après rechargement');

const autreOnglet = await ctx.newPage();
suivre(autreOnglet);
await autreOnglet.goto(URL_APP);
await attendreVerrou(autreOnglet);
ok(true, 'un nouvel onglet est verrouillé : la session ne passe pas d’un onglet à l’autre');
await autreOnglet.close();

/* ───────── 4. Verrouiller ───────── */
await bouton(page, 'Verrouiller le Journalier').click();
await attendreVerrou(page);
ok(true, 'le bouton « Verrouiller » ramène à l’écran verrouillé');
await page.reload();
await attendreVerrou(page);
ok(true, 'et après un rechargement, il reste verrouillé');
await essayer(page).click();
await entrer(page);
await page.getByRole('link', { name: 'Élèves' }).click();
ok(await page.locator('.carte-eleve').filter({ hasText: 'Alpha' }).count() === 1, 'on rouvre l’espace d’essai : les données sont toujours là');

/* ───────── 5. Copie de secours protégée par un mot de passe ───────── */
await page.getByRole('link', { name: 'Synchro', exact: true }).click();
await page.getByRole('heading', { name: 'Synchronisation', level: 1 }).waitFor();
await page.getByText('Protéger la copie par un mot de passe').click();
await page.getByLabel('Mot de passe de la copie').fill('court');
await page.getByLabel('Confirmer le mot de passe').fill('court');
await bouton(page, 'Enregistrer une copie').click();
await page.locator('.synchro-champs .erreur').waitFor();
ok(true, 'un mot de passe trop court est refusé');
await page.getByLabel('Mot de passe de la copie').fill('un mot de passe solide');
await page.getByLabel('Confirmer le mot de passe').fill('pas le même');
await bouton(page, 'Enregistrer une copie').click();
await page.locator('.synchro-champs .erreur').waitFor();
ok(/pareil|identique|même/i.test(await page.locator('.synchro-champs .erreur').innerText()), 'deux mots de passe différents sont refusés');
await page.getByLabel('Confirmer le mot de passe').fill('un mot de passe solide');
const [dl] = await Promise.all([page.waitForEvent('download'), bouton(page, 'Enregistrer une copie').click()]);
ok(/^journalier-copie-chiffree-2026-10-26\.json$/.test(dl.suggestedFilename()), `la copie chiffrée a son nom (${dl.suggestedFilename()})`);
const fichierChiffre = `${SORTIE}/copie-chiffree.json`;
await dl.saveAs(fichierChiffre);
const texteCopie = readFileSync(fichierChiffre, 'utf8');
ok(!texteCopie.includes('Alpha') && !texteCopie.includes('Mathématiques') && !texteCopie.includes('demo-'), 'le fichier ne contient aucun nom, aucune matière, aucun identifiant lisible');
ok(JSON.parse(texteCopie).schema === 'journalier-v2-copie-chiffree/1', 'et porte son identifiant de format');

// Restauration dans un espace vide (clé perdue → repartir à zéro est testé plus bas ; ici on vide d'abord les élèves).
await bouton(page, 'Restaurer une copie…').waitFor();
await page.locator('input[type=file]').setInputFiles(fichierChiffre);
await page.getByText('Cette copie est protégée par un mot de passe').waitFor();
await page.getByLabel('Mot de passe de la copie', { exact: true }).last().fill('mauvais mot de passe');
await bouton(page, 'Ouvrir la copie').click();
await page.locator('.synchro-bloc .erreur, .erreur').filter({ hasText: /incorrect/i }).first().waitFor();
ok(true, 'un mauvais mot de passe est refusé avec un message');
await page.getByLabel('Mot de passe de la copie', { exact: true }).last().fill('un mot de passe solide');
await bouton(page, 'Ouvrir la copie').click();
await page.getByRole('region', { name: 'Aperçu de la restauration' }).waitFor();
ok(true, 'avec le bon mot de passe, la copie s’ouvre et propose un aperçu');
await bouton(page, 'Annuler').last().click();

/* ───────── 6. Clé perdue ───────── */
await page.evaluate(async (nom) => {
  const base = await new Promise((resolve, reject) => { const o = indexedDB.open(nom); o.onerror = () => reject(o.error); o.onsuccess = () => resolve(o.result); });
  const tx = base.transaction('cles', 'readwrite');
  tx.objectStore('cles').clear();
  await new Promise((resolve) => { tx.oncomplete = () => resolve(); });
  base.close();
}, BASE_ESSAI);
await page.reload();
await page.getByRole('heading', { name: 'Données illisibles sur cet appareil' }).waitFor({ timeout: 15_000 });
ok(true, 'clé effacée : le Journalier le dit au lieu de planter ou d’afficher un espace vide');
ok(await page.getByText('Rien n’a été supprimé').isVisible(), 'et précise que rien n’a été supprimé');
ok(await bouton(page, 'Repartir d’un espace vide').isDisabled(), '« Repartir d’un espace vide » est bloqué tant qu’on n’a pas coché la confirmation');
await page.getByRole('checkbox').check();
await bouton(page, 'Repartir d’un espace vide').click();
await page.getByRole('link', { name: 'Accueil' }).waitFor({ timeout: 15_000 });
await page.locator('.chargement').waitFor({ state: 'hidden' });
ok((await lireBase(page, 'eleves')).length === 0, 'après confirmation, l’espace est neuf et vide, avec une nouvelle clé');
await recharger(page);
ok((await lireBase(page, 'eleves')).length === 0, 'et il se rouvre normalement');

/* ───────── 7. Migration de l'ancienne base en clair ───────── */
const ctx2 = await nouveauContexte();
const p2 = await ctx2.newPage();
suivre(p2);
await p2.goto(URL_APP);
await attendreVerrou(p2);
await p2.evaluate(() => new Promise((resolve, reject) => {
  const o = indexedDB.open('journalier-v2', 5);
  o.onupgradeneeded = () => {
    const db = o.result;
    for (const nom of ['eleves', 'seances', 'activites', 'pia', 'reglages']) db.createObjectStore(nom, { keyPath: 'id' });
    db.createObjectStore('synchro', { keyPath: 'cle' });
  };
  o.onerror = () => reject(o.error);
  o.onsuccess = () => {
    const tx = o.result.transaction(['eleves', 'seances'], 'readwrite');
    tx.objectStore('eleves').put({ id: 'vieux-1', nom: 'Ancien', prenom: 'Élève', classe: '2A', ecole: 'École X', titulaire: '', dateNaissance: '', matieres: ['Français'] });
    tx.objectStore('seances').put({ id: 'vieille-s1', eleveId: 'vieux-1', date: '2026-10-19', periodeDebut: '1e H', periodeFin: '1e H', matiere: 'Français', niveauScolaire: 'S1', forme: 'Général (G)', presence: 'present', interventions: [], objectifLecon: '', contenuClasse: '', monObjectif: '', observations: [], remarque: 'Remarque d’avant le chiffrement', competences: [], precisionCompetence: '', situationAide: 'none', aides: [], precisionAide: '', transfert: null, suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' }, creeLe: '2026-10-19T08:00:00Z', modifieLe: '2026-10-19T08:00:00Z' });
    tx.oncomplete = () => { o.result.close(); resolve(); };
  };
}));
await p2.reload();
await attendreVerrou(p2);
await p2.getByText('Des données enregistrées avant le chiffrement').waitFor();
ok(true, 'l’écran verrouillé annonce que d’anciennes données non chiffrées seront chiffrées');
await essayer(p2).click();
await entrer(p2);
await p2.getByText('Les anciennes données non chiffrées ont été supprimées').waitFor();
ok(true, 'à l’ouverture, elles sont chiffrées puis l’ancienne copie est supprimée (message affiché)');
ok(!(await basesPresentes(p2)).includes('journalier-v2'), 'l’ancienne base en clair n’existe plus');
ok((await lireBase(p2, 'eleves')).some((e) => e.nom === 'Ancien'), 'l’élève est dans le coffre, déchiffrable');
ok((await lireBase(p2, 'seances')).some((s) => s.remarque === 'Remarque d’avant le chiffrement'), 'la séance aussi, intacte');
ok(!JSON.stringify(await contenuBrut(p2, BASE_ESSAI)).includes('Ancien'), 'et plus rien n’est lisible en clair');
await recharger(p2);
await p2.getByRole('link', { name: 'Élèves' }).click();
await p2.locator('.carte-eleve').filter({ hasText: 'Ancien' }).first().waitFor({ timeout: 10_000 }).catch(() => undefined);
ok(await p2.locator('.carte-eleve').filter({ hasText: 'Ancien' }).count() === 1, 'l’élève migré apparaît dans la liste');

/* ───────── 8. Téléphone et thème sombre ───────── */
const ctx3 = await nouveauContexte({ viewport: { width: 375, height: 800 }, colorScheme: 'dark' });
const p3 = await ctx3.newPage();
suivre(p3);
await p3.goto(URL_APP);
await attendreVerrou(p3);
ok(await p3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'téléphone : l’écran verrouillé ne défile pas à l’horizontale');
ok(await essayer(p3).isVisible() && await bouton(p3, 'Se connecter avec Microsoft').isVisible(), 'téléphone : les deux boutons sont visibles');
await p3.screenshot({ path: `${SORTIE}/verrou-mobile-sombre.png`, fullPage: true });
const fond = await p3.evaluate(() => getComputedStyle(document.body).backgroundColor);
ok(fond !== 'rgb(255, 255, 255)', `thème sombre : fond ${fond}`);
await essayer(p3).click();
await entrer(p3);
ok(await p3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'téléphone : pas de défilement horizontal avec le bandeau « Mode essai »');
ok(await p3.locator('.verrouiller-bouton').isVisible(), 'téléphone : le bouton « Verrouiller » est visible');
await p3.screenshot({ path: `${SORTIE}/essai-mobile-sombre.png`, fullPage: true });

ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
await navigateur.close();
console.log(`Captures dans ${SORTIE}`);
