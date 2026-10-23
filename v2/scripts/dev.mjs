// Serveur local de développement : compile puis sert dist/ (relancer après une modification).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { compiler } from './build.mjs';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 5173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.map': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

await compiler({ minify: false });
http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const fichier = path.join(racine, 'dist', url.pathname === '/' ? 'index.html' : url.pathname);
  if (!fichier.startsWith(path.join(racine, 'dist'))) { res.writeHead(403).end(); return; }
  try {
    const corps = await readFile(fichier);
    res.writeHead(200, { 'Content-Type': types[path.extname(fichier)] ?? 'application/octet-stream' }).end(corps);
  } catch { res.writeHead(404).end('Introuvable'); }
}).listen(port, () => console.log(`http://localhost:${port}`));
