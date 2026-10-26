// Vérification dans un vrai navigateur (hors CI pour l'instant, voir lot Q).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/reunion.mjs
// Playwright n'est pas une dépendance du projet : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.
// Parcours Lot 3 : séances → Réunion (résumé par matière, période, propositions d'objectifs à valider,
// texte à copier, « sans nom »), accès depuis Élèves, retour au Journalier, téléphone, thème sombre, aucune erreur console.
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

await page.goto(URL_APP);
await page.getByRole('button', { name: 'Ajouter des élèves fictifs' }).click();
await page.getByText('Dernières séances').waitFor();
await page.evaluate((seances) => new Promise((resolve, reject) => {
  const ouverture = indexedDB.open('journalier-v2');
  ouverture.onerror = () => reject(ouverture.error);
  ouverture.onsuccess = () => {
    const tx = ouverture.result.transaction('seances', 'readwrite');
    for (const s of seances) tx.objectStore('seances').put(s);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  };
}), SEANCES);
await page.reload();
console.log('✓ six séances réalistes injectées dans la base');

// Menu : « Réunion » remplace « Rapports »
ok(await page.getByRole('link', { name: 'Rapports' }).count() === 0, 'plus de lien « Rapports »');
await page.getByRole('link', { name: 'Réunion' }).click();
await page.getByRole('heading', { name: 'Réunion', level: 1 }).waitFor();
ok(await page.getByText('Choisissez un élève pour préparer la réunion.').count() === 1, 'sans élève : message clair');
ok(await page.getByRole('heading', { name: 'Objectifs à valider' }).count() === 0, 'sans élève : pas de faux résumé');

// Résumé d'un élève
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Alpha Élève (1CB)' });
const resume = page.locator('.reunion-resume');
const texteResume = await resume.innerText();
ok(texteResume.includes('3 séances d’accompagnement') && texteResume.includes('1 séance sans accompagnement'), `résumé : ${texteResume}`);
const sansInsecable = (t) => t.replace(/\u00a0/g, ' ');
ok(sansInsecable(await page.locator('.reunion-absences').innerText()) === 'Sur la période : 1 cours annulé (professeur absent).', 'ligne des absences');
ok(await page.locator('.reunion-matiere').count() === 2, 'deux matières : Français et Mathématiques (Sciences de Bêta exclu, vieille séance exclue)');
const noms = await page.locator('.reunion-matiere h2').allInnerTexts();
ok(noms.join(',') === 'Français,Mathématiques', `matières triées : ${noms}`);

const maths = page.getByRole('region', { name: 'Mathématiques' });
const rubrique = (titre) => maths.locator('.reunion-rubrique', { has: page.getByRole('heading', { name: titre, exact: true }) });
ok((await maths.locator('.reunion-dates').innerText()) === 'du 15/09/2026 au 22/09/2026', 'dates de la matière');
ok((await rubrique('Points d’appui').innerText()).includes('partiellement (15/09) → totalement (22/09)'), 'point d’appui : progression datée');
ok((await rubrique('Points d’appui').innerText()).includes('Entre dans la tâche') && (await rubrique('Points d’appui').innerText()).includes('totalement à chaque séance'), 'point d’appui : stable');
ok((await rubrique('À travailler').innerText()).includes('Contrôle sa production') && (await rubrique('À travailler').innerText()).includes('partiellement à chaque séance'), 'à travailler');
ok((await rubrique('Compétence travaillée').innerText()).includes('Résoudre un problème à une opération (suffisamment)'), 'compétence travaillée');
ok((await rubrique('Aides utilisées').innerText()).includes('Support visuel (effet positif)'), 'aide utilisée avec son effet');
ok((await rubrique('Aides sans effet constaté').innerText()).includes('Guidage verbal'), 'aide sans effet à part');
ok(!(await maths.innerText()).includes('Ancienne observation'), 'séance d’une autre année exclue');
await page.screenshot({ path: `${SORTIE}/reunion-bureau.png`, fullPage: true });

