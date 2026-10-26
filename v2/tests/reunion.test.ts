import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { construirePeriode } from '../src/domain/journalier/index.ts';
import { NBSP as N, synthese } from '../src/domain/redaction/index.ts';
import type { Seance } from '../src/domain/types.ts';
import {
  MAX_AIDES_A_GARDER, MAX_COMPETENCES, MAX_OBSERVATIONS,
  ajouterLibre, estRetenu, proposerObjectifs, reecrire, retenir, retenusParMatiere, retirer, texteReunion
} from '../src/domain/reunion/index.ts';
import type { ObjectifRetenu } from '../src/domain/reunion/index.ts';
import { seance, vide } from './fabrique.ts';

type N3 = 0 | 1 | 2;

/** Séance d'une matière avec seulement les éléments donnés. */
const s = (date: string, surcharge: Partial<Seance> = {}): Seance => seance({ ...vide, date, ...surcharge });
const obs = (...liste: [string, N3][]) => liste.map(([texte, niveau]) => ({ texte, niveau }));
const propositions = (...seances: Seance[]) => proposerObjectifs(synthese(seances));

describe('Synthèse : le détail est gardé pour la réunion', () => {
  it('niveaux par date, effets des aides, niveau des compétences', () => {
    const m = synthese([
      s('2026-09-15', { observations: obs(['Maintient son attention', 0]), aides: [{ nom: 'Support visuel', effet: 1 }], competences: [{ texte: 'Résoudre un problème', niveau: 0 }] }),
      s('2026-09-22', { observations: obs(['Maintient son attention', 2]), aides: [{ nom: 'Support visuel', effet: 2 }], competences: [{ texte: 'Résoudre un problème', niveau: 1 }] })
    ]).matieres[0];
    assert.deepEqual(m?.suivis.observations, [{ texte: 'Maintient son attention', suite: [{ date: '2026-09-15', niveau: 0 }, { date: '2026-09-22', niveau: 2 }] }]);
    assert.deepEqual(m?.suivis.aides, [{ texte: 'Support visuel', effets: [1, 2] }]);
    assert.deepEqual(m?.suivis.competences, [{ texte: 'Résoudre un problème', niveau: 1 }]);
  });
});

describe('Propositions d’objectifs : observations', () => {
  it('« partiellement » → faire progresser ; « suffisamment » → consolider ; « totalement » → rien', () => {
    const p = propositions(s('2026-09-15', { observations: obs(['Contrôle sa production', 0], ['Repère les informations pertinentes', 1], ['Entre dans la tâche', 2]) }));
    assert.deepEqual(p.map((x) => x.texte), [
      `Faire progresser${N}: contrôle sa production.`,
      `Consolider${N}: repère les informations pertinentes.`
    ]);
    assert.deepEqual(p.map((x) => x.genre), ['progresser', 'consolider']);
    assert.equal(p[0]?.raison, 'Observé « partiellement » le 15/09.');
  });

  it('c’est le dernier niveau noté qui compte : une observation devenue totale n’est plus proposée', () => {
    const p = propositions(
      s('2026-09-15', { observations: obs(['Maintient son attention', 0]) }),
      s('2026-09-22', { observations: obs(['Maintient son attention', 2]) })
    );
    assert.deepEqual(p, []);
  });

  it('la raison dit quand une observation revient depuis plusieurs séances ou a reculé', () => {
    const serie = propositions(
      s('2026-09-15', { observations: obs(['Contrôle sa production', 0]) }),
      s('2026-09-22', { observations: obs(['Contrôle sa production', 0]) })
    );
    assert.equal(serie[0]?.raison, 'Observé « partiellement » lors des 2 dernières séances.');
    const recul = propositions(
      s('2026-09-15', { observations: obs(['Maintient son attention', 2]) }),
      s('2026-09-22', { observations: obs(['Maintient son attention', 1]) })
    );
    assert.equal(recul[0]?.genre, 'consolider');
    assert.equal(recul[0]?.raison, 'Moins bien qu’avant : totalement le 15/09, puis suffisamment le 22/09.');
  });

  it('liste courte : le moins acquis d’abord, puis ce qui a reculé, puis ce qui dure ; au plus 3', () => {
    const p = propositions(
      s('2026-09-15', { observations: obs(['A suffisant', 1], ['B reculé', 2], ['C partiel', 0], ['D partiel', 0], ['E suffisant', 1]) }),
      s('2026-09-22', { observations: obs(['A suffisant', 1], ['B reculé', 1], ['C partiel', 0], ['D partiel', 0], ['E suffisant', 1]) })
    ).filter((x) => x.genre === 'progresser' || x.genre === 'consolider');
    assert.equal(p.length, MAX_OBSERVATIONS);
    assert.deepEqual(p.map((x) => x.texte.split(`${N}: `)[1]), ['c partiel.', 'd partiel.', 'b reculé.']);
  });

  it('les séances d’absence ne produisent aucune proposition', () => {
    const p = propositions(s('2026-09-15', { presence: 'absent_eleve', observations: obs(['Contrôle sa production', 0]) }));
    assert.deepEqual(p, []);
  });
});

