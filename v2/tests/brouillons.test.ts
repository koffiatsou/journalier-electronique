import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { remettreMemo, retirerMemo } from '../src/domain/accueil/index.ts';
import type { Memo } from '../src/domain/accueil/index.ts';
import { REGLAGE_BROUILLON_SEANCE, contenuSaisi, creerBrouillonSeance, normaliserBrouillonSeance } from '../src/domain/brouillons/index.ts';
import { REGLAGES_SYNCHRONISES } from '../src/domain/synchro/cles.ts';
import { seanceVide } from '../src/features/seance/brouillon.ts';
import { creerMagasin } from '../src/state/store.ts';
import { REPERE_FOCUS_INITIAL, focaliserInitial } from '../src/ui/Dialog.tsx';
import { DUREE_TOAST_ACTION_MS, DUREE_TOAST_MS } from '../src/ui/Toast.tsx';

const memo = (id: string): Memo => ({ id, texte: `mémo ${id}`, fait: false, creeLe: '2026-11-06T08:00:00.000Z' });

describe('contenuSaisi : quand une séance vaut la peine d’être gardée', () => {
  it('un climat de classe choisi suffit à garder la séance', () => {
    assert.equal(contenuSaisi({ ...seanceVide(), climat: 'serein' }), true);
  });
  it('une séance vierge, ou avec seulement l’élève et la date, ne compte pas', () => {
    assert.equal(contenuSaisi(seanceVide()), false);
    assert.equal(contenuSaisi(seanceVide('alpha', '2026-11-06')), false);
  });
  it('ne compte pas ce que l’application préremplit seule en choisissant l’élève (forme, niveau)', () => {
    assert.equal(contenuSaisi({ ...seanceVide('alpha'), forme: 'G', niveauScolaire: '1' }), false);
  });
  it('compte dès qu’on écrit un objectif, note un point ou change la présence', () => {
    assert.equal(contenuSaisi({ ...seanceVide('alpha'), objectifLecon: 'Résoudre des équations' }), true);
    assert.equal(contenuSaisi({ ...seanceVide('alpha'), observations: [{ texte: 'Entre dans la tâche', niveau: null }] }), true);
    assert.equal(contenuSaisi({ ...seanceVide('alpha'), presence: 'absent_eleve' }), true);
  });
  it('ne compte pas un champ rempli seulement d’espaces', () => {
    assert.equal(contenuSaisi({ ...seanceVide('alpha'), monObjectif: '   ' }), false);
  });
});

describe('normaliserBrouillonSeance : relire un brouillon sans jamais planter', () => {
  const bon = creerBrouillonSeance({ ...seanceVide('alpha'), objectifLecon: 'x' }, '2026-11-06T10:12:00.000Z');
  it('relit un brouillon valide tel quel', () => {
    assert.deepEqual(normaliserBrouillonSeance(JSON.parse(JSON.stringify(bon))), bon);
  });
  it('refuse ce qui n’a pas la forme d’un brouillon de séance', () => {
    for (const mauvais of [null, undefined, 'texte', 42, [], {}, { ...bon, version: 2 }, { ...bon, enregistreLe: 5 }, { ...bon, seance: null },
      { ...bon, seance: { ...bon.seance, observations: 'non' } }, { ...bon, seance: { ...bon.seance, suite: null } }]) {
      assert.equal(normaliserBrouillonSeance(mauvais), null);
    }
  });
});

describe('le magasin garde la séance en cours de saisie', () => {
  const seanceEnCours = { ...seanceVide('alpha', '2026-11-06'), matiere: 'Mathématiques', objectifLecon: 'Résoudre des équations du premier degré' };

  it('après un rechargement, le brouillon est retrouvé (avant ce lot : perdu)', async () => {
    const depot = creerDepotMemoire();
    const avant = creerMagasin(depot);
    await avant.charger();
    avant.enregistrerBrouillonSeance(seanceEnCours);
    await avant.viderEnregistrements();

    const apres = creerMagasin(depot);
    await apres.charger();
    assert.deepEqual(apres.lire().brouillonSeance?.seance, seanceEnCours);
  });

  it('une séance enregistrée efface le brouillon, y compris dans la base', async () => {
    const depot = creerDepotMemoire();
    const m = creerMagasin(depot);
    await m.charger();
    m.enregistrerBrouillonSeance(seanceEnCours);
    await m.viderEnregistrements();
    await m.effacerBrouillonSeance();
    assert.equal(m.lire().brouillonSeance, null);

    const relu = creerMagasin(depot);
    await relu.charger();
    assert.equal(relu.lire().brouillonSeance, null);
  });

  it('un brouillon abîmé dans la base est ignoré : l’écran s’ouvre quand même', async () => {
    const depot = creerDepotMemoire([], [], [], [], [{ id: REGLAGE_BROUILLON_SEANCE, valeur: { version: 1, seance: 'cassé' } }]);
    const m = creerMagasin(depot);
    await m.charger();
    assert.equal(m.lire().pret, true);
    assert.equal(m.lire().brouillonSeance, null);
  });

  it('supprimer l’élève concerné efface aussi son brouillon', async () => {
    const depot = creerDepotMemoire([{ id: 'alpha', nom: 'Alpha', prenom: 'Élève', classe: '1CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [] }]);
    const m = creerMagasin(depot);
    await m.charger();
    m.enregistrerBrouillonSeance(seanceEnCours);
    await m.viderEnregistrements();
    await m.supprimerEleve('alpha');
    assert.equal(m.lire().brouillonSeance, null);
  });

  it('le brouillon reste sur l’appareil : jamais envoyé à OneDrive ni dans une copie de secours', () => {
    assert.equal(REGLAGES_SYNCHRONISES.includes(REGLAGE_BROUILLON_SEANCE), false);
  });
});

describe('remettreMemo : « Annuler » après la suppression d’un mémo', () => {
  const liste = [memo('a'), memo('b'), memo('c')];
  it('remet le mémo à sa place d’origine', () => {
    const apres = retirerMemo(liste, 'b');
    assert.deepEqual(remettreMemo(apres, liste[1]!, 1).map((m) => m.id), ['a', 'b', 'c']);
  });
  it('un double geste ne crée pas de doublon', () => {
    assert.deepEqual(remettreMemo(liste, liste[1]!, 1).map((m) => m.id), ['a', 'b', 'c']);
  });
  it('si la liste a raccourci entre-temps, le mémo revient en dernier', () => {
    assert.deepEqual(remettreMemo([memo('a')], memo('z'), 9).map((m) => m.id), ['a', 'z']);
    assert.deepEqual(remettreMemo([memo('a')], memo('z'), -3).map((m) => m.id), ['z', 'a']);
  });
});

describe('fenêtre de confirmation : le focus ne tombe jamais sur le bouton qui détruit', () => {
  it('donne le focus à l’élément repéré', () => {
    const appels: string[] = [];
    const bouton = (nom: string) => ({ focus: () => { appels.push(nom); } });
    const fenetre = { querySelector: (sel: string) => (sel === `[${REPERE_FOCUS_INITIAL}]` ? bouton('Annuler') : null) };
    assert.equal(focaliserInitial(fenetre), true);
    assert.deepEqual(appels, ['Annuler']);
  });
  it('sans repère, laisse le navigateur choisir', () => {
    assert.equal(focaliserInitial({ querySelector: () => null }), false);
  });
});

describe('notifications avec un geste « Annuler »', () => {
  it('restent affichées plus longtemps qu’une simple confirmation', () => {
    assert.ok(DUREE_TOAST_ACTION_MS > DUREE_TOAST_MS);
  });
});
