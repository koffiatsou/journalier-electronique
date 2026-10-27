// Aide commune aux parcours navigateur : depuis le lot 7, les données sont chiffrées dans IndexedDB.
// - aller / entrer : ouvre le Journalier en passant l'écran de verrouillage par le mode essai (données fictives).
// - lireBase / ecrireBase : lisent et écrivent la base RÉELLE de l'espace d'essai en la déchiffrant / chiffrant avec la
//   clé du navigateur, exactement comme l'application (format j2c1, données authentifiées journalier-v2|essai|table|id).
// Ce fichier ne fait pas partie de l'application : il ne sert qu'aux vérifications.

export const BASE_ESSAI = 'journalier-v2-essai';
const LIEN = new Set(['seances', 'activites', 'pia']);

/** Ouvre l'adresse ; si l'écran verrouillé s'affiche, passe par « Essayer avec des données fictives ». */
export async function aller(page, adresse) {
  await page.goto(adresse);
  await entrer(page);
}

export async function entrer(page) {
  const essai = page.getByRole('button', { name: 'Essayer avec des données fictives' });
  const menu = page.getByRole('link', { name: 'Accueil' }).first();
  await Promise.race([
    essai.waitFor({ timeout: 15_000 }).catch(() => undefined),
    menu.waitFor({ timeout: 15_000 }).catch(() => undefined)
  ]);
  if (await essai.isVisible().catch(() => false)) await essai.click();
  await menu.waitFor({ timeout: 15_000 });
  await page.locator('.chargement').waitFor({ state: 'hidden', timeout: 15_000 });
}

/** Recharge la page : le Journalier se rouvre tout seul (même onglet), on attend que les données soient lues. */
export async function recharger(page) {
  await page.reload();
  await entrer(page);
}

/** Contenu déchiffré d'une table de l'espace d'essai (pas l'affichage : la base elle-même). */
export const lireBase = (page, table, nomBase = BASE_ESSAI) => page.evaluate(async ([nomBase, nomTable]) => {
  const base = await new Promise((resolve, reject) => { const o = indexedDB.open(nomBase); o.onerror = () => reject(o.error); o.onsuccess = () => resolve(o.result); });
  const demander = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const lignes = await demander(base.transaction(nomTable, 'readonly').objectStore(nomTable).getAll());
  const cle = (await demander(base.transaction('cles', 'readonly').objectStore('cles').get('principale')))?.cle;
  base.close();
  const bin = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
  const sortie = [];
  for (const l of lignes) {
    const [, iv, ct] = l.c.split('.');
    const aad = new TextEncoder().encode(`journalier-v2|${nomBase.slice('journalier-v2-'.length)}|${nomTable}|${l.id}`);
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bin(iv), additionalData: aad }, cle, bin(ct));
    sortie.push(JSON.parse(new TextDecoder().decode(clair)));
  }
  return sortie;
}, [nomBase, table]);

/** Écrit (ou remplace) un objet dans une table de l'espace d'essai, chiffré comme le fait l'application. */
export const ecrireBase = (page, table, objet, nomBase = BASE_ESSAI) => page.evaluate(async ([nomBase, nomTable, o, avecLien]) => {
  const base = await new Promise((resolve, reject) => { const r = indexedDB.open(nomBase); r.onerror = () => reject(r.error); r.onsuccess = () => resolve(r.result); });
  const demander = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const cle = (await demander(base.transaction('cles', 'readonly').objectStore('cles').get('principale')))?.cle;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aad = new TextEncoder().encode(`journalier-v2|${nomBase.slice('journalier-v2-'.length)}|${nomTable}|${o.id}`);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad }, cle, new TextEncoder().encode(JSON.stringify(o))));
  const b64 = (u) => { let s = ''; for (const x of u) s += String.fromCharCode(x); return btoa(s); };
  const rangee = { id: o.id, ...(avecLien && o.eleveId ? { lien: o.eleveId } : {}), c: `j2c1.${b64(iv)}.${b64(ct)}` };
  const tx = base.transaction(nomTable, 'readwrite');
  tx.objectStore(nomTable).put(rangee);
  await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  base.close();
}, [nomBase, table, objet, LIEN.has(table)]);

/** Modifie un objet existant : lit, applique `changer`, réécrit. */
export async function modifierBase(page, table, id, changer) {
  const objet = (await lireBase(page, table)).find((x) => x.id === id);
  if (!objet) throw new Error(`${table}/${id} introuvable dans la base`);
  await ecrireBase(page, table, changer(objet));
}

/** Retire des lignes de la base de l'espace d'essai (par identifiant ; aucun déchiffrement nécessaire). */
export const retirerDeLaBase = (page, table, ids) => page.evaluate(async ([nomBase, nomTable, liste]) => {
  const base = await new Promise((resolve, reject) => { const r = indexedDB.open(nomBase); r.onerror = () => reject(r.error); r.onsuccess = () => resolve(r.result); });
  const tx = base.transaction(nomTable, 'readwrite');
  for (const id of liste) tx.objectStore(nomTable).delete(id);
  await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  base.close();
}, [BASE_ESSAI, table, ids]);

/** Vide une table de l'espace d'essai. */
export const viderTable = (page, table) => page.evaluate(async ([nomBase, nomTable]) => {
  const base = await new Promise((resolve, reject) => { const r = indexedDB.open(nomBase); r.onerror = () => reject(r.error); r.onsuccess = () => resolve(r.result); });
  const tx = base.transaction(nomTable, 'readwrite');
  tx.objectStore(nomTable).clear();
  await new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
  base.close();
}, [BASE_ESSAI, table]);

/**
 * Charge les deux élèves fictifs (Alpha et Bêta) SEULS : la démonstration du lot 8 ajoute aussi des séances, un agenda
 * et un PIA, qu'on retire ici pour retrouver le point de départ attendu par ces parcours. Revient à l'accueil.
 */
export async function ajouterElevesFictifs(page) {
  await page.evaluate(() => { location.hash = '#/accueil'; });
  await page.getByRole('button', { name: 'Charger les données de démonstration' }).click();
  await page.locator('.bandeau-demo').waitFor();
  // L'écriture chiffrée se fait en arrière-plan : on attend qu'elle soit complète avant de retirer quoi que ce soit.
  for (let i = 0; i < 100; i += 1) {
    const [s, a, p] = await Promise.all(['seances', 'activites', 'pia'].map((t) => lireBase(page, t).then((x) => x.length)));
    if (s >= 10 && a >= 5 && p >= 1) break;
    await page.waitForTimeout(100);
  }
  for (const table of ['activites', 'seances', 'pia']) await viderTable(page, table);
  await page.reload();
  await page.getByRole('heading', { name: /Ma journée|Prochains rendez-vous/ }).waitFor();
}

/** Noms des bases du Journalier présentes dans ce navigateur (une par propriétaire, plus l'éventuelle ancienne base en clair). */
export const basesPresentes = (page) => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name).filter((n) => n && n.startsWith('journalier-v2')).sort());

/** Nom de la base de l'espace d'un compte Microsoft (ni l'essai, ni l'ancienne base en clair). */
export async function baseDuCompte(page) {
  const noms = (await basesPresentes(page)).filter((n) => /^journalier-v2-c[0-9a-f]{16}$/.test(n));
  if (noms.length !== 1) throw new Error(`une base de compte attendue, trouvé : ${noms.join(', ') || 'aucune'}`);
  return noms[0];
}
