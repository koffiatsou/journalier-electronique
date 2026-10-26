import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANNEES_SCOLAIRES_FWB, CALENDRIER_CONNU_AU, CALENDRIER_CONNU_DU, NB_PERIODES, PERIODES_AGENDA, ajouterMois, anneeScolaireFWB, calendrierConnu, congesFWB,
  debutDuMois, enMinutes, finDuMois, horairesModifies, horairesParDefaut, indexJour, infosJour, joursFeries, libellePause, natureJour,
  normaliserHoraires, paques, pauseAvant, semainesDuMois, titreMois, verifierHoraires
} from '../src/domain/agenda/index.ts';
import type { Periode } from '../src/domain/agenda/index.ts';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { creerMagasin } from '../src/state/store.ts';

describe('jours fériés belges', () => {
  it('calcule Pâques', () => {
    assert.equal(paques(2025), '2025-04-20');
    assert.equal(paques(2026), '2026-04-05');
    assert.equal(paques(2027), '2027-03-28');
    assert.equal(paques(2028), '2028-04-16');
    assert.equal(paques(2029), '2029-04-01');
  });
  it('donne les dix jours fériés, dont les trois jours mobiles', () => {
    const f = joursFeries(2026);
    assert.equal(f.length, 10);
    const par = new Map(f.map((j) => [j.libelle, j.date]));
    assert.equal(par.get('Lundi de Pâques'), '2026-04-06');
    assert.equal(par.get('Ascension'), '2026-05-14');
    assert.equal(par.get('Lundi de Pentecôte'), '2026-05-25');
    assert.equal(par.get('Armistice'), '2026-11-11');
    assert.equal(par.get('Noël'), '2026-12-25');
  });
  it('Ascension et Pentecôte tombent toujours un jeudi et un lundi', () => {
    for (let a = 2024; a <= 2035; a++) {
      const par = new Map(joursFeries(a).map((j) => [j.libelle, j.date]));
      assert.equal(indexJour(par.get('Ascension')!), 3, `Ascension ${a}`);
      assert.equal(indexJour(par.get('Lundi de Pentecôte')!), 0, `Pentecôte ${a}`);
      assert.equal(indexJour(par.get('Lundi de Pâques')!), 0, `Pâques ${a}`);
    }
  });
  it('les congés de la Fédération sont le 27 septembre et le 2 novembre', () => {
    assert.deepEqual(congesFWB(2027).map((j) => j.date), ['2027-09-27', '2027-11-02']);
  });
});

describe('vacances scolaires de la Fédération Wallonie-Bruxelles', () => {
  it('chaque année du tableau est cohérente : rentrée un lundi, dernier jour un vendredi, congés du lundi au vendredi dans l’ordre', () => {
    for (const a of ANNEES_SCOLAIRES_FWB) {
      assert.equal(indexJour(a.rentree), 0, `rentrée ${a.libelle}`);
      assert.equal(indexJour(a.rentreeSuivante), 0, `rentrée suivante ${a.libelle}`);
      assert.equal(indexJour(a.dernierJour), 4, `dernier jour ${a.libelle}`);
      let precedent = a.rentree;
      for (const v of a.vacances) {
        assert.equal(indexJour(v.du), 0, `${a.libelle} ${v.libelle} commence un lundi`);
        assert.equal(indexJour(v.au), 4, `${a.libelle} ${v.libelle} finit un vendredi`);
        assert.ok(v.du > precedent && v.au < a.dernierJour, `${a.libelle} ${v.libelle} dans l’année`);
        precedent = v.au;
      }
      assert.ok(a.dernierJour < a.rentreeSuivante);
    }
  });
  it('les années se suivent sans trou', () => {
    for (let i = 1; i < ANNEES_SCOLAIRES_FWB.length; i++) assert.equal(ANNEES_SCOLAIRES_FWB[i]!.rentree, ANNEES_SCOLAIRES_FWB[i - 1]!.rentreeSuivante);
  });
  it('2026-2027 : congé d’automne du 19 au 30 octobre 2026', () => {
    assert.equal(infosJour('2026-10-19').vacances, 'Congé d’automne');
    assert.equal(infosJour('2026-10-30').vacances, 'Congé d’automne');
    assert.equal(infosJour('2026-10-16').sansClasse, false);
    assert.equal(infosJour('2026-11-03').sansClasse, false);
  });
  it('congé de détente 2026 : du 16 au 27 février (pas du 23 février)', () => {
    assert.equal(infosJour('2026-02-16').vacances, 'Congé de détente');
    assert.equal(infosJour('2026-02-27').vacances, 'Congé de détente');
    assert.equal(infosJour('2026-03-02').sansClasse, false);
  });
  it('fériés et vacances se superposent : Noël pendant les vacances d’hiver, Ascension 2027 pendant les vacances de printemps', () => {
    const noel = infosJour('2026-12-25');
    assert.equal(noel.ferie, 'Noël');
    assert.equal(noel.vacances, 'Vacances d’hiver');
    assert.equal(noel.libelle, 'Noël');
    const asc = infosJour('2027-05-06');
    assert.equal(asc.ferie, 'Ascension');
    assert.equal(asc.vacances, 'Vacances de printemps');
  });
  it('jours de congé en dehors des vacances : 11 novembre, lundi de Pâques, 2 novembre 2026', () => {
    assert.equal(infosJour('2026-11-11').libelle, 'Armistice');
    assert.equal(infosJour('2027-03-29').libelle, 'Lundi de Pâques');
    assert.equal(infosJour('2026-11-02').conge, 'Commémoration des défunts');
    assert.equal(natureJour(infosJour('2026-11-02')), 'ferie');
    assert.equal(natureJour(infosJour('2026-10-20')), 'vacances');
    assert.equal(natureJour(infosJour('2026-10-14')), null);
  });
  it('vacances d’été : du lendemain du dernier jour à la veille de la rentrée', () => {
    assert.equal(infosJour('2027-07-02').sansClasse, false);
    assert.equal(infosJour('2027-07-05').vacances, 'Vacances d’été');
    assert.equal(infosJour('2027-08-27').vacances, 'Vacances d’été');
    assert.equal(infosJour('2027-08-30').sansClasse, false);
    assert.equal(infosJour('2026-08-21').vacances, 'Vacances d’été');
    assert.equal(infosJour('2026-08-24').sansClasse, false);
  });
  it('hors du tableau : seulement les fériés et congés fixes, et on le sait', () => {
    assert.equal(calendrierConnu('2026-10-19'), true);
    assert.equal(calendrierConnu(CALENDRIER_CONNU_DU), true);
    assert.equal(calendrierConnu(CALENDRIER_CONNU_AU), true);
    assert.equal(calendrierConnu('2025-08-24'), false);
    assert.equal(calendrierConnu('2029-08-27'), false);
    const lointain = infosJour('2035-12-25');
    assert.equal(lointain.ferie, 'Noël');
    assert.equal(lointain.calendrierConnu, false);
    assert.equal(infosJour('2035-10-25').sansClasse, false);
  });
  it('retrouve l’année scolaire d’une date', () => {
    assert.equal(anneeScolaireFWB('2026-10-26')?.libelle, '2026-2027');
    assert.equal(anneeScolaireFWB('2027-07-10')?.libelle, '2026-2027');
    assert.equal(anneeScolaireFWB('2030-01-01'), undefined);
  });
});

