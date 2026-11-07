import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { seanceEnDoublon } from '../src/domain/journalier/index.ts';
import { seance } from './fabrique.ts';

describe('séance en doublon (même élève, même date, même période)', () => {
  const existante = seance({ id: 'a', eleveId: 'alpha', date: '2026-11-03', periodeDebut: '2e H', matiere: 'Français' });

  it('trouve la séance déjà enregistrée sur le même créneau', () => {
    const nouvelle = seance({ id: 'b', eleveId: 'alpha', date: '2026-11-03', periodeDebut: '2e H' });
    assert.equal(seanceEnDoublon([existante], nouvelle)?.id, 'a');
  });

  it('ne se signale jamais soi-même (modifier une séance)', () => {
    assert.equal(seanceEnDoublon([existante], { ...existante, matiere: 'Autre' }), undefined);
  });

  it('un autre élève, un autre jour ou une autre période : pas de doublon', () => {
    assert.equal(seanceEnDoublon([existante], seance({ eleveId: 'beta', date: '2026-11-03', periodeDebut: '2e H' })), undefined);
    assert.equal(seanceEnDoublon([existante], seance({ eleveId: 'alpha', date: '2026-11-04', periodeDebut: '2e H' })), undefined);
    assert.equal(seanceEnDoublon([existante], seance({ eleveId: 'alpha', date: '2026-11-03', periodeDebut: '3e H' })), undefined);
  });

  it('sans période renseignée, on ne peut rien affirmer : pas de doublon', () => {
    const sans = seance({ id: 'c', eleveId: 'alpha', date: '2026-11-03', periodeDebut: '' });
    assert.equal(seanceEnDoublon([{ ...existante, periodeDebut: '' }], sans), undefined);
  });
});
