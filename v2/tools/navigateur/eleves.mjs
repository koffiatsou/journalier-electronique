// Vérification dans un vrai navigateur (hors CI pour l'instant, voir lot Q).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/eleves.mjs
// Playwright n'est pas une dépendance du projet : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.
// Parcours Lot 2 : cartes, recherche, fiche (matière libre, plusieurs langues), archivage, passage d'année,
// suppression complète (séances et agenda compris, vérifiée dans la base), recherche dans le Journalier.
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

/** Contenu réel d'un magasin IndexedDB (pas l'affichage). */
const lireBase = (magasin) => page.evaluate((nom) => new Promise((resolve, reject) => {
  const ouverture = indexedDB.open('journalier-v2');
  ouverture.onerror = () => reject(ouverture.error);
  ouverture.onsuccess = () => {
    const req = ouverture.result.transaction(nom, 'readonly').objectStore(nom).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  };
}), magasin);

const ecrireActivite = (a) => page.evaluate((activite) => new Promise((resolve, reject) => {
  const ouverture = indexedDB.open('journalier-v2');
  ouverture.onsuccess = () => {
    const tx = ouverture.result.transaction('activites', 'readwrite');
    tx.objectStore('activites').put(activite);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  };
}), a);

async function nouvelleSeance(eleve, date, matiere) {
  await page.goto(`${URL_APP}#/seance`);
  await page.getByLabel('Élève accompagné').selectOption({ label: eleve });
  await page.getByLabel('Date', { exact: true }).fill(date);
  await page.getByLabel('Matière').fill(matiere);
  await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
  await page.getByText('Séance enregistrée').first().waitFor();
}
/** Comme un utilisateur : on quitte la page puis on clique sur « Élèves » dans le menu (l'écran repart de la liste). */
const versEleves = async () => {
  await page.evaluate(() => { location.hash = '#/accueil'; });
  await page.getByRole('link', { name: 'Élèves' }).click();
  await page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
};
/** Cartes de la liste principale (celles des archives sont comptées à part). */
const cartes = () => page.locator('.liste-carte:not(.archives) .carte-eleve');
const ouvrirDossier = async (nom) => { await versEleves(); await cartes().filter({ hasText: nom }).first().click(); await page.getByRole('heading', { name: new RegExp(nom), level: 2 }).waitFor(); };

/* ───────── Préparation : 2 élèves fictifs, 3 séances, 2 activités d'agenda ───────── */
await page.goto(URL_APP);
await page.getByRole('button', { name: 'Ajouter des élèves fictifs' }).click();
await nouvelleSeance('Alpha Élève', '2026-09-14', 'Français');
await nouvelleSeance('Alpha Élève', '2026-10-20', 'Mathématiques');
await nouvelleSeance('Bêta Élève', '2026-10-21', 'Sciences');
await ecrireActivite({ id: 'act-alpha', type: 'eleve', eleveId: 'demo-alpha', titre: '', lieu: '', note: '', date: '2026-10-26', debut: 0, fin: 0, repetition: 'aucune', creeLe: '2026-10-24T08:00:00Z', modifieLe: '2026-10-24T08:00:00Z' });
await ecrireActivite({ id: 'act-beta', type: 'eleve', eleveId: 'demo-beta', titre: '', lieu: '', note: '', date: '2026-10-27', debut: 1, fin: 1, repetition: 'aucune', creeLe: '2026-10-24T08:00:00Z', modifieLe: '2026-10-24T08:00:00Z' });
console.log('✓ données de départ créées');

/* ───────── Cartes ───────── */
await page.goto(URL_APP);
await page.getByRole('link', { name: 'Élèves' }).click();
await page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
ok(await cartes().count() === 2, 'deux cartes d’élèves');
const carteAlpha = cartes().filter({ hasText: 'Alpha' });
const texteAlpha = await carteAlpha.innerText();
ok(texteAlpha.includes('ÉA'), `pastille avec les initiales (${texteAlpha.split('\n')[0]})`);
ok(texteAlpha.includes('1CB'), 'classe sur la carte');
ok(texteAlpha.includes('2 séances') && texteAlpha.includes('20/10/2026'), 'nombre de séances et dernière séance');
ok(texteAlpha.includes('Néerlandais'), 'langue sur la carte');
ok(await page.locator('.cartes-eleves img').count() === 0, 'aucune photo');
await page.screenshot({ path: `${SORTIE}/eleves-cartes-bureau.png`, fullPage: true });

