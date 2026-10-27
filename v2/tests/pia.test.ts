import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import type { Depot } from '../src/data/repository.ts';
import {
  ASPECTS, COLONNES, MAX_PROPOSITIONS, MAX_RAPPROCHEMENTS, PHRASES, ajouterAmenagement, ajouterLigne, ajouterObjectifPeriode,
  ajouterPresent, basculerType, changerPresent, contientLigne, definirRetenus, idPia, modifierAmenagement, modifierCase,
  modifierIdentite, modifierObjectifPeriode, modifierPv1, modifierRetour, normaliserPia, piaVierge, proposerAmenagements,
  rapprocher, reprendreRetenus, retenusAReprendre, retirerAmenagement, retirerLigne, retirerObjectifPeriode, retirerPresent, typeDeAide,
  EXEMPLES
} from '../src/domain/pia/index.ts';
import type { Pia } from '../src/domain/pia/index.ts';
import { creerMagasin } from '../src/state/store.ts';
import { seance, vide } from './fabrique.ts';

const MAINTENANT = '2026-10-26T10:00:00.000Z';
const neuf = (): Pia => piaVierge('alpha', '2026-2027', MAINTENANT);

describe('PIA : création et relecture', () => {
  it('un PIA vierge ne contient rien : le profil se rédige à la main', () => {
    const p = neuf();
    assert.equal(p.id, idPia('alpha', '2026-2027'));
    assert.equal(p.id, 'alpha|2026-2027');
    for (const a of ASPECTS) for (const c of COLONNES) assert.equal(p.profil[a.id][c.id], '');
    assert.deepEqual(p.amenagements, []);
    assert.deepEqual(p.pv1.objectifs, []);
    assert.deepEqual(p.retenus, []);
  });

  it('les cinq aspects suivent l’ordre du modèle officiel, avec trois colonnes', () => {
    assert.deepEqual(ASPECTS.map((a) => a.libelle), [
      'Physique et psychomoteur', 'Lié à l’autonomie', 'Comportemental et affectif', 'Communication', 'Cognitif (pédagogique)'
    ]);
    assert.deepEqual(COLONNES.map((c) => c.libelle), ['Ressources', 'Difficultés', 'Objectifs à poursuivre']);
  });

  it('relit un PIA abîmé sans planter : valeurs vides à la place de ce qui manque', () => {
    const p = normaliserPia({
      eleveId: 'alpha', annee: '2026-2027', profil: { cognitif: { difficultes: 'Lit trop vite', objectifs: 42 } },
      pv1: { date: '2026-10-26', presents: ['Mme X', 7, 'M. Y'], objectifs: [{ id: 'objectif-1', texte: 'A' }, { texte: 'sans id' }, 'nimportequoi'] },
      amenagements: [{ id: 'amenagement-1', types: ['P', 'Z', 'M'], description: 'Fiche' }, { description: 'sans id' }]
    });
    assert.ok(p);
    assert.equal(p.profil.cognitif.difficultes, 'Lit trop vite');
    assert.equal(p.profil.cognitif.objectifs, '');
    assert.equal(p.profil.physique.ressources, '');
    assert.deepEqual(p.pv1.presents, ['Mme X', 'M. Y']);
    assert.deepEqual(p.pv1.objectifs, [{ id: 'objectif-1', matiere: '', texte: 'A', criteres: '' }]);
    assert.deepEqual(p.amenagements, [{ id: 'amenagement-1', types: ['P', 'M'], description: 'Fiche' }]);
    assert.equal(p.id, 'alpha|2026-2027');
  });

  it('refuse un enregistrement sans élève ou sans année', () => {
    assert.equal(normaliserPia(null), null);
    assert.equal(normaliserPia({ annee: '2026-2027' }), null);
    assert.equal(normaliserPia({ eleveId: 'a' }), null);
    assert.equal(normaliserPia('texte'), null);
  });

  it('relire un PIA bien formé ne change rien', () => {
    let p = modifierCase(neuf(), 'autonomie', 'ressources', 'Utilise son agenda');
    p = ajouterAmenagement(p, { types: ['O', 'P'], description: 'Place près du tableau', source: 'aide|support visuel' });
    p = ajouterObjectifPeriode(p, { matiere: 'Français', texte: 'Lire une consigne', criteres: '4 sur 5', source: 'r1' });
    p = definirRetenus(p, [{ id: 'r1', matiere: 'Français', texte: 'Lire une consigne', libre: false }]);
    assert.deepEqual(normaliserPia(JSON.parse(JSON.stringify(p))), p);
  });
});

