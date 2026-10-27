// Vérification dans un vrai navigateur (hors CI pour l'instant, voir lot Q).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/agenda-5.mjs
// Playwright n'est pas une dépendance du projet : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.
// Parcours Lot 5 : vue mois (activités, « + N autres », jour ouvert au toucher), jours fériés et vacances scolaires
// (semaine, mois, Noël pendant les vacances, année hors tableau), horaires réglables (refus, enregistrement,
// rechargement, remise à zéro, vérifiés dans la base), téléphone et thème sombre.
// La date du jour est figée au lundi 26 octobre 2026 (le calendrier doit donner : congé d'automne en cours).
import { mkdirSync } from 'node:fs';
import os from 'node:os';

import { ajouterElevesFictifs, aller, ecrireBase as ecrireChiffre, lireBase as lireChiffre , recharger } from './_coffre.mjs';

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

const lireBase = (magasin) => lireChiffre(page, magasin);
const ecrireActivite = (a) => ecrireChiffre(page, 'activites', a);
const activite = (id, extra) => ({ id, type: 'eleve', titre: '', lieu: '', note: '', repetition: 'aucune', creeLe: '2026-10-24T08:00:00Z', modifieLe: '2026-10-24T08:00:00Z', debut: 0, fin: 0, ...extra });

const bascule = (nom) => page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: nom, exact: true });
const titre = () => page.locator('.agenda-titre').innerText();
/** Case d'un jour DU MOIS affiché (les jours grisés des mois voisins portent parfois le même numéro). */
const caseDu = (jour) => page.locator('.mois-case:not(.hors-mois)').filter({ has: page.locator(`.mois-jour strong:text-is("${jour}")`) });
const ouvrirAgenda = async () => { await page.evaluate(() => { location.hash = '#/accueil'; }); await page.getByRole('link', { name: 'Agenda' }).click(); await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor(); };

/* ───────── Préparation : 2 élèves fictifs et des activités ───────── */
await aller(page, URL_APP);
await ajouterElevesFictifs(page);
await page.getByText('Alpha').first().waitFor().catch(() => undefined);
await ecrireActivite(activite('a1', { eleveId: 'demo-alpha', date: '2026-10-26', debut: 0, fin: 0 }));
await ecrireActivite(activite('a2', { eleveId: 'demo-beta', date: '2026-10-27', debut: 1, fin: 1 }));
await ecrireActivite(activite('a3', { type: 'formation', titre: 'Formation pôle', date: '2026-10-28', debut: 2, fin: 4 }));
for (let i = 0; i < 5; i++) await ecrireActivite(activite(`m${i}`, { type: 'administratif', titre: `Tâche ${i + 1}`, date: '2026-10-29', debut: i, fin: i }));
await ecrireActivite(activite('n1', { eleveId: 'demo-alpha', date: '2026-11-03', debut: 0, fin: 0 }));
await recharger(page);
console.log('✓ données de départ créées');

/* ───────── Semaine : congé d'automne en cours ───────── */
await ouvrirAgenda();
ok((await titre()).includes('26 – 30 octobre 2026'), 'la semaine affichée est celle du 26 octobre 2026');
const entetes = page.getByRole('columnheader');
ok(await entetes.filter({ hasText: 'Congé d’automne' }).count() === 5, 'les cinq jours de la semaine sont marqués « Congé d’automne »');
ok(await page.locator('.colonne.jour-vacances').count() === 5, 'les colonnes de la semaine sont grisées (vacances)');
ok(await page.locator('.evt').count() >= 3, 'les activités de la semaine sont toujours là');
await page.screenshot({ path: `${SORTIE}/agenda5-semaine-vacances.png`, fullPage: true });

