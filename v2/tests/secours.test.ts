import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { exempleDemo } from '../src/data/demo.ts';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { estCopieChiffree } from '../src/domain/coffre/index.ts';
import { creerMagasin } from '../src/state/store.ts';
import { NOM_COPIE, appliquerRestauration, preparerCopie, preparerRestauration } from '../src/synchro/secours.ts';

const JOUR = '2026-10-26';

async function magasinRempli() {
  const m = creerMagasin(creerDepotMemoire());
  await m.charger();
  await m.chargerExemple(exempleDemo(JOUR));
  return m;
}

describe('copie de secours', () => {
  it('nomme autrement la copie chiffrée', () => {
    assert.equal(NOM_COPIE('2026-10-26'), 'journalier-copie-2026-10-26.json');
    assert.equal(NOM_COPIE('2026-10-26', true), 'journalier-copie-chiffree-2026-10-26.json');
  });

  it('une copie en clair se relit sans mot de passe', async () => {
    const source = await magasinRempli();
    const fichier = await preparerCopie(source, `${JOUR}T10:00:00.000Z`);
    assert.equal(estCopieChiffree(fichier), false);
    const vide = creerMagasin(creerDepotMemoire());
    await vide.charger();
    const lu = await preparerRestauration(vide, fichier);
    assert.ok(lu.ok);
    assert.equal(lu.ok && lu.prevue.comparaison.manquants.length > 10, true);
  });

  it('une copie chiffrée est illisible sans le mot de passe, et se restaure avec', async () => {
    const source = await magasinRempli();
    const fichier = await preparerCopie(source, `${JOUR}T10:00:00.000Z`, 'mot de passe solide');
    assert.ok(estCopieChiffree(fichier));
    for (const secret of [exempleDemo(JOUR).eleves[0]!.nom, 'eleves', 'seances']) assert.ok(!fichier.includes(secret), secret);

    const cible = creerMagasin(creerDepotMemoire());
    await cible.charger();
    const sans = await preparerRestauration(cible, fichier);
    assert.equal(!sans.ok && sans.motDePasseRequis, true);
    const mauvais = await preparerRestauration(cible, fichier, 'pas le bon mot de passe');
    assert.equal(!mauvais.ok && mauvais.motDePasseRequis, true);
    assert.match(!mauvais.ok ? mauvais.erreur : '', /Mot de passe incorrect/);

    const bon = await preparerRestauration(cible, fichier, 'mot de passe solide');
    assert.ok(bon.ok);
    if (!bon.ok) return;
    assert.ok(await appliquerRestauration(cible, bon.prevue, false) > 10);
    const ex = exempleDemo(JOUR);
    assert.equal(cible.lire().eleves.length, ex.eleves.length);
    assert.equal(cible.lire().seances.length, ex.seances.length);
    assert.deepEqual(cible.lire().seances.find((s) => s.id === ex.seances[0]!.id), ex.seances[0]);
  });

  it('refuse un mot de passe trop court à l’enregistrement', async () => {
    await assert.rejects(preparerCopie(await magasinRempli(), `${JOUR}T10:00:00.000Z`, 'court'));
  });

  it('ne prend pas un fichier étranger pour une copie', async () => {
    const m = creerMagasin(creerDepotMemoire());
    await m.charger();
    const r = await preparerRestauration(m, '{"hello":"monde"}', 'mot de passe solide');
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.motDePasseRequis, undefined);
  });
});