describe('mois', () => {
  it('début, fin et titre', () => {
    assert.equal(debutDuMois('2026-10-26'), '2026-10-01');
    assert.equal(finDuMois('2026-10-26'), '2026-10-31');
    assert.equal(finDuMois('2028-02-10'), '2028-02-29');
    assert.equal(titreMois('2026-10-26'), 'octobre 2026');
  });
  it('ajouter des mois garde le jour, ou le dernier jour du mois', () => {
    assert.equal(ajouterMois('2026-10-26', 1), '2026-11-26');
    assert.equal(ajouterMois('2026-01-31', 1), '2026-02-28');
    assert.equal(ajouterMois('2026-12-15', 1), '2027-01-15');
    assert.equal(ajouterMois('2026-01-15', -1), '2025-12-15');
  });
  it('octobre 2026 : cinq semaines, du lundi 28 septembre au vendredi 30 octobre', () => {
    const s = semainesDuMois('2026-10-15');
    assert.equal(s.length, 5);
    assert.equal(s[0]![0], '2026-09-28');
    assert.equal(s[4]![4], '2026-10-30');
    for (const sem of s) { assert.equal(sem.length, 5); assert.equal(indexJour(sem[0]!), 0); }
  });
  it('un mois qui commence un week-end commence le lundi suivant (août 2026, novembre 2026 finit un lundi)', () => {
    assert.equal(semainesDuMois('2026-08-10')[0]![0], '2026-08-03');
    const nov = semainesDuMois('2026-11-10');
    assert.equal(nov[0]![0], '2026-11-02');
    assert.equal(nov[nov.length - 1]![0], '2026-11-30');
  });
  it('toutes les dates du mois qui sont en semaine apparaissent exactement une fois', () => {
    for (const d of ['2026-02-10', '2026-03-10', '2027-05-10', '2028-02-10', '2026-08-10', '2026-11-10']) {
      const dates = semainesDuMois(d).flat();
      assert.equal(new Set(dates).size, dates.length);
      let x = debutDuMois(d);
      for (; x <= finDuMois(d); x = `${x.slice(0, 8)}${String(Number(x.slice(8)) + 1).padStart(2, '0')}`) {
        if (indexJour(x) <= 4) assert.ok(dates.includes(x), `${x} manque`);
      }
    }
  });
});