/* ───────── Mois ───────── */
await bascule('Mois').click();
ok(await titre() === 'octobre 2026', 'vue Mois : titre « octobre 2026 »');
ok(await bascule('Mois').getAttribute('aria-pressed') === 'true', 'le bouton Mois est enfoncé');
ok(await page.locator('.mois-semaine').count() === 5, 'octobre 2026 : cinq semaines');
ok(await page.getByRole('columnheader').allInnerTexts().then((t) => t.join(',') === 'lun.,mar.,mer.,jeu.,ven.'), 'en-têtes lundi à vendredi (sans week-end)');
ok(await page.locator('.mois-case.aujourdhui').count() === 1 && (await page.locator('.mois-case.aujourdhui').innerText()).startsWith('26'), 'aujourd’hui (26) est repéré');
ok(await page.locator('.mois-case.hors-mois').count() === 3, 'les 28, 29 et 30 septembre (début de la première semaine) sont grisés');
const c26 = caseDu('26');
ok((await c26.innerText()).includes('Congé d’automne'), 'le 26 porte « Congé d’automne »');
ok(await c26.locator('.mois-evt').count() === 1, 'une activité le 26 (Alpha)');
ok((await c26.locator('.mois-evt').innerText()).includes('Alpha'), 'le nom de l’élève est visible sur l’activité');
const c29 = caseDu('29');
ok(await c29.locator('.mois-evt').count() === 3, 'le 29 : trois activités visibles');
ok((await c29.locator('.mois-plus').innerText()).includes('+ 2 autres'), 'le 29 : « + 2 autres »');
await page.screenshot({ path: `${SORTIE}/agenda5-mois-octobre.png`, fullPage: true });

/* Une activité du mois s'ouvre dans le panneau */
await c26.locator('.mois-evt').click();
await page.getByRole('region', { name: 'Modifier l’activité' }).waitFor();
ok(true, 'toucher une activité du mois ouvre le panneau de modification');
const optionsDebut = await page.getByRole('region', { name: 'Modifier l’activité' }).locator('select').allInnerTexts();
ok(optionsDebut.join(' ').includes('1e H (08:00 – 08:50)'), 'le panneau montre les horaires complets des périodes');
await page.getByRole('button', { name: 'Fermer le panneau' }).click();

/* Toucher un jour ouvre ce jour */
await c29.getByRole('button', { name: /Ouvrir ce jour/ }).first().click();
ok(await bascule('Jour').getAttribute('aria-pressed') === 'true', 'toucher le 29 ouvre la vue Jour');
ok((await titre()).includes('jeudi 29 octobre'), 'la vue Jour est bien le jeudi 29 octobre');
ok(await page.locator('.evt').count() === 5, 'les cinq activités du 29 sont dans la vue Jour');
await bascule('Mois').click();

/* « + 2 autres » ouvre aussi le jour */
await caseDu('29').locator('.mois-plus').click();
ok((await titre()).includes('jeudi 29 octobre'), '« + 2 autres » ouvre le jour');
await bascule('Mois').click();

/* ───────── Navigation par mois : fêtes et vacances ───────── */
await page.getByRole('button', { name: 'Mois suivant' }).click();
ok(await titre() === 'novembre 2026', 'mois suivant : novembre 2026');
ok((await caseDu('2').innerText()).includes('Commémoration des défunts'), '2 novembre : commémoration des défunts (congé)');
ok((await caseDu('11').innerText()).includes('Armistice'), '11 novembre : Armistice');
ok(!(await caseDu('4').innerText()).includes('Congé'), '4 novembre : jour de classe normal');
ok(await caseDu('3').locator('.mois-evt').count() === 1, 'l’activité du 3 novembre apparaît');
ok(await page.locator('.mois-case.jour-ferie').count() === 2, 'novembre 2026 : deux jours sans classe (2 et 11)');
await page.getByRole('button', { name: 'Mois suivant' }).click();
ok(await titre() === 'décembre 2026', 'mois suivant : décembre 2026');
ok((await caseDu('25').innerText()).includes('Noël'), '25 décembre : Noël (férié affiché avant les vacances d’hiver)');
ok((await caseDu('22').innerText()).includes('Vacances d’hiver'), '22 décembre : Vacances d’hiver');
ok((await caseDu('18').innerText()).replace('+', '').trim() === '18', '18 décembre : jour de classe, rien d’affiché');
await page.getByRole('button', { name: 'Mois précédent' }).click();
await page.getByRole('button', { name: 'Mois précédent' }).click();
await page.getByRole('button', { name: 'Aujourd’hui' }).click();
ok(await titre() === 'octobre 2026', '« Aujourd’hui » revient à octobre 2026');

