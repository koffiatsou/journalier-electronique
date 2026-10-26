// Vérification dans un vrai navigateur du Lot 8 : données de démonstration, synchronisation (faux OneDrive / faux Outlook),
// conflit, copie de secours, téléphone, thème sombre, puis connexion Microsoft complète (fenêtre, PKCE) contre un faux Microsoft.
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node --import tsx tools/navigateur/synchro.mjs
// (tsx sert à charger le faux Microsoft des tests ; Playwright : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.)
// La date du jour est figée au lundi 26 octobre 2026.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { FauxMicrosoft } from '../../tests/fauxMicrosoft.ts';

import { aller as ouvrirApp, baseDuCompte, ecrireBase as ecrireChiffre, lireBase as lireChiffre, recharger } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
// Normal : au premier envoi, OneDrive répond 404 pour un dossier qui n'existe pas encore (le navigateur le note dans sa console).
const dossiersAbsents = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE', acceptDownloads: true });
await ctx.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
const page = await ctx.newPage();
const suivre = (p) => {
  p.on('response', (r) => { if (r.status() === 404 && r.url().includes('/children?')) dossiersAbsents.push(r.url()); else if (r.status() === 404) erreurs.push(`404 ${r.url()}`); });
  p.on('console', (m) => { if (m.type() === 'error' && !/status of 404/.test(m.text())) erreurs.push(m.text()); });
  p.on('pageerror', (e) => erreurs.push(String(e)));
};
suivre(page);

const lireBase = (magasin) => lireChiffre(page, magasin);
const ecrireBase = (magasin, objet) => ecrireChiffre(page, magasin, objet);
const aller = async (nom) => { await page.getByRole('link', { name: nom, exact: true }).click(); };
const message = () => page.locator('.synchro-message').innerText();
const attendreMessage = async (re) => { await page.locator('.synchro-message', { hasText: re }).waitFor({ timeout: 10_000 }); };
const bouton = (nom) => page.getByRole('button', { name: nom });

/* ───────── 1. Démonstration chargée depuis l'accueil ───────── */
await ouvrirApp(page, URL_APP);
await page.evaluate(() => { localStorage.clear(); });
await recharger(page);
await page.getByRole('heading', { name: 'Bonjour', level: 1 }).waitFor();
await bouton('Charger les données de démonstration').click();
await page.locator('.bandeau-demo').waitFor();
await page.waitForTimeout(800); // l'écriture de tout le jeu de démonstration se termine juste après l'apparition du bandeau
ok((await lireBase('eleves')).length === 2, 'la démonstration crée deux élèves fictifs');
ok((await lireBase('activites')).filter((a) => a.id.startsWith('demo-a')).length === 5, 'et cinq rendez-vous d’agenda');
ok((await page.locator('.liste li').count()) >= 1, 'les séances fictives s’affichent sur l’accueil');

/* ───────── 2. Synchronisation en démonstration ───────── */
await aller('Synchro');
await page.getByRole('heading', { name: 'Synchronisation', level: 1 }).waitFor();
await bouton(/Essayer en démonstration/).click();
await page.getByText('Mode démonstration', { exact: false }).first().waitFor();
await bouton('Synchroniser maintenant').click();
await attendreMessage(/envoyés vers OneDrive/);
ok(/\d+ fichiers/.test(await page.locator('#synchro-essai ~ *, .synchro-bloc').filter({ hasText: 'Dans le faux OneDrive' }).first().innerText()), 'le faux OneDrive contient des fichiers');
await bouton('Synchroniser maintenant').click();
await attendreMessage(/Tout est à jour/);
ok(true, 'une deuxième synchronisation n’envoie plus rien');

/* ───────── 3. Réception depuis un autre appareil ───────── */
await bouton(/modifiée sur un autre appareil/).click();
await bouton('Synchroniser maintenant').click();
await attendreMessage(/1 reçu de OneDrive/);
ok((await lireBase('seances')).some((s) => /autre appareil/.test(s.remarque)), 'la modification faite ailleurs est reçue');