describe('PIA : modifications', () => {
  it('modifie une case du profil sans toucher aux autres', () => {
    const p = modifierCase(neuf(), 'communication', 'objectifs', 'Oser poser des questions');
    assert.equal(p.profil.communication.objectifs, 'Oser poser des questions');
    assert.equal(p.profil.communication.ressources, '');
    assert.equal(p.profil.physique.objectifs, '');
  });

  it('ajouter une idée la met sur une nouvelle ligne, une seule fois', () => {
    assert.equal(ajouterLigne('', 'Renforcer la persévérance'), 'Renforcer la persévérance');
    assert.equal(ajouterLigne('Utilise son agenda', 'Prépare son matériel'), 'Utilise son agenda\nPrépare son matériel');
    assert.equal(ajouterLigne('Utilise son agenda\n\n', 'Prépare son matériel'), 'Utilise son agenda\nPrépare son matériel');
    assert.equal(ajouterLigne('Utilise son agenda', '  utilise   son AGENDA '), 'Utilise son agenda');
    assert.equal(ajouterLigne('abc', '   '), 'abc');
    assert.equal(contientLigne('a\nB\nc', 'b'), true);
    assert.equal(contientLigne('abc', 'b'), false);
  });

  it('retirer une idée enlève seulement sa ligne', () => {
    assert.equal(retirerLigne('a\nb\nc', 'B'), 'a\nc');
    assert.equal(retirerLigne('b', 'b'), '');
    assert.equal(retirerLigne('a\nb', 'zzz'), 'a\nb');
    assert.equal(retirerLigne('Texte libre\nIdée', 'Idée'), 'Texte libre');
    assert.equal(retirerLigne(ajouterLigne('Texte', 'Idée'), 'Idée'), 'Texte');
  });

  it('identité, date, axe, ressources et retours', () => {
    let p = modifierIdentite(neuf(), 'cpms', 'CPMS 1');
    p = modifierPv1(p, 'date', '2026-10-26');
    p = modifierPv1(p, 'axe', 'Cognitif');
    p = modifierPv1(p, 'ressources', 'Un ordinateur');
    p = modifierRetour(p, 'pms', 'Bilan prévu');
    assert.equal(p.identite.cpms, 'CPMS 1');
    assert.equal(p.pv1.date, '2026-10-26');
    assert.equal(p.pv1.axe, 'Cognitif');
    assert.equal(p.pv1.ressources, 'Un ordinateur');
    assert.equal(p.pv1.retours.pms, 'Bilan prévu');
    assert.equal(p.pv1.retours.parents, '');
  });

  it('personnes présentes : ajouter, changer, retirer', () => {
    let p = ajouterPresent(neuf());
    p = changerPresent(p, 0, 'Mme Dupont, titulaire');
    p = ajouterPresent(p, 'Le père');
    assert.deepEqual(p.pv1.presents, ['Mme Dupont, titulaire', 'Le père']);
    p = retirerPresent(p, 0);
    assert.deepEqual(p.pv1.presents, ['Le père']);
  });

  it('objectifs de la période : identifiants uniques, texte et critères modifiables', () => {
    let p = ajouterObjectifPeriode(neuf(), { texte: 'A' });
    p = ajouterObjectifPeriode(p, { texte: 'B' });
    assert.deepEqual(p.pv1.objectifs.map((o) => o.id), ['objectif-1', 'objectif-2']);
    p = modifierObjectifPeriode(p, 'objectif-1', 'criteres', 'Sans aide');
    p = modifierObjectifPeriode(p, 'objectif-2', 'texte', 'B2');
    p = retirerObjectifPeriode(p, 'objectif-1');
    p = ajouterObjectifPeriode(p, { texte: 'C' });
    assert.deepEqual(p.pv1.objectifs.map((o) => [o.id, o.texte]), [['objectif-2', 'B2'], ['objectif-3', 'C']]);
    assert.equal(p.pv1.objectifs[0]?.criteres, '');
  });

  it('reprend les objectifs retenus à la réunion une seule fois chacun', () => {
    let p = definirRetenus(neuf(), [
      { id: 'Mathématiques|progresser|x', matiere: 'Mathématiques', texte: 'Faire progresser : x.', libre: false },
      { id: 'libre-1', matiere: '', texte: 'Revoir le matériel', libre: true },
      { id: 'libre-2', matiere: '', texte: '   ', libre: true }
    ]);
    assert.equal(retenusAReprendre(p).length, 2);
    p = reprendreRetenus(p);
    assert.deepEqual(p.pv1.objectifs.map((o) => [o.matiere, o.texte, o.criteres, o.source]), [
      ['Mathématiques', 'Faire progresser : x.', '', 'Mathématiques|progresser|x'],
      ['', 'Revoir le matériel', '', 'libre-1']
    ]);
    assert.equal(retenusAReprendre(p).length, 0);
    const encore = reprendreRetenus(p);
    assert.equal(encore.pv1.objectifs.length, 2);
    // Un objectif retiré du procès-verbal peut être repris : l'agent garde la main.
    const sans = retirerObjectifPeriode(p, 'objectif-2');
    assert.equal(retenusAReprendre(sans).length, 1);
  });

  it('aménagements : types toujours dans l’ordre P, O, M ; description modifiable ; retrait', () => {
    let p = ajouterAmenagement(neuf());
    p = ajouterAmenagement(p, { types: ['M'], description: 'Ordinateur' });
    assert.deepEqual(p.amenagements.map((a) => a.id), ['amenagement-1', 'amenagement-2']);
    p = basculerType(p, 'amenagement-1', 'M');
    p = basculerType(p, 'amenagement-1', 'P');
    p = basculerType(p, 'amenagement-1', 'O');
    assert.deepEqual(p.amenagements[0]?.types, ['P', 'O', 'M']);
    p = basculerType(p, 'amenagement-1', 'O');
    assert.deepEqual(p.amenagements[0]?.types, ['P', 'M']);
    p = modifierAmenagement(p, 'amenagement-2', 'Ordinateur en classe');
    assert.equal(p.amenagements[1]?.description, 'Ordinateur en classe');
    p = retirerAmenagement(p, 'amenagement-1');
    assert.deepEqual(p.amenagements.map((a) => a.id), ['amenagement-2']);
  });
});

