// Vérification dans un vrai navigateur (hors CI pour l'instant, voir lot Q).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/pia.mjs
// Playwright n'est pas une dépendance du projet : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.
// Parcours Lot 4a : séances → PIA (onglet Préparer = ancienne Réunion, objectifs retenus enregistrés dans le PIA,
// identité, profil avec idées, procès-verbal 1, aménagements, export Word, suppression d'élève), téléphone, thème sombre.
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
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 1000 } });
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(URL_APP).origin });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

const base = (id, date, matiere, surcharge = {}, eleveId = 'demo-alpha') => ({
  id, eleveId, date, periodeDebut: '1e H', periodeFin: '1e H', matiere, niveauScolaire: 'S1', forme: 'Général (G)',
  presence: 'present', interventions: ['Accompagnement individuel'], objectifLecon: 'Objectif', contenuClasse: '', monObjectif: '',
  observations: [], remarque: '', competences: [], precisionCompetence: '', situationAide: 'none', aides: [], precisionAide: '',
  transfert: null, suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' },
  creeLe: `${date}T10:00:00.000Z`, modifieLe: `${date}T10:00:00.000Z`, ...surcharge
});
const aidesMaths = [{ nom: 'Support visuel', effet: 2 }, { nom: 'Guidage verbal', effet: 0 }];
const SEANCES = [
  base('m1', '2026-09-15', 'Mathématiques', {
    observations: [{ texte: 'Maintient son attention', niveau: 0 }, { texte: 'Contrôle sa production', niveau: 0 }, { texte: 'Entre dans la tâche', niveau: 2 }],
    competences: [{ texte: 'Résoudre un problème à une opération', niveau: 1 }], aides: aidesMaths
  }),
  base('m2', '2026-09-22', 'Mathématiques', {
    observations: [{ texte: 'Maintient son attention', niveau: 2 }, { texte: 'Contrôle sa production', niveau: 0 }, { texte: 'Entre dans la tâche', niveau: 2 }],
    aides: aidesMaths
  }),
  base('m3', '2026-10-06', 'Mathématiques', { presence: 'absent_prof' }),
  base('f1', '2026-10-13', 'Français', {
    observations: [{ texte: 'Repère les informations pertinentes', niveau: 1 }], aides: [{ nom: 'Reformulation', effet: 2 }]
  }),
  base('vieux', '2025-11-10', 'Mathématiques', { observations: [{ texte: 'Ancienne observation', niveau: 0 }] }),
  base('beta', '2026-10-20', 'Sciences', { observations: [{ texte: 'Entre dans la tâche', niveau: 1 }] }, 'demo-beta')
];

await aller(page, URL_APP);
await ajouterElevesFictifs(page);
await page.getByRole('heading', { name: /Ma journée|Prochains rendez-vous/ }).waitFor();
for (const s of SEANCES) await ecrireChiffre(page, 'seances', s);
await recharger(page);
console.log('✓ six séances réalistes injectées dans la base');


const lireBase = (magasin) => lireChiffre(page, magasin);

// Menu : « PIA » remplace « Réunion »
ok(await page.getByRole('link', { name: 'Réunion' }).count() === 0, 'plus de lien « Réunion »');
await page.getByRole('link', { name: 'PIA' }).click();
await page.getByRole('heading', { name: 'PIA', level: 1 }).waitFor();
ok(await page.getByText('Choisissez un élève pour ouvrir ou commencer son PIA.').count() === 1, 'sans élève : message clair');

// Résumé (onglet Préparer)
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Alpha Élève (1CB)' });
await page.getByRole('tab', { name: 'Préparer', selected: true }).waitFor();
await page.getByRole('radio', { name: 'État à ce jour' }).click();
const texteResume = await page.locator('.reunion-resume').innerText();
ok(texteResume.includes('3 séances d’accompagnement') && texteResume.includes('1 séance sans accompagnement'), `résumé : ${texteResume}`);
ok(await page.locator('.reunion-matiere').count() === 2, 'deux matières : Français et Mathématiques');
const cases = page.locator('.reunion-propositions input[type=checkbox]');
ok(await cases.count() === 6, `6 propositions : ${await cases.count()}`);
await page.getByRole('checkbox', { name: /Faire progresser\s*: contrôle sa production/ }).check();
await page.getByRole('checkbox', { name: /Consolider\s*: repère les informations pertinentes/ }).check();
await page.getByLabel('Ajouter un objectif personnel').fill('parler du matériel avec la titulaire');
await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
ok(await page.locator('.reunion-retenus li').count() === 3, 'trois objectifs retenus');