/* ───────── 4. Conflit puis choix ───────── */
await page.getByRole('checkbox', { name: /Envoyer automatiquement/ }).uncheck(); // sinon la synchronisation de démarrage enverrait nos changements avant le conflit
const seances = await lireBase('seances');
for (const s of seances) await ecrireBase('seances', { ...s, remarque: 'changé ici', modifieLe: '2026-10-26T13:00:00.000Z' });
await recharger(page);
await aller('Synchro');
await bouton(/modifiée sur un autre appareil/).click();
await bouton('Synchroniser maintenant').click();
await page.waitForTimeout(1500); await page.locator('.conflit').first().waitFor({ timeout: 10_000 });
ok((await page.locator('.conflit').count()) >= 1, 'une séance modifiée des deux côtés demande votre choix');
await page.screenshot({ path: `${SORTIE}/synchro-conflit.png`, fullPage: true });
const avant = await page.locator('.conflit').count();
await page.locator('.conflit').first().getByRole('button', { name: /OneDrive/ }).click();
await page.waitForFunction((n) => document.querySelectorAll('.conflit').length < n, avant, { timeout: 10_000 });
ok(true, 'après le choix, le conflit disparaît');
ok((await lireBase('seances')).some((s) => /autre appareil/.test(s.remarque)), 'et la version de OneDrive a bien été adoptée');
while (await page.locator('.conflit').count()) {
  const n = await page.locator('.conflit').count();
  await page.locator('.conflit').first().getByRole('button', { name: /ici/ }).click();
  await page.waitForFunction((x) => document.querySelectorAll('.conflit').length < x, n, { timeout: 10_000 });
}

/* ───────── 5. Outlook ───────── */
await page.getByRole('checkbox', { name: /Envoyer mon agenda vers Outlook/ }).click();
await attendreMessage(/Outlook mis à jour/);
const texteEssai = await page.locator('.synchro-bloc').filter({ hasText: 'Dans le faux OneDrive' }).innerText();
const evenements = Number(/(\d+) événement/.exec(texteEssai)?.[1] ?? 0);
ok(evenements > 10, `Outlook (faux) reçoit les rendez-vous (${evenements} événements)`);
await page.getByLabel('Nom de l’élève dans Outlook').selectOption('initiales');
await bouton('Mettre à jour Outlook').click();
await attendreMessage(/Outlook/);
ok(true, 'le réglage du nom dans Outlook se met à jour');
await bouton('Retirer le calendrier d’Outlook').click();
await attendreMessage(/supprimé d’Outlook/);
ok(/0 événement/.test(await page.locator('.synchro-bloc').filter({ hasText: 'Dans le faux OneDrive' }).innerText()), 'retirer le calendrier le vide');

/* ───────── 6. Copie de secours ───────── */
const [telechargement] = await Promise.all([page.waitForEvent('download'), bouton('Enregistrer une copie').click()]);
const fichierCopie = `${SORTIE}/${telechargement.suggestedFilename()}`;
await telechargement.saveAs(fichierCopie);
ok(/^journalier-copie-2026-10-26\.json$/.test(telechargement.suggestedFilename()), 'la copie de secours se télécharge avec un nom daté');
ok(JSON.parse(readFileSync(fichierCopie, 'utf8')).schema === 'journalier-v2-copie/1', 'et porte l’identifiant de format');
await aller('Accueil');
await bouton('Effacer la démonstration').click();
await bouton('Oui, effacer la démonstration').click();
await page.getByRole('heading', { name: 'Aucun élève pour l’instant' }).waitFor();
ok((await lireBase('eleves')).length === 0, 'effacer la démonstration retire les élèves fictifs');
await aller('Synchro');
await page.locator('input[type=file]').setInputFiles(fichierCopie);
await page.getByRole('region', { name: 'Aperçu de la restauration' }).waitFor();
await bouton('Ajouter ce qui manque').click();
await page.waitForTimeout(500);
ok((await lireBase('eleves')).length === 2, 'restaurer la copie rend les élèves');
writeFileSync(`${SORTIE}/mauvais.json`, '{"pas":"une copie"}');
await page.locator('input[type=file]').setInputFiles(`${SORTIE}/mauvais.json`);
await page.locator('.synchro-bloc .erreur').waitFor();
ok(true, 'un fichier étranger est refusé avec un message');