describe('PIA : indices', () => {
  it('chaque case a un exemple et des phrases à cliquer', () => {
    for (const a of ASPECTS) {
      for (const c of COLONNES) {
        assert.ok(EXEMPLES[a.id][c.id].length > 10, `exemple ${a.id}/${c.id}`);
        assert.ok(PHRASES[a.id][c.id].length >= 3, `phrases ${a.id}/${c.id}`);
        assert.equal(new Set(PHRASES[a.id][c.id]).size, PHRASES[a.id][c.id].length, `doublons ${a.id}/${c.id}`);
      }
    }
  });

  const obs = (texte: string, niveau: 0 | 1 | 2) => ({ texte, niveau });

  it('rapproche ce qui revient sur plusieurs séances, rangé par aspect, d’après le dernier niveau', () => {
    const liste = [
      seance({ id: 'a', date: '2026-09-22', matiere: 'Mathématiques', ...vide, observations: [obs('Entre dans la tâche', 2), obs('Contrôle sa production', 0), obs('Repère les informations pertinentes', 1), obs('Persévère dans la tâche', 0)] }),
      seance({ id: 'b', date: '2026-09-29', matiere: 'Français', ...vide, observations: [obs('Entre dans la tâche', 2), obs('Contrôle sa production', 0), obs('Repère les informations pertinentes', 1), obs('Observation libre', 0)] }),
      seance({ id: 'c', date: '2026-10-06', matiere: 'Français', ...vide, observations: [obs('Entre dans la tâche', 2), obs('Contrôle sa production', 0), obs('Persévère dans la tâche', 2), obs('Observation libre', 0)] })
    ];
    const r = rapprocher(liste);
    const texte = (aspect: string, colonne: string) => r.filter((x) => x.aspect === aspect && x.colonne === colonne).map((x) => x.texte);
    assert.deepEqual(texte('autonomie', 'ressources'), ['Acquis : entre dans la tâche']);
    assert.deepEqual(texte('cognitif', 'difficultes'), ['Pas encore acquis : contrôle sa production']);
    assert.deepEqual(texte('cognitif', 'objectifs'), ['Faire progresser : contrôle sa production', 'Consolider : repère les informations pertinentes']);
    // Persévère : 0 puis 2 → le dernier niveau décide (ressource), pas de difficulté.
    assert.deepEqual(texte('comportement', 'ressources'), ['Acquis : persévère dans la tâche']);
    assert.deepEqual(texte('comportement', 'difficultes'), []);
    // Une observation libre (hors liste) n'est pas rangée dans un aspect ; physique et communication restent libres.
    assert.ok(!r.some((x) => x.texte.toLowerCase().includes('libre')));
    assert.ok(!r.some((x) => x.aspect === 'physique' || x.aspect === 'communication'));
    const entreDansLaTache = r.find((x) => x.aspect === 'autonomie');
    assert.equal(entreDansLaTache?.raison, 'Noté lors de 3 séances (Mathématiques, Français) ; dernier niveau : totalement.');
  });

  it('ne rapproche pas ce qui n’a été noté qu’une fois, ni les absences', () => {
    const r = rapprocher([
      seance({ id: 'a', ...vide, observations: [obs('Entre dans la tâche', 2)] }),
      seance({ id: 'b', date: '2026-09-29', presence: 'absent_eleve', ...vide, observations: [obs('Entre dans la tâche', 2)] })
    ]);
    assert.deepEqual(r, []);
  });

  it('ne tient pas compte d’une observation sans niveau', () => {
    const r = rapprocher([
      seance({ id: 'a', ...vide, observations: [{ texte: 'Entre dans la tâche', niveau: null }] }),
      seance({ id: 'b', date: '2026-09-29', ...vide, observations: [{ texte: 'Entre dans la tâche', niveau: null }] })
    ]);
    assert.deepEqual(r, []);
  });

  it('limite les rapprochements par case', () => {
    const suggerees = ['Identifie ce qui est demandé dans la consigne', 'Repère les informations pertinentes', 'Comprend la notion travaillée', 'Mobilise des connaissances antérieures', 'Met en relation des informations'];
    const liste = ['a', 'b'].map((id, i) => seance({ id, date: `2026-09-2${i}`, ...vide, observations: suggerees.map((t) => obs(t, 2)) }));
    const r = rapprocher(liste);
    assert.equal(r.filter((x) => x.aspect === 'cognitif' && x.colonne === 'ressources').length, MAX_RAPPROCHEMENTS);
  });

  it('les identifiants sont stables d’un calcul à l’autre', () => {
    const liste = ['a', 'b'].map((id, i) => seance({ id, date: `2026-09-2${i}`, ...vide, observations: [obs('Entre dans la tâche', 2)] }));
    assert.deepEqual(rapprocher(liste).map((x) => x.id), rapprocher([...liste].reverse()).map((x) => x.id));
  });
});

