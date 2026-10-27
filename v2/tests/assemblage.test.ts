import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { assembler, normaliserBase, reperesDansHtml, verifierSite } from '../scripts/assembler-site.ts';

/*
 * Lot S : la V2 prend l'adresse principale, la V75 passe dans v75/. Ces tests protègent l'assemblage du site publié :
 * une erreur ici se verrait sur l'adresse de toute l'équipe, sans moyen de l'essayer avant la fusion.
 * Les faux dossiers imitent la forme réelle des deux compilations (V2 : chemins relatifs ; V75 : Vite écrit la base dans les adresses).
 */

const BASE = '/journalier-electronique/';
const racines: string[] = [];
after(async () => { await Promise.all(racines.map((r) => rm(r, { recursive: true, force: true }))); });

async function ecrire(dossier: string, fichiers: Record<string, string>): Promise<void> {
  for (const [nom, contenu] of Object.entries(fichiers)) {
    await mkdir(path.dirname(path.join(dossier, nom)), { recursive: true });
    await writeFile(path.join(dossier, nom), contenu);
  }
}

const pageV2 = '<!doctype html><html><head><link rel="icon" href="./logo.svg"><link rel="stylesheet" href="./assets/main-A.css"><script type="module" src="./assets/main-A.js"></script></head><body><div id="root"></div></body></html>';
const retourV2 = '<!doctype html><html><body><script type="module" src="./retour-microsoft.js"></script></body></html>';
const fichiersV2: Record<string, string> = {
  'index.html': pageV2, 'msal-redirect.html': retourV2, 'retour-microsoft.js': '//', 'logo.svg': '<svg id="v2"/>',
  'assets/main-A.js': '//', 'assets/main-A.css': '/**/', 'modeles/modele.docx': 'docx'
};

/** La V75 compilée avec la bonne base : Vite écrit /journalier-electronique/v75/ dans ses adresses ; ses scripts « classiques » restent relatifs. */
function fichiersV75(base = `${BASE}v75/`): Record<string, string> {
  return {
    'index.html': `<!doctype html><html><head><link rel="stylesheet" crossorigin href="${base}assets/index-B.css"><script type="module" crossorigin src="${base}assets/index-B.js"></script><link rel="modulepreload" crossorigin href="${base}assets/vendor-D.js"></head><body><img src="./logo.svg" alt=""><a href="/journalier-electronique-v75.zip">ZIP</a><script src="./src/app/classique.js"></script></body></html>`,
    'msal-redirect.html': `<!doctype html><html><body><script type="module" crossorigin src="${base}assets/msal-redirect-C.js"></script></body></html>`,
    'logo.svg': '<svg id="v75"/>', 'src/app/classique.js': '//', 'assets/index-B.css': '/**/', 'assets/index-B.js': '//', 'assets/vendor-D.js': '//', 'assets/msal-redirect-C.js': '//'
  };
}

async function preparer(v2: Record<string, string> = fichiersV2, v75: Record<string, string> = fichiersV75()): Promise<{ v2: string; v75: string; sortie: string }> {
  const dossier = await mkdtemp(path.join(tmpdir(), 'assemblage-'));
  racines.push(dossier);
  await ecrire(path.join(dossier, 'v2'), v2);
  await ecrire(path.join(dossier, 'v75'), v75);
  return { v2: path.join(dossier, 'v2'), v75: path.join(dossier, 'v75'), sortie: path.join(dossier, 'site') };
}

const options = (c: { v2: string; v75: string; sortie: string }) => ({ ...c, base: BASE });
const refuse = async (c: { v2: string; v75: string; sortie: string }): Promise<string> => {
  try { await assembler(options(c)); } catch (e) { return e instanceof Error ? e.message : String(e); }
  return '';
};

