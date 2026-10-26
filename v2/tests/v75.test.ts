import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { occurrences } from '../src/domain/agenda/index.ts';
import { lireCopie, normaliserObjet } from '../src/domain/synchro/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { convertirAgenda, controlerReprise, convertirEleve, convertirSeance, copieDeReprise, creerAnnuaire, doublonDe, estEcart, fichePiaV75, finAnneeScolaire, preparerReprise, tombeLe } from '../src/domain/v75/index.ts';
import type { EleveRepris } from '../src/domain/v75/index.ts';
import { creerMagasin } from '../src/state/store.ts';
import { appliquerRestauration, preparerRestauration } from '../src/synchro/secours.ts';
import { etatV75, evenementV75, seanceV75 } from './fabrique-v75.ts';

const CTX = { aujourdhui: '2026-10-26', maintenant: '2026-10-26T20:00:00.000Z' };

function elevesRepris(): EleveRepris[] {
  return etatV75().eleves.map((e) => { const r = convertirEleve(e); assert.ok(!estEcart(r)); return r as EleveRepris; });
}
const contexteSeances = () => ({ annuaire: creerAnnuaire(elevesRepris()), periodesV75: ['1e H', '2e H', '3e H', '4e H', '5e H', '6e H', '7e H', '8e H'], maintenant: CTX.maintenant });

describe('reprise V75 : élèves', () => {
  it('garde le nom entier, reprend le dossier et reconnaît les langues', () => {
    const r = convertirEleve(etatV75().eleves[0]);
    assert.ok(!estEcart(r));
    assert.deepEqual(r.eleve, {
      id: 'v75-1001', nom: 'Séfora', prenom: '', classe: '3CB', ecole: 'Athénée Royal', titulaire: 'M. Dupont', dateNaissance: '2012-03-04',
      matieres: ['Mathématiques', 'Français'], langues: ['Néerlandais']
    });
    assert.equal(r.idV75, '1001');
  });

  it('utilise l’identifiant d’élève de la V75 tel quel, même s’il n’est pas numérique', () => {
    const r = convertirEleve(etatV75().eleves[1]);
    assert.ok(!estEcart(r));
    assert.equal(r.eleve.id, 'v75-student_1002');
    assert.deepEqual(r.eleve.matieres, ['Sciences économiques']);
  });

  it('refuse un dossier sans nom ou sans identifiant, en le disant', () => {
    assert.match((convertirEleve({ id: 5, studentId: '5' }) as { raison: string }).raison, /sans nom/);
    assert.match((convertirEleve({ nom: 'X' }) as { raison: string }).raison, /sans identifiant/);
    assert.match((convertirEleve('n’importe quoi') as { raison: string }).raison, /sans/);
  });

  it('laisse vide une date de naissance illisible et le signale', () => {
    const r = convertirEleve({ studentId: '7', nom: 'Z', dateNaissance: '12/03/2012' });
    assert.ok(!estEcart(r));
    assert.equal(r.eleve.dateNaissance, '');
    assert.ok(r.alertes.some((a) => /naissance/.test(a)));
  });

  it('l’élève converti est accepté tel quel par la V2', () => {
    for (const r of elevesRepris()) assert.notEqual(normaliserObjet('eleve', r.eleve), null);
  });
});

