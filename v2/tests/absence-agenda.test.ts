import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creer, occurrences, occurrencesAgenda } from '../src/domain/agenda/index.ts';
import { seance } from './fabrique.ts';

describe('agenda : une séance d’absence se distingue d’une séance tenue', () => {
  const planifiee = creer({ type: 'eleve', eleveId: 'alpha', date: '2026-11-03', debut: 1, fin: 1 });

  it('séance planifiée puis encodée absente : réalisée ET marquée absence', () => {
    const s = seance({ eleveId: 'alpha', date: '2026-11-03', periodeDebut: '2e H', periodeFin: '2e H', presence: 'absent_eleve' });
    const [o] = occurrences([planifiee], '2026-11-03', '2026-11-03', [s]);
    assert.equal(o?.statut, 'realise');
    assert.equal(o?.absence, true);
  });

  it('séance tenue : pas d’absence', () => {
    const s = seance({ eleveId: 'alpha', date: '2026-11-03', periodeDebut: '2e H', periodeFin: '2e H', presence: 'present' });
    const [o] = occurrences([planifiee], '2026-11-03', '2026-11-03', [s]);
    assert.equal(o?.absence, undefined);
  });

  it('séance d’absence sans planification : l’occurrence calculée est marquée absence', () => {
    const s = seance({ eleveId: 'beta', date: '2026-11-03', periodeDebut: '3e H', periodeFin: '3e H', presence: 'absent_prof' });
    const o = occurrencesAgenda([], '2026-11-03', '2026-11-03', [s]).find((x) => x.seanceId === s.id);
    assert.equal(o?.absence, true);
  });
});

describe('agenda : « réalisé » à la main n’est pas une absence', () => {
  it('une activité marquée réalisée sans séance n’est jamais marquée absence', () => {
    const a = { ...creer({ type: 'collaboration', titre: 'Réunion', date: '2026-11-03', debut: 1, fin: 1 }), etats: { '2026-11-03': 'realise' as const } };
    const [o] = occurrences([a], '2026-11-03', '2026-11-03', []);
    assert.equal(o?.statut, 'realise');
    assert.equal(o?.absence, undefined);
  });
});
