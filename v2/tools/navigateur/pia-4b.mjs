// Vérification dans un vrai navigateur. Lancer : PORT=5199 npm run dev   puis   LANG=C.UTF-8 node tools/navigateur/pia-4b.mjs
// Playwright n'est pas une dépendance du projet : PLAYWRIGHT=<chemin vers playwright/index.mjs> si besoin.
// Parcours Lot 4b : exemple fictif → PV 2 (rappel des séances, évaluation, présents, retours, aménagements de la rentrée),
// export Word par partie et dé-identifié, version imprimable (PDF), rechargement, téléphone, thème sombre, aucune erreur console.
import { mkdirSync } from 'node:fs';
import os from 'node:os';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');
const URL_APP = process.env.URL_APP ?? 'http://localhost:5199/';
const SORTIE = process.env.SORTIE ?? `${os.tmpdir()}/journalier-navigateur`;
mkdirSync(SORTIE, { recursive: true });
const erreurs = [];
const ok = (cond, msg) => { if (!cond) throw new Error(`ÉCHEC : ${msg}`); console.log(`✓ ${msg}`); };

const navigateur = await chromium.launch();
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text()); });
page.on('pageerror', (e) => erreurs.push(String(e)));
// L'impression réelle ouvre une fenêtre du navigateur : on la remplace par un relevé de ce qui serait imprimé.
await page.addInitScript(() => {
  window.__impressions = [];
  window.print = () => { window.__impressions.push(document.querySelector('.pia-impression')?.innerText ?? null); };
});

const lireBase = (magasin) => page.evaluate((m) => new Promise((resolve, reject) => {
  const o = indexedDB.open('journalier-v2');
  o.onerror = () => reject(o.error);
  o.onsuccess = () => {
    const r = o.result.transaction(m).objectStore(m).getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  };
}), magasin);

async function exporter(nomBouton = 'Exporter en Word') {
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: nomBouton }).click()]);
  return dl.suggestedFilename();
}

// Exemple fictif
await page.goto(`${URL_APP}#/pia`);
await page.getByRole('heading', { name: 'PIA', level: 1 }).waitFor();
await page.getByRole('button', { name: 'Charger un exemple fictif' }).click();
await page.getByText(/Exemple fictif chargé/).waitFor();
await page.getByRole('tab', { name: 'Préparer', selected: true }).waitFor();
ok(await page.getByLabel('Élève', { exact: true }).inputValue() === 'demo-alpha', 'exemple chargé : on arrive sur le PIA d’Alpha');
ok(await page.locator('.reunion-retenus li').count() === 2, 'le PIA fictif contient deux objectifs retenus');
const pias = await lireBase('pia');
ok(pias.length === 1 && pias[0].eleveId === 'demo-alpha', 'le PIA fictif est dans la base');
ok((await lireBase('seances')).length === 10, 'dix séances fictives dans la base');
await page.getByRole('tab', { name: 'Profil' }).click();
ok((await page.getByRole('textbox', { name: /Ressources — Cognitif/ }).inputValue()).includes('mémoire visuelle'), 'profil fictif prérempli');
await page.getByRole('tab', { name: 'Aménagements' }).click();
await page.locator('.pia-amenagement').first().waitFor();
ok(await page.locator('.pia-amenagement').count() === 2, 'deux aménagements fictifs');
ok(await page.locator('.pia-proposition').count() >= 1, 'des propositions d’aménagements d’après les séances');

// PV 2
await page.getByRole('tab', { name: 'Procès-verbal 2' }).click();
await page.getByRole('heading', { name: 'Évaluation des objectifs du procès-verbal 1' }).waitFor();
ok(await page.locator('.pia-objectifs .pia-objectif').count() === 1, 'un objectif du PV 1 à évaluer');
ok(await page.locator('.pia-objectif .chip[aria-pressed=true]').count() === 0, 'aucun résultat n’est choisi d’avance');
await page.locator('details.pia-idees summary').first().click();
const rappel = await page.locator('details.pia-idees[open]').innerText();
ok(/2 séances d’accompagnement en Mathématiques depuis le PV 1/.test(rappel), `rappel des séances depuis le PV 1 : ${rappel.split('\n').find((l) => l.includes('séance'))}`);
await page.getByRole('button', { name: 'Atteint en partie' }).click();
ok(await page.getByRole('button', { name: 'Atteint en partie' }).getAttribute('aria-pressed') === 'true', 'résultat choisi');
await page.getByRole('button', { name: 'Atteint en partie' }).click();
ok(await page.getByRole('button', { name: 'Atteint en partie' }).getAttribute('aria-pressed') === 'false', 'un second clic l’enlève');
await page.getByRole('button', { name: 'Atteint en partie' }).click();
await page.getByLabel('Commentaire sur l’objectif 1').fill('Progrès nets depuis octobre.');
await page.getByLabel('Date de la réunion').fill('2027-06-20');
await page.getByRole('button', { name: 'Reprendre les présents du PV 1' }).click();
ok(await page.getByLabel('Personne présente au PV 2, 1').inputValue() === 'M. Test, titulaire', 'présents du PV 1 repris');
await page.getByLabel('Retour de l’élève (PV 2)').fill('Fier de ses progrès.');
await page.getByRole('button', { name: 'Reprendre les aménagements de l’année' }).click();
ok(await page.locator('.pia-pv1 .pia-amenagement').count() === 2, 'aménagements de l’année repris pour la rentrée');
ok(await page.getByRole('button', { name: 'Reprendre les aménagements de l’année' }).count() === 0, 'reprise une seule fois');
await page.getByLabel('Aménagement de rentrée 2', { exact: true }).fill('Temps supplémentaire + salle calme');
await page.getByRole('button', { name: 'Retirer l’aménagement de rentrée 1' }).click();
ok(await page.locator('.pia-pv1 .pia-amenagement').count() === 1, 'retirer un aménagement de la rentrée');
await page.getByRole('button', { name: 'Ajouter un aménagement' }).click();
ok(await page.locator('.pia-pv1 .pia-amenagement').count() === 2, 'ajouter un aménagement de la rentrée');
await page.screenshot({ path: `${SORTIE}/pia-pv2-bureau.png`, fullPage: true });

