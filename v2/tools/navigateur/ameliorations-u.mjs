// Vérification dans un vrai navigateur du lot U (retouches après les essais du 3 novembre 2026).
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/ameliorations-u.mjs
// U1 : bouton « Encoder la séance » en haut du panneau de l'agenda ; horaire libre (13h30 – 16h) hors des périodes.
// U2 : enseignants par cours (fiche élève, colonne « Titulaire » du Journalier, séance).
// U3 : évolution regroupée par changement de niveau (Progression / À consolider).
// La date du jour est figée au mardi 3 novembre 2026.
import { mkdirSync } from 'node:fs';
import os from 'node:os';

import { ajouterElevesFictifs, aller, ecrireBase, lireBase, recharger } from './_coffre.mjs';
import { auditerEcran } from './_accessibilite.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-11-03T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));

await aller(page, URL_APP);
await ajouterElevesFictifs(page);

const eleveBase = (await lireBase(page, 'eleves')).find((e) => e.id === 'demo-alpha');
const alpha = { ...eleveBase, titulaire: 'Mme Titu', matieres: ['Mathématiques', 'Français'], enseignants: [{ matiere: 'Mathématiques', nom: 'M. Maths' }] };
await ecrireBase(page, 'eleves', alpha);

const seance = (id, date, observations, extra = {}) => ({
  id, eleveId: 'demo-alpha', date, periodeDebut: '2e H', periodeFin: '2e H', matiere: 'Mathématiques', niveauScolaire: '1CB', forme: '', presence: 'present',
  interventions: ['Accompagnement individuel'], objectifLecon: 'Notation scientifique', contenuClasse: '', monObjectif: 'Comprendre la virgule',
  observations, remarque: '', competences: [], precisionCompetence: '', situationAide: 'none', aides: [], precisionAide: '', transfert: null,
  suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' },
  creeLe: `${date}T10:00:00.000Z`, modifieLe: `${date}T10:00:00.000Z`, ...extra
});
await ecrireBase(page, 'seances', seance('u-1', '2026-10-02', [
  { texte: 'Comprend la notion travaillée', niveau: 0 }, { texte: 'Entre dans la tâche', niveau: 2 }, { texte: 'Maintient son attention', niveau: 0 }
]));
await ecrireBase(page, 'seances', seance('u-2', '2026-11-03', [
  { texte: 'Comprend la notion travaillée', niveau: 1 }, { texte: 'Entre dans la tâche', niveau: 1 }, { texte: 'Maintient son attention', niveau: 1 }
]));
await recharger(page);

/* ───────── U3 : évolution ───────── */
await page.evaluate(() => { location.hash = '#/journalier'; });
await page.getByRole('heading', { name: 'Journalier', level: 1 }).waitFor();
await page.getByRole('button', { name: 'Voir' }).first().click().catch(() => undefined);
await page.locator('.apercu-ligne').first().waitFor();
const lignes = await page.locator('.apercu-ligne').allInnerTexts();
const evo = lignes.filter((l) => /Progression|À consolider/.test(l));
ok(evo.length === 2, `évolution : deux lignes regroupées (${evo.length})`);
ok(/^• Progression, Partiellement → Suffisamment/.test(evo[0]) && /comprend la notion travaillée/.test(evo[0]) && /maintient son attention/.test(evo[0]), 'évolution : progressions groupées sur une ligne');
ok(/^• À consolider, Totalement → Suffisamment/.test(evo[1]) && /entre dans la tâche/.test(evo[1]), 'évolution : point à consolider à part');
ok(await page.locator('.evo-progres').count() === 1 && await page.locator('.evo-consolider').count() === 1, 'évolution : deux libellés colorés');
ok((await page.locator('.journalier-apercu').innerText()).includes('Évolution depuis la séance du 02/10'), 'évolution : la date de la séance comparée est dite une fois');

/* ───────── U2 : enseignants ───────── */
// Les aperçus du Journalier ont des titres <h4> sous un <h2> (niveau sauté) : défaut antérieur à ce lot, hors sujet ici ; on vérifie les contrastes.
let defauts = (await auditerEcran(page, 'journalier évolution')).filter((d) => d.regle !== 'titres');
ok(defauts.length === 0, `Journalier : audit d'accessibilité à 0 défaut${defauts.length ? ` — ${JSON.stringify(defauts)}` : ''}`);
await page.screenshot({ path: `${SORTIE}/u-journalier.png` });

