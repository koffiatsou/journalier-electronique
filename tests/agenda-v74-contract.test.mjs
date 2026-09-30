import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const core = read('src/app/journalier-core.js');
const ms = read('src/app/microsoft-core.js');
const migration = read('src/v74/v74-migration.js');
const index = read('index.html');
const css = read('src/styles/journalier-ux-responsive.css');
const architecture = read('ARCHITECTURE.md');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function nodeCheck(file) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { encoding: 'utf8' });
  assert(result.status === 0, `${file} : syntaxe invalide\n${result.stderr}`);
}

for (const file of [
  'src/app/journalier-core.js',
  'src/app/microsoft-core.js',
  'src/v74/v74-migration.js',
  'src/v74/v74-runtime.js',
  'src/msal-bridge.js',
  'src/msal-redirect.js'
]) nodeCheck(file);

assert(core.includes('const DEFAULT_AGENDA_PERIODS = ['), 'DEFAULT_AGENDA_PERIODS absent.');
assert((core.match(/\{id:'p\d',label:'\de H',start:'/g) || []).length === 8, 'Les 8 périodes par défaut ne sont pas présentes.');
assert(core.includes('agendaPeriodConfig'), 'Configuration des périodes absente.');
assert(core.includes('agenda.__events=Array.isArray(agenda.__events)?agenda.__events:[]'), 'Stockage canonique __events absent.');
assert(core.includes("eventStatus:'proposed'"), 'Nouvel événement non initialisé en proposition.');
for (const status of ['proposed','realized','cancelled']) assert(core.includes(`'${status}'`), `Statut ${status} absent.`);
assert(core.includes('function findAgendaEventForOccurrence'), 'Sélection d’un événement chevauchant absente.');
assert(core.includes("data-force-create=\"true\""), 'Ajout sur créneau occupé absent.');
assert(core.includes('function toggleAgendaEventRealized'), 'Réalisation des événements non pédagogiques absente.');
assert(core.includes("const excluded=prev?.__exceptions?.[seriesKey]"), 'Les exceptions de suppression d’occurrence ne sont pas prises en compte.');
assert(core.includes('content:${contentKey}'), 'Migration des anciens créneaux sans eventId ne regroupe plus les contenus contigus.');
assert(core.includes('seriesId:event.seriesId||event.eventId'), 'Suppression d’occurrence non rattachée à la série de récurrence.');
assert(core.includes('function syncAgendaAfterSessionSave'), 'Rapprochement Agenda après enregistrement de séance absent.');
assert(core.includes('function syncAgendaAfterSessionDelete'), 'Rapprochement Agenda après suppression de séance absent.');
assert(core.includes('[data-action="history-edit"]'), 'Action Modifier de l’Historique absente.');
assert(!ms.includes('history-edit') && !ms.includes('history-delete'), 'Le module Microsoft ne doit pas gérer les actions de l’Historique.');
assert(core.includes('history_'), 'Projection des séances historiques dans l’Agenda absente.');
assert(core.includes('virtualHistoryEvent:true'), 'Occurrence historique virtuelle absente.');
assert(core.includes('itemStart<=endIndex&&itemEnd>=startIndex'), 'Index Agenda/Historique non aligné.');
assert(core.includes('function openAgendaPeriodConfigModal'), 'Configuration des périodes absente.');
assert(core.includes("'Europe/Brussels'"), 'Fuseau Agenda Outlook absent.');
assert(index.includes('agenda-period-config-open'), 'Bouton de configuration des périodes absent.');
assert(index.includes('event-action-realize'), 'Action de réalisation absente.');
assert(!core.includes('agendaConflictModal') && !index.includes('agendaConflictModal'), 'Ancien modal de conflit bloquant encore présent.');
assert(!core.includes('function chooseSessionSubject(subject)'), 'Double déclaration historique de chooseSessionSubject encore présente.');

assert(ms.includes("['__events','__exceptions','__config','__uniqueEvents']"), 'Validateur Agenda Graph non aligné sur le nouveau modèle.');
assert(ms.includes("eventStatus") && ms.includes("outlook"), 'Validateur Graph incomplet pour les événements V74.');
assert(ms.includes("/^\\d+_.+$/"), 'Compatibilité des anciens créneaux Agenda absente du validateur.');
assert(migration.includes('a.__events'), 'Migration V74 non alignée sur __events.');

const cspMatch = index.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/i);
assert(cspMatch, 'CSP introuvable.');
const csp = cspMatch[1];
for (const directive of ["script-src 'self'", 'connect-src', 'https://graph.microsoft.com', 'https://login.microsoftonline.com', "worker-src 'self' blob:"]) {
  assert(csp.includes(directive), `Directive CSP absente : ${directive}`);
}
assert(!csp.includes("script-src 'unsafe-inline'"), 'CSP trop permissive : unsafe-inline ajouté à script-src.');
assert(index.includes('./src/styles/journalier-ux-responsive.css'), 'CSS responsive absente.');
assert(index.includes('viewport-fit=cover'), 'viewport-fit=cover absent.');
assert(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(index), 'Script inline introduit dans index.html.');

const idMatches = [...index.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
const duplicates = idMatches.filter((id, i) => idMatches.indexOf(id) !== i);
assert(duplicates.length === 0, `IDs HTML dupliqués : ${[...new Set(duplicates)].join(', ')}`);

assert(css.includes('.agenda-period-config-modal-card'), 'Styles de configuration des périodes absents.');
assert(css.includes('.day-overlap-add'), 'Styles d’ajout sur créneau occupé absents.');
assert(core.includes("ev.eventStatus==='confirmed'?'proposed'"), 'Compatibilité de lecture de l’ancien statut Confirmé absente.');
assert(!core.includes("['proposed','confirmed','realized','cancelled']"), 'Ancien modèle Agenda à quatre états encore actif.');
assert(!ms.includes("['proposed','confirmed','realized','cancelled']"), 'Validateur Graph encore aligné sur l’ancien modèle à quatre états.');
assert(!index.includes('event-action-confirm'), 'Ancienne action de confirmation encore présente dans index.html.');
assert(!css.includes('agenda-status-confirmed'), 'Ancien style Agenda Confirmé encore présent.');
assert(!core.includes('toggleAgendaEventConfirmation'), 'Ancienne fonction de confirmation encore présente.');
assert(architecture.includes('agenda.__events'), 'Architecture non documentée pour __events.');

console.log('✓ Agenda V74 contract tests passed');
console.log('✓ Syntaxe JavaScript vérifiée');
console.log('✓ CSP statique vérifiée');
console.log('✓ Modèle __events / statuts / périodes vérifié');
console.log('✓ Compatibilité Graph / migration vérifiée');
console.log('✓ IDs HTML et handlers statiques vérifiés');