/* Hors du calendrier connu */
ok(await page.locator('.agenda-note').count() === 0, 'pas de note pour une période connue');
for (let i = 0; i < 48; i++) await page.getByRole('button', { name: 'Mois suivant' }).click();
ok(await titre() === 'octobre 2030', '48 mois plus tard : octobre 2030');
ok(await page.locator('.agenda-note').count() === 1, 'hors du tableau : la note explique que les vacances ne sont pas connues');
ok((await caseDu('25').innerText()).replace('+', '').trim() === '25', 'octobre 2030 : aucune vacance inventée');
await page.getByRole('button', { name: 'Aujourd’hui' }).click();

/* ───────── Horaires ───────── */
await bascule('Semaine').click();
ok((await page.locator('.axe').innerText()).includes('08:00'), 'avant : la 1e H commence à 08:00');
await page.getByRole('button', { name: 'Horaires', exact: true }).click();
const fenetre = page.getByRole('dialog', { name: 'Horaires des périodes' });
await fenetre.waitFor();
ok(await fenetre.locator('input[type=time]').count() === 18, 'dix-huit champs : début et fin des neuf périodes (la 9e H est vide : non utilisée)');
ok(await fenetre.getByRole('button', { name: 'Enregistrer' }).isDisabled(), 'Enregistrer est grisé tant que rien n’a changé');
ok(await fenetre.getByRole('button', { name: 'Remettre les horaires habituels' }).isDisabled(), 'Remettre est grisé tant que rien n’a changé');
ok((await fenetre.innerText()).includes('Récré · 15 min') && (await fenetre.innerText()).includes('Midi · 50 min'), 'les pauses (récré, midi) sont indiquées');

// incohérent : la fin de la 3e H avant son début
await fenetre.getByLabel('3e H, fin').fill('09:30');
ok(await fenetre.getByRole('alert').innerText().then((t) => t.includes('3e H : la fin doit venir après le début')), 'une fin avant le début est expliquée');
ok(await fenetre.getByRole('button', { name: 'Enregistrer' }).isDisabled(), 'Enregistrer est grisé pour des horaires incohérents');
await fenetre.getByLabel('3e H, fin').fill('10:30');
// chevauchement : la 2e H commence avant la fin de la 1e H
await fenetre.getByLabel('2e H, début').fill('08:40');
ok(await fenetre.getByRole('alert').innerText().then((t) => t.includes('2e H : commence avant la fin de 1e H (08:50)')), 'un chevauchement est expliqué');
await fenetre.getByLabel('2e H, début').fill('08:50');
ok(await fenetre.getByRole('alert').count() === 0, 'plus d’erreur une fois corrigé');

// horaires valides
await fenetre.getByLabel('1e H, début').fill('07:45');
await fenetre.getByLabel('1e H, fin').fill('08:40');
await fenetre.getByLabel('2e H, début').fill('08:40');
await fenetre.getByLabel('2e H, fin').fill('09:30');
await fenetre.getByLabel('3e H, début').fill('09:40');
ok(await fenetre.getByRole('alert').count() === 0, 'horaires cohérents : aucune erreur');
await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
await page.getByText('Horaires enregistrés').first().waitFor();
await fenetre.waitFor({ state: 'hidden' });
ok((await page.locator('.axe').innerText()).includes('07:45'), 'la grille affiche la 1e H à 07:45');
const reglages = await lireBase('reglages');
ok(reglages.length === 1 && reglages[0].id === 'agenda-ecoles' && reglages[0].valeur.ecoles[0].periodes[0].debut === '07:45' && reglages[0].valeur.ecoles[0].periodes[0].label === '1e H', 'réglage enregistré dans la base (noms des périodes inchangés)');
await page.screenshot({ path: `${SORTIE}/agenda5-semaine-horaires.png`, fullPage: true });

// après rechargement
await recharger(page);
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
ok((await page.locator('.axe').innerText()).includes('07:45'), 'après rechargement : horaires conservés');
ok(await page.locator('.evt').count() >= 3, 'les activités sont toujours attachées à leur période (1e H, 2e H…)');

// le panneau et l'encodage utilisent les nouveaux horaires
await page.locator('.evt').first().click();
const panneau = page.getByRole('region', { name: 'Modifier l’activité' });
await panneau.waitFor();
ok((await panneau.locator('select').allInnerTexts()).join(' ').includes('1e H (07:45 – 08:40)'), 'le panneau reprend les nouveaux horaires');
await page.getByRole('button', { name: 'Fermer le panneau' }).click();