describe('Propositions d’objectifs : compétences et aides', () => {
  it('compétence pas encore totale → à continuer ; totale → rien ; notée sans niveau → proposée', () => {
    const p = propositions(s('2026-09-15', {
      competences: [{ texte: 'Résoudre un problème à une opération', niveau: 1 }, { texte: 'Lire un graphique', niveau: 2 }],
      precisionCompetence: 'Se repérer dans le tableau'
    }));
    assert.deepEqual(p.map((x) => x.texte), [
      `Continuer à travailler la compétence${N}: résoudre un problème à une opération.`,
      `Continuer à travailler la compétence${N}: se repérer dans le tableau.`
    ]);
    assert.equal(p[0]?.raison, 'Niveau noté : suffisamment.');
    assert.equal(p[1]?.raison, 'Compétence notée sans niveau.');
  });

  it('pas plus de deux compétences par matière', () => {
    const p = propositions(s('2026-09-15', { competences: ['a', 'b', 'c', 'd'].map((texte) => ({ texte, niveau: 0 as const })) }));
    assert.equal(p.length, MAX_COMPETENCES);
  });

  it('aide qui marche → à garder ; aide sans effet → à revoir ; effet partiel ou inconnu → rien', () => {
    const p = propositions(
      s('2026-09-15', { aides: [{ nom: 'Support visuel', effet: 2 }, { nom: 'Guidage verbal', effet: 0 }, { nom: 'Matériel', effet: 1 }, { nom: 'Décomposition', effet: null }] }),
      s('2026-09-22', { aides: [{ nom: 'Support visuel', effet: 2 }, { nom: 'Guidage verbal', effet: 0 }] })
    );
    assert.deepEqual(p.map((x) => [x.genre, x.texte, x.raison]), [
      ['garder-aide', `Garder l’aide qui fonctionne${N}: support visuel.`, 'Effet positif à chaque séance.'],
      ['revoir-aide', `Revoir l’aide${N}: guidage verbal.`, 'Aucun effet noté, séance après séance.']
    ]);
  });

  it('une aide qui a eu plusieurs effets se juge sur le dernier effet noté', () => {
    const p = propositions(
      s('2026-09-15', { aides: [{ nom: 'Reformulation', effet: 0 }] }),
      s('2026-09-22', { aides: [{ nom: 'Reformulation', effet: 2 }] })
    );
    assert.deepEqual(p.map((x) => [x.genre, x.raison]), [['garder-aide', 'Effet positif lors de la dernière séance.']]);
    assert.ok(MAX_AIDES_A_GARDER >= 1);
  });
});

