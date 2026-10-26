// Vérification dans un vrai navigateur (hors CI pour l'instant, voir lot Q).
// Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/agenda-6.mjs
// Playwright n'est pas une dépendance du projet : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.
// Parcours Lot 6 : glisser pour créer sur plusieurs périodes (souris, vers le haut, simple clic), semaine type
// (enregistrer, relire après rechargement, placer sur plusieurs semaines sans fériés ni vacances, pas de doublon,
// supprimer), impression (bouton, mise en page, PDF paysage d'une page), téléphone.
// La date du jour est figée au lundi 26 octobre 2026 (semaine de congé d'automne).
import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';

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
const activite = (id, extra) => ({ id, type: 'eleve', titre: '', lieu: '', note: '', repetition: 'aucune', creeLe: '2026-10-24T08:00:00Z', modifieLe: '2026-10-24T08:00:00Z', debut: 0, fin: 0, ...extra });

const bascule = (nom) => page.getByRole('group', { name: 'Affichage' }).getByRole('button', { name: nom, exact: true });
const titre = () => page.locator('.agenda-titre').innerText();
const caseDu = (jour) => page.locator('.mois-case:not(.hors-mois)').filter({ has: page.locator(`.mois-jour strong:text-is("${jour}")`) });
const cellule = (date, periode) => page.locator(`button.cellule[data-date="${date}"][data-periode="${periode}"]`);
const centre = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const panneauNouveau = () => page.getByRole('region', { name: 'Nouvelle activité' });
const choisi = (nom) => panneauNouveau().getByLabel(nom, { exact: true }).evaluate((s) => s.options[s.selectedIndex].text);
const ouvrirAgenda = async () => { await page.evaluate(() => { location.hash = '#/accueil'; }); await page.getByRole('link', { name: 'Agenda' }).click(); await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor(); };
/** Glisse de la case (date, a) à la case (date, b), comme avec une souris. */
async function glisser(date, a, b) {
  const d = await centre(cellule(date, a));
  const f = await centre(cellule(date, b));
  await page.mouse.move(d.x, d.y);
  await page.mouse.down();
  await page.mouse.move(d.x, d.y + (f.y > d.y ? 8 : -8), { steps: 3 });
  await page.mouse.move(f.x, f.y, { steps: 8 });
}

/* ───────── Préparation ───────── */
await page.goto(URL_APP);
await page.getByRole('button', { name: 'Ajouter des élèves fictifs' }).click();
await page.getByText('Alpha').first().waitFor().catch(() => undefined);
await ecrireActivite(activite('a1', { eleveId: 'demo-alpha', date: '2026-10-26', debut: 0, fin: 1 }));
await ecrireActivite(activite('a2', { eleveId: 'demo-beta', date: '2026-10-27', debut: 2, fin: 2 }));
await ecrireActivite(activite('a3', { type: 'formation', titre: 'Formation pôle', date: '2026-10-29', debut: 2, fin: 4 }));
await page.reload();
await ouvrirAgenda();
console.log('✓ données de départ créées');

/* ───────── Glisser pour créer ───────── */
await glisser('2026-10-28', 5, 7);
ok(await page.locator('.fantome.creation').count() === 1, 'pendant le glissement, la zone choisie est dessinée');
const hauteurFantome = await page.locator('.fantome.creation').evaluate((e) => e.getBoundingClientRect().height);
ok(hauteurFantome > 3 * 55, `la zone couvre trois périodes (${Math.round(hauteurFantome)}px)`);
await page.mouse.up();
await panneauNouveau().waitFor();
ok(await page.locator('.fantome.creation').count() === 0, 'la zone disparaît au relâchement');
ok(await panneauNouveau().getByLabel('Jour').inputValue() === '2026-10-28', 'le panneau s’ouvre au bon jour (mercredi 28)');
const texteDe = await choisi('De');
const texteA = await choisi('À');
ok(texteDe.startsWith('6e H') && texteA.startsWith('8e H'), `de la 6e H à la 8e H (${texteDe} → ${texteA})`);
// l'enregistrer
await panneauNouveau().getByRole('radio', { name: 'Administratif' }).click();
await panneauNouveau().getByLabel('Titre').fill('Réunion d’équipe');
await panneauNouveau().getByRole('button', { name: 'Ajouter à l’agenda' }).click();
await page.getByText('Activité ajoutée').first().waitFor();
ok(await page.locator('.evt', { hasText: 'Réunion d’équipe' }).count() === 1, 'l’activité de trois périodes apparaît dans la grille');
const acts = await lireBase('activites');
const reunion = acts.find((a) => a.titre === 'Réunion d’équipe');
ok(reunion && reunion.debut === 5 && reunion.fin === 7 && reunion.date === '2026-10-28', 'enregistrée dans la base : 6e H à 8e H');

// de bas en haut
await glisser('2026-10-30', 4, 2);
await page.mouse.up();
await panneauNouveau().waitFor();
ok((await choisi('De')).startsWith('3e H') && (await choisi('À')).startsWith('5e H'), 'glisser vers le haut : de la 3e H à la 5e H');
await page.getByRole('button', { name: 'Fermer le panneau' }).click();

