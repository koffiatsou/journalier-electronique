// Compilation de production : React + TypeScript → dist/ (esbuild, sans Vite).
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(racine, 'dist');

/**
 * Fichiers à appeler depuis la page : ceux de l'entrée `src/main.tsx`, jamais un morceau chargé à la demande.
 * esbuild donne aussi une propriété `entryPoint` aux morceaux issus d'un `import()` (les fichiers du référentiel) : prendre « le premier
 * qui en a une » faisait appeler un de ces morceaux depuis la page (écran vide, découvert le 10/11/2026).
 */
export function choisirSorties(outputs) {
  const sorties = Object.entries(outputs);
  const principal = (ext) => sorties.find(([f, o]) => f.endsWith(ext) && typeof o.entryPoint === 'string' && /(^|\/)src\/main\.tsx$/.test(o.entryPoint))?.[0];
  const js = principal('.js') && path.basename(principal('.js'));
  const css = principal('.css') ? path.basename(principal('.css')) : sorties.map(([f]) => path.basename(f)).find((f) => f.endsWith('.css'));
  return { js, css };
}

export async function compiler({ minify = true, surveiller = false } = {}) {
  await rm(dist, { recursive: true, force: true });
  await mkdir(path.join(dist, 'assets'), { recursive: true });

  const options = {
    entryPoints: [path.join(racine, 'src/main.tsx')],
    bundle: true,
    splitting: true,
    chunkNames: 'chunks/[name]-[hash]',
    format: 'esm',
    target: 'es2022',
    jsx: 'automatic',
    outdir: path.join(dist, 'assets'),
    entryNames: '[name]-[hash]',
    metafile: true,
    sourcemap: true,
    minify,
    legalComments: 'none',
    loader: { '.css': 'css' },
    define: { 'process.env.NODE_ENV': minify ? '"production"' : '"development"' },
    logLevel: 'warning'
  };

  const resultat = await build(options);
  const { js, css } = choisirSorties(resultat.metafile.outputs);
  const balises = [
    css ? `<link rel="stylesheet" href="./assets/${css}" />` : '',
    js ? `<script type="module" src="./assets/${js}"></script>` : ''
  ].filter(Boolean).join('\n  ');

  // Page de retour de la connexion Microsoft : un petit script à part, à un nom fixe (pas de signature dans le nom).
  await build({
    entryPoints: [path.join(racine, 'src/retour-microsoft.ts')], bundle: true, format: 'esm', target: 'es2022', minify, legalComments: 'none',
    outfile: path.join(dist, 'retour-microsoft.js'), logLevel: 'warning'
  });

  const modele = await readFile(path.join(racine, 'index.html'), 'utf8');
  await writeFile(path.join(dist, 'index.html'), modele.replace('<!--ASSETS-->', balises));
  if (existsSync(path.join(racine, 'public'))) await cp(path.join(racine, 'public'), dist, { recursive: true });
  return { js, css, surveiller };
}

// Comparer des adresses `file://` : le chemin brut d'argv ne ressemble pas à `import.meta.url` sous Windows (la compilation ne se lançait pas).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = await compiler();
  console.log(`Compilation terminée : ${r.js}${r.css ? ` + ${r.css}` : ''}`);
}
