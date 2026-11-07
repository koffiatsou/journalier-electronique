import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attendreFinRepli, debordements, positionCentree } from '../src/features/seance/defilement.ts';

type Evenement = { target: unknown; propertyName?: string };

/** Faux élément : garde les écouteurs pour pouvoir déclencher « transitionend » à la main. */
function fauxElement() {
  const ecouteurs = new Set<(e: Evenement) => void>();
  const el = {
    addEventListener: (_t: 'transitionend', f: (e: Evenement) => void) => { ecouteurs.add(f); },
    removeEventListener: (_t: 'transitionend', f: (e: Evenement) => void) => { ecouteurs.delete(f); },
    emettre: (e: Evenement) => { for (const f of [...ecouteurs]) f(e); },
    nombre: () => ecouteurs.size
  };
  return el;
}

/** Minuterie contrôlée : rien ne se déclenche seul, le test décide quand. */
function fausseMinuterie() {
  const taches = new Map<number, () => void>();
  let suivant = 1;
  return {
    set: (f: () => void) => { taches.set(suivant, f); return suivant++; },
    clear: (id: unknown) => { taches.delete(id as number); },
    declencher: () => { for (const [id, f] of [...taches]) { taches.delete(id); f(); } },
    enAttente: () => taches.size
  };
}

describe('attendreFinRepli : ne défiler qu’une fois la rubrique précédente refermée', () => {
  it('sans rubrique à attendre, rend la main tout de suite', async () => {
    await attendreFinRepli(null);
  });

  it('attend la fin de la transition de repli de la rubrique elle-même', async () => {
    const el = fauxElement();
    const m = fausseMinuterie();
    let fini = false;
    const attente = attendreFinRepli(el, 400, m).then(() => { fini = true; });
    await Promise.resolve();
    assert.equal(fini, false, 'pas fini avant la fin du repli');
    el.emettre({ target: el, propertyName: 'grid-template-rows' });
    await attente;
    assert.equal(fini, true);
    assert.equal(el.nombre(), 0, 'l’écouteur est retiré');
    assert.equal(m.enAttente(), 0, 'le délai de secours est annulé');
  });

  it('ignore les transitions des éléments à l’intérieur et les autres propriétés', async () => {
    const el = fauxElement();
    const m = fausseMinuterie();
    let fini = false;
    const attente = attendreFinRepli(el, 400, m).then(() => { fini = true; });
    el.emettre({ target: {}, propertyName: 'grid-template-rows' });
    el.emettre({ target: el, propertyName: 'opacity' });
    await Promise.resolve();
    assert.equal(fini, false);
    m.declencher();
    await attente;
    assert.equal(fini, true);
  });

  it('rend la main au bout du délai de secours si la transition ne se déclenche jamais', async () => {
    const el = fauxElement();
    const m = fausseMinuterie();
    const attente = attendreFinRepli(el, 400, m);
    m.declencher();
    await attente;
    assert.equal(el.nombre(), 0, 'l’écouteur est retiré aussi dans ce cas');
  });
});

describe('positionCentree : centrer la pastille active sans sortir de la bande', () => {
  it('centre un bouton au milieu de la bande', () => {
    assert.equal(positionCentree(300, 100, 320, 650), 190);
  });
  it('ne dépasse jamais le début ni la fin du contenu', () => {
    assert.equal(positionCentree(10, 100, 320, 650), 0);
    assert.equal(positionCentree(600, 100, 320, 650), 330);
  });
  it('ne défile pas quand tout tient dans la bande', () => {
    assert.equal(positionCentree(80, 100, 600, 500), 0);
  });
});

describe('debordements : de quel côté il reste des rubriques cachées', () => {
  it('rien de caché quand tout tient', () => {
    assert.equal(debordements(0, 600, 600), '');
  });
  it('à droite au départ, à gauche à la fin, des deux côtés au milieu', () => {
    assert.equal(debordements(0, 320, 650), 'droite');
    assert.equal(debordements(330, 320, 650), 'gauche');
    assert.equal(debordements(120, 320, 650), 'gauche droite');
  });
  it('tolère l’arrondi d’un pixel', () => {
    assert.equal(debordements(0.5, 320, 320.6), '');
  });
});
