// Charge le module d'export Journalier dans Node (shim comme pour le moteur).
const fs = require('fs'), path = require('path');
const R = require('./charger-moteur.cjs');
const code = fs.readFileSync(path.join(__dirname, '../src/app/journalier-seances-docx.js'), 'utf8');
const m = { exports: {} };
const root = { JournalierRedaction: R };
new Function('module', 'self', code)(m, root);
module.exports = { api: m.exports, root, R };
