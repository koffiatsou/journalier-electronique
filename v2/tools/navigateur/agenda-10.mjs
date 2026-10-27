// Vérification dans un vrai navigateur : agenda avec plusieurs écoles (lot 10 « Agenda : horaires par école »).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/agenda-10.mjs   (PLAYWRIGHT=<chemin> si besoin)
// Parcours : deux écoles aux horaires différents (neuf périodes), élève rattaché par la fiche, heure réelle et école sur chaque case,
// avertissements (chevauchement, trajet trop court), filtre par école, suppression d'une école, 9e période, téléphone, thème sombre.
// La date du jour est figée au lundi 26 octobre 2026.
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import { ajouterElevesFictifs, aller, ecrireBase, lireBase as lireChiffre, recharger } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

const lireBase = (table) => lireChiffre(page, table);
const activite = (id, extra) => ({ id, type: 'eleve', titre: '', lieu: '', note: '', repetition: 'aucune', creeLe: '2026-10-24T08:00:00Z', modifieLe: '2026-10-24T08:00:00Z', debut: 0, fin: 0, ...extra });
const ouvrirAgenda = async () => { await page.evaluate(() => { location.hash = '#/accueil'; }); await page.getByRole('link', { name: 'Agenda' }).click(); await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor(); };
const fenetre = page.getByRole('dialog', { name: 'Horaires des périodes' });
const ouvrirHoraires = async () => { await page.getByRole('button', { name: 'Horaires', exact: true }).click(); await fenetre.waitFor(); };
const caseDe = (texte) => page.locator('.evt').filter({ hasText: texte });

/* ───────── Préparation : deux élèves, des rendez-vous sur la semaine du 26 octobre ───────── */
await aller(page, URL_APP);
await ajouterElevesFictifs(page);
// École 1 (par défaut) : 1e H à 08:00 ; école 2 : une heure plus tard, avec une 9e période.
await ecrireBase(page, 'activites', activite('a0', { eleveId: 'demo-alpha', date: '2026-10-26', debut: 0, fin: 0 })); // lundi : sans voisin
await ecrireBase(page, 'activites', activite('a1', { eleveId: 'demo-alpha', date: '2026-10-27', debut: 2, fin: 2 })); // mardi 09:40–10:30 (école 1)
await ecrireBase(page, 'activites', activite('a2', { eleveId: 'demo-beta', date: '2026-10-27', debut: 0, fin: 0 }));  // mardi 09:00–09:50 (école 2) : chevauche
await ecrireBase(page, 'activites', activite('a3', { eleveId: 'demo-alpha', date: '2026-10-29', debut: 4, fin: 4 })); // jeudi 11:35–12:25 (école 1)
await ecrireBase(page, 'activites', activite('a4', { eleveId: 'demo-beta', date: '2026-10-29', debut: 4, fin: 4 }));  // jeudi 12:35–13:25 (école 2) : 10 min seulement
await recharger(page);
await ouvrirAgenda();

/* ───────── Une seule école : rien ne change ───────── */
ok(await page.getByLabel('École affichée').count() === 0, 'une seule école : pas de filtre par école');
ok(await page.locator('.agenda-alertes').count() === 0, 'une seule école : aucun avertissement');
ok((await page.locator('.axe').innerText()).includes('08:00') && !(await page.locator('.axe').innerText()).includes('9e H'), 'la grille montre huit périodes (la 9e H n’existe pour aucune école)');
await page.screenshot({ path: `${SORTIE}/agenda10-une-ecole.png`, fullPage: true });