/* ───────── Recherche ───────── */
const recherche = page.getByLabel('Rechercher un élève');
await recherche.fill('NEERLANDAIS');
ok(await cartes().count() === 1 && (await cartes().first().innerText()).includes('Alpha'), 'recherche « NEERLANDAIS » (sans accent, majuscules) : Alpha seul');
await recherche.fill('4tq');
ok(await cartes().count() === 1 && (await cartes().first().innerText()).includes('Bêta'), 'recherche par classe : Bêta seul');
await recherche.fill('bêta sciences');
ok(await cartes().count() === 1, 'plusieurs mots : nom + matière');
await recherche.fill('zzzz');
ok(await cartes().count() === 0 && await page.getByText('Aucun dossier ne correspond.').count() === 1, 'aucun résultat : message clair');
await recherche.fill('');
ok(await cartes().count() === 2, 'recherche vidée : tout le monde revient');

/* ───────── Fiche : matière libre + plusieurs langues ───────── */
await ouvrirDossier('Alpha');
await page.getByRole('button', { name: 'Modifier le dossier' }).click();
await page.getByLabel('Autre matière').fill('Éducation physique');
await page.getByLabel('Autre matière').press('Enter');
ok(await page.getByRole('heading', { name: 'Modifier le dossier' }).count() === 1, 'Entrée dans « Autre matière » n’enregistre pas la fiche');
ok(await page.getByRole('button', { name: 'Éducation physique' }).getAttribute('aria-pressed') === 'true', 'matière libre ajoutée et cochée');
await page.getByLabel('Autre matière').fill('mathematiques');
await page.getByRole('button', { name: 'Ajouter la matière' }).click();
ok(await page.getByRole('button', { name: /^Mathématiques$/ }).count() === 1, 'matière déjà connue (accents près) : pas de doublon');
const groupeLangues = page.getByRole('group', { name: /Langues modernes/ });
await groupeLangues.getByRole('button', { name: 'Anglais' }).click();
await groupeLangues.getByRole('button', { name: 'Espagnol' }).click();
ok(await groupeLangues.getByRole('button', { pressed: true }).count() === 3, 'trois langues cochées (Néerlandais, Anglais, Espagnol)');
await page.screenshot({ path: `${SORTIE}/eleves-fiche-bureau.png`, fullPage: true });
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Alpha Élève enregistré').first().waitFor();
await page.reload();
await ouvrirDossier('Alpha');
const infos = await page.locator('.dossier-infos').innerText();
ok(infos.includes('Éducation physique'), 'matière libre conservée après rechargement');
ok(/Néerlandais, Anglais, Espagnol/.test(infos), 'trois langues conservées après rechargement');

// Séance : les langues sont proposées comme matières
await page.goto(`${URL_APP}#/seance`);
await page.getByLabel('Élève accompagné').selectOption({ label: 'Alpha Élève' });
const propositions = await page.locator('datalist option').evaluateAll((l) => l.map((o) => o.value));
ok(['Anglais', 'Espagnol', 'Néerlandais', 'Éducation physique'].every((m) => propositions.includes(m)), `matières proposées dans la séance : ${propositions.join(', ')}`);

/* ───────── Archivage ───────── */
await ouvrirDossier('Alpha');
await page.getByRole('button', { name: 'Archiver', exact: true }).click();
await page.getByText('Alpha Élève archivé').first().waitFor();
ok(await page.getByText(/Archivé le/).count() === 1, 'dossier marqué archivé');
await versEleves();
ok(await cartes().count() === 1, 'liste principale : seul Bêta reste actif');
ok(await page.locator('details.archives').count() === 1 && !(await page.locator('details.archives').evaluate((d) => d.open)), 'section « Élèves archivés » présente, repliée');
await page.locator('.archives summary').click();
ok(await page.locator('.archives .carte-eleve').count() === 1, 'Alpha est dans les archives');
await recherche.fill('alpha');
ok(await page.locator('.archives').evaluate((d) => d.open), 'une recherche ouvre les archives qui correspondent');
await recherche.fill('');
await page.goto(`${URL_APP}#/seance`);
const choix = await page.getByLabel('Élève accompagné').locator('option').allInnerTexts();
ok(!choix.some((c) => c.includes('Alpha')), 'un élève archivé n’est plus proposé pour une nouvelle séance');
await page.goto(`${URL_APP}#/journalier`);
ok(await page.locator('.journalier-liste > li').count() === 3, 'ses séances restent dans le Journalier');
const optionsJ = await page.getByLabel('Élève', { exact: true }).locator('option').allInnerTexts();
ok(optionsJ.some((o) => o.includes('Alpha') && o.includes('archivé')), 'Journalier : Alpha reste choisissable (« archivé »)');
await ouvrirDossier('Alpha').catch(async () => { await versEleves(); await page.locator('.archives summary').click(); await page.locator('.archives .carte-eleve').first().click(); });
await page.getByRole('button', { name: 'Suivre à nouveau' }).click();
await page.getByText('est de nouveau suivi').first().waitFor();
await versEleves();
ok(await cartes().count() === 2, 'réactivé : Alpha revient parmi les élèves actifs');

