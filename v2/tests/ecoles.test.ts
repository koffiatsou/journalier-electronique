import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import {
  NB_PERIODES, PERIODES_AGENDA, TRAJET_PAR_DEFAUT, avertissementsEcoles, creer, ecoleDeEleve, ecoleDeOccurrence, ecolesParDefaut, elevesApresChangement,
  heuresDe, horairesParDefaut, horairesReference, lireHoraires, nbPeriodesUtilisees, normaliserEcoles, normaliserHoraires, occurrences, pauseAvant, rattachement,
  verifierEcoles, verifierHoraires
} from '../src/domain/agenda/index.ts';
import type { Ecole, Periode } from '../src/domain/agenda/index.ts';
import { lirePeriodesV75 } from '../src/domain/v75/agenda.ts';
import { evenementsSouhaites, normaliserObjet } from '../src/domain/synchro/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { creerMagasin } from '../src/state/store.ts';

const eleve = (id: string, extra: Partial<Eleve> = {}): Eleve => ({ id, nom: id, prenom: 'X', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [], ...extra });

/** Une école à neuf périodes, qui commence à `debut` (HH:MM) : chaque période dure 50 minutes, sans pause. */
function ecole(id: string, nom: string, debut: string, nb = 9): Ecole {
  const periodes: Periode[] = PERIODES_AGENDA.map((p, i) => {
    if (i >= nb) return { label: p.label, debut: '', fin: '' };
    const d = Number(debut.slice(0, 2)) * 60 + Number(debut.slice(3)) + i * 50;
    const h = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return { label: p.label, debut: h(d), fin: h(d + 50) };
  });
  return { id, nom, periodes };
}

describe('neuf périodes', () => {
  it('il y a neuf périodes ; la neuvième n’est pas utilisée par les horaires habituels', () => {
    assert.equal(NB_PERIODES, 9);
    assert.equal(PERIODES_AGENDA[8]!.label, '9e H');
    assert.equal(nbPeriodesUtilisees(PERIODES_AGENDA), 8);
    assert.deepEqual(verifierHoraires(PERIODES_AGENDA), []);
  });
  it('un ancien réglage à huit périodes est relu avec une neuvième période non utilisée', () => {
    const ancien = PERIODES_AGENDA.slice(0, 8).map((p) => ({ ...p, debut: p.debut.replace('08:00', '07:45') }));
    const lu = normaliserHoraires(ancien);
    assert.equal(lu.length, 9);
    assert.equal(lu[0]!.debut, '07:45');
    assert.deepEqual(lu[8], { label: '9e H', debut: '', fin: '' });
    assert.equal(lireHoraires(ancien)?.length, 9);
  });
  it('une école peut utiliser les neuf périodes', () => {
    const h = horairesParDefaut();
    h[8] = { label: '9e H', debut: '15:45', fin: '16:35' };
    assert.deepEqual(verifierHoraires(h), []);
    assert.equal(nbPeriodesUtilisees(h), 9);
  });
  it('refuse un trou au milieu, une première période vide, une neuvième qui commence trop tôt', () => {
    const trou = horairesParDefaut(); trou[3] = { label: '4e H', debut: '', fin: '' };
    assert.equal(verifierHoraires(trou)[0]?.index, 3);
    const toutVide = horairesParDefaut().map((p) => ({ ...p, debut: '', fin: '' }));
    assert.equal(verifierHoraires(toutVide)[0]?.index, 0);
    const tot = horairesParDefaut(); tot[8] = { label: '9e H', debut: '15:00', fin: '15:50' };
    assert.match(verifierHoraires(tot)[0]!.message, /commence avant la fin de 8e H/);
  });
  it('une période non utilisée n’ajoute jamais de pause', () => {
    assert.equal(pauseAvant(PERIODES_AGENDA, 8), 0);
  });
  it('une seule moitié d’heure est refusée', () => {
    const h = horairesParDefaut(); h[8] = { label: '9e H', debut: '16:00', fin: '' };
    assert.equal(verifierHoraires(h)[0]?.index, 8);
  });
});