// Propositions à valider
const cases = page.locator('.reunion-propositions input[type=checkbox]');
ok(await cases.count() === 6, `6 propositions (4 en maths, 2 en français) : ${await cases.count()}`);
ok(await page.locator('.reunion-propositions input:checked').count() === 0, 'rien n’est coché d’avance');
const progresser = page.getByRole('checkbox', { name: /Faire progresser\s*: contrôle sa production/ });
ok((await page.locator('label', { has: progresser }).innerText()).includes('Observé « partiellement » lors des 2 dernières séances.'), 'la raison de la proposition est affichée');
await progresser.check();
await page.getByRole('checkbox', { name: /Garder l’aide qui fonctionne\s*: support visuel/ }).check();
await page.getByRole('checkbox', { name: /Consolider\s*: repère les informations pertinentes/ }).check();
ok(await page.locator('.reunion-retenus li').count() === 3, 'trois objectifs retenus');

// Reformuler un objectif, retirer, ajouter le sien
const champ = page.getByLabel('Objectif retenu 1 (Mathématiques)');
ok((await champ.inputValue()).startsWith('Faire progresser') || (await champ.inputValue()).startsWith('Garder'), 'le texte proposé est modifiable');
await champ.fill('Faire progresser le contrôle de sa production en fin de période.');
await page.getByRole('button', { name: 'Retirer l’objectif 3' }).click();
ok(await page.locator('.reunion-retenus li').count() === 2, 'retirer un objectif');
ok(!(await page.getByRole('checkbox', { name: /Consolider\s*: repère/ }).isChecked()), 'la case se décoche quand on retire l’objectif');
const ajout = page.getByRole('button', { name: 'Ajouter', exact: true });
ok(await ajout.isDisabled(), 'ajout bloqué tant que le champ est vide');
await page.getByLabel('Ajouter un objectif personnel').fill('parler du matériel avec la titulaire');
await ajout.click();
ok(await page.locator('.reunion-retenus li').count() === 3, 'objectif personnel ajouté');
ok(await page.getByLabel('Objectif retenu 3').inputValue() === 'Parler du matériel avec la titulaire', 'objectif personnel : majuscule, sans matière');

// Texte à copier
await page.getByText('Voir le texte', { exact: true }).click();
const texte = await page.locator('.reunion-texte').innerText();
ok(/^Réunion\s*: Alpha Élève \(1CB\)\nPériode\s*: 2026-2027 au /.test(texte), 'texte : en-tête avec le nom et la classe');
ok(texte.includes('Mathématiques (du 15/09/2026 au 22/09/2026)') && texte.includes('Français (le 13/10/2026)'), 'texte : une partie par matière avec ses dates');
ok(/Objectifs retenus pour la suite\nMathématiques\n• Faire progresser le contrôle de sa production en fin de période\.\n• Garder l’aide qui fonctionne\s*: support visuel\.\n\n?/.test(texte) || texte.includes('Faire progresser le contrôle de sa production en fin de période.'), 'texte : objectifs retenus (reformulés)');
ok(texte.trimEnd().endsWith('• Parler du matériel avec la titulaire'), 'texte : objectif personnel en dernier');
await page.getByRole('button', { name: 'Copier le texte' }).click();
await page.getByText('Texte de la réunion copié').waitFor();
ok(await page.evaluate(() => navigator.clipboard.readText()) === texte.replace(/\r/g, ''), 'le presse-papiers contient exactement le texte affiché');

// Sans nom
await page.getByLabel('Sans nom (pour partager)').check();
const anonyme = await page.locator('.reunion-texte').innerText();
ok(!anonyme.includes('Alpha') && /^Réunion\s*: élève \(1CB\)/.test(anonyme), 'sans nom : le nom disparaît du texte');
await page.getByLabel('Sans nom (pour partager)').uncheck();