// remise à zéro
await page.getByRole('button', { name: 'Horaires', exact: true }).click();
await fenetre.waitFor();
await fenetre.getByRole('button', { name: 'Remettre les horaires habituels' }).click();
ok(await fenetre.getByLabel('1e H, début').inputValue() === '08:00', 'remise : la 1e H redevient 08:00 dans le formulaire');
await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
await fenetre.waitFor({ state: 'hidden' });
ok((await page.locator('.axe').innerText()).includes('08:00'), 'les horaires habituels sont revenus');

// Annuler ne change rien
await page.getByRole('button', { name: 'Horaires', exact: true }).click();
await fenetre.waitFor();
await fenetre.getByLabel('8e H, fin').fill('16:30');
await fenetre.getByRole('button', { name: 'Annuler' }).click();
await fenetre.waitFor({ state: 'hidden' });
await page.getByRole('button', { name: 'Horaires', exact: true }).click();
await fenetre.waitFor();
ok(await fenetre.getByLabel('8e H, fin').inputValue() === '15:45', 'Annuler : rien n’est enregistré, le formulaire repart des horaires en vigueur');
await page.keyboard.press('Escape');
await fenetre.waitFor({ state: 'hidden' });
ok(true, 'Échap ferme la fenêtre des horaires');

/* ───────── Téléphone ───────── */
await page.setViewportSize({ width: 390, height: 844 });
await aller(page, URL_APP);
await ouvrirAgenda();
ok(await bascule('Semaine').count() === 0, 'téléphone : pas de bouton Semaine (trop large)');
ok(await bascule('Jour').getAttribute('aria-pressed') === 'true', 'téléphone : vue Jour par défaut');
await bascule('Mois').click();
ok(await titre() === 'octobre 2026', 'téléphone : vue Mois');
ok(await page.locator('.mois-pastille').count() === 7, 'téléphone : des pastilles de couleur à la place des textes (4 au plus par jour)');
ok(await caseDu('29').locator('.mois-reste').innerText() === '+1', 'téléphone : « +1 » quand toutes les pastilles ne tiennent pas');
ok(await page.locator('.mois-evt').count() === 0, 'téléphone : pas de bouton d’activité minuscule');
const debordement = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
ok(debordement <= 0, `téléphone : pas de défilement horizontal (débordement ${debordement}px)`);
await page.screenshot({ path: `${SORTIE}/agenda5-mois-telephone.png`, fullPage: true });
await caseDu('27').getByRole('button', { name: /Ouvrir ce jour/ }).click();
ok((await titre()).includes('mardi 27 octobre'), 'téléphone : toucher un jour ouvre ce jour');
await page.getByRole('button', { name: 'Horaires', exact: true }).click();
const fenetreTel = page.getByRole('dialog', { name: 'Horaires des périodes' });
await fenetreTel.waitFor();
const boite = await fenetreTel.boundingBox();
ok(boite && boite.x >= 0 && boite.x + boite.width <= 390, 'téléphone : la fenêtre des horaires tient dans l’écran');
await page.screenshot({ path: `${SORTIE}/agenda5-horaires-telephone.png` });
await page.keyboard.press('Escape');

/* ───────── Thème sombre ───────── */
const sombre = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark', locale: 'fr-BE' });
await sombre.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
const p2 = await sombre.newPage();
p2.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
p2.on('pageerror', (e) => erreurs.push(String(e)));
await aller(p2, URL_APP);
await ajouterElevesFictifs(p2);
await ecrireChiffre(p2, 'activites', { id: 'd1', type: 'eleve', eleveId: 'demo-alpha', titre: '', lieu: '', note: '', date: '2026-11-03', debut: 0, fin: 0, repetition: 'aucune', creeLe: '2026-10-24T08:00:00Z', modifieLe: '2026-10-24T08:00:00Z' });
await recharger(p2);
await p2.getByRole('link', { name: 'Agenda' }).click();
await p2.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Mois', exact: true }).click();
await p2.getByRole('button', { name: 'Mois suivant' }).click();
await p2.screenshot({ path: `${SORTIE}/agenda5-mois-sombre.png`, fullPage: true });
ok(true, 'thème sombre : capture prise');

ok(erreurs.length === 0, `aucune erreur console (${erreurs.join(' | ') || 'aucune'})`);
await navigateur.close();
console.log(`\nCaptures dans ${SORTIE}`);