/* ───────── Régler deux écoles ───────── */
await ouvrirHoraires();
ok(await fenetre.locator('input[type=time]').count() === 18, 'neuf périodes dans la fenêtre (la 9e est vide)');
ok((await fenetre.innerText()).includes('non utilisée'), 'la 9e période est indiquée « non utilisée »');
ok(await fenetre.getByRole('button', { name: 'Supprimer cette école' }).count() === 0, 'avec une seule école, on ne peut pas la supprimer');
await fenetre.getByLabel('Nom de l’école').fill('Saint-Joseph');
await fenetre.getByRole('button', { name: 'Ajouter une école' }).click();
ok(await fenetre.getByRole('button', { name: /Nouvelle école/ }).count() === 1, 'une nouvelle école apparaît');
ok(await fenetre.getByRole('button', { name: 'Enregistrer' }).isDisabled(), 'Enregistrer est grisé tant que la nouvelle école n’a pas de nom');
ok((await fenetre.getByRole('alert').innerText()).includes('Donnez un nom à chaque école'), 'le nom manquant est expliqué');
await fenetre.getByLabel('Nom de l’école').fill('Notre-Dame');
const horaires2 = [['09:00', '09:50'], ['09:50', '10:40'], ['10:40', '11:30'], ['11:45', '12:35'], ['12:35', '13:25'], ['14:15', '15:05'], ['15:05', '15:55'], ['15:55', '16:45'], ['16:45', '17:35']];
for (const [i, [d, f]] of horaires2.entries()) {
  const nom = `${i + 1}e H`;
  await fenetre.getByLabel(`${nom}, début`).fill(d);
  await fenetre.getByLabel(`${nom}, fin`).fill(f);
}
ok(await fenetre.getByRole('alert').count() === 0, 'horaires cohérents : aucune erreur');
ok(await fenetre.getByLabel('Temps de trajet entre deux écoles (minutes)').inputValue() === '30', 'trajet de 30 minutes par défaut');
// Deux écoles de même nom : refusé
await fenetre.getByLabel('Nom de l’école').fill('saint-joseph');
ok((await fenetre.getByRole('alert').innerText()).includes('Deux écoles portent le nom'), 'deux écoles de même nom : refusé et expliqué');
await fenetre.getByLabel('Nom de l’école').fill('Notre-Dame');
await page.screenshot({ path: `${SORTIE}/agenda10-fenetre.png`, fullPage: true });
await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Écoles et horaires enregistrés').first().waitFor();
await fenetre.waitFor({ state: 'hidden' });
const reglages = await lireBase('reglages');
ok(reglages.length === 1 && reglages[0].id === 'agenda-ecoles' && reglages[0].valeur.ecoles.length === 2 && reglages[0].valeur.trajet === 30, 'réglage enregistré dans la base : deux écoles, trajet de 30 minutes');
ok(reglages[0].valeur.ecoles[1].periodes[8].debut === '16:45', 'la 9e période de la 2e école est enregistrée');

/* ───────── Rattacher Bêta à Notre-Dame par sa fiche ───────── */
await page.evaluate(() => { location.hash = '#/accueil'; });
await page.getByRole('link', { name: 'Élèves' }).click();
await page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
await page.locator('.liste-carte:not(.archives) .carte-eleve').filter({ hasText: 'Bêta' }).first().click();
await page.getByRole('button', { name: 'Modifier le dossier' }).click();
const choixEcole = page.getByLabel('École', { exact: true });
ok((await choixEcole.locator('option').allInnerTexts()).join('|') === 'Pas précisée (école par défaut)|Saint-Joseph|Notre-Dame', 'la fiche propose les deux écoles');
ok((await page.getByText(/ne correspond à aucune école de l’agenda/).count()) === 1, 'le texte du dossier qui ne correspond à aucune école est signalé');
await choixEcole.selectOption({ label: 'Notre-Dame' });
await page.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByRole('heading', { name: /Bêta/, level: 2 }).waitFor();
let beta = (await lireBase('eleves')).find((e) => e.id === 'demo-beta');
ok(beta.ecoleId === 'ecole-2' && beta.ecole === 'Notre-Dame', 'Bêta est rattaché à Notre-Dame (identifiant et nom du dossier)');