// Enregistrement dans le PIA
await page.getByText(/Brouillon enregistré/).waitFor();
let pias = await lireBase('pia');
ok(pias.length === 1 && pias[0].retenus.length === 3, 'les objectifs retenus sont enregistrés dans la base (store pia)');
await recharger(page);
await page.getByRole('heading', { name: 'Objectifs à valider' }).waitFor();
ok(await page.locator('.reunion-retenus li').count() === 3, 'après rechargement : les objectifs retenus sont retrouvés');

// Identité
await page.getByRole('tab', { name: 'Identité' }).click();
ok((await page.locator('.dossier-infos').innerText()).includes('Alpha Élève'), 'identité préremplie depuis le dossier');
await page.getByLabel('Option').fill('Sciences');
await page.getByLabel('Coordonnées du CPMS coopérant').fill('CPMS Test 02 000 00 00');

// Profil
await page.getByRole('tab', { name: 'Profil' }).click();
const ressCog = page.getByRole('textbox', { name: /Ressources — Cognitif/ });
ok(await ressCog.inputValue() === '', 'profil : rien n’est rempli à ma place');
await ressCog.fill('Bonne mémoire visuelle.');
await page.locator('details.pia-idees').nth(14).locator('summary').click();
const rapprochee = page.locator('details.pia-idees[open]').getByRole('checkbox').first();
ok(await rapprochee.count() === 1, 'profil : des idées tirées des séances sont proposées');
await rapprochee.check();
ok((await page.getByRole('textbox', { name: /Objectifs à poursuivre — Cognitif/ }).inputValue()).length > 0, 'profil : une idée cochée s’écrit dans la case');
const premierePhrase = page.locator('details.pia-idees[open]').first().locator('.chip').first();
await premierePhrase.click();
ok(await premierePhrase.getAttribute('aria-pressed') === 'true', 'profil : phrase toute faite cliquée');
await premierePhrase.click();
ok(await premierePhrase.getAttribute('aria-pressed') === 'false', 'profil : phrase décliquée, elle est retirée');

// Procès-verbal 1
await page.getByRole('tab', { name: 'Procès-verbal 1' }).click();
await page.getByLabel('Date de la réunion').fill('2026-10-26');
await page.getByRole('button', { name: 'Ajouter une personne' }).click();
await page.getByLabel('Personne présente 1').fill('Mme Dupont, titulaire');
await page.getByRole('button', { name: 'Aspects du profil' }).count();
await page.getByRole('button', { name: 'Comportemental et affectif' }).click();
await page.getByRole('button', { name: /Reprendre les objectifs retenus \(3\)/ }).click();
ok(await page.locator('.pia-objectif').count() === 3, 'PV 1 : les trois objectifs retenus sont repris');
ok(await page.getByRole('button', { name: /Reprendre les objectifs retenus/ }).count() === 0, 'PV 1 : reprise une seule fois');
await page.getByLabel('Critères d’évaluation de l’objectif 1').fill('Contrôle seul 4 productions sur 5.');
await page.getByLabel('Retour de l’élève').fill('Dit que les exemples l’aident.');

// Aménagements
await page.getByRole('tab', { name: 'Aménagements' }).click();
const prop = page.locator('.pia-proposition');
await page.getByRole('heading', { name: 'Aménagements', level: 2 }).waitFor();
await prop.first().waitFor();
ok(await prop.count() >= 1, 'aménagements : des propositions tirées des aides des séances');
await prop.first().getByRole('button', { name: /Ajouter/ }).click();
ok(await page.locator('.pia-amenagement').count() === 1, 'aménagement ajouté depuis une proposition');
ok(await page.locator('.pia-amenagement .chip[aria-pressed=true]').count() >= 1, 'son type P/O/M est déjà coché');
await page.getByRole('button', { name: 'Ajouter un aménagement' }).click();
await page.getByLabel('Aménagement 2', { exact: true }).fill('Temps supplémentaire pour les évaluations');
await page.locator('.pia-amenagement').nth(1).getByRole('button', { name: 'Organisationnel' }).click();

