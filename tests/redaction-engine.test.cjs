// Tests du moteur de rédaction — données entièrement fictives.
const assert = require('assert');
const R = require('./charger-moteur.cjs');
const N = '\u00A0';
let ok = 0;
const test = (nom, f) => { try { f(); ok++; console.log('  ✓', nom); } catch (e) { console.error('  ✗', nom, '\n   ', e.message); process.exitCode = 1; } };

const base = (o = {}) => ({
  id: 1, type: 'SEANCE',
  identification: { eleve: 'Élève Alpha', date: '2026-09-22' },
  contexte: { matiere: 'Mathématiques', titulaire: 'M. Test', typeIntervention: ['Accompagnement individuel'], presenceStatus: 'present' },
  objectif: { objectifLecon: 'Résoudre un problème additif', objectifProfessionnel: 'Aider à identifier les données utiles' },
  q2: { observations: [
    { categorie: 'Organisation', observation: 'Entre dans la tâche', niveau: 2 },
    { categorie: 'Organisation', observation: 'Maintient son attention', niveau: 2 },
    { categorie: 'Compréhension', observation: 'Repère les informations pertinentes', niveau: 1 },
    { categorie: 'Réalisation', observation: 'Contrôle sa production', niveau: 0 }], precision: 'Se fatigue en fin de période' },
  q3: { indicateurs: [{ id: 'MATH-01', texte: 'Résoudre un problème à une opération', appreciation: 1 }], precision: '' },
  q4: { situation: 'some', types: ['Support visuel', 'Guidage verbal'], effets: { 'Support visuel': 2, 'Guidage verbal': 1 }, precision: '' },
  q5: { statut: 'observed', precision: 'Réutilisé en classe lors de l’exercice suivant' },
  q6: { actions: ['Maintenir l’accompagnement', 'Favoriser l’autonomie'], modalite: '', objectif: '', collaborations: [], precision: '' },
  ...o
});

console.log('Moteur de rédaction');

test('séance complète : niveaux groupés et points nommés', () => {
  const t = R.blocEnTexte(R.construireBloc(base()));
  assert(t.includes(`– Totalement${N}: entre dans la tâche${N}; maintient son attention.`));
  assert(t.includes(`– Suffisamment${N}: repère les informations pertinentes.`));
  assert(t.includes(`– Partiellement${N}: contrôle sa production.`));
  assert(t.includes(`Remarque${N}: Se fatigue en fin de période.`));
  assert(t.includes(`Support visuel (effet positif)${N}; guidage verbal (effet partiel).`));
  assert(t.includes(`Maintenir l’accompagnement${N}; favoriser l’autonomie.`));
});
test('contrôles : aucun défaut sur la séance complète', () => assert.deepStrictEqual(R.controler(R.construireBloc(base())), []));
test('déterminisme : même séance, même texte', () =>
  assert.strictEqual(R.blocEnTexte(R.construireBloc(base())), R.blocEnTexte(R.construireBloc(base()))));
