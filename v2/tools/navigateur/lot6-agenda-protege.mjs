// Audit lot 6 : depuis l'agenda, une séance déjà remplie n'est jamais écrasée par une séance vide.
// Cas vécu : changer la couleur d'une activité qui a une séance encodée, ou « Ouvrir la séance », ne doit rien changer dans la séance.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-agenda-protege.mjs
import { ajouterElevesFictifs, aller, ecrireBase, lireBase, recharger } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const seance = {
  id: 's-remplie', eleveId: 'demo-alpha', date: '2026-10-21', periodeDebut: '2e H', periodeFin: '2e H', matiere: 'Mathématiques', niveauScolaire: '', forme: '',
  presence: 'present', interventions: [], objectifLecon: 'Résoudre des équations', contenuClasse: '', monObjectif: '',
  observations: [{ texte: 'Reste concentré', niveau: 2 }], remarque: 'Très bonne séance', competences: [], precisionCompetence: '', situationAide: 'none', aides: [], precisionAide: '',
  transfert: null, suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' }, creeLe: '2026-10-21T10:00:00Z', modifieLe: '2026-10-21T10:00:00Z'
};
const activite = {
  id: 'a-plan', type: 'eleve', eleveId: 'demo-alpha', titre: '', matiere: 'Mathématiques', lieu: '', note: '', date: '2026-10-21', debut: 1, fin: 1,
  repetition: 'aucune', couleur: 1, creeLe: '2026-10-20T08:00:00Z', modifieLe: '2026-10-20T08:00:00Z'
};

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-10-26T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
await aller(page, URL_APP);
await ajouterElevesFictifs(page);
await ecrireBase(page, 'seances', seance);
await ecrireBase(page, 'activites', activite);
await recharger(page);

const etatSeances = async () => JSON.stringify(await lireBase(page, 'seances'));
const avant = await etatSeances();
const evenement = async () => {
  await page.evaluate(() => { location.hash = '#/agenda'; });
  await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
  await page.waitForTimeout(500);
  if (await page.locator('.evt').count() === 0) await page.getByRole('button', { name: 'Semaine précédente' }).click();
  const evt = page.locator('.evt').first();
  await evt.waitFor();
  await evt.click();
};

// 1. Changer seulement la couleur de l'activité.
await evenement();
await page.getByRole('group', { name: 'Couleur' }).getByRole('button').nth(4).click();
await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await page.getByText('Activité enregistrée').first().waitFor();
await page.waitForTimeout(800);
ok(await etatSeances() === avant, 'changer la couleur de l’activité ne touche pas à la séance encodée');
ok((await lireBase(page, 'activites')).find((a) => a.id === 'a-plan')?.couleur !== 1, 'la couleur de l’activité a bien changé');

// 2. « Ouvrir la séance » reprend la séance existante (pas une séance vide) et la quitter n'écrit rien.
await evenement();
await page.getByRole('button', { name: 'Ouvrir la séance' }).click();
await page.getByRole('heading', { name: /Modifier la séance/, level: 1 }).waitFor({ timeout: 4000 }).catch(() => undefined);
ok(await page.getByRole('heading', { name: /Modifier la séance/, level: 1 }).count() === 1, '« Ouvrir la séance » ouvre la séance existante (titre « Modifier la séance »)');
ok(await page.getByLabel(/Objectif de la leçon/).inputValue() === 'Résoudre des équations', 'les informations déjà notées sont là');
await page.evaluate(() => { location.hash = '#/agenda'; });
await page.waitForTimeout(800);
ok(await etatSeances() === avant, 'ouvrir puis quitter la séance ne change rien');

// 3. Une séance vide sur ce créneau ne remplace pas la séance remplie sans confirmation, et ne l'efface jamais.
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Alpha' });
await page.getByLabel('Date', { exact: true }).fill('2026-10-21');
await page.getByLabel('Première période').selectOption({ label: '2e H' }).catch(() => page.getByLabel('Première période').selectOption({ index: 1 }));
await page.getByLabel('Matière').fill('Mathématiques');
await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
await page.getByRole('dialog', { name: /Aucun point noté/ }).waitFor({ timeout: 4000 }).catch(() => undefined);
ok(await page.getByRole('dialog', { name: /Aucun point noté/ }).count() === 1, 'une séance vide demande d’abord confirmation');
await page.getByRole('dialog', { name: /Aucun point noté/ }).getByRole('button', { name: 'Enregistrer quand même' }).click();
await page.getByRole('dialog', { name: /déjà une séance/ }).waitFor({ timeout: 4000 }).catch(() => undefined);
ok(await page.getByRole('dialog', { name: /déjà une séance/ }).count() === 1, 'puis avertit qu’une séance existe déjà sur ce créneau');
await page.waitForTimeout(600);
ok(await etatSeances() === avant, 'tant que rien n’est confirmé, la séance remplie reste intacte');
await page.getByRole('dialog', { name: /déjà une séance/ }).getByRole('button', { name: 'Revenir à la séance' }).click();
await page.waitForTimeout(500);
ok(await etatSeances() === avant, '« Revenir à la séance » n’écrit rien');
const gardee = (await lireBase(page, 'seances')).find((s) => s.id === 's-remplie');
ok(gardee?.objectifLecon === 'Résoudre des équations' && gardee.observations.length === 1, 'la séance remplie garde son contenu');

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