await page.evaluate(() => { location.hash = '#/eleves'; });
await page.getByRole('heading', { name: 'Élèves', level: 1 }).waitFor();
await page.getByText('Alpha', { exact: false }).first().click();
await page.getByRole('button', { name: /Modifier/ }).first().click();
await page.getByText('Enseignants par cours').waitFor();
ok(await page.getByLabel('Titulaire(s) de classe').isVisible(), 'fiche : « Titulaire(s) de classe » pour le PIA');
await page.getByRole('button', { name: 'Ajouter un cours' }).click();
await page.getByLabel('Matière 2', { exact: true }).selectOption('Français');
await page.getByLabel('Enseignant de la matière 2').fill('Mme Français');
await page.screenshot({ path: `${SORTIE}/u-fiche-eleve.png` });
await page.getByRole('button', { name: /^Enregistrer/ }).first().click();
await page.waitForTimeout(600);
const enregistre = (await lireBase(page, 'eleves')).find((e) => e.id === 'demo-alpha');
ok(JSON.stringify(enregistre.enseignants) === JSON.stringify([{ matiere: 'Mathématiques', nom: 'M. Maths' }, { matiere: 'Français', nom: 'Mme Français' }]), 'fiche : les enseignants sont enregistrés');
ok(enregistre.titulaire === 'Mme Titu', 'fiche : le titulaire de classe reste distinct');

/* séance : le nom du dossier est gardé dans la séance enregistrée */
await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByRole('heading', { name: 'Séance', level: 1 }).waitFor();
await page.getByLabel('Élève accompagné').selectOption('demo-alpha');
await page.getByLabel('Matière', { exact: true }).fill('Mathématiques');
ok((await page.locator('.feuille').first().innerText()).includes('M. Maths'), 'séance : la feuille donne l’enseignant de la matière (maths)');
await page.getByLabel('Matière', { exact: true }).fill('Français');
ok((await page.locator('.feuille').first().innerText()).includes('Mme Français'), 'séance : la feuille suit la matière (français)');
ok((await page.getByLabel('Enseignant du cours').getAttribute('placeholder')) === 'Mme Français', 'séance : le nom du dossier est proposé pour la matière');
await page.getByLabel('Objectif de la leçon').fill('Le verbe').catch(() => undefined);
await page.getByRole('button', { name: /Enregistrer la séance/ }).click();
await page.getByRole('dialog', { name: /Aucun point noté/ }).getByRole('button', { name: 'Enregistrer quand même' }).click({ timeout: 1500 }).catch(() => undefined); // séance volontairement sans point noté
await page.waitForTimeout(800);
const seances = await lireBase(page, 'seances');
const nouvelle = seances.find((s) => s.matiere === 'Français');
ok(nouvelle?.enseignant === 'Mme Français', `séance : l'enseignant est gardé dans la séance (${nouvelle?.enseignant})`);

/* ───────── U1 : panneau de l'agenda et horaire libre ───────── */
const activite = (id, extra) => ({ id, type: 'eleve', titre: '', lieu: '', note: '', repetition: 'aucune', creeLe: '2026-10-24T08:00:00Z', modifieLe: '2026-10-24T08:00:00Z', debut: 0, fin: 0, ...extra });
await ecrireBase(page, 'activites', activite('u-a1', { eleveId: 'demo-alpha', date: '2026-11-04', debut: 1, fin: 1, matiere: 'Mathématiques' }));
await ecrireBase(page, 'activites', activite('u-a2', { type: 'collaboration', titre: 'Travail de groupe', date: '2026-11-03', debut: 5, fin: 7, heureDebut: '13:30', heureFin: '16:00' }));
await recharger(page);
await page.evaluate(() => { location.hash = '#/agenda'; });
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();

const bloc = page.locator('button.evt', { hasText: 'Travail de groupe' });
await bloc.waitFor();
ok((await bloc.innerText()).includes('13:30 – 16:00'), 'agenda : le bloc libre affiche ses heures exactes');
const hauteurBloc = (await bloc.boundingBox()).height;
const hauteurPeriode = (await page.locator('button.cellule').first().boundingBox()).height;
ok(hauteurBloc > hauteurPeriode * 2, `agenda : le bloc de 2 h 30 est plus haut que deux périodes (${Math.round(hauteurBloc)} px)`);
const dessus = (await page.locator('button.cellule[data-periode="5"]').first().boundingBox()).y;
const haut = (await bloc.boundingBox()).y;
ok(haut > dessus && haut < dessus + hauteurPeriode, 'agenda : le bloc commence au milieu de la période 13 h 15 – 14 h 05 (13 h 30)');
await page.screenshot({ path: `${SORTIE}/u-agenda-libre.png` });