/* ───────── L'agenda avec deux écoles ───────── */
await ouvrirAgenda();
ok(await page.getByLabel('École affichée').count() === 1, 'le filtre par école apparaît');
ok((await page.locator('.agenda-note').innerText()).includes('Saint-Joseph'), 'une note dit que la colonne de gauche montre les heures de l’école par défaut');
const alertes = page.locator('.agenda-alertes');
await alertes.waitFor();
const texteAlertes = await alertes.innerText();
ok(texteAlertes.includes('2 points à vérifier'), 'deux points à vérifier cette semaine');
ok(/mardi 27 octobre[^\n]*se chevauchent/.test(texteAlertes), 'mardi : chevauchement signalé');
ok(/jeudi 29 octobre[^\n]*seulement 10 min/.test(texteAlertes) && texteAlertes.includes('trajet prévu : 30 min'), 'jeudi : seulement 10 minutes pour le trajet');
ok(await page.locator('.evt.alerte').count() === 4, 'les quatre cases concernées sont marquées');
const caseBeta = caseDe('Bêta').first();
ok((await caseBeta.innerText()).includes('09:00 – 09:50 · Notre-Dame'), 'la case de Bêta indique son heure réelle et son école');
const caseAlpha = page.locator('.evt', { hasText: 'Alpha' }).first();
ok((await caseAlpha.innerText()).includes('08:00 – 08:50 · Saint-Joseph'), 'Alpha (sans école précisée) prend l’école par défaut');
ok((await caseBeta.getAttribute('aria-label')).includes('Notre-Dame') && (await caseBeta.getAttribute('aria-label')).includes('attention'), 'le nom accessible mentionne l’école et l’avertissement');
await page.screenshot({ path: `${SORTIE}/agenda10-semaine.png`, fullPage: true });

// Le panneau d'une activité de Bêta montre les heures de SON école
await caseBeta.click();
const panneau = page.getByRole('region', { name: 'Modifier l’activité' });
await panneau.waitFor();
ok((await panneau.getByLabel('De', { exact: true }).locator('option').allInnerTexts()).includes('1e H (09:00 – 09:50)'), 'le panneau montre les heures de l’école de l’élève');
ok((await panneau.getByLabel('De', { exact: true }).locator('option').allInnerTexts()).length === 9, 'neuf périodes dans le panneau (Notre-Dame a une 9e H)');
ok((await panneau.innerText()).includes('École : Notre-Dame (celle du dossier de l’élève)'), 'le panneau dit de quelle école il s’agit');
await page.getByRole('button', { name: 'Fermer le panneau' }).click();

// Autre type d'activité : l'école se choisit
await page.getByRole('button', { name: 'Nouvelle activité', exact: true }).click();
const nouveau = page.getByRole('region', { name: 'Nouvelle activité' });
await nouveau.getByRole('radio', { name: 'Formation' }).click();
await nouveau.getByLabel('École', { exact: true }).selectOption({ label: 'Notre-Dame' });
ok((await nouveau.getByLabel('De', { exact: true }).locator('option').allInnerTexts()).includes('1e H (09:00 – 09:50)'), 'une formation dans Notre-Dame prend les heures de Notre-Dame');
await nouveau.getByLabel('Titre').fill('Formation du pôle');
await nouveau.getByLabel('Jour').fill('2026-10-28');
await nouveau.getByRole('button', { name: 'Ajouter à l’agenda' }).click();
await page.locator('.evt', { hasText: 'Formation du pôle' }).waitFor();
ok((await lireBase('activites')).find((a) => a.titre === 'Formation du pôle').ecoleId === 'ecole-2', 'l’école de la formation est enregistrée');
ok((await page.locator('.evt', { hasText: 'Formation du pôle' }).innerText()).includes('Notre-Dame'), 'la case de la formation montre son école');