// Enregistrement
await page.getByText(/Brouillon enregistré/).waitFor();
let base = (await lireBase('pia'))[0];
ok(base.pv2.date === '2027-06-20' && base.pv2.evaluations[0]?.resultat === 'partiel' && base.pv2.amenagements.length === 2, 'PV 2 enregistré dans la base');
ok(base.amenagements.length === 2, 'les aménagements de l’année ne sont pas touchés par ceux de la rentrée');
await page.reload();
await page.getByRole('heading', { name: 'Évaluation des objectifs du procès-verbal 1' }).waitFor();
ok(await page.getByLabel('Commentaire sur l’objectif 1').inputValue() === 'Progrès nets depuis octobre.', 'après rechargement : le PV 2 est retrouvé');

// Exports
await page.getByText('Choisir les parties à exporter').click();
const complet = await exporter();
ok(/^PIA - Alpha - \d{4}-\d{4}\.docx$/.test(complet), `export complet : ${complet}`);
await page.getByLabel('Profil', { exact: true }).uncheck();
await page.getByLabel('Procès-verbal 1 et aménagements').uncheck();
const pv2 = await exporter();
ok(/PV2\.docx$/.test(pv2), `export du PV 2 seul : ${pv2}`);
await page.getByLabel('Procès-verbal 2 et aménagements pour la rentrée').uncheck();
ok(await page.getByRole('button', { name: 'Exporter en Word' }).isDisabled(), 'aucune partie choisie : export bloqué');
await page.getByLabel('Profil', { exact: true }).check();
await page.getByLabel('Procès-verbal 1 et aménagements').check();
await page.getByLabel('Procès-verbal 2 et aménagements pour la rentrée').check();
await page.getByLabel(/Version dé-identifiée/).check();
const anonyme = await exporter();
ok(/dé-identifié/.test(anonyme) && !/Alpha/.test(anonyme), `export dé-identifié : ${anonyme}`);

// Version imprimable
await page.getByRole('button', { name: 'Imprimer / PDF' }).click();
await page.waitForFunction(() => window.__impressions.length === 1);
const imprime = await page.evaluate(() => window.__impressions[0]);
ok(imprime && imprime.includes('Procès-verbal 2') && imprime.includes('Progrès nets depuis octobre.'), 'impression dé-identifiée : contient le PV 2 et l’évaluation');
ok(!imprime.includes('Alpha') && !imprime.includes('CPMS fictif') && imprime.includes('Élève'), 'impression dé-identifiée : sans nom ni coordonnées');
ok(await page.locator('.pia-impression').count() === 0, 'la version imprimable disparaît après l’impression');
await page.getByLabel(/Version dé-identifiée/).uncheck();
await page.getByLabel('Profil', { exact: true }).uncheck();
await page.getByLabel('Procès-verbal 2 et aménagements pour la rentrée').uncheck();
await page.getByRole('button', { name: 'Imprimer / PDF' }).click();
await page.waitForFunction(() => window.__impressions.length === 2);
const pv1 = await page.evaluate(() => window.__impressions[1]);
ok(pv1.includes('Procès-verbal 1') && !pv1.includes('Procès-verbal 2') && pv1.includes('Alpha Élève'), 'impression du PV 1 seul, avec le nom');

// Navigation clavier sur les six onglets, téléphone, thème sombre
ok(await page.getByRole('tab').count() === 6, 'six onglets');
await page.setViewportSize({ width: 390, height: 844 });
ok(!(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), 'téléphone : pas de défilement horizontal');
await page.screenshot({ path: `${SORTIE}/pia-pv2-telephone.png`, fullPage: true });
await page.setViewportSize({ width: 1280, height: 1000 });
await page.emulateMedia({ colorScheme: 'dark' });
await page.screenshot({ path: `${SORTIE}/pia-pv2-sombre.png`, fullPage: true });

await navigateur.close();
ok(erreurs.length === 0, `aucune erreur console${erreurs.length ? ` (${erreurs.join(' | ')})` : ''}`);
console.log('Parcours complet réussi.');