describe('PIA : aménagements proposés', () => {
  const aide = (nom: string, effet: 0 | 1 | 2 | null) => ({ nom, effet });
  const avecAides = (id: string, date: string, aides: { nom: string; effet: 0 | 1 | 2 | null }[], matiere = 'Mathématiques') =>
    seance({ id, date, matiere, ...vide, aides });

  it('classe les aides connues en P, O ou M (proposition de départ)', () => {
    for (const n of ['Reformulation', 'Explicitation / verbalisation', 'Décomposition', 'Modélisation', 'Guidage verbal', 'Support visuel']) assert.equal(typeDeAide(n), 'P', n);
    for (const n of ['Aide organisation', 'Environnement']) assert.equal(typeDeAide(n), 'O', n);
    for (const n of ['Matériel', 'Outil numérique', 'Gabarit / fiche outil']) assert.equal(typeDeAide(n), 'M', n);
    assert.equal(typeDeAide('  support VISUEL. '), 'P');
    assert.equal(typeDeAide('Autre'), null);
    assert.equal(typeDeAide('Pictogrammes faits maison'), null);
  });

  it('propose les aides à effet positif, avec leur type et les matières', () => {
    const p = proposerAmenagements([
      avecAides('a', '2026-09-22', [aide('Support visuel', 2), aide('Outil numérique', 2)]),
      avecAides('b', '2026-09-29', [aide('Support visuel', 2)], 'Français'),
      avecAides('c', '2026-10-06', [aide('Guidage verbal', 1)])
    ], []);
    assert.deepEqual(p.map((x) => x.description), ['Support visuel (Mathématiques, Français)', 'Outil numérique (Mathématiques)']);
    assert.deepEqual(p.map((x) => x.types), [['P'], ['M']]);
    assert.equal(p[0]?.id, 'aide|support visuel');
    assert.equal(p[0]?.raison, 'Effet positif noté lors de 2 séances.');
    assert.equal(p[1]?.raison, 'Effet positif noté lors de 1 séance.');
  });

  it('écarte une aide sans effet, ou dont le dernier effet est « aucun effet »', () => {
    const p = proposerAmenagements([
      avecAides('a', '2026-09-22', [aide('Reformulation', 1), aide('Modélisation', 2), aide('Matériel', null)]),
      avecAides('b', '2026-09-29', [aide('Modélisation', 0)])
    ], []);
    assert.deepEqual(p, []);
  });

  it('une aide libre est proposée sans type : l’agent la classe', () => {
    const p = proposerAmenagements([avecAides('a', '2026-09-22', [aide('Pictogrammes faits maison', 2)])], []);
    assert.deepEqual(p[0]?.types, []);
    assert.match(p[0]?.raison ?? '', /à classer/);
  });

  it('ne repropose pas une aide déjà reprise, ni les absences', () => {
    const seances = [
      avecAides('a', '2026-09-22', [aide('Support visuel', 2)]),
      seance({ id: 'b', date: '2026-09-29', presence: 'absent_eleve', ...vide, aides: [aide('Matériel', 2)] })
    ];
    assert.equal(proposerAmenagements(seances, []).length, 1);
    const p = ajouterAmenagement(neuf(), { source: 'aide|support visuel', description: 'Support visuel' });
    assert.deepEqual(proposerAmenagements(seances, p.amenagements), []);
  });

  it('limite le nombre de propositions', () => {
    const noms = ['Reformulation', 'Décomposition', 'Modélisation', 'Guidage verbal', 'Support visuel', 'Matériel', 'Environnement', 'Outil numérique'];
    const p = proposerAmenagements([avecAides('a', '2026-09-22', noms.map((n) => aide(n, 2)))], []);
    assert.equal(p.length, MAX_PROPOSITIONS);
  });
});

