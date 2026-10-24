// Vérification dans un vrai navigateur (hors CI pour l'instant, voir lot Q).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/journalier.mjs
// Playwright n'est pas une dépendance du projet : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.
// Parcours Lot 1 : séance → Journalier → Word (période respectée), modification, suppression, aucune erreur console.
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

const docx = async (telechargement, nom) => {
  const chemin = `${SORTIE}/${nom}`;
  await telechargement.saveAs(chemin);
  return chemin;
};
const xmlDuDocx = (chemin) => execFileSync('unzip', ['-p', chemin, 'word/document.xml']).toString();

async function nouvelleSeance(date, matiere) {
  await page.goto(`${URL_APP}#/seance`);
  await page.getByLabel('Élève accompagné').selectOption({ label: 'Alpha Élève' });
  await page.getByLabel('Date', { exact: true }).fill(date);
  await page.getByLabel('Matière').fill(matiere);
  await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
  await page.getByText('Séance enregistrée').first().waitFor();
}

await page.goto(URL_APP);
await page.getByRole('button', { name: 'Ajouter des élèves fictifs' }).click();
await nouvelleSeance('2026-06-15', 'Néerlandais');
await nouvelleSeance('2026-10-20', 'Mathématiques');
await nouvelleSeance('2026-09-14', 'Français');
console.log('✓ trois séances créées par l’écran Séance');

// Journalier depuis la navigation
await page.getByRole('link', { name: 'Journalier' }).click();
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
const lignes = () => page.locator('.journalier-liste > li');
ok(await lignes().count() === 2, 'état à ce jour : 2 séances (juin exclue)');
ok((await page.locator('.journalier-resume').innerText()).includes('2026-2027 au 24/10/2026'), 'résumé de la période lisible');
await page.screenshot({ path: `${SORTIE}/journalier-bureau.png`, fullPage: true });

await page.getByRole('radio', { name: 'Année scolaire' }).click();
await page.getByLabel('Année scolaire').selectOption('2025-2026');
ok(await lignes().count() === 1, 'année 2025-2026 : 1 séance');

await page.getByRole('radio', { name: 'Dates libres' }).click();
await page.getByLabel('Du', { exact: true }).fill('2026-10-01');
await page.getByLabel('Au', { exact: true }).fill('2026-10-31');
ok(await lignes().count() === 1, 'dates libres (octobre) : 1 séance');
await page.getByLabel('Du', { exact: true }).fill('2026-11-15');
ok((await page.locator('.journalier-resume').innerText()).includes('après'), 'dates inversées : message clair');
ok(await page.getByRole('button', { name: 'Exporter le Journalier (Word)' }).isDisabled(), 'export bloqué si période invalide');
await page.getByLabel('Du', { exact: true }).fill('2026-09-01');

// Voir l'aperçu
await page.getByRole('button', { name: 'Voir' }).first().click();
ok(await page.locator('.journalier-apercu').count() === 1, 'aperçu du texte affiché');

// Export Word pour un élève, période septembre → octobre
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Alpha Élève (1CB)' });
let [t] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter le Journalier (Word)' }).click()]);
ok(t.suggestedFilename() === 'Journalier - Alpha - du 01-09-2026 au 31-10-2026.docx', `nom du fichier : ${t.suggestedFilename()}`);
let xml = xmlDuDocx(await docx(t, 'alpha.docx'));
ok(xml.includes('14/09/2026') && xml.includes('20/10/2026') && !xml.includes('15/06/2026'), 'le fichier Word respecte la période');
ok(xml.indexOf('14/09/2026') < xml.indexOf('20/10/2026'), 'ordre chronologique dans le Word');

// Tous les élèves, dé-identifié → zip
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Tous les élèves' });
await page.getByRole('radio', { name: 'Année scolaire' }).click();
await page.getByLabel('Année scolaire').selectOption('2025-2026');
await page.getByLabel('Sans nom ni titulaire (pour partager)').check();
[t] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter le Journalier (Word)' }).click()]);
ok(t.suggestedFilename() === 'Journaliers - dé-identifiés - 2025-2026.zip', `archive : ${t.suggestedFilename()}`);
const zip = await docx(t, 'tous.zip');
// unzip ignore le marqueur UTF-8 : Python le respecte (comme l’explorateur de Windows).
const contenu = execFileSync('python3', ['-c', 'import zipfile,sys;print("\\n".join(zipfile.ZipFile(sys.argv[1]).namelist()))', zip]).toString().trim().split('\n');
ok(contenu.length === 1 && contenu[0] === 'Journalier - dé-identifié - 1CB - 2025-2026.docx', `contenu de l’archive : ${contenu.join(', ')}`);
xml = execFileSync('python3', ['-c', 'import zipfile,sys,io;z=zipfile.ZipFile(sys.argv[1]);d=zipfile.ZipFile(io.BytesIO(z.read(sys.argv[2])));print(d.read("word/document.xml").decode())', zip, contenu[0]]).toString();
ok(xml.includes('15/06/2026') && !xml.includes('Alpha') && !xml.includes('M. Test'), 'docx de l’archive : bonne période, sans nom ni titulaire');
await page.getByLabel('Sans nom ni titulaire (pour partager)').uncheck();

// Modifier une séance
await page.getByRole('radio', { name: 'État à ce jour' }).click();
await page.locator('.journalier-liste > li', { hasText: 'Mathématiques' }).getByRole('button', { name: 'Modifier' }).click();
await page.getByRole('heading', { name: 'Modifier la séance du 20/10/2026' }).waitFor();
ok(await page.getByLabel('Matière').inputValue() === 'Mathématiques', 'la séance s’ouvre avec ses données');
await page.getByLabel('Matière').fill('Sciences');
await page.getByRole('button', { name: 'Enregistrer les modifications' }).click();
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
ok(page.url().includes('eleve=demo-alpha'), 'retour au Journalier de l’élève');
ok(await lignes().count() === 2 && await page.locator('.journalier-liste', { hasText: 'Sciences' }).count() === 1, 'modification visible, pas de doublon');

// Supprimer une séance (avec confirmation)
await page.locator('.journalier-liste > li', { hasText: 'Français' }).getByRole('button', { name: 'Supprimer' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();
ok(await lignes().count() === 2, 'annuler ne supprime rien');
await page.locator('.journalier-liste > li', { hasText: 'Français' }).getByRole('button', { name: 'Supprimer' }).click();
await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
await page.getByText('Séance du 14/09/2026 supprimée').waitFor();
ok(await lignes().count() === 1, 'séance supprimée');
await page.reload();
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
ok(await lignes().count() === 1, 'suppression et modification conservées après rechargement');

// Depuis Élèves
await page.getByRole('link', { name: 'Élèves' }).click();
await page.getByRole('button', { name: /Bêta Élève/ }).click();
await page.getByRole('button', { name: 'Voir le Journalier' }).click();
ok(await page.getByLabel('Élève', { exact: true }).inputValue() === 'demo-beta', 'Élèves → Journalier filtré sur l’élève');
ok(await page.getByText('Aucune séance dans cette période.').count() === 1, 'message quand il n’y a rien');

// Téléphone
await page.setViewportSize({ width: 390, height: 844 });
await page.getByLabel('Élève', { exact: true }).selectOption('');
await page.screenshot({ path: `${SORTIE}/journalier-telephone.png`, fullPage: true });
const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
ok(!deborde, 'téléphone : pas de défilement horizontal');

await navigateur.close();
ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` (${erreurs.join(' | ')})` : ''}`);
console.log('Parcours complet réussi.');