/* ───────── 7. Téléphone et thème sombre ───────── */
await page.setViewportSize({ width: 375, height: 800 });
await recharger(page);
await page.getByRole('heading', { name: 'Synchronisation', level: 1 }).waitFor();
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'téléphone : pas de défilement horizontal');
ok((await page.locator('.nav-lien').count()) === 7 && await page.locator('.nav-lien').last().isVisible(), 'téléphone : les 7 onglets sont visibles');
await page.screenshot({ path: `${SORTIE}/synchro-mobile.png`, fullPage: true });
await page.emulateMedia({ colorScheme: 'dark' });
await page.screenshot({ path: `${SORTIE}/synchro-sombre.png`, fullPage: true });
ok(true, 'thème sombre capturé');
await page.setViewportSize({ width: 1280, height: 900 });
await page.emulateMedia({ colorScheme: 'light' });

/* ───────── 8. Se déconnecter de la démonstration ───────── */
await bouton('Quitter la démonstration').click();
await page.getByText('mode essai', { exact: false }).first().waitFor();
ok(await bouton('Se connecter avec Microsoft').count() === 0, 'mode essai : pas de bouton Microsoft (jamais relié à un vrai compte)');

/* ───────── 9. Connexion Microsoft complète contre un faux Microsoft ───────── */
const faux = new FauxMicrosoft();
await ctx.route(/^https:\/\/(login\.microsoftonline\.com|graph\.microsoft\.com)\//, async (route) => {
  const req = route.request();
  const url = req.url();
  if (url.includes('/oauth2/v2.0/authorize')) {
    await route.fulfill({ status: 302, headers: { location: faux.autoriser(url) }, body: '' });
    return;
  }
  const rep = await faux.fetch(url, { method: req.method(), headers: req.headers(), body: req.postData() ?? undefined });
  await route.fulfill({ status: rep.status, headers: Object.fromEntries(rep.headers), body: Buffer.from(await rep.arrayBuffer()) });
});
// Se connecter se fait depuis l'écran verrouillé : « Verrouiller » ramène à cet écran, puis la fenêtre Microsoft s'ouvre.
await bouton('Verrouiller le Journalier').click();
const [popup] = await Promise.all([ctx.waitForEvent('page'), bouton('Se connecter avec Microsoft').click()]);
suivre(popup);
await page.getByRole('link', { name: 'Synchro', exact: true }).waitFor({ timeout: 20_000 });
await page.locator('.chargement').waitFor({ state: 'hidden' });
const baseCompte = await baseDuCompte(page);
ok(baseCompte !== 'journalier-v2-essai', `l’espace du compte est une base à part (${baseCompte})`);
ok((await lireChiffre(page, 'eleves', baseCompte)).length === 0, 'l’espace du compte démarre vide : la démonstration n’y entre pas');
await ecrireChiffre(page, 'eleves', { id: 'e-reel', nom: 'Réel', prenom: 'Léo', classe: '2A', ecole: 'École X', titulaire: '', dateNaissance: '', matieres: [] }, baseCompte);
await recharger(page);
await aller('Synchro');
await page.getByText('Connecté : Agent Test').waitFor();
ok(true, 'connexion par la fenêtre Microsoft (code + PKCE) réussie, session rouverte après rechargement');
const adresse = await page.locator('.synchro-aide code').innerText().catch(() => '');
await page.locator('.synchro-aide summary').click();
ok(/msal-redirect\.html$/.test(await page.locator('.synchro-aide code').innerText()), 'l’adresse de retour à déclarer chez Microsoft est affichée');
await bouton('Synchroniser maintenant').click();
await attendreMessage(/envoyés? vers OneDrive|Tout est à jour/);
ok(faux.chemins().some((c) => c.includes('eleves/')), 'l’élève réel est arrivé dans le faux OneDrive de Microsoft');
ok(!faux.chemins().some((c) => c.includes('demo-')), 'aucune donnée de démonstration n’est partie chez Microsoft');
await bouton('Se déconnecter et verrouiller').click();
await bouton('Se connecter avec Microsoft').waitFor();
ok(true, 'la déconnexion verrouille le Journalier');
ok((await lireChiffre(page, 'eleves', baseCompte)).length === 1, 'les données du compte restent chiffrées sur l’appareil');

ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
await navigateur.close();
console.log(`Captures dans ${SORTIE}`);