describe('Propositions d’objectifs : identifiants et matières', () => {
  it('même contenu → mêmes identifiants (un choix déjà fait est retrouvé) ; une matière ne se confond pas avec une autre', () => {
    const base = [
      s('2026-09-15', { matiere: 'Mathématiques', observations: obs(['Contrôle sa production', 0]) }),
      s('2026-09-16', { matiere: 'Français', observations: obs(['Contrôle sa production', 0]) })
    ];
    const a = propositions(...base);
    const b = propositions(...base.slice().reverse());
    assert.deepEqual(a.map((x) => x.id).sort(), b.map((x) => x.id).sort());
    assert.equal(new Set(a.map((x) => x.id)).size, 2);
    assert.deepEqual(a.map((x) => x.matiere), ['Français', 'Mathématiques']);
  });

  it('aucune séance → aucune proposition', () => assert.deepEqual(propositions(), []));
});

describe('Validation par l’agent', () => {
  const p = propositions(s('2026-09-15', { observations: obs(['Contrôle sa production', 0]), aides: [{ nom: 'Support visuel', effet: 2 }] }));
  const [premiere, seconde] = p;
  assert.ok(premiere && seconde);

  it('retenir, retirer, ne pas retenir deux fois', () => {
    let r: ObjectifRetenu[] = [];
    r = retenir(r, premiere);
    r = retenir(r, premiere);
    assert.equal(r.length, 1);
    assert.ok(estRetenu(r, premiere.id) && !estRetenu(r, seconde.id));
    assert.deepEqual(retirer(r, premiere.id), []);
    assert.equal(r.length, 1);
  });

  it('reformuler ne change que le texte retenu', () => {
    const r = reecrire(retenir(retenir([], premiere), seconde), premiere.id, 'Mon texte');
    assert.deepEqual(r.map((x) => x.texte), ['Mon texte', seconde.texte]);
    assert.equal(r[0]?.id, premiere.id);
  });

  it('objectif libre : nettoyé, majuscule, numéroté ; un texte vide est ignoré', () => {
    let r = ajouterLibre([], '  parler à   la titulaire  ');
    r = ajouterLibre(r, '   ');
    r = ajouterLibre(r, 'Revoir le matériel', 'Français');
    assert.deepEqual(r.map((x) => [x.id, x.texte, x.matiere, x.libre]), [
      ['libre-1', 'Parler à la titulaire', '', true],
      ['libre-2', 'Revoir le matériel', 'Français', true]
    ]);
    assert.equal(ajouterLibre(retirer(r, 'libre-1'), 'Autre').at(-1)?.id, 'libre-3');
  });

  it('groupés par matière, ceux sans matière à la fin, les textes vides écartés', () => {
    const r: ObjectifRetenu[] = [
      { id: 'a', matiere: '', texte: 'Libre', libre: true },
      { id: 'b', matiere: 'Mathématiques', texte: 'M1', libre: false },
      { id: 'c', matiere: 'Français', texte: 'F1', libre: false },
      { id: 'd', matiere: 'Français', texte: '   ', libre: false }
    ];
    assert.deepEqual(retenusParMatiere(r).map((g) => [g.matiere, g.objectifs.map((o) => o.id)]), [
      ['Français', ['c']], ['Mathématiques', ['b']], ['', ['a']]
    ]);
  });
});

