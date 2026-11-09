import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { suiteDerniereSeance } from '../src/domain/accueil/index.ts';
import { rapprocher } from '../src/domain/pia/index.ts';
import { NBSP as N, blocEnTexte, construireBloc, synthese } from '../src/domain/redaction/index.ts';
import { proposerObjectifs } from '../src/domain/reunion/index.ts';
import { NIVEAUX_LIBELLES, libelleNiveau } from '../src/domain/types.ts';
import type { Niveau, Seance } from '../src/domain/types.ts';
import { seance, vide } from './fabrique.ts';

const PAS_DU_TOUT = -1 as Niveau;
const s = (date: string, o: [string, Niveau][], extra: Partial<Seance> = {}): Seance =>
  seance({ ...vide, date, id: `s-${date}`, observations: o.map(([texte, niveau]) => ({ texte, niveau })), ...extra });
const texte = (x: Seance, precedentes: Seance[] = []) => blocEnTexte(construireBloc(x, { precedentes }));

describe('quatre niveaux : Pas du tout / Un peu / Assez / Tout à fait', () => {
  it('les mots, du plus faible au plus fort ; les anciennes valeurs 0, 1, 2 gardent leur rang', () => {
    assert.deepEqual([...NIVEAUX_LIBELLES], ['Pas du tout', 'Un peu', 'Assez', 'Tout à fait']);
    assert.deepEqual([-1, 0, 1, 2].map(libelleNiveau), ['Pas du tout', 'Un peu', 'Assez', 'Tout à fait']);
    assert.equal(libelleNiveau(7), '');
  });

  it('Journalier : un niveau par puce, du plus fort au plus faible', () => {
    const t = texte(s('2026-10-01', [['A', 2], ['B', 1], ['C', 0], ['D', PAS_DU_TOUT]]));
    const i = ['Tout à fait', 'Assez', 'Un peu', 'Pas du tout'].map((m) => t.indexOf(`• ${m}${N}:`));
    assert.ok(i.every((x) => x >= 0), t);
    assert.deepEqual([...i].sort((a, b) => a - b), i);
  });

  it('Journalier : compétence écrite avec le nouveau mot', () => {
    const x = seance({ ...vide, competences: [{ texte: 'Lire un graphique', niveau: PAS_DU_TOUT }, { texte: 'Calculer une aire', niveau: 2 }] });
    const t = texte(x);
    assert.ok(t.includes('Lire un graphique (pas du tout)'), t);
    assert.ok(t.includes('calculer une aire (tout à fait)'), t);
  });

  it('évolution : de « Pas du tout » à « Un peu » est une progression', () => {
    const t = texte(s('2026-10-01', [['Contrôle sa production', 0]]), [s('2026-09-15', [['Contrôle sa production', PAS_DU_TOUT]])]);
    assert.ok(t.includes(`• Progression, Pas du tout → Un peu${N}: contrôle sa production.`), t);
  });

  it('synthèse : « Pas du tout » compte comme à travailler, jamais comme appui', () => {
    const m = synthese([s('2026-10-01', [['Contrôle sa production', PAS_DU_TOUT]])]).matieres[0];
    assert.deepEqual(m?.appuis, []);
    assert.deepEqual(m?.aTravailler, [`Contrôle sa production${N}: pas du tout.`]);
  });

  it('réunion : « Pas du tout » et « Un peu » donnent « Faire progresser », « Assez » donne « Consolider »', () => {
    const genres = (n: Niveau) => proposerObjectifs(synthese([s('2026-10-01', [['Contrôle sa production', n]])])).map((p) => p.genre);
    assert.deepEqual(genres(PAS_DU_TOUT), ['progresser']);
    assert.deepEqual(genres(0), ['progresser']);
    assert.deepEqual(genres(1), ['consolider']);
    assert.deepEqual(genres(2), []);
  });

  it('PIA : « Pas du tout » à deux reprises = difficulté et objectif, comme « Un peu »', () => {
    const r = rapprocher([s('2026-10-01', [['Maintient son attention', PAS_DU_TOUT]]), s('2026-10-08', [['Maintient son attention', PAS_DU_TOUT]])]);
    assert.ok(r.some((x) => x.colonne === 'difficultes' && x.texte.startsWith('Pas encore acquis')));
    assert.ok(r.some((x) => x.colonne === 'objectifs' && x.texte.startsWith('Faire progresser')));
    assert.ok(r.every((x) => x.raison.includes('dernier niveau : pas du tout')));
  });

  it('accueil : « Pas du tout » est à retravailler comme « Un peu »', () => {
    const x = s('2026-10-01', [['Entre dans la tâche', PAS_DU_TOUT], ['Maintient son attention', 0], ['Contrôle sa production', 1]]);
    assert.deepEqual(suiteDerniereSeance(x.eleveId, '2026-10-02', [x])?.aRetravailler, ['Entre dans la tâche', 'Maintient son attention']);
  });
});