describe('horaires des périodes', () => {
  const copie = (): Periode[] => horairesParDefaut();
  it('les horaires habituels sont valides et inchangés', () => {
    assert.deepEqual(verifierHoraires(PERIODES_AGENDA), []);
    assert.equal(horairesModifies(copie()), false);
    assert.equal(copie().length, NB_PERIODES);
  });
  it('refuse une fin avant le début, un chevauchement, une heure illisible', () => {
    const a = copie(); a[2] = { ...a[2]!, fin: '09:30' };
    assert.equal(verifierHoraires(a)[0]?.index, 2);
    const b = copie(); b[1] = { ...b[1]!, debut: '08:40' };
    assert.match(verifierHoraires(b)[0]!.message, /commence avant la fin de 1e H/);
    const c = copie(); c[0] = { ...c[0]!, debut: '8h' };
    assert.equal(verifierHoraires(c)[0]?.index, 0);
  });
  it('accepte des horaires réglés par l’utilisateur', () => {
    const h = copie();
    h[0] = { ...h[0]!, debut: '07:45', fin: '08:40' };
    h[1] = { ...h[1]!, debut: '08:40', fin: '09:30' };
    h[2] = { ...h[2]!, debut: '09:40', fin: '10:30' };
    assert.deepEqual(verifierHoraires(h), []);
    assert.equal(horairesModifies(h), true);
  });
  it('relit des horaires enregistrés ; rien d’exploitable redonne les horaires habituels', () => {
    assert.deepEqual(normaliserHoraires(undefined), PERIODES_AGENDA);
    assert.deepEqual(normaliserHoraires([]), PERIODES_AGENDA);
    assert.deepEqual(normaliserHoraires('x'), PERIODES_AGENDA);
    const h = copie(); h[0] = { ...h[0]!, debut: '07:45', fin: '08:40' };
    assert.deepEqual(normaliserHoraires(h), h);
    const abime = copie(); abime[3] = { label: 'n’importe quoi', debut: '12:00', fin: '11:00' };
    assert.deepEqual(normaliserHoraires(abime), PERIODES_AGENDA);
  });
  it('les noms des périodes ne changent jamais, même si le stockage en contient d’autres', () => {
    const h = copie().map((p) => ({ ...p, label: 'X' }));
    assert.deepEqual(normaliserHoraires(h).map((p) => p.label), PERIODES_AGENDA.map((p) => p.label));
  });
  it('les pauses sont l’écart entre deux périodes', () => {
    assert.equal(pauseAvant(PERIODES_AGENDA, 0), 0);
    assert.equal(pauseAvant(PERIODES_AGENDA, 1), 0);
    assert.equal(pauseAvant(PERIODES_AGENDA, 3), 15);
    assert.equal(pauseAvant(PERIODES_AGENDA, 5), 50);
    assert.equal(libellePause(15), 'Récré');
    assert.equal(libellePause(50), 'Midi');
    assert.equal(enMinutes('13:15'), 795);
  });
});

describe('horaires : enregistrement', () => {
  it('au départ, les horaires habituels', async () => {
    const magasin = creerMagasin(creerDepotMemoire());
    await magasin.charger();
    assert.deepEqual(magasin.lire().horaires, PERIODES_AGENDA);
  });
  it('enregistre des horaires cohérents et les retrouve après rechargement', async () => {
    const depot = creerDepotMemoire();
    const magasin = creerMagasin(depot);
    await magasin.charger();
    const h = horairesParDefaut();
    h[0] = { ...h[0]!, debut: '07:45', fin: '08:40' };
    assert.deepEqual(await magasin.changerHoraires(h), []);
    assert.equal(magasin.lire().horaires[0]?.debut, '07:45');
    const relu = creerMagasin(depot);
    await relu.charger();
    assert.deepEqual(relu.lire().horaires, h);
  });
  it('refuse des horaires incohérents : rien n’est écrit, les anciens restent', async () => {
    const depot = creerDepotMemoire();
    const magasin = creerMagasin(depot);
    await magasin.charger();
    const h = horairesParDefaut();
    h[1] = { ...h[1]!, debut: '08:00' };
    const erreurs = await magasin.changerHoraires(h);
    assert.equal(erreurs.length, 1);
    assert.deepEqual(magasin.lire().horaires, PERIODES_AGENDA);
    assert.deepEqual(await depot.chargerReglages(), []);
  });
  it('un réglage abîmé dans la base redonne les horaires habituels sans bloquer le chargement', async () => {
    const magasin = creerMagasin(creerDepotMemoire([], [], [], [], [{ id: 'agenda-horaires', valeur: 'n’importe quoi' }]));
    await magasin.charger();
    assert.equal(magasin.lire().erreur, null);
    assert.deepEqual(magasin.lire().horaires, PERIODES_AGENDA);
  });
  it('supprimer un élève ne touche pas aux horaires', async () => {
    const depot = creerDepotMemoire();
    const magasin = creerMagasin(depot);
    await magasin.charger();
    const h = horairesParDefaut(); h[7] = { ...h[7]!, fin: '16:00' };
    await magasin.changerHoraires(h);
    await magasin.supprimerEleve('inconnu');
    assert.equal(magasin.lire().horaires[7]?.fin, '16:00');
  });
});