describe('écoles : réglage', () => {
  it('sans réglage : une école avec les horaires habituels', () => {
    const e = normaliserEcoles(undefined);
    assert.equal(e.ecoles.length, 1);
    assert.equal(e.trajet, TRAJET_PAR_DEFAUT);
    assert.deepEqual(e.ecoles[0]!.periodes, PERIODES_AGENDA);
  });
  it('migration : l’ancien réglage « horaires » devient l’école par défaut', () => {
    const ancien = PERIODES_AGENDA.slice(0, 8).map((p, i) => (i === 0 ? { ...p, debut: '07:45', fin: '08:40' } : i === 1 ? { ...p, debut: '08:40' } : p));
    const e = normaliserEcoles(undefined, ancien);
    assert.equal(e.ecoles.length, 1);
    assert.equal(e.ecoles[0]!.periodes[0]!.debut, '07:45');
    assert.equal(e.ecoles[0]!.periodes.length, 9);
  });
  it('le nouveau réglage prime sur l’ancien', () => {
    const nouveau = { ecoles: [ecole('a', 'Alpha', '08:30')], trajet: 20 };
    const e = normaliserEcoles(nouveau, PERIODES_AGENDA);
    assert.equal(e.ecoles[0]!.nom, 'Alpha');
    assert.equal(e.ecoles[0]!.periodes[0]!.debut, '08:30');
    assert.equal(e.trajet, 20);
  });
  it('un réglage abîmé ne bloque jamais : horaires habituels, trajet par défaut', () => {
    assert.equal(normaliserEcoles('x').ecoles.length, 1);
    assert.equal(normaliserEcoles({ ecoles: [] }).ecoles.length, 1);
    const abime = normaliserEcoles({ ecoles: [{ id: 'a', nom: '', periodes: 'n’importe quoi' }, 12], trajet: -4 });
    assert.equal(abime.ecoles[0]!.nom, 'École 1');
    assert.deepEqual(abime.ecoles[0]!.periodes, PERIODES_AGENDA);
    assert.equal(abime.ecoles[1]!.nom, 'École 2');
    assert.equal(abime.trajet, TRAJET_PAR_DEFAUT);
  });
  it('deux écoles de même identifiant reçoivent chacune le leur', () => {
    const e = normaliserEcoles({ ecoles: [ecole('a', 'A', '08:00'), ecole('a', 'B', '09:00')], trajet: 30 });
    assert.equal(new Set(e.ecoles.map((x) => x.id)).size, 2);
  });
  it('vérifie les noms (vides, doublons sans accents ni majuscules) et les horaires', () => {
    assert.deepEqual(verifierEcoles([ecole('a', 'École A', '08:00')]), []);
    assert.match(verifierEcoles([ecole('a', ' ', '08:00')])[0]!.message, /nom/);
    assert.match(verifierEcoles([ecole('a', 'Ecole A', '08:00'), ecole('b', 'école a', '09:00')])[0]!.message, /Deux écoles/);
    const mauvaise = ecole('b', 'B', '09:00'); mauvaise.periodes[2] = { label: '3e H', debut: '09:00', fin: '09:30' };
    const erreurs = verifierEcoles([ecole('a', 'A', '08:00'), mauvaise]);
    assert.ok(erreurs.length > 0 && erreurs.every((x) => x.ecoleId === 'b'));
    assert.match(erreurs[0]!.message, /^B — /);
    assert.equal(verifierEcoles([])[0]?.message, 'Il faut au moins une école.');
  });
});

