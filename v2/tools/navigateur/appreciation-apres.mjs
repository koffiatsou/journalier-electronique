// Vérification dans un vrai navigateur : l'appréciation s'écrit APRÈS les éléments, avec un trait.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/appreciation-apres.mjs
// A1 : Journalier (aperçu) : « … | tout à fait », appréciation en pastille de la teinte de la séance.
// A2 : « Pas du tout » en ambre soutenu, point de vigilance en violet (teintes des pastilles, pas de gris ni de rouge).
// A3 : Word : trait et mot écrits ; sans couleur par défaut ; couleur seulement après avoir coché la case (choix retenu).
// A4 : Word dé-identifié et coloré : aucun nom, la couleur reste.
import { mkdirSync } from 'node:fs';
import os from 'node:os';

import { ajouterElevesFictifs, aller, ecrireBase, recharger } from './_coffre.mjs';
import { lireXmlDocx } from './_docx.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };
const FOND_FORT = 'D9F2EE';
const FOND_VIGILANCE = ['F1EBFA', 'E2D6F6', 'CFBAF0'];
const sansBalises = (xml) => xml.replace(/<[^>]+>/g, '').replace(/ /g, ' ');
const fonds = (xml) => [...xml.matchAll(/<w:shd [^>]*w:fill="([0-9A-F]{6})"/g)].map((m) => m[1]);

const nav = await chromium.launch();
const ctx = await nav.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

await aller(page, URL_APP);
await ajouterElevesFictifs(page);
const seance = {
  id: 'ap-1', eleveId: 'demo-alpha', date: '2026-10-02', periodeDebut: '2e H', periodeFin: '2e H', matiere: 'Mathématiques', niveauScolaire: '1CB', forme: '', presence: 'present',
  interventions: ['Accompagnement individuel'], objectifLecon: 'Notation scientifique', contenuClasse: '', monObjectif: 'Comprendre la virgule',
  observations: [
    { texte: 'Entre dans la tâche', niveau: 2 }, { texte: 'Maintient son attention', niveau: 2 }, { texte: 'Lit la consigne', niveau: -1 },
    { texte: 'Se désengage / évite la tâche', niveau: 1 }, { texte: 'Élève Alpha explique sa démarche', niveau: 1 }
  ],
  remarque: '', competences: [], precisionCompetence: '', situationAide: 'none', aides: [{ nom: 'Support visuel', effet: 2 }], precisionAide: '', transfert: null,
  suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' }, creeLe: '2026-10-02T10:00:00.000Z', modifieLe: '2026-10-02T10:00:00.000Z'
};
await ecrireBase(page, 'seances', seance);
await recharger(page);

/* ───────── A1 et A2 : aperçu à l'écran ───────── */
await page.evaluate(() => { location.hash = '#/journalier'; });
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
await page.getByRole('button', { name: 'Voir' }).first().click();
const apercu = page.locator('.journalier-apercu');
await apercu.waitFor();
const texte = await apercu.innerText();
ok(/Entre dans la tâche\s+;\s+maintient son attention\s+tout à fait/.test(texte), 'aperçu : les éléments d’abord, puis « tout à fait »');
ok(!/Tout à fait\s*:/.test(texte), 'aperçu : plus de « Tout à fait : » en tête de ligne');
const teinte = async (mot) => apercu.locator('.appreciation', { hasText: mot }).first().getAttribute('data-teinte');
ok(await teinte('tout à fait') === 'fort', 'aperçu : « tout à fait » en sarcelle');
ok(await teinte('pas du tout') === 'attention-fort', 'aperçu : « pas du tout » en ambre soutenu (pas gris)');
ok(await teinte('point de vigilance, souvent') === 'vigilance-2', 'aperçu : point de vigilance en violet, intensité « souvent »');
ok(await apercu.locator('.appreciation-trait').count() >= 3, 'aperçu : un trait avant chaque appréciation');
const couleurs = await apercu.locator('.appreciation').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundColor));
ok(new Set(couleurs).size >= 3, 'aperçu : les pastilles ont des couleurs différentes');
await page.screenshot({ path: `${SORTIE}/appreciation-apercu.png`, fullPage: true });

/* ───────── A3 : Word, sans puis avec couleur ───────── */
const exporter = async (nom) => {
  const [t] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter le Journalier (Word)' }).click()]);
  const chemin = `${SORTIE}/${nom}`;
  await t.saveAs(chemin);
  return lireXmlDocx(chemin);
};
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Élève Alpha (1CB)' });
const caseCouleur = page.getByLabel('Colorer les appréciations dans le Word');
ok(!(await caseCouleur.isChecked()), 'Word : la case « Colorer les appréciations » est décochée par défaut');
let xml = await exporter('appreciation-sobre.docx');
ok(/Entre dans la tâche ; maintient son attention \| tout à fait/.test(sansBalises(xml)), 'Word : trait et mot écrits');
ok(!fonds(xml).includes(FOND_FORT) && !FOND_VIGILANCE.some((f) => fonds(xml).includes(f)), 'Word : sobre par défaut, aucune couleur d’appréciation');

await caseCouleur.check();
await recharger(page);
await page.evaluate(() => { location.hash = '#/journalier'; });
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
ok(await page.getByLabel('Colorer les appréciations dans le Word').isChecked(), 'Word : le choix est retenu après rechargement');
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Élève Alpha (1CB)' });
xml = await exporter('appreciation-couleur.docx');
ok(/maintient son attention \| +tout à fait/.test(sansBalises(xml)), 'Word coloré : même texte');
ok(fonds(xml).includes(FOND_FORT), 'Word coloré : « tout à fait » sur fond sarcelle clair');
ok(FOND_VIGILANCE.some((f) => fonds(xml).includes(f)), 'Word coloré : point de vigilance sur fond violet clair');

/* ───────── A4 : dé-identifié et coloré ───────── */
await page.getByLabel('Sans nom ni titulaire (pour partager)').check();
xml = await exporter('appreciation-anonyme.docx');
ok(!/Alpha|Élève/.test(sansBalises(xml).replace(/Élève accompagné|de l’élève|l’élève|Suivi de l’élève|Photo de l’élève|à l’élève|l’agent/gi, '')), 'dé-identifié : le nom n’apparaît nulle part');
ok(fonds(xml).includes(FOND_FORT), 'dé-identifié : la couleur de l’appréciation reste');

await nav.close();
ok(erreurs.length === 0, `aucune erreur console (${erreurs.slice(0, 2).join(' | ')})`);
console.log('Appréciation après : tout est bon.');
