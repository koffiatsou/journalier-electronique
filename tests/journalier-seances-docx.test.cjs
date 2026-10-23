// Test du remplissage du modèle Journalier papier — données fictives.
const assert = require('assert');
const cp = require('child_process');
const { api } = require('./charger-docx.cjs');
const xml = cp.execSync('unzip -p public/modeles/Journalier_modele_papier.docx word/document.xml', { maxBuffer: 1 << 28 }).toString();
let ok = 0; const test = (n, f) => { try { f(); ok++; console.log('  ✓', n); } catch (e) { console.error('  ✗', n, '\n   ', e.message); process.exitCode = 1; } };
const seance = (date, pres, extra = {}) => ({ id: date, identification: { eleve: 'Élève Alpha', date },
  contexte: { matiere: 'Mathématiques', presenceStatus: pres, typeIntervention: ['Accompagnement individuel'], classNotes: '' },
  objectif: { objectifLecon: 'Résoudre <un> problème & co', objectifProfessionnel: 'Repérer les données' },
  q2: { observations: pres === 'present' ? [{ observation: 'Entre dans la tâche', niveau: 2 }] : [], precision: '' }, q4: { types: [], effets: {} }, q5: {}, q6: { actions: [] }, ...extra });
const eleve = { nom: 'Élève Alpha', classe: 'P3', ecole: 'École Test A', titulaire: 'Mme Exemple', dateNaissance: '2016-04-12' };
const texte = (x) => x.replace(/<[^>]+>/g, '|').replace(/\|+/g, '|');
console.log('Export Journalier (modèle papier)');
const blocs = api.preparerBlocs([seance('2026-09-22', 'present'), seance('2026-09-15', 'present'), seance('2026-09-29', 'absent_prof')], eleve, false);
const out = api.remplirDocument(xml, blocs, { nom: 'Élève Alpha', prenom: '', dateNaissance: '2016-04-12', classe: 'P3', titulaire: 'Mme Exemple', ecole: 'École Test A' });
test('un bloc par séance, triés par date', () => {
  assert.strictEqual((out.match(/Partie orthopédagogique/g) || []).length, 2);
  assert(out.indexOf('15/09/2026') < out.indexOf('22/09/2026') && out.indexOf('22/09/2026') < out.indexOf('29/09/2026'));
});
test('absence : bloc réduit à une ligne', () => assert(out.includes('Professeur absent — cours annulé.')));
test('XML bien formé : caractères spéciaux échappés', () => { assert(out.includes('Résoudre &lt;un&gt; problème &amp; co')); assert(!out.includes('<un>')); });
test('identité remplie', () => { assert(out.includes('12/04/2016') && out.includes('École Test A') && out.includes('Mme Exemple')); });
test('balises équilibrées', () => { const c = (r) => (out.match(r) || []).length; assert.strictEqual(c(/<w:tbl>/g), c(/<\/w:tbl>/g)); assert.strictEqual(c(/<w:tc>/g), c(/<\/w:tc>/g)); assert.strictEqual(c(/<w:tr[ >]/g), c(/<\/w:tr>/g)); });
test('dé-identifié : nom, titulaire et école absents', () => {
  const b = api.preparerBlocs([seance('2026-09-22', 'present', { objectif: { objectifLecon: 'Avec Alpha', objectifProfessionnel: '' } })], eleve, true);
  const o = api.remplirDocument(xml, b, { classe: 'P3' });
  assert(!/Alpha|Mme Exemple|Test A/.test(texte(o).replace('Suivi de l’élève', '')));
});
test('année scolaire déduite de la date', () => { assert.strictEqual(api.anneeScolaire('2026-09-22'), '2026-2027'); assert.strictEqual(api.anneeScolaire('2027-03-01'), '2026-2027'); });
console.log(`\n${ok} tests réussis`);