// un simple clic crée toujours une seule période
await cellule('2026-10-27', 6).click();
await panneauNouveau().waitFor();
ok((await choisi('De')).startsWith('7e H') && (await choisi('À')).startsWith('7e H'), 'simple clic : une seule période (7e H)');
await page.getByRole('button', { name: 'Fermer le panneau' }).click();
// un glisser qui sort de la colonne ne change pas de jour
const d1 = await centre(cellule('2026-10-30', 1));
const autre = await centre(cellule('2026-10-27', 3));
await page.mouse.move(d1.x, d1.y); await page.mouse.down(); await page.mouse.move(d1.x, d1.y + 10, { steps: 3 }); await page.mouse.move(autre.x, autre.y, { steps: 6 }); await page.mouse.up();
await panneauNouveau().waitFor();
ok(await panneauNouveau().getByLabel('Jour').inputValue() === '2026-10-30', 'sortir de la colonne en glissant garde le jour de départ');
await page.getByRole('button', { name: 'Fermer le panneau' }).click();

/* ───────── Semaine type ───────── */
await page.getByRole('button', { name: 'Semaine type', exact: true }).click();
const fenetre = page.getByRole('dialog', { name: 'Semaine type' });
await fenetre.waitFor();
ok((await fenetre.innerText()).includes('4 activités'), 'la fenêtre compte les 4 activités de la semaine affichée');
ok(await fenetre.getByText('Pas encore de semaine type').count() === 1, 'au départ, pas de semaine type');
await fenetre.getByRole('button', { name: 'Enregistrer comme semaine type' }).click();
await page.getByText('Semaine type enregistrée').first().waitFor();
const texteFenetre = await fenetre.innerText();
ok(texteFenetre.includes('Votre semaine type') && texteFenetre.includes('Réunion d’équipe') && texteFenetre.includes('Formation pôle') && texteFenetre.includes('Élève Alpha'), 'la semaine type est montrée jour par jour');
ok(texteFenetre.includes('1e H–2e H · Élève Alpha'), 'avec les périodes (1e H–2e H)');
await page.screenshot({ path: `${SORTIE}/agenda6-semaine-type.png` });
const reglage = (await lireBase('reglages')).find((r) => r.id === 'agenda-semaine-type');
ok(reglage && reglage.valeur.elements.length === 4, 'enregistrée dans la base (4 éléments)');

// aperçu : jusqu'au 20 novembre, fériés et vacances ignorés
await fenetre.getByLabel(/Jusqu’au/).fill('2026-11-20');
let apercu = await fenetre.getByRole('status').innerText();
ok(apercu.includes('10 activités ajoutées') && apercu.includes('4 semaines') && apercu.includes('6 ignorées'), `aperçu : 10 ajoutées, 4 semaines, 6 ignorées (${apercu})`);
await fenetre.getByLabel('Ne rien placer les jours fériés et pendant les vacances scolaires').uncheck();
apercu = await fenetre.getByRole('status').innerText();
ok(apercu.includes('12 activités ajoutées') && apercu.includes('4 déjà présentes'), `sans l’option : 12 ajoutées, 4 déjà présentes (${apercu})`);
await fenetre.getByLabel('Ne rien placer les jours fériés et pendant les vacances scolaires').check();
await fenetre.getByLabel(/Jusqu’au/).fill('2026-10-01');
ok((await fenetre.getByRole('status').innerText()).includes('Choisissez une date de fin'), 'une date avant la semaine affichée est expliquée');
ok(await fenetre.getByRole('button', { name: 'Ajouter à l’agenda' }).isDisabled(), 'rien à ajouter : le bouton est grisé');
await fenetre.getByLabel(/Jusqu’au/).fill('2026-11-20');

// après rechargement, la semaine type est toujours là
await fenetre.getByRole('button', { name: 'Fermer' }).click();
await fenetre.waitFor({ state: 'hidden' });
await page.reload();
await page.getByRole('heading', { name: 'Agenda', level: 1 }).waitFor();
await page.getByRole('button', { name: 'Semaine type', exact: true }).click();
await fenetre.waitFor();
ok((await fenetre.innerText()).includes('Votre semaine type'), 'après rechargement : semaine type conservée');
await fenetre.getByLabel(/Jusqu’au/).fill('2026-11-20');

// application
const avant = (await lireBase('activites')).length;
await fenetre.getByRole('button', { name: 'Ajouter à l’agenda' }).click();
await page.getByText('10 activités ajoutées').first().waitFor();
await fenetre.waitFor({ state: 'hidden' });
const apres = await lireBase('activites');
ok(apres.length === avant + 10, `10 activités créées dans la base (${avant} → ${apres.length})`);
ok(apres.every((a) => a.repetition === 'aucune'), 'aucune n’est une série : chacune se déplace ou se supprime seule');
ok(!apres.some((a) => ['2026-11-02', '2026-11-11'].includes(a.date)), 'rien le 2 novembre (congé) ni le 11 novembre (Armistice)');
ok(!apres.some((a) => a.date > '2026-10-30' && a.date < '2026-11-02'), 'et rien de plus dans la semaine de vacances');

