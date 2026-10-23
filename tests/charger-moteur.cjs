// Charge le moteur (script classique, sans « export ») dans Node, sans toucher au type "module" du projet.
const fs = require('fs'), path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../src/app/redaction-engine.js'), 'utf8');
const m = { exports: {} };
new Function('module', 'self', code)(m, undefined);
module.exports = m.exports;
