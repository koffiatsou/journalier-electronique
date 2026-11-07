import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import {
  REGLAGE_BROUILLON_ACTIVITE, REGLAGE_BROUILLON_ELEVE, activiteSaisie, champsActiviteVides, eleveSaisi, normaliserBrouillonActivite, normaliserBrouillonEleve
} from '../src/domain/brouillons/index.ts';
import type { ChampsActivite } from '../src/domain/brouillons/index.ts';
import { REGLAGES_SYNCHRONISES } from '../src/domain/synchro/cles.ts';
import type { Eleve } from '../src/domain/types.ts';
import { creerMagasin } from '../src/state/store.ts';

const vierge: Eleve = { id: 'n1', nom: '', prenom: '', classe: '', ecole: '', titulaire: '', dateNaissance: '', matieres: [] };
const commence: Eleve = { ...vierge, nom: 'Dupont', prenom: 'Élodie' };
const activiteCommencee: ChampsActivite = { ...champsActiviteVides('2026-11-04', 1, 1), titre: 'Réunion', lieu: 'Salle B' };

describe('eleveSaisi : un formulaire d’élève vaut la peine d’être gardé dès qu’on y écrit', () => {
  it('un formulaire vierge ne compte pas', () => assert.equal(eleveSaisi(vierge), false));
  it('un nom, une classe ou une matière cochée comptent', () => {
    assert.equal(eleveSaisi({ ...vierge, nom: 'Dupont' }), true);
    assert.equal(eleveSaisi({ ...vierge, classe: '3CB' }), true);
    assert.equal(eleveSaisi({ ...vierge, matieres: ['Français'] }), true);
  });
  it('des espaces seuls ne comptent pas', () => assert.equal(eleveSaisi({ ...vierge, nom: '   ' }), false));
});

describe('activiteSaisie : seule une vraie saisie compte (pas la date ni les périodes choisies par le clic)', () => {
  it('l’état de départ ne compte pas', () => assert.equal(activiteSaisie(champsActiviteVides('2026-11-04', 1, 1)), false));
  it('un titre, un lieu, une note ou un élève comptent', () => {
    assert.equal(activiteSaisie(activiteCommencee), true);
    assert.equal(activiteSaisie({ ...champsActiviteVides('2026-11-04', 1, 1), eleveId: 'alpha' }), true);
  });
});

describe('relire un brouillon sans jamais planter', () => {
  it('valide et refuse', () => {
    const b = { version: 1, enregistreLe: '2026-11-07T10:00:00.000Z', donnees: commence };
    assert.deepEqual(normaliserBrouillonEleve(b)?.donnees, commence);
    assert.equal(normaliserBrouillonEleve({ ...b, version: 2 }), null);
    assert.equal(normaliserBrouillonEleve({ ...b, donnees: { nom: 3 } }), null);
    assert.equal(normaliserBrouillonEleve('abîmé'), null);
    const a = { version: 1, enregistreLe: '2026-11-07T10:00:00.000Z', donnees: activiteCommencee };
    assert.deepEqual(normaliserBrouillonActivite(a)?.donnees, activiteCommencee);
    assert.equal(normaliserBrouillonActivite({ ...a, donnees: { titre: 1 } }), null);
  });
});

describe('le magasin garde l’élève et l’activité en cours de saisie', () => {
  it('après un rechargement, les deux brouillons sont retrouvés', async () => {
    const depot = creerDepotMemoire();
    const avant = creerMagasin(depot);
    await avant.charger();
    avant.enregistrerBrouillonEleve(commence);
    avant.enregistrerBrouillonActivite(activiteCommencee);
    await avant.viderEnregistrements();
    const apres = creerMagasin(depot);
    await apres.charger();
    assert.deepEqual(apres.lire().brouillonEleve?.donnees, commence);
    assert.deepEqual(apres.lire().brouillonActivite?.donnees, activiteCommencee);
  });

  it('effacer un brouillon l’efface aussi de la base, sans toucher à l’autre', async () => {
    const depot = creerDepotMemoire();
    const m = creerMagasin(depot);
    await m.charger();
    m.enregistrerBrouillonEleve(commence);
    m.enregistrerBrouillonActivite(activiteCommencee);
    await m.viderEnregistrements();
    await m.effacerBrouillonEleve();
    const apres = creerMagasin(depot);
    await apres.charger();
    assert.equal(apres.lire().brouillonEleve, null);
    assert.deepEqual(apres.lire().brouillonActivite?.donnees, activiteCommencee);
  });

  it('un brouillon abîmé dans la base est ignoré', async () => {
    const depot = creerDepotMemoire();
    await depot.enregistrerReglage({ id: REGLAGE_BROUILLON_ELEVE, valeur: { n: 'importe quoi' } });
    const m = creerMagasin(depot);
    await m.charger();
    assert.equal(m.lire().brouillonEleve, null);
  });

  it('les deux restent sur l’appareil : jamais synchronisés', () => {
    assert.equal(REGLAGES_SYNCHRONISES.includes(REGLAGE_BROUILLON_ELEVE), false);
    assert.equal(REGLAGES_SYNCHRONISES.includes(REGLAGE_BROUILLON_ACTIVITE), false);
  });
});