describe('écoles : quelle école pour qui', () => {
  const A = ecole('a', 'Saint-Joseph', '08:00');
  const B = ecole('b', 'Notre-Dame', '08:30');
  it('par identifiant, sinon par nom (sans accents ni majuscules), sinon l’école par défaut', () => {
    assert.equal(ecoleDeEleve(eleve('x', { ecoleId: 'b' }), [A, B]).id, 'b');
    assert.equal(ecoleDeEleve(eleve('x', { ecole: 'notre-dame' }), [A, B]).id, 'b');
    assert.equal(ecoleDeEleve(eleve('x', { ecole: 'Inconnue' }), [A, B]).id, 'a');
    assert.equal(ecoleDeEleve(eleve('x'), [A, B]).id, 'a');
    assert.equal(ecoleDeEleve(eleve('x', { ecoleId: 'disparue' }), [A, B]).id, 'a');
    assert.equal(rattachement(eleve('x', { ecole: 'Inconnue' }), [A, B]), undefined);
    assert.equal(ecoleDeEleve(undefined, [A, B]).id, 'a');
  });
  it('une activité d’élève suit l’école de l’élève ; une autre, son école ou l’école par défaut', () => {
    const el = eleve('x', { ecoleId: 'b' });
    const [o1] = occurrences([creer({ type: 'eleve', eleveId: 'x', date: '2026-10-26', debut: 0, fin: 0 })], '2026-10-26', '2026-10-26');
    const [o2] = occurrences([creer({ type: 'collaboration', titre: 'Réunion', date: '2026-10-26', debut: 0, fin: 0, ecoleId: 'b' })], '2026-10-26', '2026-10-26');
    const [o3] = occurrences([creer({ type: 'formation', titre: 'F', date: '2026-10-26', debut: 0, fin: 0 })], '2026-10-26', '2026-10-26');
    const [o4] = occurrences([creer({ type: 'libre', titre: 'F', date: '2026-10-26', debut: 0, fin: 0, ecoleId: 'effacee' })], '2026-10-26', '2026-10-26');
    assert.equal(ecoleDeOccurrence(o1!, [el], [A, B]).id, 'b');
    assert.equal(ecoleDeOccurrence(o2!, [el], [A, B]).id, 'b');
    assert.equal(ecoleDeOccurrence(o3!, [el], [A, B]).id, 'a');
    assert.equal(ecoleDeOccurrence(o4!, [el], [A, B]).id, 'a');
  });
  it('heures réelles d’une activité dans son école', () => {
    assert.deepEqual(heuresDe(B, 0, 1), { debut: '08:30', fin: '10:10' });
    assert.equal(heuresDe(ecole('c', 'C', '08:00', 5), 0, 6), null);
  });
  it('la grille prend les heures de la première école qui utilise chaque période', () => {
    const courte = ecole('a', 'A', '08:00', 5);
    const longue = ecole('b', 'B', '08:30', 9);
    const ref = horairesReference([courte, longue]);
    assert.equal(ref.length, 9);
    assert.equal(ref[0]!.debut, '08:00');
    assert.equal(ref[4]!.debut, '11:20');
    assert.equal(ref[5]!.debut, '12:40'); // vient de B : A n'a que cinq périodes
    assert.equal(horairesReference([courte]).length, 5);
    assert.equal(horairesReference([courte], 6).length, 7); // une activité plus loin reste visible
    assert.deepEqual(horairesReference([courte], 6)[6], { label: '7e H', debut: '', fin: '' });
  });
});

