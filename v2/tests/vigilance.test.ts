import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { NBSP as N, blocEnTexte, construireBloc, synthese } from '../src/domain/redaction/index.ts';
import { proposerObjectifs } from '../src/domain/reunion/index.ts';
import { rapprocher } from '../src/domain/pia/index.ts';
import { suiteDerniereSeance } from '../src/domain/accueil/index.ts';
import type { Seance } from '../src/domain/types.ts';
import { estVigilance } from '../src/domain/types.ts';
import { seance, vide } from './fabrique.ts';

const DESENGAGE = 'Se désengage / évite la tâche';
type N3 = 0 | 1 | 2;
const s = (date: string, o: [string, N3][], extra: Partial<Seance> = {}): Seance =>
  seance({ ...vide, date, id: `s-${date}`, observations: o.map(([texte, niveau]) => ({ texte, niveau })), ...extra });
const texte = (x: Seance, precedentes: Seance[] = []) => blocEnTexte(construireBloc(x, { precedentes }));

describe('Points de vigilance : un niveau « Totalement » n’est jamais un acquis', () => {
  it('le point connu et le point libre marqué sont reconnus ; un point ordinaire non', () => {
    assert.ok(estVigilance({ texte: DESENGAGE }));
    assert.ok(estVigilance({ texte: 'se désengage / évite la tâche.' }));
    assert.ok(estVigilance({ texte: 'Se décourage', vigilance: true }));
    assert.ok(!estVigilance({ texte: 'Persévère dans la tâche' }));
  });

  it('Journalier : échelle de fréquence, bloc à part, jamais « Totalement »', () => {
    const t = texte(s('2026-10-01', [[DESENGAGE, 2], ['Maintient son attention', 2]]));
    assert.ok(t.includes(`• Totalement${N}: maintient son attention.`));
    assert.ok(t.includes(`• Point de vigilance, tout au long${N}: se désengage / évite la tâche.`));
    assert.ok(!t.includes(`Totalement${N}: se désengage`));
  });

  it('évolution : moins fréquent = progression, plus fréquent = à surveiller', () => {
    const avant = s('2026-09-15', [[DESENGAGE, 2]]);
    assert.ok(texte(s('2026-10-01', [[DESENGAGE, 0]]), [avant]).includes(`• Progression, Tout au long → Ponctuellement${N}: se désengage / évite la tâche.`));
    const peu = s('2026-09-15', [[DESENGAGE, 0]]);
    assert.ok(texte(s('2026-10-01', [[DESENGAGE, 2]]), [peu]).includes(`• À surveiller, Ponctuellement → Tout au long${N}:`));
  });

  it('synthèse : en vigilance, pas en points d’appui ni à travailler', () => {
    const m = synthese([s('2026-10-01', [[DESENGAGE, 2]])]).matieres[0];
    assert.deepEqual(m?.appuis, []);
    assert.deepEqual(m?.aTravailler, []);
    assert.deepEqual(m?.vigilances, [`Se désengage / évite la tâche${N}: tout au long.`]);
  });

  it('réunion : « Souvent » donne « Rester attentif », « Ponctuellement » ne propose rien, jamais « Faire progresser »', () => {
    const souvent = proposerObjectifs(synthese([s('2026-10-01', [[DESENGAGE, 1]])]));
    assert.equal(souvent.length, 1);
    assert.equal(souvent[0]?.genre, 'vigilance');
    assert.ok(souvent[0]?.texte.includes('Rester attentif'));
    assert.deepEqual(proposerObjectifs(synthese([s('2026-10-01', [[DESENGAGE, 0]])])), []);
  });

  it('PIA : jamais une ressource ; une difficulté seulement si elle revient et n’est plus ponctuelle', () => {
    const r = rapprocher([s('2026-10-01', [[DESENGAGE, 2]]), s('2026-10-08', [[DESENGAGE, 2]])]);
    assert.ok(!r.some((x) => x.colonne === 'ressources'));
    assert.ok(r.some((x) => x.colonne === 'difficultes' && x.texte.startsWith('Difficulté observée')));
    assert.deepEqual(rapprocher([s('2026-10-01', [[DESENGAGE, 0]]), s('2026-10-08', [[DESENGAGE, 0]])]), []);
  });

  it('accueil : « Partiellement » d’un point de vigilance n’est pas « à retravailler »', () => {
    const x = s('2026-10-01', [[DESENGAGE, 0], ['Entre dans la tâche', 0]]);
    assert.deepEqual(suiteDerniereSeance(x.eleveId, '2026-10-02', [x])?.aRetravailler, ['Entre dans la tâche']);
  });
});