/** Dépôt qui compte les écritures de PIA et peut refuser d'écrire. */
function depotEspion(base: Depot) {
  const ecritures: Pia[] = [];
  let refuser = false;
  const depot: Depot = {
    ...base,
    enregistrerPia: async (p) => {
      if (refuser) throw new Error('Disque plein');
      ecritures.push(p);
      await base.enregistrerPia(p);
    }
  };
  return { depot, ecritures, refuser: (v: boolean) => { refuser = v; } };
}

describe('PIA : enregistrement du brouillon', () => {
  const eleve = (id: string) => ({ id, nom: 'Test', prenom: id, classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [] });

  it('visible tout de suite, écrit en une seule fois après une courte pause', async () => {
    const espion = depotEspion(creerDepotMemoire());
    const magasin = creerMagasin(espion.depot);
    let p = neuf();
    for (const lettre of ['U', 'Ut', 'Uti']) {
      p = modifierCase(p, 'autonomie', 'ressources', lettre);
      magasin.enregistrerPia(p);
    }
    assert.equal(magasin.lire().pias.length, 1);
    assert.equal(magasin.lire().pias[0]?.profil.autonomie.ressources, 'Uti');
    assert.equal(magasin.lire().statutPia.etat, 'attente');
    assert.equal(espion.ecritures.length, 0);
    await magasin.viderEnregistrements();
    assert.equal(espion.ecritures.length, 1);
    assert.equal(espion.ecritures[0]?.profil.autonomie.ressources, 'Uti');
    assert.equal(magasin.lire().statutPia.etat, 'ok');
    assert.ok(magasin.lire().statutPia.le);
    assert.equal((await espion.depot.chargerPias()).length, 1);
  });

  it('se retrouve au chargement suivant, relu proprement', async () => {
    const depot = creerDepotMemoire();
    const a = creerMagasin(depot);
    a.enregistrerPia(modifierCase(neuf(), 'physique', 'difficultes', 'Se fatigue vite'));
    await a.viderEnregistrements();
    const b = creerMagasin(depot);
    await b.charger();
    assert.equal(b.lire().pias[0]?.profil.physique.difficultes, 'Se fatigue vite');
  });

  it('un échec d’écriture est signalé, puis réessayé à la fin', async () => {
    const espion = depotEspion(creerDepotMemoire());
    const magasin = creerMagasin(espion.depot);
    espion.refuser(true);
    magasin.enregistrerPia(neuf());
    await magasin.viderEnregistrements();
    assert.equal(magasin.lire().statutPia.etat, 'erreur');
    assert.equal(magasin.lire().statutPia.message, 'Disque plein');
    assert.equal(magasin.lire().pias.length, 1);
    espion.refuser(false);
    await magasin.viderEnregistrements();
    assert.equal(magasin.lire().statutPia.etat, 'ok');
    assert.equal(espion.ecritures.length, 1);
  });

  it('supprimer l’élève supprime ses PIA, et un brouillon en attente n’est pas réécrit après', async () => {
    const espion = depotEspion(creerDepotMemoire([eleve('alpha'), eleve('beta')], [seance({ eleveId: 'alpha' })]));
    const magasin = creerMagasin(espion.depot);
    await magasin.charger();
    magasin.enregistrerPia(piaVierge('alpha', '2025-2026', MAINTENANT));
    magasin.enregistrerPia(piaVierge('alpha', '2026-2027', MAINTENANT));
    magasin.enregistrerPia(piaVierge('beta', '2026-2027', MAINTENANT));
    await magasin.viderEnregistrements();
    // Modification encore en attente au moment de la suppression.
    magasin.enregistrerPia(modifierCase(piaVierge('alpha', '2026-2027', MAINTENANT), 'physique', 'ressources', 'Brouillon'));
    const effet = await magasin.supprimerEleve('alpha');
    assert.deepEqual(effet.pias.sort(), ['alpha|2025-2026', 'alpha|2026-2027']);
    await magasin.viderEnregistrements();
    assert.deepEqual(magasin.lire().pias.map((x) => x.id), ['beta|2026-2027']);
    assert.deepEqual((await espion.depot.chargerPias()).map((x) => x.id), ['beta|2026-2027']);
    assert.equal((await espion.depot.chargerSeances()).length, 0);
  });
});