describe('assemblage du site : V2 à la racine, V75 dans v75/', () => {
  it('place la V2 à la racine et la V75 dans v75/, sans mélanger les fichiers', async () => {
    const c = await preparer();
    await assembler(options(c));
    assert.equal(await readFile(path.join(c.sortie, 'logo.svg'), 'utf8'), '<svg id="v2"/>');
    assert.equal(await readFile(path.join(c.sortie, 'v75', 'logo.svg'), 'utf8'), '<svg id="v75"/>');
    assert.match(await readFile(path.join(c.sortie, 'index.html'), 'utf8'), /id="root"/);
    assert.match(await readFile(path.join(c.sortie, 'msal-redirect.html'), 'utf8'), /retour-microsoft\.js/);
    assert.doesNotMatch(await readFile(path.join(c.sortie, 'v75', 'msal-redirect.html'), 'utf8'), /retour-microsoft\.js/);
    await assert.rejects(stat(path.join(c.sortie, 'src')), 'aucun fichier de la V75 ne doit atterrir à la racine');
    assert.deepEqual(await verifierSite(c.sortie, BASE), []);
  });

  it('recommence proprement : un ancien site dans le dossier de sortie est remplacé', async () => {
    const c = await preparer();
    await ecrire(c.sortie, { 'reste-ancien.txt': 'ancien' });
    await assembler(options(c));
    await assert.rejects(stat(path.join(c.sortie, 'reste-ancien.txt')));
  });

  it('refuse une V75 compilée avec l’ancienne base (l’oubli de --base) : elle irait chercher les fichiers de la V2', async () => {
    // Piège le plus probable : sans --base, la V75 appelle /journalier-electronique/assets/… = la racine, donc la V2.
    const c = await preparer(fichiersV2, fichiersV75(BASE));
    const message = await refuse(c);
    assert.match(message, /v75\/index\.html : « \/journalier-electronique\/assets\/index-B\.css » mène hors de v75\//);
    assert.match(message, /--base=\/journalier-electronique\/v75\//);
  });

  it('refuse une adresse qui mène hors du site', async () => {
    const c = await preparer({ ...fichiersV2, 'index.html': pageV2.replace('./assets/main-A.js', '/assets/main-A.js') });
    assert.match(await refuse(c), /index\.html : « \/assets\/main-A\.js » mène hors du site/);
  });

  it('refuse un fichier appelé par une page mais absent', async () => {
    const sans = { ...fichiersV2 };
    delete sans['assets/main-A.css'];
    assert.match(await refuse(await preparer(sans)), /index\.html : « \.\/assets\/main-A\.css » est introuvable/);
    const sansV75 = fichiersV75();
    delete sansV75['assets/index-B.js'];
    assert.match(await refuse(await preparer(fichiersV2, sansV75)), /v75\/index\.html : .*index-B\.js.* est introuvable/);
  });

  it('refuse une page de la V2 qui appellerait un fichier de la V75', async () => {
    const c = await preparer({ ...fichiersV2, 'index.html': pageV2.replace('./logo.svg', './v75/logo.svg') });
    assert.match(await refuse(c), /index\.html : « \.\/v75\/logo\.svg » mène dans v75\//);
  });

  it('refuse si la page de retour de Microsoft de la racine n’est pas celle de la V2', async () => {
    const c = await preparer({ ...fichiersV2, 'msal-redirect.html': '<html><body>autre</body></html>' });
    assert.match(await refuse(c), /msal-redirect\.html, à la racine, n’est pas celui de la V2/);
  });

  it('refuse si la V75 n’a pas sa page de retour (sa connexion Microsoft ne marcherait plus)', async () => {
    const sans = fichiersV75();
    delete sans['msal-redirect.html'];
    assert.match(await refuse(await preparer(fichiersV2, sans)), /v75\/msal-redirect\.html introuvable/);
  });

  it('refuse si une compilation manque, ou si la V2 contient déjà un dossier v75', async () => {
    const c = await preparer();
    await rm(path.join(c.v75, 'index.html'));
    assert.match(await refuse(c), /compilation de la V75 est introuvable/);
    const d = await preparer({ ...fichiersV2, 'v75/index.html': 'x' });
    assert.match(await refuse(d), /contient déjà un dossier « v75 »/);
  });

  it('accepte une autre base (site à la racine d’un domaine)', async () => {
    const c = await preparer(fichiersV2, fichiersV75('/v75/'));
    await assembler({ ...c, base: '/' });
    assert.deepEqual(await verifierSite(c.sortie, '/'), []);
  });
});

describe('lecture des adresses d’une page', () => {
  it('relève scripts, feuilles de style, icônes et images ; ignore les liens, les sites extérieurs et data:', () => {
    const html = [
      '<script src="./a.js"></script>', '<script type="module" crossorigin src="/b/c.js"></script>',
      '<link rel="stylesheet" href="s.css">', '<link href=\'i.svg\' rel="icon">', '<img src="p.png" alt="">',
      '<a href="/lien.zip">lien</a>', '<img data-src="paresseux.png">', '<script src="https://cdn.exemple.org/x.js"></script>',
      '<link rel="preconnect" href="//polices.exemple.org">', '<img src="data:image/png;base64,AAAA">', '<link rel="x" href="#ancre">', '<script>sans adresse</script>'
    ].join('\n');
    assert.deepEqual(reperesDansHtml(html), ['./a.js', '/b/c.js', 's.css', 'i.svg', 'p.png']);
  });

  it('remet la base sous la forme /dossier/', () => {
    assert.equal(normaliserBase('journalier-electronique'), '/journalier-electronique/');
    assert.equal(normaliserBase('/journalier-electronique'), '/journalier-electronique/');
    assert.equal(normaliserBase('/'), '/');
    assert.equal(normaliserBase(''), '/');
  });
});
