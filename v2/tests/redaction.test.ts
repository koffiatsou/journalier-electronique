import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NBSP as N, blocEnTexte, construireBloc, controler, dateFR, deIdentifier, statsPresence, synthese
} from '../src/domain/redaction/index.ts';
import type { Presence } from '../src/domain/types.ts';
import { seance, vide } from './fabrique.ts';

const texte = (s = seance(), opts = {}) => blocEnTexte(construireBloc(s, opts));

test('séance complète : niveaux et effets groupés, points nommés', () => {
  const t = texte();
  assert.ok(t.includes(`• Totalement${N}: entre dans la tâche${N}; maintient son attention.`));
  assert.ok(t.includes(`• Suffisamment${N}: repère les informations pertinentes.`));
  assert.ok(t.includes(`• Partiellement${N}: contrôle sa production.`));
  assert.ok(t.includes(`Remarque${N}: Se fatigue en fin de période.`));
  assert.ok(t.includes(`• Effet positif${N}: support visuel.`));
  assert.ok(t.includes(`• Effet partiel${N}: guidage verbal.`));
  assert.ok(t.includes(`Maintenir l’accompagnement${N}; favoriser l’autonomie.`));
});

test('contrôles : aucun défaut sur la séance complète', () => {
  assert.deepEqual(controler(construireBloc(seance())), []);
});

test('déterminisme : même séance, même texte', () => {
  const s = seance();
  assert.equal(texte(s), texte(s));
});

test('aucun comptage dans le texte', () => {
  assert.ok(!/\b(deux|trois|quatre|cinq|six)\b/i.test(texte()));
});

test('séance vide : mention explicite, pas de champ vide', () => {
  const b = construireBloc(seance({ ...vide }));
  assert.equal(b.ortho[0]?.texte, 'Séance sans observation particulière.');
});

test('transfert « sans objet » absent de l’export', () => {
  assert.ok(!/Transfert/.test(texte(seance({ transfert: 'not_relevant', precisionTransfert: '' }))));
});

test('aide sans effet renseigné : ligne « Effet non précisé », pas de parenthèse vide', () => {
  const t = texte(seance({ aides: [{ nom: 'Matériel', effet: null }] }));
  assert.ok(t.includes('Effet non précisé') && t.includes('matériel.') && !t.includes('()'));
});

test('observation sans niveau : regroupée sous « Observé »', () => {
  const t = texte(seance({ observations: [{ texte: 'Comprend la consigne', niveau: null }], remarque: '' }));
  assert.ok(t.includes(`• Observé${N}: comprend la consigne.`));
});

test('évolution : même point, même matière, niveau différent', () => {
  const avant = seance({ date: '2026-09-15', observations: [{ texte: 'Maintient son attention', niveau: 0 }] });
  const t = texte(seance(), { precedentes: [avant] });
  assert.ok(t.includes(`Évolution depuis la séance précédente${N}: maintient son attention${N}: partiellement (15/09) → totalement.`));
});

test('évolution : ignorée si autre matière ou niveau inchangé', () => {
  const autre = seance({ date: '2026-09-15', matiere: 'Français', observations: [{ texte: 'Maintient son attention', niveau: 0 }] });
  const pareil = seance({ date: '2026-09-15', observations: [{ texte: 'Maintient son attention', niveau: 2 }] });
  assert.ok(!/Évolution/.test(texte(seance(), { precedentes: [autre, pareil] })));
});

test('absences : quatre cas, co-enseignement avec partie pédagogique', () => {
  const mk = (presence: Presence, extra = {}) =>
    texte(seance({ presence, matiere: 'Français', ...extra }));
  assert.ok(mk('absent_eleve').includes('Élève absent — séance non tenue.'));
  assert.ok(mk('absent_prof').includes('Professeur absent — cours annulé.'));
  assert.ok(mk('absent_agent').includes('Agent du pôle absent — séance non assurée.'));
  const co = mk('absent_eleve_coteach', { contenuClasse: 'Révision du chapitre 3' });
  assert.ok(co.includes('PARTIE PÉDAGOGIQUE'));
  assert.ok(co.includes(`Contenu vu en classe${N}: Révision du chapitre 3`));
  assert.ok(co.includes('Élève absent — intervention en co-enseignement.'));
  assert.ok(!/Fonctionnement observé|Compétence travaillée/.test(co));
  assert.ok(!mk('absent_eleve').includes('PARTIE PÉDAGOGIQUE'));
});

test('statistiques de présence', () => {
  const s = statsPresence([seance(), seance(), seance({ presence: 'absent_eleve' }), seance({ presence: 'absent_prof' })]);
  assert.deepEqual([s.total, s.present, s.absent_eleve, s.absent_prof, s.tauxPresence], [4, 2, 1, 1, 50]);
});

test('dé-identification : accents, casse, mots entiers', () => {
  const r = deIdentifier('Éloïse Dupont avance. eloise va bien, DUPONT aussi. Eloïsey non.', ['Éloïse', 'Dupont']);
  assert.equal(r, 'l’élève avance. l’élève va bien, l’élève aussi. Eloïsey non.');
});

test('contrôle : détecte comptage et marqueurs parasites', () => {
  const e = controler(construireBloc(seance({ ...vide, remarque: 'six points observés **[Fait]**' })));
  assert.ok(e.includes('comptage interdit') && e.includes('marqueur parasite'));
});

test('co-enseignement : le texte de repli n’est pas un objectif', () => {
  const t = texte(seance({ presence: 'absent_eleve_coteach', matiere: 'Français', contenuClasse: 'Chapitre 5', objectifLecon: 'Co-enseignement / Notes : Chapitre 5' }));
  assert.ok(!/Objectif de la leçon.*Co-enseignement/.test(t));
  assert.ok(t.includes('Contenu vu en classe'));
});

test('synthèse par matière : appuis, points à travailler, aides, absences', () => {
  const s = (date: string, niveaux: [string, 0 | 1 | 2][]) => seance({
    date,
    observations: niveaux.map(([texte, niveau]) => ({ texte, niveau })),
    aides: [{ nom: 'Support visuel', effet: 2 }]
  });
  const sy = synthese([
    s('2026-09-15', [['Maintient son attention', 0], ['Contrôle sa production', 0]]),
    s('2026-09-22', [['Maintient son attention', 2], ['Contrôle sa production', 0]]),
    seance({ date: '2026-09-29', presence: 'absent_prof' }),
    seance({ date: '2026-10-06', presence: 'absent_agent' })
  ]);
  const m = sy.matieres[0];
  assert.deepEqual(m?.appuis, [`Maintient son attention${N}: partiellement (15/09) → totalement (22/09).`]);
  assert.deepEqual(m?.aTravailler, [`Contrôle sa production${N}: partiellement à chaque séance.`]);
  assert.deepEqual(m?.aides, ['support visuel (effet positif)']);
  assert.ok(sy.absences.includes('1 cours annulé') && sy.absences.includes('1 absence de l’agent du pôle'));
  assert.equal(sy.seances, 2);
  assert.ok(!/occurrence/i.test(JSON.stringify(sy)));
});

test('date au format belge', () => assert.equal(dateFR('2026-09-22'), '22/09/2026'));

test('champs vides : un tiret, jamais d’espace pendant', () => {
  const t = texte(seance({ objectifLecon: '', monObjectif: '' }));
  assert.ok(t.includes(`Objectif de la leçon${N}: —`) && t.includes(`Titulaire${N}: —`));
  assert.deepEqual(controler(construireBloc(seance({ objectifLecon: '' }))), []);
});
