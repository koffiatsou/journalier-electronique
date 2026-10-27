// Assemblage du site publié sur GitHub Pages (lot S : « la V2 devient la version définitive »).
//
//   adresse principale du site  →  la V2        (v2/dist, copiée à la racine)
//   <adresse principale>/v75/   →  la V75       (dist de la racine du dépôt, compilée avec --base=<base>v75/), en secours
//
// Ce script copie les deux compilations au bon endroit, puis VÉRIFIE le résultat sans navigateur : chaque script, feuille de
// style et image appelés par une page HTML doit exister dans le site publié, et chaque version ne doit appeler que ses
// propres fichiers (sinon une page de la V75 pourrait charger, sans que personne le voie, un fichier de la V2).
//
//   Lancer (depuis v2/) :  npm run site       →  site assemblé dans ../site (ignoré par Git)
//   Autres emplacements :  node --import tsx scripts/assembler-site.ts --v2 dist --v75 ../dist --sortie ../site --base /journalier-electronique/
import { cp, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DOSSIER_V75 = 'v75';

export interface OptionsAssemblage {
  /** Compilation de la V2 (contient index.html). */
  v2: string;
  /** Compilation de la V75, faite avec `--base=<base>v75/`. */
  v75: string;
  /** Dossier du site assemblé (supprimé puis recréé). */
  sortie: string;
  /** Début de toutes les adresses du site, par exemple `/journalier-electronique/`. */
  base: string;
}

/** Remet la base sous la forme `/dossier/` (barre au début et à la fin). */
export function normaliserBase(base: string): string {
  const propre = base.trim().replace(/^\/+|\/+$/g, '');
  return propre ? `/${propre}/` : '/';
}

/** Les adresses appelées par une page : `<script src>`, `<link href>`, `<img src>` (pas les liens `<a>`, pas `data-src`). */
export function reperesDansHtml(html: string): string[] {
  const reperes: string[] = [];
  const balise = /<(script|link|img)\b([^>]*)>/gi;
  for (const [, , attributs] of html.matchAll(balise)) {
    const attribut = /(?<![\w-])(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attributs ?? '');
    const valeur = attribut?.[1] ?? attribut?.[2];
    if (valeur === undefined) continue;
    const v = valeur.trim();
    if (!v || v.startsWith('#') || v.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(v)) continue; // vide, ancre, site extérieur, data:
    reperes.push(v);
  }
  return reperes;
}

async function existe(chemin: string): Promise<boolean> {
  try { await stat(chemin); return true; } catch { return false; }
}

async function pagesHtml(dossier: string, relatif = ''): Promise<string[]> {
  const pages: string[] = [];
  for (const entree of await readdir(path.join(dossier, relatif), { withFileTypes: true })) {
    const chemin = path.posix.join(relatif.split(path.sep).join('/'), entree.name);
    if (entree.isDirectory()) pages.push(...await pagesHtml(dossier, chemin));
    else if (entree.name.endsWith('.html')) pages.push(chemin);
  }
  return pages;
}

/** Vérifie un site déjà assemblé. Renvoie la liste des problèmes (vide = tout est en ordre). */
export async function verifierSite(sortie: string, baseBrute: string): Promise<string[]> {
  const base = normaliserBase(baseBrute);
  const problemes: string[] = [];

  const racine = path.join(sortie, 'index.html');
  if (!(await existe(racine))) problemes.push('index.html introuvable à la racine du site (la V2 doit y être).');
  else if (!(await readFile(racine, 'utf8')).includes('id="root"')) problemes.push('index.html, à la racine, n’est pas celui de la V2 (élément « root » absent).');
  const retourV2 = path.join(sortie, 'msal-redirect.html');
  if (!(await existe(retourV2))) problemes.push('msal-redirect.html introuvable à la racine : sans lui, la connexion Microsoft de la V2 échoue.');
  else if (!(await readFile(retourV2, 'utf8')).includes('retour-microsoft.js')) problemes.push('msal-redirect.html, à la racine, n’est pas celui de la V2 (retour-microsoft.js absent).');
  for (const requis of [`${DOSSIER_V75}/index.html`, `${DOSSIER_V75}/msal-redirect.html`]) {
    if (!(await existe(path.join(sortie, requis)))) problemes.push(`${requis} introuvable : la V75 de secours n’est pas en place.`);
  }

  for (const page of await pagesHtml(sortie)) {
    const dansV75 = page.startsWith(`${DOSSIER_V75}/`);
    const html = await readFile(path.join(sortie, page), 'utf8');
    for (const repere of reperesDansHtml(html)) {
      const adresse = new URL(repere, `https://site.invalide${base}${page}`);
      if (!adresse.pathname.startsWith(base)) { problemes.push(`${page} : « ${repere} » mène hors du site (il doit commencer par ${base}).`); continue; }
      const relatif = decodeURIComponent(adresse.pathname.slice(base.length));
      const versV75 = relatif === DOSSIER_V75 || relatif.startsWith(`${DOSSIER_V75}/`);
      if (dansV75 && !versV75) { problemes.push(`${page} : « ${repere} » mène hors de ${DOSSIER_V75}/ — la V75 doit être compilée avec --base=${base}${DOSSIER_V75}/.`); continue; }
      if (!dansV75 && versV75) { problemes.push(`${page} : « ${repere} » mène dans ${DOSSIER_V75}/ — la V2 ne doit pas appeler de fichier de la V75.`); continue; }
      if (!(await existe(path.join(sortie, relatif)))) problemes.push(`${page} : « ${repere} » est introuvable dans le site (${relatif}).`);
    }
  }
  return problemes;
}

/** Copie la V2 à la racine et la V75 dans `v75/`, puis vérifie le tout. Lève une erreur (en français) au premier problème. */
export async function assembler(options: OptionsAssemblage): Promise<void> {
  const base = normaliserBase(options.base);
  for (const [nom, dossier] of [['la V2', options.v2], ['la V75', options.v75]] as const) {
    if (!(await existe(path.join(dossier, 'index.html')))) throw new Error(`La compilation de ${nom} est introuvable (${path.join(dossier, 'index.html')}). Compilez-la d’abord.`);
  }
  if (await existe(path.join(options.v2, DOSSIER_V75))) throw new Error(`La compilation de la V2 contient déjà un dossier « ${DOSSIER_V75} » : il serait écrasé par la V75.`);

  await rm(options.sortie, { recursive: true, force: true });
  await mkdir(options.sortie, { recursive: true });
  await cp(options.v2, options.sortie, { recursive: true });
  await cp(options.v75, path.join(options.sortie, DOSSIER_V75), { recursive: true });

  const problemes = await verifierSite(options.sortie, base);
  if (problemes.length) throw new Error(`Le site assemblé n’est pas correct :\n- ${problemes.join('\n- ')}`);
}

function lireOptions(args: string[]): OptionsAssemblage {
  const valeur = (nom: string, defaut: string): string => {
    const i = args.indexOf(`--${nom}`);
    return i >= 0 && args[i + 1] ? args[i + 1] as string : defaut;
  };
  return { v2: valeur('v2', 'dist'), v75: valeur('v75', '../dist'), sortie: valeur('sortie', '../site'), base: valeur('base', '/journalier-electronique/') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const options = lireOptions(process.argv.slice(2));
  try {
    await assembler(options);
    console.log(`Site assemblé dans ${path.resolve(options.sortie)} : V2 à la racine, V75 dans ${DOSSIER_V75}/ (adresses sous ${normaliserBase(options.base)}). Toutes les pages ont été vérifiées.`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
}