describe('reprise V75 : séances', () => {
  it('convertit une séance complète sans rien perdre', () => {
    const r = convertirSeance(seanceV75(5001), contexteSeances());
    assert.ok(!estEcart(r));
    const s = r.seance;
    assert.equal(s.id, 'v75-s-5001');
    assert.equal(s.eleveId, 'v75-1001');
    assert.equal(s.date, '2026-09-22');
    assert.equal(s.periodeDebut, '2e H');
    assert.equal(s.matiere, 'Mathématiques');
    assert.equal(s.niveauScolaire, 'S3');
    assert.equal(s.presence, 'present');
    assert.deepEqual(s.interventions, ['Accompagnement individuel']);
    assert.equal(s.objectifLecon, 'Résoudre une équation');
    assert.equal(s.monObjectif, 'Aider à isoler l’inconnue');
    assert.deepEqual(s.observations, [{ texte: 'Contrôle sa production', niveau: 1 }, { texte: 'Demande de l’aide', niveau: 2 }]);
    assert.equal(s.remarque, 'Fatigue en fin de période');
    assert.deepEqual(s.competences, [{ texte: 'Résoudre une équation du premier degré', niveau: 1 }]);
    assert.equal(s.situationAide, 'new');
    assert.deepEqual(s.aides, [{ nom: 'Support visuel', effet: 2 }, { nom: 'Guidage verbal', effet: 1 }]);
    assert.equal(s.precisionAide, 'Schéma de la balance');
    assert.equal(s.transfert, 'observed');
    assert.deepEqual(s.suite, { actions: ['Maintenir l’accompagnement'], modalite: 'Individuel', objectif: 'Consolider', collaborations: ['Échange avec l’enseignant'], precision: '' });
    assert.equal(s.creeLe, '2026-09-22T09:00:00.000Z');
    assert.equal(s.modifieLe, '2026-09-22T09:30:00.000Z');
    assert.notEqual(normaliserObjet('seance', s), null);
  });

  it('retrouve l’élève par son nom (accents et majuscules ignorés) quand l’identifiant manque', () => {
    const r = convertirSeance(etatV75().seances[2], contexteSeances());
    assert.ok(!estEcart(r));
    assert.equal(r.seance.eleveId, 'v75-1001');
  });

  it('ne choisit pas entre deux élèves de même nom', () => {
    const deux = [...elevesRepris(), convertirEleve({ studentId: '2000', nom: 'SÉFORA' }) as EleveRepris];
    const r = convertirSeance(seanceV75(1, { identification: { eleve: 'séfora', date: '2026-09-22', periode: { start: '1e H', end: '1e H' } } }), { ...contexteSeances(), annuaire: creerAnnuaire(deux) });
    assert.ok(estEcart(r));
    assert.match(r.raison, /introuvable/);
  });

  it('une absence reprend la présence et efface la phrase que la V75 écrivait toute seule', () => {
    const r = convertirSeance(etatV75().seances[2], contexteSeances());
    assert.ok(!estEcart(r));
    assert.equal(r.seance.presence, 'absent_eleve');
    assert.equal(r.seance.objectifLecon, '');
    assert.deepEqual(r.seance.observations, []);
  });

  it('range le texte du transfert avec les précisions sur les aides et ne retient que les réponses que la V2 connaît', () => {
    const r = convertirSeance(etatV75().seances[1], contexteSeances());
    assert.ok(!estEcart(r));
    assert.equal(r.seance.transfert, null);
    assert.equal(r.seance.precisionAide, 'Schéma de la balance\nUtilisé ailleurs que pendant la séance : Pas de cours de français cette semaine');
    assert.ok(r.alertes.length > 0);
    assert.equal(r.seance.periodeFin, '2e H');
  });

  it('refuse, en le disant, une séance sans élève connu ou sans date lisible', () => {
    const sansEleve = convertirSeance(etatV75().seances[3], contexteSeances());
    assert.ok(estEcart(sansEleve));
    assert.match(sansEleve.raison, /Inconnu/);
    const sansDate = convertirSeance(etatV75().seances[4], contexteSeances());
    assert.ok(estEcart(sansDate));
    assert.match(sansDate.raison, /date/);
    assert.ok(estEcart(convertirSeance({ identification: {} }, contexteSeances())));
  });

  it('ramène les noms de périodes réglés dans la V75 aux noms de la V2, sinon garde le nom', () => {
    const ctx = { ...contexteSeances(), periodesV75: ['Matin 1', 'Matin 2', 'Matin 3', 'Matin 4', 'Midi 1', 'Midi 2', 'Soir 1', 'Soir 2'] };
    const r = convertirSeance(seanceV75(1, { identification: { eleve: 'Séfora', eleveId: '1001', date: '2026-09-22', periode: { start: 'Matin 2', end: 'Matin 3' } } }), ctx);
    assert.ok(!estEcart(r));
    assert.deepEqual([r.seance.periodeDebut, r.seance.periodeFin], ['2e H', '3e H']);
    const inconnue = convertirSeance(seanceV75(2, { identification: { eleve: 'Séfora', eleveId: '1001', date: '2026-09-22', periode: { start: 'Étude', end: 'Étude' } } }), ctx);
    assert.ok(!estEcart(inconnue));
    assert.equal(inconnue.seance.periodeDebut, 'Étude');
  });

  it('un niveau hors 0-2 reste « pas encore choisi » plutôt que d’être inventé', () => {
    const r = convertirSeance(seanceV75(3, { q2: { observations: [{ observation: 'Entre dans la tâche', niveau: 7 }], precision: '' } }), contexteSeances());
    assert.ok(!estEcart(r));
    assert.deepEqual(r.seance.observations, [{ texte: 'Entre dans la tâche', niveau: null }]);
  });
});

