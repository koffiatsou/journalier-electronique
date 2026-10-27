// Vérification dans un vrai navigateur : les séances réalisées apparaissent dans l'agenda, même sans planification (lot « Agenda : séances réalisées »).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/agenda-seances.mjs   (PLAYWRIGHT=<chemin> si besoin)
// La date du jour est figée au lundi 26 octobre 2026.
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import { ajouterElevesFictifs, aller, ecrireBase, recharger } from './_coffre.mjs';

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

const seance = (id, extra) => ({
  id, eleveId: 'demo-alpha', date: '2026-10-21', periodeDebut: '2e H', periodeFin: '2e H', matiere: 'Mathématiques', niveauScolaire: '', forme: '',
  presence: 'present', interventions: [], objectifLecon: '', contenuClasse: '', monObjectif: '', observations: [], remarque: '', competences: [],
  precisionCompetence: '', situationAide: 'none', aides: [], precisionAide: '', transfert: 'observed', suite: { actions: [], modalite: '', objectif: '', collaborations: [], precision: '' }, creeLe: '2026-10-21T10:00:00Z', modifieLe: '2026-10-21T10:00:00Z', ...extra
});
const bascule = (nom) => page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: nom, exact: true });

await aller(page, URL_APP);
await ajouterElevesFictifs(page);
// Une séance de la semaine passée (21/10) et une très ancienne (septembre), toutes deux SANS planification.
await ecrireBase(page, 'seances', seance('s-recente', {}));
await ecrireBase(page, 'seances', seance('s-ancienne', { date: '2026-09-15', periodeDebut: '4e H', periodeFin: '5e H', eleveId: 'demo-beta' }));
await recharger(page);
await page.getByRole('link', { name: 'Agenda' }).click();
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();

// Semaine du 26 octobre : on recule d'une semaine pour voir le 21.
await page.getByRole('button', { name: 'Semaine précédente' }).click();
const evt = page.locator('.evt.realise').first();
await evt.waitFor();
ok(/réalisé/.test((await evt.getAttribute('aria-label')) ?? ''), 'une séance sans planification apparaît dans la semaine, marquée « réalisé »');
ok((await evt.getAttribute('aria-label')).includes('mercredi 21'), 'au bon jour (mercredi 21 octobre)');
ok((await evt.locator('.evt-poignee').count()) === 0, 'pas de poignée pour étirer une séance sans planification');
await page.screenshot({ path: `${SORTIE}/agenda-seance-semaine.png`, fullPage: true });

await evt.click();
const panneau = page.getByRole('region', { name: 'Séance réalisée' });
await panneau.waitFor();
ok(/Séance enregistrée sans planification/.test(await panneau.innerText()), 'le panneau explique d’où vient l’événement');
ok((await panneau.getByRole('button', { name: 'Supprimer' }).count()) === 0, 'rien à supprimer ni à planifier depuis l’agenda');

// Rétroactif : mois de septembre
await bascule('Mois').click();
await page.getByRole('button', { name: 'Mois précédent' }).click();
ok((await page.locator('.mois-evt', { hasText: /B[eê]ta/ }).count()) === 1, 'rétroactif : la séance de septembre apparaît dans la vue Mois');
ok((await page.locator('.mois-evt[draggable="false"]').count()) === 1, 'elle ne se glisse pas');
await page.screenshot({ path: `${SORTIE}/agenda-seance-mois.png`, fullPage: true });

// Ouvrir la séance depuis l'agenda
await page.locator('.mois-evt', { hasText: /B[eê]ta/ }).click();
await page.getByRole('button', { name: 'Ouvrir la séance' }).click();
await page.getByRole('heading', { name: /séance/i, level: 1 }).waitFor();
ok(page.url().includes('#/seance'), '« Ouvrir la séance » mène à l’écran Séance');
ok((await page.locator('select, input').evaluateAll((els) => els.some((e) => e.value === '4e H'))), 'la séance s’ouvre avec ses périodes (4e H)');

// Une planification qui couvre la séance : pas de doublon
await page.getByRole('link', { name: 'Agenda' }).click();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ` : ${erreurs.join(' | ')}` : ''}`);
await navigateur.close();
console.log(`Captures dans ${SORTIE}`);