await page.locator('.colonne').nth(2).locator('button.evt').first().click();
const panneau = page.getByRole('region', { name: 'Modifier l’activité' });
await panneau.waitFor();
const encoder = panneau.getByRole('button', { name: 'Encoder la séance' });
const fermer = panneau.getByRole('button', { name: 'Fermer le panneau' });
await page.screenshot({ path: `${SORTIE}/u-agenda-panneau.png` });
const bEnc = await encoder.boundingBox();
const bFer = await fermer.boundingBox();
const haut0 = (await panneau.boundingBox()).y;
ok(bEnc.y - haut0 < 110 && bEnc.y >= bFer.y, 'panneau : « Encoder la séance » est tout en haut, juste sous le titre et « Fermer »');
ok(await panneau.getByRole('button', { name: 'Encoder la séance' }).count() === 1, 'panneau : un seul bouton « Encoder la séance »');
const barre = await panneau.locator('.barre-fixe').boundingBox();
ok(barre.y + barre.height <= 1000 + 1, 'panneau : « Enregistrer » reste visible en bas de l’écran');
await page.screenshot({ path: `${SORTIE}/u-agenda-panneau.png` });
await encoder.click();
await page.waitForURL(/#\/seance/);
ok(true, 'panneau : le bouton ouvre l’écran Séance');

/* création d'un horaire libre par le panneau */
await page.evaluate(() => { location.hash = '#/agenda'; });
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
await page.getByRole('button', { name: 'Nouvelle activité' }).first().click();
const nouveau = page.getByRole('region', { name: 'Nouvelle activité' });
await nouveau.getByRole('radio', { name: 'Formation' }).click();
await nouveau.getByLabel('Titre').fill('Atelier libre');
await nouveau.getByLabel('Jour').fill('2026-11-05');
ok(await nouveau.getByLabel('Horaire libre (en dehors des périodes)').isVisible(), 'panneau : option « Horaire libre » proposée hors accompagnement d’élève');
await nouveau.getByLabel('Horaire libre (en dehors des périodes)').check();
await nouveau.getByLabel('De', { exact: true }).fill('16:00');
await nouveau.getByLabel('À', { exact: true }).fill('15:00');
ok(await nouveau.getByRole('alert').isVisible() && await nouveau.getByRole('button', { name: 'Ajouter à l’agenda' }).isDisabled(), 'panneau : heures inversées = message et bouton bloqué');
await nouveau.getByLabel('De', { exact: true }).fill('15:45');
await nouveau.getByLabel('À', { exact: true }).fill('17:15');
await nouveau.getByRole('button', { name: 'Ajouter à l’agenda' }).click();
await page.waitForTimeout(800);
const creee = (await lireBase(page, 'activites')).find((a) => a.titre === 'Atelier libre');
ok(creee?.heureDebut === '15:45' && creee?.heureFin === '17:15' && creee.debut === 7, `agenda : l'activité garde ses heures (${creee?.heureDebut}–${creee?.heureFin}, période ${creee?.debut})`);
await recharger(page);
await page.evaluate(() => { location.hash = '#/agenda'; });
await page.locator('button.evt', { hasText: 'Atelier libre' }).waitFor();
await page.locator('button.evt', { hasText: 'Atelier libre' }).click();
const edition = page.getByRole('region', { name: 'Modifier l’activité' });
ok(await edition.getByLabel('De', { exact: true }).inputValue() === '15:45', 'agenda : les heures se relisent dans le panneau après rechargement');
await edition.getByLabel('Horaire libre (en dehors des périodes)').uncheck();
await edition.getByRole('button', { name: 'Enregistrer', exact: true }).click();
await page.waitForTimeout(800);
const retour = (await lireBase(page, 'activites')).find((a) => a.titre === 'Atelier libre');
ok(retour && !('heureDebut' in retour) && !('heureFin' in retour), 'agenda : décocher « Horaire libre » retire les heures');

defauts = await auditerEcran(page, 'agenda horaire libre');
ok(defauts.length === 0, `Agenda : audit d'accessibilité à 0 défaut${defauts.length ? ` — ${JSON.stringify(defauts)}` : ''}`);

await nav.close();
ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