/* ───────── Filtre par école ───────── */
await page.getByLabel('École affichée').selectOption({ label: 'Notre-Dame' });
ok(await page.locator('.evt', { hasText: 'Alpha' }).count() === 0, 'filtre Notre-Dame : les élèves de l’autre école disparaissent');
ok((await page.locator('.axe').innerText()).includes('09:00') && (await page.locator('.axe').innerText()).includes('9e H'), 'filtre Notre-Dame : la grille prend ses horaires, 9e H comprise');
ok(await page.locator('.agenda-note').count() === 0, 'filtre : plus de note sur l’école par défaut');
await page.screenshot({ path: `${SORTIE}/agenda10-filtre.png`, fullPage: true });
await page.getByLabel('École affichée').selectOption({ label: 'Toutes les écoles' });
ok(await page.locator('.evt', { hasText: 'Alpha' }).count() >= 3, 'toutes les écoles : tout revient');

/* ───────── Vue Mois ───────── */
await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Mois', exact: true }).click();
ok(await page.locator('.mois-evt.alerte').count() === 4, 'vue Mois : les quatre rendez-vous à vérifier sont marqués');
await page.screenshot({ path: `${SORTIE}/agenda10-mois.png`, fullPage: true });
await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click();

/* ───────── Formulaire de séance : les périodes de l'école de l'élève ───────── */
await aller(page, `${URL_APP}#/seance`);
await page.getByLabel('Élève accompagné').selectOption({ label: 'Bêta Élève' });
ok((await page.getByLabel('Première période').locator('option').allInnerTexts()).length === 9, 'séance de Bêta (Notre-Dame) : neuf périodes proposées');
await page.getByLabel('Élève accompagné').selectOption({ label: 'Alpha Élève' });
ok((await page.getByLabel('Première période').locator('option').allInnerTexts()).length === 8, 'séance d’Alpha (Saint-Joseph) : huit périodes proposées');

/* ───────── Après rechargement ───────── */
await recharger(page);
await ouvrirAgenda();
ok(await page.locator('.agenda-alertes').count() === 1 && await page.getByLabel('École affichée').count() === 1, 'après rechargement : les écoles et les avertissements sont conservés');

/* ───────── Téléphone et thème sombre ───────── */
await page.setViewportSize({ width: 390, height: 844 });
await aller(page, URL_APP);
await ouvrirAgenda();
ok(await page.getByLabel('École affichée').isVisible(), 'téléphone : le filtre par école est visible');
ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'téléphone : pas de défilement horizontal');
await page.screenshot({ path: `${SORTIE}/agenda10-telephone.png`, fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });
await ctx.newPage().then((p) => p.close());
await page.emulateMedia({ colorScheme: 'dark' });
await page.waitForTimeout(400);
ok(await page.locator('.agenda-alertes').count() === 1, 'thème sombre : les avertissements restent affichés');
await page.screenshot({ path: `${SORTIE}/agenda10-sombre.png`, fullPage: true });
await page.emulateMedia({ colorScheme: 'light' });

/* ───────── Supprimer une école ───────── */
await ouvrirHoraires();
await fenetre.getByRole('button', { name: /Notre-Dame/ }).click();
await fenetre.getByRole('button', { name: 'Supprimer cette école' }).click();
ok((await fenetre.innerText()).includes('1 élève passe à l’école par défaut'), 'la suppression annonce le nombre d’élèves concernés');
ok((await fenetre.innerText()).includes('Aucune séance ni activité n’est supprimée'), 'et rassure sur les séances et activités');
await fenetre.getByRole('button', { name: 'Oui, supprimer' }).click();
ok(await fenetre.getByRole('button', { name: /Notre-Dame/ }).count() === 0, 'l’école disparaît de la liste');
await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
await fenetre.waitFor({ state: 'hidden' });
beta = (await lireBase('eleves')).find((e) => e.id === 'demo-beta');
ok(beta.ecoleId === undefined && beta.ecole === 'Notre-Dame', 'Bêta n’est plus rattaché, le texte de son dossier est conservé');
ok((await lireBase('activites')).length === 6, 'aucune activité n’est supprimée avec l’école');
ok(await page.getByLabel('École affichée').count() === 0 && await page.locator('.agenda-alertes').count() === 0, 'une seule école : filtre et avertissements disparaissent');

ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
await navigateur.close();
console.log('\nParcours « Agenda : horaires par école » terminé.');