describe('écoles : avertissements', () => {
  const A = ecole('a', 'Saint-Joseph', '08:00', 5); // 08:00–12:10 (la 5e H finit à 12:10)
  const B = ecole('b', 'Notre-Dame', '12:30', 5);   // 12:30 : la 1e H commence 20 minutes après la fin de la 5e H de A
  const eleves = [eleve('un', { prenom: 'Léa', nom: 'Dupont', ecoleId: 'a' }), eleve('deux', { prenom: 'Max', nom: 'Martin', ecoleId: 'b' })];
  const occ = (...acts: ReturnType<typeof creer>[]) => occurrences(acts, '2026-10-26', '2026-10-30');
  const act = (eleveId: string, debut: number, fin = debut, date = '2026-10-27') => creer({ type: 'eleve', eleveId, date, debut, fin });

  it('une seule école : jamais d’avertissement', () => {
    assert.deepEqual(avertissementsEcoles(occ(act('un', 0), act('un', 1)), eleves, [A], 30), []);
  });
  it('deux écoles, trajet trop court : seulement 10 minutes', () => {
    const w = avertissementsEcoles(occ(act('un', 4), act('deux', 0)), eleves, [A, B], 30);
    assert.equal(w.length, 1);
    assert.equal(w[0]!.genre, 'trajet');
    assert.match(w[0]!.texte, /seulement 20 min/);
    assert.match(w[0]!.texte, /Léa Dupont/);
    assert.match(w[0]!.texte, /Notre-Dame/);
    assert.match(w[0]!.texte, /trajet prévu : 30 min/);
  });
  it('assez de temps pour le trajet : rien', () => {
    assert.deepEqual(avertissementsEcoles(occ(act('un', 3), act('deux', 0)), eleves, [A, B], 30), []); // 11:20 → 12:30 : plus d'une heure
    assert.deepEqual(avertissementsEcoles(occ(act('un', 4), act('deux', 0)), eleves, [A, B], 20), []); // exactement 20 min, trajet de 20
    assert.deepEqual(avertissementsEcoles(occ(act('un', 4), act('deux', 0)), eleves, [A, B], 0), []);
  });
  it('rendez-vous qui se chevauchent dans deux écoles', () => {
    const w = avertissementsEcoles(occ(act('un', 3, 4), act('deux', 0)), eleves, [A, B], 30); // A jusqu'à 12:10, B dès 12:30 : pas de chevauchement, mais trajet court
    assert.equal(w[0]!.genre, 'trajet');
    const Bplus = ecole('b', 'Notre-Dame', '12:00', 5); // B dès 12:00 : chevauche la 5e H de A
    const x = avertissementsEcoles(occ(act('un', 4), act('deux', 0)), eleves, [A, Bplus], 30);
    assert.equal(x.length, 1);
    assert.equal(x[0]!.genre, 'chevauchement');
    assert.match(x[0]!.texte, /se chevauchent/);
  });
  it('deux jours différents ou une activité annulée : rien', () => {
    assert.deepEqual(avertissementsEcoles(occ(act('un', 4), act('deux', 0, 0, '2026-10-28')), eleves, [A, B], 30), []);
    const annulee = act('deux', 0); annulee.etats = { '2026-10-27': 'annule' };
    assert.deepEqual(avertissementsEcoles(occ(act('un', 4), annulee), eleves, [A, B], 30), []);
  });
  it('deux activités dans la même école ne sont pas concernées', () => {
    assert.deepEqual(avertissementsEcoles(occ(act('un', 0), act('un', 0)), eleves, [A, B], 30), []);
  });
  it('une activité sans heures dans son école est ignorée (jamais de plantage)', () => {
    assert.deepEqual(avertissementsEcoles(occ(act('un', 7), act('deux', 0)), eleves, [A, B], 30), []);
  });
});

describe('écoles : dossiers des élèves suivent', () => {
  const A = ecole('a', 'Saint-Joseph', '08:00');
  const B = ecole('b', 'Notre-Dame', '08:30');
  const eleves = [eleve('un', { ecoleId: 'a', ecole: 'Saint-Joseph' }), eleve('deux', { ecole: 'notre-dame' }), eleve('trois', { ecole: 'Ailleurs' }), eleve('quatre')];
  it('école renommée : le nom du dossier suit, et un élève rattaché par le nom reçoit l’identifiant', () => {
    const apres = elevesApresChangement(eleves, [A, B], [{ ...A, nom: 'Saint-Joseph (primaire)' }, B]);
    assert.deepEqual(apres.map((e) => [e.id, e.ecoleId, e.ecole]), [['un', 'a', 'Saint-Joseph (primaire)'], ['deux', 'b', 'Notre-Dame']]);
  });
  it('école supprimée : le rattachement est retiré, le texte du dossier reste', () => {
    const apres = elevesApresChangement(eleves, [A, B], [A]);
    assert.deepEqual(apres.map((e) => [e.id, e.ecoleId, e.ecole]), [['deux', undefined, 'notre-dame']].slice(0, 0));
    // « deux » n'avait que le nom : rien à retirer ; seuls les élèves rattachés par identifiant changent
    const sans = elevesApresChangement([eleve('x', { ecoleId: 'b', ecole: 'Notre-Dame' })], [A, B], [A]);
    assert.deepEqual(sans.map((e) => [e.id, e.ecoleId, e.ecole]), [['x', undefined, 'Notre-Dame']]);
  });
  it('rien ne change : rien à enregistrer', () => {
    assert.deepEqual(elevesApresChangement(eleves, [A, B], [A, B]).map((e) => e.id), ['deux']); // « deux » reçoit son identifiant
    assert.deepEqual(elevesApresChangement([eleve('un', { ecoleId: 'a', ecole: 'Saint-Joseph' })], [A, B], [A, B]), []);
  });
});