describe('reprise V75 : agenda', () => {
  const ctx = () => ({ annuaire: creerAnnuaire(elevesRepris()), ...CTX });

  it('une activité unique annulée reste annulée', () => {
    const r = convertirAgenda({ __events: [evenementV75('u', { eventStatus: 'cancelled' })] }, ctx());
    const a = r.activites[0]!.activite;
    assert.equal(a.id, 'v75-a-u');
    assert.equal(a.repetition, 'aucune');
    assert.equal(a.date, '2026-10-27');
    assert.deepEqual(a.etats, { '2026-10-27': 'annule' });
    assert.deepEqual([a.debut, a.fin], [1, 2]);
    assert.equal(a.eleveId, 'v75-1001');
    assert.equal(a.lieu, 'Local 12');
  });

  it('une série hebdomadaire simple reste une série, avec sa date de fin et les dates retirées', () => {
    const r = convertirAgenda(etatV75().agenda, ctx());
    const s = r.activites.find((a) => a.activite.id === 'v75-a-serie_lundi')!.activite;
    assert.equal(s.repetition, 'hebdomadaire');
    assert.equal(s.date, '2026-09-07');
    assert.equal(s.jusquau, '2027-01-29');
    assert.deepEqual(s.exceptions, ['2026-11-02', '2026-11-09']);
    const vues = occurrences([s], '2026-11-01', '2026-11-30').map((o) => o.date);
    assert.deepEqual(vues, ['2026-11-16', '2026-11-23', '2026-11-30']);
  });

  it('une série le mardi commence le premier mardi, même si la V75 ne donnait que le lundi de départ', () => {
    const r = convertirAgenda({ __events: [evenementV75('m', { recurrence: 'weekly', dayIndex: 1, date: '', recurrenceRange: { type: 'noEnd', startDate: '2026-09-07' } })] }, ctx());
    assert.equal(r.activites[0]!.activite.date, '2026-09-08');
    assert.equal(r.activites[0]!.activite.jusquau, undefined);
  });

  it('une répétition sur deux jours est reprise date par date, sans date en trop', () => {
    const r = convertirAgenda(etatV75().agenda, ctx());
    const dates = r.activites.filter((a) => a.activite.id.startsWith('v75-a-deux_jours-')).map((a) => a.activite.date);
    assert.deepEqual(dates, ['2026-10-06', '2026-10-08', '2026-10-13', '2026-10-15', '2026-10-20', '2026-10-22']);
    assert.ok(r.activites.find((a) => a.activite.id === 'v75-a-deux_jours-2026-10-06')!.alertes[0]!.includes('date par date'));
  });

  it('une répétition toutes les deux semaines va jusqu’au 31 juillet', () => {
    const r = convertirAgenda(etatV75().agenda, ctx());
    const dates = r.activites.filter((a) => a.activite.id.startsWith('v75-a-quinzaine-')).map((a) => a.activite.date);
    assert.equal(dates.length, 22);
    assert.equal(dates[0], '2026-10-07');
    assert.equal(dates[1], '2026-10-21');
    assert.equal(dates.at(-1), '2027-07-28');
    assert.ok(dates.every((d) => d <= '2027-07-31'));
  });

  it('le calcul des dates est celui de la V75 (nombre d’occurrences, mois, année)', () => {
    const hebdo = { recurrence: 'weekly', dayIndex: 0, recurrencePattern: { interval: 1, daysOfWeek: [0, 2] }, recurrenceRange: { type: 'count', startDate: '2026-09-07', numberOfOccurrences: 3 } };
    const dates = (ev: Record<string, unknown>, du: string, au: string, retirees: string[] = []): string[] => {
      const out: string[] = [];
      for (let d = new Date(`${du}T12:00:00Z`); d <= new Date(`${au}T12:00:00Z`); d = new Date(d.getTime() + 86_400_000)) {
        const iso = d.toISOString().slice(0, 10);
        if (tombeLe(ev, iso, retirees)) out.push(iso);
      }
      return out;
    };
    assert.deepEqual(dates(hebdo, '2026-09-01', '2026-10-30'), ['2026-09-07', '2026-09-09', '2026-09-14']);
    const mensuel = { recurrence: 'monthly', dayIndex: 1, recurrencePattern: { interval: 1, index: 'first', daysOfWeek: [1] }, recurrenceRange: { type: 'noEnd', startDate: '2026-09-01' } };
    assert.deepEqual(dates(mensuel, '2026-09-01', '2026-11-30'), ['2026-09-01', '2026-10-06', '2026-11-03']);
    const annuel = { recurrence: 'yearly', date: '2026-10-15', recurrenceRange: { type: 'noEnd', startDate: '2026-10-15' } };
    assert.deepEqual(dates(annuel, '2026-01-01', '2028-12-31'), ['2026-10-15', '2027-10-15', '2028-10-15']);
    assert.deepEqual(dates({ recurrence: 'daily', recurrencePattern: { interval: 3 }, recurrenceRange: { type: 'noEnd', startDate: '2026-10-01' } }, '2026-10-01', '2026-10-10'), ['2026-10-01', '2026-10-04', '2026-10-07', '2026-10-10']);
    assert.deepEqual(dates({ recurrence: 'unique', date: '2026-10-05' }, '2026-10-01', '2026-10-10', ['2026-10-05']), []);
  });

  it('sans élève retrouvé, le nom reste noté ; samedi et dimanche sont écartés avec leur raison', () => {
    const r = convertirAgenda(etatV75().agenda, ctx());
    const libre = r.activites.find((a) => a.activite.id === 'v75-a-libre')!;
    assert.equal(libre.activite.eleveId, undefined);
    assert.equal(libre.activite.nomLibre, 'Quelqu’un');
    assert.ok(libre.alertes.some((a) => /introuvable/.test(a)));
    assert.equal(r.ecarts.length, 1);
    assert.match(r.ecarts[0]!.raison, /samedi/);
  });

  it('reprend les horaires de la V75 et les ignore s’ils sont incohérents', () => {
    const bons = convertirAgenda(etatV75().agenda, ctx());
    assert.equal(bons.horaires?.[0]?.debut, '08:15');
    assert.equal(bons.horaires?.[0]?.label, '1e H');
    const mauvais = convertirAgenda({ __config: { periods: Array.from({ length: 8 }, (_, i) => ({ label: `P${i}`, start: '10:00', end: '09:00' })) }, __events: [] }, ctx());
    assert.equal(mauvais.horaires, null);
    assert.equal(convertirAgenda({}, ctx()).horaires, null);
  });

  it('toutes les activités reprises sont acceptées par la V2', () => {
    for (const a of convertirAgenda(etatV75().agenda, ctx()).activites) assert.notEqual(normaliserObjet('activite', a.activite), null, a.activite.id);
  });

  it('une série annulée dans la V75 n’est pas reprise et on le dit', () => {
    const r = convertirAgenda({ __events: [evenementV75('c', { recurrence: 'weekly', dayIndex: 0, eventStatus: 'cancelled', date: '2026-09-07' })] }, ctx());
    assert.equal(r.activites.length, 0);
    assert.match(r.ecarts[0]!.raison, /annulée/);
  });

  it('la fin d’année scolaire est le 31 juillet qui suit', () => {
    assert.equal(finAnneeScolaire('2026-10-26'), '2027-07-31');
    assert.equal(finAnneeScolaire('2027-03-01'), '2027-07-31');
    assert.equal(finAnneeScolaire('2026-08-24'), '2027-07-31');
  });
});