test('aucun comptage dans le texte', () => assert(!/\b(deux|trois|quatre|cinq|six)\b/i.test(R.blocEnTexte(R.construireBloc(base())))));
test('séance vide : mention explicite, pas de champ vide', () => {
  const b = R.construireBloc(base({ q2: { observations: [], precision: '' }, q3: { indicateurs: [] }, q4: { types: [], effets: {} }, q5: { statut: '' }, q6: { actions: [] } }));
  assert.strictEqual(b.ortho[0].texte, 'Séance sans observation particulière.');
});
test('transfert « non pertinent » absent de l’export', () => {
  const t = R.blocEnTexte(R.construireBloc(base({ q5: { statut: 'not_relevant', precision: '' } })));
  assert(!/Transfert/.test(t));
});
test('aide sans effet renseigné : pas de parenthèse vide', () => {
  const t = R.blocEnTexte(R.construireBloc(base({ q4: { types: ['Matériel'], effets: {}, precision: '' } })));
  assert(t.includes('Matériel.') && !t.includes('()'));
});
test('séance ancienne (observation en simple texte, niveau absent)', () => {
  const t = R.blocEnTexte(R.construireBloc(base({ q2: { observations: ['Comprend la consigne'], precision: '' } })));
  assert(t.includes(`– Observé${N}: comprend la consigne.`));
});
test('évolution : même point, même matière, niveau différent', () => {
  const avant = base({ id: 0, identification: { eleve: 'Élève Alpha', date: '2026-09-15' },
    q2: { observations: [{ observation: 'Maintient son attention', niveau: 0 }], precision: '' } });
  const t = R.blocEnTexte(R.construireBloc(base(), [avant]));
  assert(t.includes(`Évolution depuis la séance précédente${N}: maintient son attention${N}: partiellement (15/09) → totalement.`));
});
test('évolution : ignorée si autre matière ou niveau inchangé', () => {
  const autre = base({ id: 0, identification: { eleve: 'Élève Alpha', date: '2026-09-15' }, contexte: { matiere: 'Français', presenceStatus: 'present' },
    q2: { observations: [{ observation: 'Maintient son attention', niveau: 0 }] } });
  const pareil = base({ id: 0, identification: { eleve: 'Élève Alpha', date: '2026-09-15' },
    q2: { observations: [{ observation: 'Maintient son attention', niveau: 2 }] } });
  assert(!/Évolution/.test(R.blocEnTexte(R.construireBloc(base(), [autre, pareil]))));
});
test('absences : quatre cas conservés, co-enseignement avec partie pédagogique', () => {
  const mk = (s, extra = {}) => R.blocEnTexte(R.construireBloc(base({ contexte: { matiere: 'Français', presenceStatus: s, ...extra } })));
  assert(mk('absent_eleve').includes('Élève absent — séance non tenue.'));
  assert(mk('absent_prof').includes('Professeur absent — cours annulé.'));
  assert(mk('absent_agent').includes('Agent du pôle absent — séance non assurée.'));
  const co = mk('absent_eleve_coteach', { classNotes: 'Révision du chapitre 3' });
  assert(co.includes('PARTIE PÉDAGOGIQUE'));
  assert(co.includes(`Contenu vu en classe${N}: Révision du chapitre 3`));
  assert(co.includes('Élève absent — intervention en co-enseignement.'));
  assert(!/Fonctionnement observé|Compétence travaillée/.test(co));
  assert(!mk('absent_eleve').includes('PARTIE PÉDAGOGIQUE'));
});
test('statistiques de présence', () => {
  const s = R.statsPresence([base(), base(), base({ contexte: { presenceStatus: 'absent_eleve' } }), base({ contexte: { presenceStatus: 'absent_prof' } })]);
  assert.deepStrictEqual([s.total, s.present, s.absent_eleve, s.absent_prof, s.tauxPresence], [4, 2, 1, 1, 50]);
});
test('dé-identification : accents, casse, mots entiers', () => {
  const r = R.deIdentifier('Éloïse Dupont avance. eloise va bien, DUPONT aussi. Eloïsey non.', ['Éloïse', 'Dupont']);
  assert.strictEqual(r, 'l’élève avance. l’élève va bien, l’élève aussi. Eloïsey non.');
});
test('contrôle : détecte comptage et marqueurs parasites', () => {
  const b = R.construireBloc(base({ q2: { observations: [], precision: 'six points observés **[Fait]**' } }));
  const e = R.controler(b);
  assert(e.includes('comptage interdit') && e.includes('marqueur parasite'));
});
test('co-enseignement : le texte de repli n’est pas un objectif', () => {
  const t = R.blocEnTexte(R.construireBloc(base({ contexte: { matiere: 'Français', presenceStatus: 'absent_eleve_coteach', classNotes: 'Chapitre 5' }, objectif: { objectifLecon: 'Co-enseignement / Notes : Chapitre 5' } })));
  assert(!/Objectif de la leçon.*Co-enseignement/.test(t));
  assert(t.includes('Contenu vu en classe'));
});
test('synthèse par matière : appuis, points à travailler, aides, absences', () => {
  const seance = (date, niveaux, aide, extra = {}) => ({
    identification: { eleve: 'Alpha', date },
    contexte: { matiere: 'Mathématiques', presenceStatus: 'present', ...extra },
    q2: { observations: niveaux.map(([observation, niveau]) => ({ observation, niveau })) },
    q4: { types: [aide[0]], effets: { [aide[0]]: aide[1] } }
  });
  const sy = R.synthese([
    seance('2026-09-15', [['Maintient son attention', 0], ['Contrôle sa production', 0]], ['Support visuel', 2]),
    seance('2026-09-22', [['Maintient son attention', 2], ['Contrôle sa production', 0]], ['Support visuel', 2]),
    { identification: { eleve: 'Alpha', date: '2026-09-29' }, contexte: { matiere: 'Mathématiques', presenceStatus: 'absent_prof' } },
    { identification: { eleve: 'Alpha', date: '2026-10-06' }, contexte: { matiere: 'Mathématiques', presenceStatus: 'absent_agent' } }
  ]);
  const m = sy.matieres[0];
  assert.deepStrictEqual(m.appuis, [`Maintient son attention${N}: partiellement (15/09) → totalement (22/09).`]);
  assert.deepStrictEqual(m.aTravailler, [`Contrôle sa production${N}: partiellement à chaque séance.`]);
  assert.deepStrictEqual(m.aides, ['support visuel (effet positif)']);
  assert(sy.absences.includes('1 cours annulé') && sy.absences.includes('1 absence de l’agent du pôle'));
  assert.strictEqual(sy.seances, 2);
  assert(!/ClinIque|occurrence/i.test(JSON.stringify(sy)));
});
test('date au format belge', () => assert.strictEqual(R.dateFR('2026-09-22'), '22/09/2026'));

console.log(`\n${ok} tests réussis`);
