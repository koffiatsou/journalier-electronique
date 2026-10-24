// Compilation de production : React + TypeScript → dist/ (esbuild, sans Vite).
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(racine, 'dist');

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
  const sorties = Object.entries(resultat.metafile.outputs);
  const principal = (ext) => sorties.find(([f, o]) => f.endsWith(ext) && o.entryPoint)?.[0];
  const js = principal('.js') && path.basename(principal('.js'));
  const css = principal('.css') ? path.basename(principal('.css')) : sorties.map(([f]) => path.basename(f)).find((f) => f.endsWith('.css'));
  const balises = [
    css ? `<link rel="stylesheet" href="./assets/${css}" />` : '',
    js ? `<script type="module" src="./assets/${js}"></script>` : ''
  ].filter(Boolean).join('\n  ');

  const modele = await readFile(path.join(racine, 'index.html'), 'utf8');
  await writeFile(path.join(dist, 'index.html'), modele.replace('<!--ASSETS-->', balises));
  if (existsSync(path.join(racine, 'public'))) await cp(path.join(racine, 'public'), dist, { recursive: true });
  return { js, css, surveiller };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await compiler();
  console.log(`Compilation terminée : ${r.js}${r.css ? ` + ${r.css}` : ''}`);
}