describe('reprise V75 : fiche PIA', () => {
  it('rend lisible ce que la V75 avait enregistré, sans rien convertir', () => {
    const etat = etatV75();
    const f = fichePiaV75(etat.eleves[0], etat.pias['1001']);
    assert.equal(f.contenu, true);
    assert.equal(f.annee, '2026-2027');
    for (const attendu of ['Gagner en autonomie', 'Lire un texte court à voix haute', 'Utiliser un schéma', 'Poursuivre en mathématiques', 'Tablette pour la lecture', 'CPMS Bruxelles', 'ATTEINT', 'Mme Martin']) {
      assert.ok(f.texte.includes(attendu), attendu);
    }
  });

  it('pas de PIA ni d’objectifs : rien à montrer', () => {
    const f = fichePiaV75(etatV75().eleves[1], undefined);
    assert.equal(f.contenu, false);
    assert.equal(f.texte, '');
  });
});

describe('reprise V75 : plan élève par élève', () => {
  const plan = () => preparerReprise(etatV75(), CTX);

  it('range séances et agenda par élève et dit ce qui n’a pas pu être repris', () => {
    const r = plan();
    assert.deepEqual(r.fiches.map((f) => f.eleve.nom), ['Nicoleta', 'Séfora']);
    const sefora = r.fiches.find((f) => f.eleve.id === 'v75-1001')!;
    assert.equal(sefora.seances.length, 3);
    assert.deepEqual(sefora.seances.map((s) => s.seance.date), ['2026-09-22', '2026-09-24', '2026-10-01']);
    assert.equal(sefora.premiere, '2026-09-22');
    assert.equal(sefora.derniere, '2026-10-01');
    assert.equal(sefora.activites.length, 8);
    assert.equal(sefora.pia.contenu, true);
    const nicoleta = r.fiches.find((f) => f.eleve.id === 'v75-student_1002')!;
    assert.equal(nicoleta.seances.length, 1);
    assert.equal(r.agendaGeneral.length, 23);
    assert.equal(r.ecarts.length, 3);
    assert.deepEqual(r.ecarts.map((e) => e.raison.split(' ')[0]).sort(), ['activité', 'date', 'élève']);
    assert.notEqual(r.horaires, null);
  });

  it('chaque séance et chaque activité sont comptées une seule fois, même si la V75 les répète', () => {
    const etat = etatV75();
    etat.seances.push(etat.seances[0]!);
    (etat.agenda as { __events: unknown[] }).__events.push(...(etat.agenda as { __events: unknown[] }).__events);
    const r = preparerReprise(etat, CTX);
    assert.equal(r.fiches.find((f) => f.eleve.id === 'v75-1001')!.seances.length, 3);
    assert.equal(r.fiches.find((f) => f.eleve.id === 'v75-1001')!.activites.length, 8);
  });

  it('la copie ne contient que les élèves cochés, jamais de PIA, et les horaires seulement si on les veut', () => {
    const r = plan();
    const copie = copieDeReprise(r, { eleves: new Set(['v75-1001']), agendaGeneral: false, horaires: false }, CTX.maintenant);
    assert.deepEqual(copie.eleves.map((e) => e.id), ['v75-1001']);
    assert.equal(copie.seances.length, 3);
    assert.equal(copie.activites.length, 8);
    assert.deepEqual(copie.pias, []);
    assert.deepEqual(copie.reglages, []);
    const tout = copieDeReprise(r, { eleves: new Set(r.fiches.map((f) => f.eleve.id)), agendaGeneral: true, horaires: true }, CTX.maintenant);
    assert.equal(tout.activites.length, 31);
    assert.equal(tout.reglages[0]?.id, 'agenda-horaires');
  });

  it('la copie passe la relecture de la V2 sans rien perdre', () => {
    const r = plan();
    const copie = copieDeReprise(r, { eleves: new Set(r.fiches.map((f) => f.eleve.id)), agendaGeneral: true, horaires: true }, CTX.maintenant);
    const lue = lireCopie(JSON.stringify(copie));
    assert.ok(lue.ok);
    assert.equal(lue.copie.seances.length, 4);
  });

  it('repère un élève déjà présent dans la V2 sous un autre identifiant', () => {
    const f = plan().fiches.find((x) => x.eleve.id === 'v75-1001')!;
    const existant: Eleve = { id: 'e1', nom: 'Dupont', prenom: 'séfora', classe: '', ecole: '', titulaire: '', dateNaissance: '', matieres: [] };
    assert.equal(doublonDe(f, [existant])?.id, 'e1');
    assert.equal(doublonDe(f, [{ ...existant, prenom: 'Autre' }]), null);
    assert.equal(doublonDe(f, [{ ...f.eleve }]), null, 'le même élève déjà repris n’est pas un doublon');
  });
});