describe('Texte de la réunion', () => {
  const seances = [
    s('2026-09-15', { observations: obs(['Maintient son attention', 0], ['Entre dans la tâche', 2]), aides: [{ nom: 'Support visuel', effet: 2 }, { nom: 'Guidage verbal', effet: 0 }], competences: [{ texte: 'Résoudre un problème', niveau: 1 }] }),
    s('2026-09-22', { observations: obs(['Maintient son attention', 1], ['Entre dans la tâche', 2]), aides: [{ nom: 'Support visuel', effet: 2 }, { nom: 'Guidage verbal', effet: 0 }] }),
    s('2026-09-29', { presence: 'absent_prof' })
  ];
  const sy = synthese(seances);
  const retenus = retenir([], proposerObjectifs(sy)[0] ?? (() => { throw new Error('aucune proposition'); })());
  const entete = { eleve: 'Dupont Élodie', classe: '3CB', periode: '2026-2027' };

  it('contient la période, les rubriques de la matière et les objectifs retenus', () => {
    const t = texteReunion(sy, ajouterLibre(retenus, 'Voir avec la titulaire'), entete);
    assert.ok(t.startsWith(`Réunion${N}: Dupont Élodie (3CB)\nPériode${N}: 2026-2027\n2 séances d’accompagnement`));
    assert.ok(t.includes('1 cours annulé'));
    assert.ok(t.includes('Mathématiques (du 15/09/2026 au 22/09/2026)'));
    for (const titre of ['Points d’appui', 'À travailler', 'Compétence travaillée', 'Aides utilisées', 'Aides sans effet constaté']) assert.ok(t.includes(`\n${titre}\n`), titre);
    assert.ok(t.includes(`• Entre dans la tâche${N}: totalement à chaque séance.`));
    assert.ok(t.includes('• Support visuel (effet positif)') && t.includes('• Guidage verbal'));
    assert.ok(t.includes(`Objectifs retenus pour la suite\nMathématiques\n• Consolider${N}: maintient son attention.`));
    assert.ok(t.endsWith('• Voir avec la titulaire'));
  });

  it('sans objectif retenu, pas de rubrique « Objectifs »', () => assert.ok(!texteReunion(sy, [], entete).includes('Objectifs retenus')));

  it('« sans nom » : le nom de l’élève disparaît, même s’il est cité dans un texte libre', () => {
    const t = texteReunion(
      synthese([s('2026-09-15', { precisionCompetence: 'Élodie se repère mieux' })]),
      ajouterLibre([], 'Parler de Dupont à la titulaire'),
      { ...entete, masquer: ['Dupont', 'Élodie', 'Dupont Élodie'] }
    );
    assert.ok(!/dupont|élodie/i.test(t), t);
    assert.ok(t.startsWith(`Réunion${N}: élève (3CB)`));
  });

  it('« sans nom » : même si le prénom est « Élève » (élèves fictifs), l’en-tête reste lisible', () => {
    const t = texteReunion(synthese([s('2026-09-15')]), [], { eleve: 'Alpha Élève', classe: '1CB', periode: '2026-2027', masquer: ['Alpha Élève', 'Alpha', 'Élève', 'Élève'] });
    assert.ok(t.startsWith(`Réunion${N}: élève (1CB)\nPériode${N}: 2026-2027\n`), t);
    assert.ok(!t.includes('Alpha'));
  });

  it('matière sans observation : le dit clairement', () => {
    const t = texteReunion(synthese([s('2026-09-15')]), [], entete);
    assert.ok(t.includes('Mathématiques (le 15/09/2026)\nAucune observation notée.'));
  });

  it('période vide : seulement l’en-tête', () => {
    assert.equal(texteReunion(synthese([]), [], entete), `Réunion${N}: Dupont Élodie (3CB)\nPériode${N}: 2026-2027\n0 séance d’accompagnement`);
  });
});

describe('Période choisie à l’écran', () => {
  it('construit la bonne période selon le genre', () => {
    const c = { annee: '2026-2027', du: '2026-09-01', au: '2026-10-31' };
    assert.deepEqual(construirePeriode({ genre: 'a-ce-jour', ...c }), { genre: 'a-ce-jour' });
    assert.deepEqual(construirePeriode({ genre: 'annee', ...c }), { genre: 'annee', annee: '2026-2027' });
    assert.deepEqual(construirePeriode({ genre: 'dates', ...c }), { genre: 'dates', du: '2026-09-01', au: '2026-10-31' });
  });
});