await bascule('Mois').click();
await page.getByRole('button', { name: 'Mois suivant' }).click();
ok(await titre() === 'novembre 2026', 'mois suivant : novembre 2026');
ok(await caseDu('2').locator('.mois-evt').count() === 0, '2 novembre : aucune activité placée');
ok(await caseDu('3').locator('.mois-evt').count() === 1 && (await caseDu('3').innerText()).includes('Bêta'), '3 novembre : Bêta placée');
ok(await caseDu('11').locator('.mois-evt').count() === 0, '11 novembre : aucune activité placée');
ok(await caseDu('16').locator('.mois-evt').count() === 1 && await caseDu('18').locator('.mois-evt').count() === 1, '16 et 18 novembre : activités placées');
await page.screenshot({ path: `${SORTIE}/agenda6-mois-novembre.png`, fullPage: true });

// réappliquer ne double rien
await page.getByRole('button', { name: 'Aujourd’hui' }).click();
await page.getByRole('button', { name: 'Semaine type', exact: true }).click();
await fenetre.waitFor();
await fenetre.getByLabel(/Jusqu’au/).fill('2026-11-20');
ok((await fenetre.getByRole('status').innerText()).includes('0 activité ajoutée'), 'réappliquer : 0 activité à ajouter (pas de doublon)');
ok(await fenetre.getByRole('button', { name: 'Ajouter à l’agenda' }).isDisabled(), 'réappliquer : bouton grisé');

// supprimer la semaine type
await fenetre.getByRole('button', { name: 'Supprimer la semaine type' }).click();
ok(await fenetre.getByRole('button', { name: 'Oui, supprimer la semaine type' }).count() === 1, 'suppression : une confirmation est demandée');
await fenetre.getByRole('button', { name: 'Oui, supprimer la semaine type' }).click();
await page.getByText('Semaine type supprimée').first().waitFor();
ok(await fenetre.getByText('Pas encore de semaine type').count() === 1, 'la fenêtre revient à « pas encore de semaine type »');
ok((await lireBase('activites')).length === avant + 10, 'supprimer la semaine type ne touche pas aux activités déjà placées');
await page.keyboard.press('Escape');
await fenetre.waitFor({ state: 'hidden' });

/* ───────── Impression ───────── */
await bascule('Semaine').click();
await page.evaluate(() => { window.__impressions = 0; window.print = () => { window.__impressions += 1; }; });
await page.getByRole('button', { name: 'Imprimer', exact: true }).click();
ok(await page.evaluate(() => window.__impressions) === 1, 'le bouton « Imprimer » lance l’impression');
await page.emulateMedia({ media: 'print' });
ok(await page.locator('.nav').isHidden(), 'impression : le menu est caché');
ok(await page.locator('.agenda-barre').isHidden(), 'impression : la barre de boutons est cachée');
ok(await page.locator('.cellule').first().isHidden(), 'impression : les cases de création sont cachées');
ok(await page.locator('.grille').isVisible(), 'impression : la grille est visible (l’application n’est pas cachée)');
const titreImp = await page.locator('.agenda-impression-titre').innerText();
ok(titreImp.toLowerCase().includes('26 – 30 octobre 2026'), `impression : un titre indique la semaine (${titreImp})`);
const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
writeFileSync(`${SORTIE}/agenda6-semaine.pdf`, pdf);
const texte = pdf.toString('latin1');
const pages = (texte.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
const boite = texte.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
ok(pages === 1, `PDF de la semaine : une seule page (${pages})`);
ok(boite && Number(boite[1]) > Number(boite[2]), `PDF en paysage (${boite?.[1]} × ${boite?.[2]})`);
await page.emulateMedia({ media: 'screen' });
await bascule('Mois').click();
await page.emulateMedia({ media: 'print' });
ok(await page.locator('.mois').isVisible() && await page.locator('.mois-jour').first().isVisible(), 'impression du mois : la grille du mois est visible');
const pdfMois = await page.pdf({ preferCSSPageSize: true, printBackground: true });
const pagesMois = (pdfMois.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
ok(pagesMois === 1, `PDF du mois : une seule page (${pagesMois})`);
writeFileSync(`${SORTIE}/agenda6-mois.pdf`, pdfMois);
await page.emulateMedia({ media: 'screen' });

/* ───────── Téléphone ───────── */
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(URL_APP);
await ouvrirAgenda();
await page.getByRole('button', { name: 'Semaine type', exact: true }).click();
const fenTel = page.getByRole('dialog', { name: 'Semaine type' });
await fenTel.waitFor();
const b = await fenTel.boundingBox();
ok(b && b.x >= 0 && b.x + b.width <= 390 && b.y >= 0 && b.y + b.height <= 844, 'téléphone : la fenêtre de la semaine type tient dans l’écran');
await page.screenshot({ path: `${SORTIE}/agenda6-semaine-type-telephone.png` });
await page.keyboard.press('Escape');

ok(erreurs.length === 0, `aucune erreur console (${erreurs.join(' | ') || 'aucune'})`);
await navigateur.close();
console.log(`\nCaptures dans ${SORTIE}`);
