// Audit lot 6.3 : dans l'agenda, une séance d'absence se voit (croix, mot « absence », contour) et la légende explique les signes.
// Lancer : npm run dev (port 5199), puis  LANG=C.UTF-8 node tools/navigateur/lot6-agenda.mjs
import { aller } from './_coffre.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const echecs = [];
const erreurs = [];
const ok = (cond, msg) => { if (!cond) { echecs.push(msg); console.log(`✗ ${msg}`); } else console.log(`✓ ${msg}`); };

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: 'fr-BE' });
await ctx.clock.setFixedTime(new Date('2026-11-04T12:00:00'));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
await aller(page, URL_APP);
await page.getByRole('button', { name: 'Charger les données d’essai' }).click();
await page.getByText('Données d’essai chargées').waitFor();

await page.evaluate(() => { location.hash = '#/seance'; });
await page.getByLabel('Élève accompagné').selectOption({ label: 'Élève Bêta' });
await page.getByLabel('Date', { exact: true }).fill('2026-11-03');
await page.getByLabel('Première période').selectOption({ index: 6 });
await page.getByLabel('Matière').fill('Sciences');
await page.locator('input[name="presence"][value="absent_eleve"]').check({ force: true });
await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
await page.getByRole('dialog', { name: /Aucun point noté/ }).getByRole('button', { name: 'Enregistrer quand même' }).click({ timeout: 1500 }).catch(() => undefined); // séance volontairement sans point noté
await page.getByText('Séance enregistrée').first().waitFor();

await page.evaluate(() => { location.hash = '#/agenda'; });
await page.waitForTimeout(600);
await page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: 'Semaine', exact: true }).click();
await page.waitForTimeout(400);
const absence = page.locator('.evt.absence');
ok(await absence.count() === 1, `la séance d'absence a le style « absence » (${await absence.count()})`);
if (await absence.count() === 1) {
  ok((await absence.innerText()).includes('absence'), 'le mot « absence » est écrit (pas la couleur seule)');
  ok(/absence/.test(await absence.getAttribute('aria-label')), 'le nom accessible dit « absence »');
}
ok(await page.locator('.evt.realise:not(.absence)').count() >= 0 && await page.locator('.legende-signes').count() === 1, 'la légende des signes est affichée');
const legende = await page.locator('.legende-signes').innerText();
ok(/réalisée/.test(legende) && /absence/.test(legende) && /annulé/.test(legende) && /férié/.test(legende) && /vacances/.test(legende), `la légende explique réalisé, absence, annulé, férié, vacances (${legende.slice(0, 60)}…)`);
const typeNonEleve = await page.locator('.evt:not(.c-0):not(.c-1):not(.c-2):not(.c-3):not(.c-4):not(.c-5):not(.c-6):not(.c-7):not(.c-8):not(.c-9)').first().innerText();
ok(/Collaboration|Formation|Administratif|Autre|Libre/i.test(typeNonEleve), `le type d'une activité sans élève est écrit (${typeNonEleve.replace(/\n/g, ' · ')})`);
/* Séries : dupliquer ne crée pas de doublon ; pendant les vacances, la série est signalée. */
await page.locator('.evt', { hasText: 'Remédiation fractions' }).first().click();
await page.locator('.panneau').waitFor();
const avant = await page.locator('.evt').count();
await page.getByRole('button', { name: 'Dupliquer à la semaine suivante' }).click();
await page.getByText('rien à dupliquer').first().waitFor({ timeout: 4000 }).catch(() => undefined);
ok(await page.getByText('rien à dupliquer').count() >= 1, 'dupliquer une série : message, aucun doublon créé');
await page.getByLabel('Fermer le panneau').click();
await page.waitForTimeout(300);
ok(await page.locator('.evt').count() === avant, 'le nombre d’activités affichées ne change pas');
for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Semaine suivante' }).click();
await page.waitForTimeout(500);
const alertes = await page.locator('.agenda-alertes').innerText().catch(() => '');
ok(/Vacances d’hiver/.test(alertes), `la semaine du 21 décembre signale les séries en vacances (${alertes.replace(/\s+/g, ' ').slice(0, 90)})`);

await nav.close();
ok(erreurs.length === 0, `aucune erreur dans la console${erreurs.length ? ' : ' + erreurs.slice(0, 2).join(' | ') : ''}`);
if (echecs.length) { console.log(`\n${echecs.length} échec(s)`); process.exit(1); }
console.log('\nTout est bon.');