describe('écoles : enregistrement', () => {
  it('au départ, une école avec les horaires habituels ; `horaires` reste ceux de l’école par défaut', async () => {
    const magasin = creerMagasin(creerDepotMemoire());
    await magasin.charger();
    assert.equal(magasin.lire().ecoles.length, 1);
    assert.deepEqual(magasin.lire().horaires, PERIODES_AGENDA);
  });
  it('l’ancien réglage « horaires » est relu comme l’école par défaut', async () => {
    const ancien = PERIODES_AGENDA.slice(0, 8).map((p, i) => (i === 0 ? { ...p, debut: '07:45', fin: '08:40' } : i === 1 ? { ...p, debut: '08:40' } : p));
    const magasin = creerMagasin(creerDepotMemoire([], [], [], [], [{ id: 'agenda-horaires', valeur: ancien }]));
    await magasin.charger();
    assert.equal(magasin.lire().horaires[0]!.debut, '07:45');
    assert.equal(magasin.lire().ecoles[0]!.periodes[8]!.debut, '');
  });
  it('enregistre deux écoles et les retrouve après rechargement', async () => {
    const depot = creerDepotMemoire();
    const magasin = creerMagasin(depot);
    await magasin.charger();
    const refus = await magasin.changerEcoles([ecole('a', 'Saint-Joseph', '08:00'), ecole('b', 'Notre-Dame', '08:30', 8)], 25);
    assert.deepEqual(refus, []);
    assert.equal(magasin.lire().trajet, 25);
    const relu = creerMagasin(depot);
    await relu.charger();
    assert.deepEqual(relu.lire().ecoles.map((e) => e.nom), ['Saint-Joseph', 'Notre-Dame']);
    assert.equal(relu.lire().ecoles[1]!.periodes[0]!.debut, '08:30');
    assert.equal(relu.lire().trajet, 25);
    assert.deepEqual((await depot.chargerReglages()).map((r) => r.id), ['agenda-ecoles']);
  });
  it('refuse un réglage incohérent : rien n’est écrit', async () => {
    const depot = creerDepotMemoire();
    const magasin = creerMagasin(depot);
    await magasin.charger();
    const mauvaise = ecole('b', '', '08:30');
    const refus = await magasin.changerEcoles([ecole('a', 'A', '08:00'), mauvaise], 30);
    assert.ok(refus.length > 0);
    assert.deepEqual(await depot.chargerReglages(), []);
    assert.equal(magasin.lire().ecoles.length, 1);
  });
  it('renommer ou supprimer une école met à jour les dossiers des élèves', async () => {
    const depot = creerDepotMemoire([eleve('un', { ecoleId: 'a', ecole: 'Saint-Joseph' }), eleve('deux', { ecoleId: 'b', ecole: 'Notre-Dame' })]);
    const magasin = creerMagasin(depot);
    await magasin.charger();
    await magasin.changerEcoles([ecole('a', 'Saint-Joseph', '08:00'), ecole('b', 'Notre-Dame', '08:30')], 30);
    await magasin.changerEcoles([ecole('a', 'Saint-Jo', '08:00')], 30);
    const un = magasin.lire().eleves.find((e) => e.id === 'un')!;
    const deux = magasin.lire().eleves.find((e) => e.id === 'deux')!;
    assert.equal(un.ecole, 'Saint-Jo');
    assert.equal(deux.ecoleId, undefined);
    assert.equal(deux.ecole, 'Notre-Dame');
    const enBase = await depot.chargerEleves();
    assert.equal(enBase.find((e) => e.id === 'un')!.ecole, 'Saint-Jo');
  });
  it('changerHoraires règle l’école par défaut sans toucher aux autres', async () => {
    const magasin = creerMagasin(creerDepotMemoire());
    await magasin.charger();
    await magasin.changerEcoles([ecole('a', 'A', '08:00'), ecole('b', 'B', '09:00')], 30);
    const h = horairesParDefaut(); h[0] = { ...h[0]!, debut: '07:45', fin: '08:40' };
    assert.deepEqual(await magasin.changerHoraires(h), []);
    assert.equal(magasin.lire().ecoles[0]!.periodes[0]!.debut, '07:45');
    assert.equal(magasin.lire().ecoles[1]!.periodes[0]!.debut, '09:00');
    assert.equal(magasin.lire().horaires[0]!.debut, '07:45');
  });
  it('un réglage reçu d’un autre appareil met à jour les écoles', async () => {
    const magasin = creerMagasin(creerDepotMemoire());
    await magasin.charger();
    const valeur = { ecoles: [ecole('a', 'A', '08:00'), ecole('b', 'B', '09:00')], trajet: 40 };
    await magasin.appliquerSynchro([{ type: 'reglage', id: 'agenda-ecoles', donnees: { id: 'agenda-ecoles', valeur } }], []);
    assert.equal(magasin.lire().ecoles.length, 2);
    assert.equal(magasin.lire().trajet, 40);
  });
});