describe('reprise V75 : import et contrôle', () => {
  async function importer(choix?: Set<string>) {
    const r = preparerReprise(etatV75(), CTX);
    const copie = copieDeReprise(r, { eleves: choix ?? new Set(r.fiches.map((f) => f.eleve.id)), agendaGeneral: true, horaires: true }, CTX.maintenant);
    const magasin = creerMagasin(creerDepotMemoire());
    await magasin.charger();
    const prevue = await preparerRestauration(magasin, JSON.stringify(copie));
    assert.ok(prevue.ok);
    return { r, copie, magasin, prevue: prevue.prevue };
  }

  it('importe tout, et le contrôle relit chaque élément', async () => {
    const { copie, magasin, prevue } = await importer();
    assert.equal(prevue.ignores, 0);
    const ecrits = await appliquerRestauration(magasin, prevue, false);
    assert.equal(ecrits, copie.eleves.length + copie.seances.length + copie.activites.length + copie.reglages.length);
    const controle = await controlerReprise(copie, await magasin.lireObjets());
    assert.equal(controle.ok, true);
    const sefora = controle.eleves.find((e) => e.eleveId === 'v75-1001')!;
    assert.deepEqual(sefora.seances, { attendues: 3, trouvees: 3 });
    assert.deepEqual(sefora.activites, { attendues: 8, trouvees: 8 });
    assert.deepEqual(controle.agendaGeneral, { attendues: 23, trouvees: 23 });
    assert.equal((await magasin.lireObjets()).reglages.some((x) => x.id === 'agenda-horaires'), true);
  });

  it('importer deux fois ne crée aucun doublon', async () => {
    const { copie, magasin, prevue } = await importer();
    await appliquerRestauration(magasin, prevue, false);
    const avant = await magasin.lireObjets();
    const encore = await preparerRestauration(magasin, JSON.stringify(copie));
    assert.ok(encore.ok);
    assert.equal(encore.prevue.comparaison.manquants.length, 0);
    assert.equal(encore.prevue.comparaison.differents.length, 0);
    await appliquerRestauration(magasin, encore.prevue, false);
    const apres = await magasin.lireObjets();
    assert.equal(apres.seances.length, avant.seances.length);
    assert.equal(apres.activites.length, avant.activites.length);
    assert.equal(apres.eleves.length, avant.eleves.length);
  });

  it('n’importe que l’élève choisi, avec son agenda et ses séances', async () => {
    const { magasin, prevue } = await importer(new Set(['v75-student_1002']));
    await appliquerRestauration(magasin, prevue, false);
    const objets = await magasin.lireObjets();
    assert.deepEqual(objets.eleves.map((e) => e.id), ['v75-student_1002']);
    assert.equal(objets.seances.length, 1);
    assert.ok(objets.seances.every((s) => s.eleveId === 'v75-student_1002'));
  });

  it('ne touche jamais à ce qui existe déjà dans la V2', async () => {
    const { copie, magasin, prevue } = await importer();
    await magasin.ajouterEleves([{ id: 'mien', nom: 'Existant', prenom: 'Déjà', classe: '1A', ecole: '', titulaire: '', dateNaissance: '', matieres: [] }]);
    await appliquerRestauration(magasin, prevue, false);
    const objets = await magasin.lireObjets();
    assert.ok(objets.eleves.some((e) => e.id === 'mien'));
    assert.equal(objets.eleves.length, copie.eleves.length + 1);
  });

  it('le contrôle voit un élément manquant ou changé après l’import', async () => {
    const { copie, magasin, prevue } = await importer();
    await appliquerRestauration(magasin, prevue, false);
    await magasin.supprimerSeance('v75-s-5001');
    const manque = await controlerReprise(copie, await magasin.lireObjets());
    assert.equal(manque.ok, false);
    assert.deepEqual(manque.eleves.find((e) => e.eleveId === 'v75-1001')!.seances, { attendues: 3, trouvees: 2 });
    const objets = await magasin.lireObjets();
    const change = { ...objets, seances: objets.seances.map((s) => (s.id === 'v75-s-5003' ? { ...s, remarque: 'modifié' } : s)) };
    const controleChange = await controlerReprise(copie, change);
    assert.equal(controleChange.ok, false);
    assert.equal(controleChange.eleves.find((e) => e.eleveId === 'v75-1001')!.differents, 1);
  });
});
