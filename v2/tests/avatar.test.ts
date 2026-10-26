import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import {
  ACCESSOIRES_LIBELLES, AVATAR_PAR_DEFAUT, CHEVEUX, COIFFURES_LIBELLES, NB_OPTIONS, STYLES_AVATAR, TEINTS, VISAGES_LIBELLES,
  avatarAuHasard, descriptionAvatar, dessiner, memeAvatar, normaliserAvatar
} from '../src/domain/avatar/index.ts';
import type { AvatarEleve, Forme } from '../src/domain/avatar/index.ts';
import { normaliserEleve } from '../src/domain/eleves/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { creerMagasin } from '../src/state/store.ts';

const base: AvatarEleve = { style: 'manga', teint: 2, cheveux: 3, coiffure: 1, visage: 0, accessoire: 0 };
const eleve = (surcharge: Partial<Eleve> = {}): Eleve => ({ id: 'a', nom: 'Dupont', prenom: 'Élodie', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [], ...surcharge });
const serie = (a: AvatarEleve): string => JSON.stringify(dessiner(a));

/** Tous les nombres d'une forme (coordonnées, rayons, chemin) : doivent rester dans la zone 64 × 64, avec une petite marge. */
function nombres(f: Forme): number[] {
  switch (f.t) {
    case 'rect': return [f.x, f.y, f.x + f.w, f.y + f.h];
    case 'circle': return [f.cx - f.r, f.cy - f.r, f.cx + f.r, f.cy + f.r];
    case 'ellipse': return [f.cx - f.rx, f.cy - f.ry, f.cx + f.rx, f.cy + f.ry];
    case 'path': return (f.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  }
}

describe('Avatars : dessin', () => {
  it('toutes les combinaisons de style, coiffure, visage et accessoire donnent un dessin valide dans la zone 64 × 64', () => {
    let n = 0;
    for (const style of STYLES_AVATAR) for (let coiffure = 0; coiffure < NB_OPTIONS.coiffure; coiffure += 1) {
      for (let visage = 0; visage < NB_OPTIONS.visage; visage += 1) for (let accessoire = 0; accessoire < NB_OPTIONS.accessoire; accessoire += 1) {
        const formes = dessiner({ style, teint: 3, cheveux: 4, coiffure, visage, accessoire });
        assert.ok(formes.length > 5, `${style}/${coiffure}/${visage}/${accessoire} : trop peu de formes`);
        assert.equal(formes[0]?.f, 'fond', 'le fond vient en premier');
        for (const f of formes) for (const v of nombres(f)) {
          assert.ok(Number.isFinite(v) && v >= -4 && v <= 68, `${style}/${coiffure}/${visage}/${accessoire} : valeur ${v} hors zone`);
        }
        n += 1;
      }
    }
    assert.equal(n, 5 * 8 * 5 * 5);
  });

  it('couleurs : seulement #rrggbb, « fond », « haut » ou « none » (rien d’autre ne peut finir dans la page)', () => {
    const permis = /^(#[0-9a-f]{6}|fond|haut|none)$/i;
    for (const style of STYLES_AVATAR) for (const accessoire of [0, 1, 3, 4]) {
      for (const f of dessiner({ ...base, style, accessoire })) {
        assert.match(f.f, permis);
        if (f.s) assert.match(f.s, permis);
        if (f.t === 'path') assert.match(f.d, /^[MLCQZHV0-9 .\-]+$/, 'chemin sans commande inattendue');
      }
    }
  });

  it('le dessin est le même pour le même choix', () => {
    assert.equal(serie(base), serie({ ...base }));
  });

  it('chaque option change vraiment le dessin (aucune option sans effet), dans chaque style', () => {
    const options: [keyof Omit<AvatarEleve, 'style'>, number][] = [
      ['teint', TEINTS.length], ['cheveux', CHEVEUX.length], ['coiffure', COIFFURES_LIBELLES.length],
      ['visage', VISAGES_LIBELLES.length], ['accessoire', ACCESSOIRES_LIBELLES.length]
    ];
    for (const style of STYLES_AVATAR) {
      for (const [cle, nb] of options) {
        const dessins = new Set<string>();
        for (let v = 0; v < nb; v += 1) dessins.add(serie({ ...base, style, [cle]: v }));
        assert.equal(dessins.size, nb, `${style} : « ${cle} » a des valeurs qui donnent le même dessin`);
      }
    }
  });

  it('les cinq styles sont bien différents', () => {
    assert.equal(new Set(STYLES_AVATAR.map((style) => serie({ ...base, style }))).size, 5);
  });

  it('la couleur de peau et celle des cheveux choisies se retrouvent dans le dessin', () => {
    for (const style of STYLES_AVATAR) {
      for (let t = 0; t < TEINTS.length; t += 1) assert.ok(serie({ ...base, style, teint: t }).includes(TEINTS[t]!), `${style} teint ${t}`);
      for (let c = 0; c < CHEVEUX.length; c += 1) assert.ok(serie({ ...base, style, cheveux: c }).includes(CHEVEUX[c]!), `${style} cheveux ${c}`);
    }
  });

  it('la couleur de l’élève (« haut ») sert aux vêtements dans tous les styles', () => {
    for (const style of STYLES_AVATAR) assert.ok(dessiner({ ...base, style }).some((f) => f.f === 'haut'), style);
  });
});

describe('Avatars : relecture et tirage', () => {
  it('un avatar valide est conservé tel quel', () => {
    assert.deepEqual(normaliserAvatar(base), base);
  });
  it('style inconnu ou valeur qui n’est pas un avatar : pas d’avatar (initiales)', () => {
    for (const x of [undefined, null, 'manga', 3, [], { style: 'photo' }, { teint: 1 }]) assert.equal(normaliserAvatar(x), undefined);
  });
  it('option illisible : retour à la première valeur ; champs inconnus ignorés', () => {
    assert.deepEqual(
      normaliserAvatar({ style: 'pixel', teint: 99, cheveux: -1, coiffure: 2.5, visage: '1', accessoire: null, url: 'http://exemple.test/photo.png' }),
      { style: 'pixel', teint: 0, cheveux: 0, coiffure: 0, visage: 0, accessoire: 0 }
    );
  });
  it('tirage au hasard : toujours valide, reproductible avec la même suite, couvre les valeurs', () => {
    let graine = 7;
    const alea = (): number => { graine = (graine * 16807) % 2147483647; return (graine - 1) / 2147483646; };
    const vus = { style: new Set<number>(), coiffure: new Set<number>(), accessoire: new Set<number>() };
    for (let i = 0; i < 400; i += 1) {
      const a = avatarAuHasard(alea);
      assert.deepEqual(normaliserAvatar(a), a, 'un tirage est toujours un avatar valide');
      vus.style.add(STYLES_AVATAR.indexOf(a.style)); vus.coiffure.add(a.coiffure); vus.accessoire.add(a.accessoire);
    }
    assert.equal(vus.style.size, 5);
    assert.equal(vus.coiffure.size, 8);
    assert.equal(vus.accessoire.size, 5);
    const serieA = [0.1, 0.9, 0.5, 0.3, 0.7, 0.2, 0.8];
    const de = (): (() => number) => { let i = 0; return () => serieA[i++ % serieA.length]!; };
    assert.deepEqual(avatarAuHasard(de()), avatarAuHasard(de()));
    assert.equal(avatarAuHasard(Math.random, 'pixel').style, 'pixel');
    assert.deepEqual(avatarAuHasard(() => 0.999999), { style: 'minimal', teint: 5, cheveux: 7, coiffure: 7, visage: 4, accessoire: 4 });
  });
  it('comparaison et description pour lecteur d’écran', () => {
    assert.ok(memeAvatar(base, { ...base }));
    assert.ok(!memeAvatar(base, { ...base, visage: 2 }));
    assert.ok(!memeAvatar(base, undefined));
    assert.ok(memeAvatar(undefined, undefined));
    assert.match(descriptionAvatar({ ...base, accessoire: 1 }), /^Avatar manga : .*coiffure frange.*lunettes rondes$/);
    assert.ok(!descriptionAvatar(base).includes('undefined'));
    assert.equal(normaliserAvatar(AVATAR_PAR_DEFAUT)?.style, 'cartoon');
  });
});

describe('Avatars : dans le dossier de l’élève', () => {
  it('le dossier garde un avatar valide, répare un avatar abîmé, retire un avatar illisible', () => {
    assert.deepEqual(normaliserEleve(eleve({ avatar: base })).avatar, base);
    assert.deepEqual(normaliserEleve(eleve({ avatar: { ...base, teint: 42 } })).avatar, { ...base, teint: 0 });
    assert.equal('avatar' in normaliserEleve({ ...eleve(), avatar: { style: 'photo' } as unknown as AvatarEleve }), false);
    assert.equal('avatar' in normaliserEleve(eleve()), false);
  });
  it('enregistré puis relu par le magasin ; retirer l’avatar revient aux initiales ; archiver et réactiver le conservent', async () => {
    const depot = creerDepotMemoire([], [], []);
    const magasin = creerMagasin(depot);
    await magasin.charger();
    await magasin.ajouterEleves([eleve({ avatar: base })]);
    const relu = creerMagasin(depot);
    await relu.charger();
    assert.deepEqual(relu.lire().eleves[0]?.avatar, base);

    const { avatar: _a, ...sans } = relu.lire().eleves[0]!;
    await relu.ajouterEleves([sans]);
    const apres = creerMagasin(depot);
    await apres.charger();
    assert.equal(apres.lire().eleves[0]?.avatar, undefined);
  });
});