/* ───────── Passage d'année ───────── */
await page.getByRole('button', { name: 'Passage d’année' }).click();
await page.getByRole('heading', { name: 'Passage à la nouvelle année scolaire' }).waitFor();
const lignes = page.locator('.passage-ligne');
ok(await lignes.count() === 2, 'une ligne par élève actif');
ok((await page.getByLabel('Année scolaire qui commence').inputValue()) === '2026-2027', 'année proposée : 2026-2027');
ok((await page.getByLabel('Que faire pour Élève Alpha').inputValue()) === 'laisser', 'dossier sans année connue : jamais de passage automatique');
ok((await lignes.first().innerText()).includes('Année du dossier inconnue'), 'la raison est expliquée');
await page.screenshot({ path: `${SORTIE}/eleves-passage-bureau.png`, fullPage: true });
await page.getByLabel('Que faire pour Élève Alpha').selectOption('passer');
ok((await page.getByLabel('Nouvelle classe de Élève Alpha').inputValue()) === '2CB', 'classe suivante proposée (1CB → 2CB)');
ok(await page.getByRole('button', { name: 'Appliquer le passage' }).isEnabled(), 'bouton actif quand il y a quelque chose à changer');
await page.getByLabel('Nouvelle classe de Élève Alpha').fill('');
ok(await page.getByRole('button', { name: 'Appliquer le passage' }).isDisabled(), 'classe vide : passage bloqué');
await page.getByLabel('Nouvelle classe de Élève Alpha').fill('2CB');
await page.getByRole('button', { name: 'Appliquer le passage' }).click();
await page.getByText(/Passage à 2026-2027 appliqué/).first().waitFor();
await ouvrirDossier('Alpha');
const apres = await page.locator('.dossier-identite').innerText();
ok(apres.includes('2CB'), 'Alpha est passé en 2CB');
ok(!(await page.locator('.dossier-infos').innerText()).includes('M. Test'), 'titulaire effacé');
await page.goto(`${URL_APP}#/journalier?eleve=demo-alpha`);
ok(await page.locator('.journalier-liste > li').count() === 2, 'les séances d’Alpha sont intactes après le passage');
await versEleves();
await page.getByRole('button', { name: 'Passage d’année' }).click();
ok((await page.locator('.passage-ligne').first().innerText()).includes('Déjà à jour'), 'après passage : « déjà à jour », pas de double passage');
ok((await page.getByLabel('Que faire pour Élève Alpha').inputValue()) === 'laisser', 'action par défaut : ne pas changer');
await page.getByRole('button', { name: 'Tout faire passer' }).click();
ok((await page.getByLabel('Que faire pour Élève Alpha').inputValue()) === 'laisser', '« Tout faire passer » épargne les dossiers déjà à jour');
await page.getByRole('button', { name: 'Annuler' }).click();

/* ───────── Recherche dans le Journalier ───────── */
await page.goto(`${URL_APP}#/journalier`);
const recJ = page.getByLabel('Rechercher une séance');
await recJ.fill('FRANCAIS');
ok(await page.locator('.journalier-liste > li').count() === 1, 'recherche « FRANCAIS » : une séance');
ok((await page.locator('.journalier-resume').innerText()).includes('3 séances'), 'le résumé de la période garde le total (export complet)');
await recJ.fill('bêta sciences');
ok(await page.locator('.journalier-liste > li').count() === 1, 'recherche par nom d’élève + matière');
await recJ.fill('introuvable');
ok(await page.getByText('Aucune séance de cette période ne correspond à la recherche.').count() === 1, 'aucun résultat : message clair');
await recJ.fill('français');
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Alpha Élève (2CB)' });
const [t] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter le Journalier (Word)' }).click()]);
await t.saveAs(`${SORTIE}/alpha-recherche.docx`);
const xml = execFileSync('unzip', ['-p', `${SORTIE}/alpha-recherche.docx`, 'word/document.xml']).toString();
ok(xml.includes('14/09/2026') && xml.includes('20/10/2026'), 'l’export Word contient toute la période, même avec une recherche affichée');
await recJ.fill('');