// Période
await page.getByRole('radio', { name: 'Année scolaire' }).click();
await page.getByLabel('Année scolaire').selectOption('2025-2026');
ok((await page.locator('.reunion-resume').innerText()).includes('1 séance d’accompagnement'), 'année 2025-2026 : une séance');
ok(await page.locator('.reunion-matiere').count() === 1 && (await page.locator('.reunion-matiere').innerText()).includes('Ancienne observation'), 'année 2025-2026 : l’ancienne observation');
ok(await page.locator('.reunion-retenus li').count() === 3, 'les objectifs retenus restent quand on change de période');
await page.getByRole('radio', { name: 'Dates libres' }).click();
await page.getByLabel('Du', { exact: true }).fill('2026-11-15');
await page.getByLabel('Au', { exact: true }).fill('2026-10-01');
ok((await page.locator('.reunion-resume').innerText()).includes('après'), 'dates inversées : message clair');
await page.getByLabel('Du', { exact: true }).fill('2026-10-01');
await page.getByLabel('Au', { exact: true }).fill('2026-10-31');
ok((await page.locator('.reunion-resume').innerText()).includes('1 séance d’accompagnement') && await page.getByRole('region', { name: 'Français' }).count() === 1, 'dates libres (octobre) : Français seulement');
await page.getByRole('radio', { name: 'Dates libres' }).click();
await page.getByLabel('Du', { exact: true }).fill('2027-01-01');
await page.getByLabel('Au', { exact: true }).fill('2027-01-31');
ok(await page.getByText('Aucune séance dans cette période.').count() === 1, 'période sans séance : message clair');
await page.getByRole('radio', { name: 'État à ce jour' }).click();

// Un autre élève : ses propres objectifs
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Bêta Élève (4TQ)' });
ok(await page.locator('.reunion-retenus li').count() === 0 && await page.getByRole('region', { name: 'Sciences' }).count() === 1, 'autre élève : sa matière, aucun objectif retenu de l’autre');
await page.getByLabel('Élève', { exact: true }).selectOption({ label: 'Alpha Élève (1CB)' });
ok(await page.locator('.reunion-retenus li').count() === 3, 'retour sur le premier élève : ses objectifs sont retrouvés');

// Depuis Élèves, puis vers le Journalier
await page.getByRole('link', { name: 'Élèves' }).click();
await page.getByRole('button', { name: /Bêta Élève/ }).click();
await page.getByRole('button', { name: 'Préparer la réunion' }).click();
await page.getByRole('heading', { name: 'Réunion', level: 1 }).waitFor();
ok(await page.getByLabel('Élève', { exact: true }).inputValue() === 'demo-beta', 'Élèves → Réunion avec l’élève choisi');
await page.getByRole('button', { name: 'Voir le Journalier de l’élève' }).click();
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
ok(await page.getByLabel('Élève', { exact: true }).inputValue() === 'demo-beta', 'Réunion → Journalier du même élève');

// Ancien lien
await page.goto(`${URL_APP}#/rapports`);
await page.getByRole('heading', { name: 'Bonjour' }).waitFor();
ok(true, 'ancien lien #/rapports : retour à l’accueil, pas d’erreur');

// Téléphone et thème sombre
await page.goto(`${URL_APP}#/reunion?eleve=demo-alpha`);
await page.getByRole('heading', { name: 'Objectifs à valider' }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: `${SORTIE}/reunion-telephone.png`, fullPage: true });
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'téléphone : pas de défilement horizontal');
await page.setViewportSize({ width: 1280, height: 1000 });
await page.emulateMedia({ colorScheme: 'dark' });
await page.screenshot({ path: `${SORTIE}/reunion-sombre.png`, fullPage: true });
console.log('✓ captures : bureau, téléphone, thème sombre');

await navigateur.close();
ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` (${erreurs.join(' | ')})` : ''}`);
console.log('Parcours complet réussi.');
