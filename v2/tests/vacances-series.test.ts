import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { avertissementsVacances, creer, occurrences } from '../src/domain/agenda/index.ts';

describe('séries hebdomadaires pendant les vacances', () => {
  const serie = { ...creer({ type: 'eleve', eleveId: 'alpha', titre: 'Remédiation', date: '2026-11-02', debut: 1, fin: 1 }), repetition: 'hebdomadaire' as const };
  const nom = () => 'Élève Alpha';

  it('une date de la série en vacances d’hiver est signalée, avec le nom des vacances', () => {
    const occ = occurrences([serie], '2026-12-21', '2026-12-25');
    const avert = avertissementsVacances(occ, nom);
    assert.equal(avert.length, 1);
    assert.match(avert[0]!.texte, /Vacances d’hiver/);
    assert.match(avert[0]!.texte, /Élève Alpha/);
    assert.deepEqual(avert[0]!.cles, [occ[0]!.cle]);
  });

  it('un jour de classe : rien', () => {
    assert.deepEqual(avertissementsVacances(occurrences([serie], '2026-11-09', '2026-11-13'), nom), []);
  });

  it('une date déjà annulée n’est pas signalée', () => {
    const annulee = { ...serie, etats: { '2026-12-21': 'annule' as const } };
    assert.deepEqual(avertissementsVacances(occurrences([annulee], '2026-12-21', '2026-12-25'), nom), []);
  });

  it('une activité unique posée en vacances est voulue : pas d’avertissement', () => {
    const unique = creer({ type: 'collaboration', titre: 'Formation', date: '2026-12-22', debut: 1, fin: 1 });
    assert.deepEqual(avertissementsVacances(occurrences([unique], '2026-12-21', '2026-12-25'), nom), []);
  });
});