// Export Word
const [telechargement] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Exporter en Word' }).click()
]);
const chemin = `${SORTIE}/${telechargement.suggestedFilename()}`;
await telechargement.saveAs(chemin);
ok(/^PIA/.test(telechargement.suggestedFilename()) && telechargement.suggestedFilename().endsWith('.docx'), `export Word : ${telechargement.suggestedFilename()}`);
await page.getByText(/PIA Word créé/).waitFor();

// Enregistrement + rechargement
await page.getByText(/Brouillon enregistré/).waitFor();
await recharger(page);
await page.getByRole('tab', { name: 'Aménagements' }).click();
ok(await page.locator('.pia-amenagement').count() === 2, 'après rechargement : aménagements retrouvés');
await page.getByRole('tab', { name: 'Procès-verbal 1' }).click();
ok(await page.getByLabel('Retour de l’élève').inputValue() === 'Dit que les exemples l’aident.', 'après rechargement : PV 1 retrouvé');

// Clavier sur les onglets
await page.getByRole('tab', { name: 'Procès-verbal 1' }).focus();
await page.keyboard.press('ArrowRight');
await page.getByRole('tab', { name: 'Procès-verbal 2', selected: true }).waitFor();
ok(true, 'onglets : flèche droite → onglet suivant');

// Autre année : autre PIA
await page.getByLabel('Année scolaire').selectOption('2025-2026');
await page.getByRole('tab', { name: 'Procès-verbal 1' }).click();
ok(await page.getByLabel('Retour de l’élève').inputValue() === '', 'autre année : PIA vierge');

// Ancien lien Réunion
await aller(page, `${URL_APP}#/reunion?eleve=demo-beta`);
await page.getByRole('heading', { name: 'Objectifs à valider' }).waitFor();
ok(await page.getByLabel('Élève', { exact: true }).inputValue() === 'demo-beta', 'ancien lien #/reunion : ouvre Préparer pour le bon élève');

// Depuis Élèves : suppression, aucun PIA orphelin
await page.getByRole('link', { name: 'Élèves' }).click();
await page.getByRole('button', { name: /Alpha Élève/ }).click();
await page.getByRole('button', { name: 'Ouvrir le PIA' }).click();
await page.getByRole('heading', { name: 'PIA', level: 1 }).waitFor();
ok(await page.getByLabel('Élève', { exact: true }).inputValue() === 'demo-alpha', 'Élèves → PIA avec l’élève choisi');
await page.getByRole('link', { name: 'Élèves' }).click();
await page.getByRole('button', { name: /Alpha Élève/ }).click();
await page.getByRole('button', { name: 'Supprimer…' }).click();
ok((await page.getByRole('dialog').innerText()).includes('PIA'), 'suppression : le message annonce aussi le PIA');
await page.getByRole('dialog').getByRole('checkbox').check();
await page.getByRole('dialog').getByRole('button', { name: 'Supprimer définitivement' }).click();
await page.getByText(/Alpha Élève supprimé/).first().waitFor();
pias = await lireBase('pia');
ok(pias.every((p) => p.eleveId !== 'demo-alpha'), 'après suppression de l’élève : aucun PIA orphelin');

// Téléphone et thème sombre
await aller(page, `${URL_APP}#/pia?eleve=demo-beta&onglet=preparer`);
await page.getByRole('heading', { name: 'Objectifs à valider' }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${SORTIE}/pia-telephone.png`, fullPage: true });
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'téléphone : pas de défilement horizontal');
await page.setViewportSize({ width: 1280, height: 1000 });
await page.emulateMedia({ colorScheme: 'dark' });
await page.screenshot({ path: `${SORTIE}/pia-sombre.png`, fullPage: true });
console.log('✓ captures : bureau, téléphone, thème sombre');

await navigateur.close();
ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` (${erreurs.join(' | ')})` : ''}`);
console.log('Parcours complet réussi.');