/* ───────── Suppression complète ───────── */
ok((await lireBase('seances')).filter((s) => s.eleveId === 'demo-beta').length === 1, 'avant : Bêta a 1 séance en base');
ok((await lireBase('activites')).some((a) => a.eleveId === 'demo-beta'), 'avant : Bêta a 1 activité d’agenda en base');
await ouvrirDossier('Bêta');
await page.getByRole('button', { name: 'Supprimer…' }).click();
const dialogue = page.getByRole('dialog');
await dialogue.waitFor();
const texteDialogue = await dialogue.innerText();
ok(texteDialogue.includes('1 séance') && texteDialogue.includes('1 activité'), 'la confirmation annonce ce qui disparaît (1 séance, 1 activité)');
ok(texteDialogue.includes('Archiver'), 'la confirmation propose d’archiver à la place');
const bouton = dialogue.getByRole('button', { name: 'Supprimer définitivement' });
ok(await bouton.isDisabled(), 'suppression bloquée tant que la case n’est pas cochée');
await page.screenshot({ path: `${SORTIE}/eleves-suppression-bureau.png` });
await dialogue.getByRole('button', { name: 'Annuler' }).click();
ok((await lireBase('eleves')).some((e) => e.id === 'demo-beta'), 'après « Annuler » : Bêta est toujours là');
await page.getByRole('button', { name: 'Supprimer…' }).click();
await dialogue.getByRole('checkbox').check();
await bouton.click();
await page.getByText(/Bêta Élève supprimé/).first().waitFor();
ok((await lireBase('eleves')).every((e) => e.id !== 'demo-beta'), 'base : l’élève est supprimé');
ok((await lireBase('seances')).every((s) => s.eleveId !== 'demo-beta'), 'base : plus aucune séance de Bêta');
ok((await lireBase('activites')).every((a) => a.eleveId !== 'demo-beta'), 'base : plus aucune activité de Bêta');
ok((await lireBase('activites')).some((a) => a.eleveId === 'demo-alpha'), 'base : l’agenda d’Alpha est intact');
const idsEleves = new Set((await lireBase('eleves')).map((e) => e.id));
ok((await lireBase('seances')).every((s) => idsEleves.has(s.eleveId)), 'aucune séance orpheline');
await page.reload();
await page.getByRole('link', { name: 'Journalier' }).click();
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
ok(await page.locator('.journalier-liste > li').count() === 2, 'après rechargement : 2 séances (celles d’Alpha)');
ok(await page.getByText('Élève supprimé').count() === 0, 'Journalier : aucune ligne « Élève supprimé »');

// Suppression d'un élève sans séance (message adapté), puis création d'un nouvel élève
await versEleves();
await page.getByRole('button', { name: 'Nouvel élève' }).click();
await page.getByLabel('Nom', { exact: true }).fill('Test');
await page.getByLabel('Prénom').fill('Zoé');
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Test Zoé enregistré').first().waitFor();
await ouvrirDossier('Test');
await page.getByRole('button', { name: 'Supprimer…' }).click();
ok((await page.getByRole('dialog').innerText()).includes('aucune séance ni activité'), 'élève sans séance : message adapté');
await page.getByRole('dialog').getByRole('checkbox').check();
await page.getByRole('dialog').getByRole('button', { name: 'Supprimer définitivement' }).click();
await page.getByText(/Test Zoé supprimé/).first().waitFor();

/* ───────── Téléphone ───────── */
await page.setViewportSize({ width: 390, height: 844 });
await versEleves();
await page.screenshot({ path: `${SORTIE}/eleves-cartes-telephone.png`, fullPage: true });
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'téléphone : pas de défilement horizontal');
await page.getByRole('button', { name: 'Passage d’année' }).click();
await page.screenshot({ path: `${SORTIE}/eleves-passage-telephone.png`, fullPage: true });
ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'téléphone : passage d’année sans défilement horizontal');

await navigateur.close();
ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
console.log(`\nCaptures dans ${SORTIE}`);