describe('écoles : Outlook et synchronisation', () => {
  const A = ecole('a', 'A', '08:00');
  const B = ecole('b', 'B', '09:30');
  const eleves = [eleve('un', { ecoleId: 'a' }), eleve('deux', { ecoleId: 'b' })];
  it('chaque rendez-vous prend les vraies heures de son école', () => {
    const acts = [creer({ type: 'eleve', eleveId: 'un', date: '2026-10-26', debut: 0, fin: 1 }), creer({ type: 'eleve', eleveId: 'deux', date: '2026-10-26', debut: 0, fin: 1 })];
    const ev = evenementsSouhaites(acts, eleves, [], (o) => ecoleDeOccurrence(o, eleves, [A, B]).periodes, '2026-10-26', '2026-10-30', { actif: true, nom: 'aucun', lieu: true });
    assert.deepEqual(ev.map((e) => [e.debut, e.fin]).sort(), [['2026-10-26T08:00', '2026-10-26T09:40'], ['2026-10-26T09:30', '2026-10-26T11:10']]);
  });
  it('une période sans heures n’est jamais envoyée à Outlook', () => {
    const court = ecole('c', 'C', '08:00', 3);
    const a = creer({ type: 'libre', titre: 'X', date: '2026-10-26', debut: 5, fin: 5 });
    assert.deepEqual(evenementsSouhaites([a], [], [], court.periodes, '2026-10-26', '2026-10-30', { actif: true, nom: 'aucun', lieu: true }), []);
  });
  it('le réglage des écoles reçu de OneDrive : accepté s’il est lisible, refusé sinon', () => {
    const bon = { id: 'agenda-ecoles', valeur: { ecoles: [A, B], trajet: 30 } };
    assert.deepEqual((normaliserObjet('reglage', bon) as { valeur: { ecoles: unknown[] } }).valeur.ecoles.length, 2);
    assert.equal(normaliserObjet('reglage', { id: 'agenda-ecoles', valeur: { ecoles: [], trajet: 30 } }), null);
    assert.equal(normaliserObjet('reglage', { id: 'agenda-ecoles', valeur: { ecoles: [A, { ...A, id: 'z' }], trajet: 30 } }), null); // même nom
    assert.equal(normaliserObjet('reglage', { id: 'agenda-ecoles', valeur: { ecoles: [{ ...A, periodes: [] }], trajet: 30 } }), null);
    assert.equal(normaliserObjet('reglage', { id: 'agenda-ecoles', valeur: { ecoles: [A], trajet: 'beaucoup' } }), null);
  });
  it('l’ancien réglage « horaires » à huit périodes reste accepté', () => {
    const huit = PERIODES_AGENDA.slice(0, 8);
    const lu = normaliserObjet('reglage', { id: 'agenda-horaires', valeur: huit }) as { valeur: Periode[] };
    assert.equal(lu.valeur.length, 9);
    assert.equal(normaliserObjet('reglage', { id: 'agenda-horaires', valeur: [] }), null);
  });
  it('l’élève garde son école à travers la synchronisation (champ ecoleId conservé)', () => {
    const lu = normaliserObjet('eleve', eleve('x', { ecoleId: 'b', ecole: 'B' })) as Eleve;
    assert.equal(lu.ecoleId, 'b');
  });
});

describe('reprise V75 : huit périodes', () => {
  it('les huit périodes de la V75 donnent des horaires à neuf périodes, la neuvième non utilisée', () => {
    const periods = PERIODES_AGENDA.slice(0, 8).map((p) => ({ label: p.label, start: p.debut, end: p.fin }));
    const { horaires } = lirePeriodesV75({ periods });
    assert.equal(horaires?.length, 9);
    assert.equal(horaires?.[8]?.debut, '');
    assert.equal(lirePeriodesV75({ periods: periods.slice(0, 5) }).horaires, null);
  });
  it('ecolesParDefaut reste valide', () => {
    assert.deepEqual(verifierEcoles(ecolesParDefaut().ecoles), []);
  });
});
