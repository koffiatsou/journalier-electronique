// Rejoue TOUS les parcours navigateur d'un coup (lot Q). C'est ce que le contrôle automatique de GitHub lance à chaque
// mise à jour de la demande de fusion ; on peut aussi le lancer à la main.
//
//   Lancer :  LANG=C.UTF-8 node tools/navigateur/tout.mjs            (ou : npm run navigateur)
//   Quelques parcours seulement :  node tools/navigateur/tout.mjs accueil,agenda-5
//   Voir la liste :  node tools/navigateur/tout.mjs --liste
//
// Il démarre lui-même le serveur local (port 5199, ou PORT) s'il n'en tourne pas déjà un, lance chaque parcours l'un après
// l'autre dans un processus à part, puis résume. Code de sortie 0 = tout est passé ; 1 = au moins un parcours a échoué.
// Un parcours qui échoue est rejoué UNE fois : s'il réussit alors, il est signalé « fragile » (⚠) dans le résumé, jamais
// passé sous silence. Playwright doit être installé (en CI : `npm install --no-save playwright`, voir .github/workflows/ci.yml)
// ou indiqué par la variable PLAYWRIGHT (chemin de son index.mjs).
import { spawn } from 'node:child_process';
import { appendFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const racine = join(ici, '..', '..');
const port = process.env.PORT ?? '5199';
const adresse = `http://localhost:${port}/`;
const enCi = process.env.GITHUB_ACTIONS === 'true';
const DELAI_PARCOURS_MS = 6 * 60 * 1000;

/** Les parcours à rejouer : tous les .mjs de ce dossier, sauf les aides (`_…`) et les outils de captures d'écran. */
const OUTILS_SANS_VERIFICATION = new Set(['tout', 'captures', 'captures-detail']);
const tous = readdirSync(ici).filter((f) => f.endsWith('.mjs') && !f.startsWith('_')).map((f) => f.slice(0, -4)).filter((n) => !OUTILS_SANS_VERIFICATION.has(n)).sort();

const args = process.argv.slice(2);
if (args.includes('--liste')) { console.log(tous.join('\n')); process.exit(0); }
const choisis = args.find((a) => !a.startsWith('--'))?.split(',').filter(Boolean);
const inconnus = (choisis ?? []).filter((n) => !tous.includes(n));
if (inconnus.length) { console.error(`Parcours inconnu : ${inconnus.join(', ')}. Liste : ${tous.join(', ')}`); process.exit(2); }
const parcours = choisis ?? tous;

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function serveurPret(essais = 1) {
  for (let i = 0; i < essais; i += 1) {
    try { if ((await fetch(adresse)).ok) return true; } catch { /* pas encore prêt */ }
    if (essais > 1) await pause(500);
  }
  return false;
}

/** Lance un processus, renvoie sa sortie et son code ; l'arrête s'il dépasse le délai. */
function lancer(commande, argumentsCommande, options = {}) {
  return new Promise((resolve) => {
    const enfant = spawn(commande, argumentsCommande, { cwd: racine, env: { LANG: 'C.UTF-8', ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let sortie = '';
    enfant.stdout.on('data', (d) => { sortie += d; });
    enfant.stderr.on('data', (d) => { sortie += d; });
    const minuteur = options.delai ? setTimeout(() => { sortie += `\n(arrêté : plus de ${Math.round(options.delai / 60000)} minutes)\n`; enfant.kill('SIGKILL'); }, options.delai) : null;
    enfant.on('close', (code) => { if (minuteur) clearTimeout(minuteur); resolve({ code: code ?? 1, sortie }); });
  });
}

let serveur = null;
if (!(await serveurPret())) {
  serveur = spawn('node', ['scripts/dev.mjs'], { cwd: racine, env: { ...process.env, PORT: port }, stdio: 'ignore' });
  if (!(await serveurPret(120))) { console.error(`Le serveur local ne démarre pas sur ${adresse}`); serveur.kill(); process.exit(1); }
}
const arreterServeur = () => { if (serveur && !serveur.killed) serveur.kill('SIGTERM'); };
process.on('SIGINT', () => { arreterServeur(); process.exit(130); });

const resultats = [];
const debutTotal = Date.now();
for (const nom of parcours) {
  let essai = 0;
  let r;
  const debut = Date.now();
  do {
    essai += 1;
    // `--import tsx` : certains parcours lisent des fichiers .ts (faux Microsoft) ; c'est sans effet pour les autres.
    r = await lancer('node', ['--import', 'tsx', join('tools', 'navigateur', `${nom}.mjs`)], { env: { URL_APP: adresse }, delai: DELAI_PARCOURS_MS });
    if (r.code !== 0 && essai === 1) console.log(`… « ${nom} » a échoué, nouvel essai`);
  } while (r.code !== 0 && essai < 2);
  const duree = Math.round((Date.now() - debut) / 1000);
  const statut = r.code === 0 ? (essai === 1 ? 'ok' : 'fragile') : 'echec';
  resultats.push({ nom, statut, duree });
  const icone = statut === 'ok' ? '✓' : statut === 'fragile' ? '⚠' : '✗';
  console.log(`${icone} ${nom} (${duree} s)${statut === 'fragile' ? ' — réussi seulement au 2e essai' : ''}`);
  if (statut !== 'ok') {
    const fin = r.sortie.trim().split('\n').slice(-40).join('\n');
    if (enCi) console.log(`::group::Fin de la sortie de « ${nom} »`);
    console.log(fin);
    if (enCi) console.log('::endgroup::');
    if (statut === 'echec' && enCi) console.log(`::error title=Parcours navigateur::« ${nom} » a échoué (voir le détail ci-dessus)`);
  }
}
arreterServeur();

const echecs = resultats.filter((r) => r.statut === 'echec');
const fragiles = resultats.filter((r) => r.statut === 'fragile');
const total = Math.round((Date.now() - debutTotal) / 1000);
console.log(`\n${resultats.length - echecs.length - fragiles.length} réussis, ${fragiles.length} fragile(s), ${echecs.length} échec(s) — ${total} s au total`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const lignes = ['## Parcours dans un vrai navigateur', '', '| Parcours | Résultat | Durée |', '|---|---|---|',
    ...resultats.map((r) => `| ${r.nom} | ${r.statut === 'ok' ? '✅ réussi' : r.statut === 'fragile' ? '⚠️ réussi au 2e essai' : '❌ échec'} | ${r.duree} s |`), ''];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lignes.join('\n')}\n`);
}
process.exit(echecs.length ? 1 : 0);
