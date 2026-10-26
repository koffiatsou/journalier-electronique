import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ErreurCoffre, PREFIXE_SCELLE, PROPRIETAIRE_ESSAI, chiffrerCopie, dechiffrerCopie, estCopieChiffree, estProprietaireValide, estScelle,
  nomBaseDe, nouvelleCle, ouvrir, proprietaireDeCompte, sceller, verifierMotDePasse
} from '../src/domain/coffre/index.ts';
import { depuisBase64, versBase64 } from '../src/domain/coffre/octets.ts';

const ctx = { proprietaire: 'c0123456789abcdef', table: 'seances', id: 's1' };
const valeur = { id: 's1', remarque: 'Se fatigue en fin de période — élève Zoé', observations: [{ texte: 'Entre dans la tâche', niveau: 2 }] };

describe('base64', () => {
  it('fait l’aller-retour, y compris sur de gros volumes', () => {
    const octets = new Uint8Array(200_000).map((_, i) => i % 251);
    assert.deepEqual(depuisBase64(versBase64(octets)), octets);
  });
  it('refuse un texte qui n’est pas du base64', () => {
    assert.equal(depuisBase64('pas du base64!'), null);
    assert.equal(depuisBase64('abc'), null);
  });
});

describe('chiffrement d’un enregistrement', () => {
  it('rend la valeur d’origine avec la bonne clé', async () => {
    const cle = await nouvelleCle();
    const texte = await sceller(cle, ctx, valeur);
    assert.deepEqual(await ouvrir(cle, ctx, texte), valeur);
  });

  it('ne laisse rien de lisible dans le texte enregistré', async () => {
    const cle = await nouvelleCle();
    const texte = await sceller(cle, ctx, valeur);
    assert.ok(texte.startsWith(`${PREFIXE_SCELLE}.`) && estScelle(texte));
    for (const mot of ['fatigue', 'Zoé', 'Entre dans la tâche', 'remarque']) assert.ok(!texte.includes(mot), mot);
  });

  it('donne un texte différent à chaque fois (IV aléatoire)', async () => {
    const cle = await nouvelleCle();
    assert.notEqual(await sceller(cle, ctx, valeur), await sceller(cle, ctx, valeur));
  });

  it('refuse une autre clé', async () => {
    const texte = await sceller(await nouvelleCle(), ctx, valeur);
    await assert.rejects(ouvrir(await nouvelleCle(), ctx, texte), (e: unknown) => e instanceof ErreurCoffre && e.code === 'illisible');
  });

  it('refuse un enregistrement déplacé : autre identifiant, autre table, autre propriétaire', async () => {
    const cle = await nouvelleCle();
    const texte = await sceller(cle, ctx, valeur);
    for (const autre of [{ ...ctx, id: 's2' }, { ...ctx, table: 'eleves' }, { ...ctx, proprietaire: 'cffffffffffffffff' }]) {
      await assert.rejects(ouvrir(cle, autre, texte), (e: unknown) => e instanceof ErreurCoffre && e.code === 'illisible');
    }
  });

  it('refuse un texte modifié, d’un seul caractère', async () => {
    const cle = await nouvelleCle();
    const texte = await sceller(cle, ctx, valeur);
    const [p, iv, ct] = texte.split('.') as [string, string, string];
    const octets = depuisBase64(ct)!;
    octets[3] = (octets[3]! + 1) % 256;
    await assert.rejects(ouvrir(cle, ctx, [p, iv, versBase64(octets)].join('.')), (e: unknown) => e instanceof ErreurCoffre && e.code === 'illisible');
  });

  it('reconnaît un texte de forme inconnue', async () => {
    const cle = await nouvelleCle();
    for (const mauvais of ['', 'texte clair', 'j2c1.abc', 'j2c9.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', `${PREFIXE_SCELLE}.${versBase64(new Uint8Array(12))}.AA==`]) {
      await assert.rejects(ouvrir(cle, ctx, mauvais), (e: unknown) => e instanceof ErreurCoffre && e.code === 'format', mauvais);
    }
    assert.equal(estScelle('{"id":"x"}'), false);
    assert.equal(estScelle(undefined), false);
  });

  it('crée une clé impossible à exporter', async () => {
    const cle = await nouvelleCle();
    assert.equal(cle.extractable, false);
    await assert.rejects(globalThis.crypto.subtle.exportKey('raw', cle));
  });

  it('garde les accents, les emojis et les très longs textes', async () => {
    const cle = await nouvelleCle();
    const v = { t: 'À l’école, élève « Zoë » — 日本語 🙂'.repeat(5000) };
    assert.deepEqual(await ouvrir(cle, ctx, await sceller(cle, ctx, v)), v);
  });
});

describe('propriétaire des données', () => {
  it('donne une empreinte stable, propre à chaque compte, sans l’identifiant dedans', async () => {
    const a = await proprietaireDeCompte('11111111-aaaa-bbbb-cccc-000000000001');
    assert.equal(a, await proprietaireDeCompte('11111111-aaaa-bbbb-cccc-000000000001'));
    assert.notEqual(a, await proprietaireDeCompte('11111111-aaaa-bbbb-cccc-000000000002'));
    assert.match(a, /^c[0-9a-f]{16}$/);
    assert.ok(estProprietaireValide(a));
  });
  it('connaît le mode essai et refuse le reste', () => {
    assert.ok(estProprietaireValide(PROPRIETAIRE_ESSAI));
    for (const x of ['', 'C0123456789abcdef', 'c123', '../autre', 'essai2']) assert.equal(estProprietaireValide(x), false, x);
  });
  it('range chaque espace dans sa propre base, distincte de l’ancienne', () => {
    assert.equal(nomBaseDe('essai'), 'journalier-v2-essai');
    assert.notEqual(nomBaseDe('c0123456789abcdef'), 'journalier-v2');
  });
});

describe('copie de secours protégée par un mot de passe', () => {
  const copie = JSON.stringify({ schema: 'journalier-v2-copie/1', eleves: [{ id: 'a', nom: 'Dupont' }] });
  const FAIBLE = { iterations: 1_000 }; // les tests vont vite ; l’application en utilise 600 000

  it('fait l’aller-retour avec le bon mot de passe', async () => {
    const fichier = await chiffrerCopie(copie, 'un bon mot de passe', FAIBLE);
    assert.ok(estCopieChiffree(fichier));
    assert.deepEqual(await dechiffrerCopie(fichier, 'un bon mot de passe'), { ok: true, texte: copie });
  });

  it('ne montre rien du contenu', async () => {
    const fichier = await chiffrerCopie(copie, 'un bon mot de passe', FAIBLE);
    for (const mot of ['Dupont', 'eleves', 'journalier-v2-copie/1']) assert.ok(!fichier.includes(mot), mot);
  });

  it('refuse un mauvais mot de passe sans rien rendre', async () => {
    const fichier = await chiffrerCopie(copie, 'un bon mot de passe', FAIBLE);
    const r = await dechiffrerCopie(fichier, 'un autre mot de passe');
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.raison, 'mot-de-passe');
  });

  it('refuse un fichier modifié', async () => {
    const o = JSON.parse(await chiffrerCopie(copie, 'un bon mot de passe', FAIBLE)) as { chiffre: string };
    const octets = depuisBase64(o.chiffre)!;
    octets[0] = (octets[0]! + 1) % 256;
    const r = await dechiffrerCopie(JSON.stringify({ ...o, chiffre: versBase64(octets) }), 'un bon mot de passe');
    assert.equal(r.ok, false);
  });

  it('traite pareil les écritures différentes d’un même accent (NFC)', async () => {
    const fichier = await chiffrerCopie(copie, 'café-très-long', FAIBLE);
    assert.equal((await dechiffrerCopie(fichier, 'café-très-long')).ok, true);
  });

  it('donne un fichier différent à chaque fois (sel et IV aléatoires)', async () => {
    assert.notEqual(await chiffrerCopie(copie, 'un bon mot de passe', FAIBLE), await chiffrerCopie(copie, 'un bon mot de passe', FAIBLE));
  });

  it('exige un mot de passe d’au moins 8 caractères', async () => {
    assert.ok(verifierMotDePasse('court'));
    assert.ok(verifierMotDePasse('        '));
    assert.equal(verifierMotDePasse('huit car'), null);
    await assert.rejects(chiffrerCopie(copie, 'court'));
  });

  it('ne prend pas une copie en clair, ni un fichier étranger, pour une copie chiffrée', async () => {
    assert.equal(estCopieChiffree(copie), false);
    assert.equal(estCopieChiffree('n’importe quoi'), false);
    assert.equal(estCopieChiffree(JSON.stringify({ x: 1 })), false);
    const r = await dechiffrerCopie(copie, 'un bon mot de passe');
    assert.equal(!r.ok && r.raison, 'format');
  });

  it('refuse un fichier chiffré incomplet ou aux réglages absurdes', async () => {
    const o = JSON.parse(await chiffrerCopie(copie, 'un bon mot de passe', FAIBLE)) as Record<string, unknown>;
    for (const abime of [{ ...o, iterations: 3 }, { ...o, iterations: 10 ** 12 }, { ...o, iv: 'AA==' }, { ...o, sel: 5 }, { ...o, kdf: 'MD5' }, { ...o, chiffre: 'AA==' }]) {
      const r = await dechiffrerCopie(JSON.stringify(abime), 'un bon mot de passe');
      assert.equal(!r.ok && r.raison, 'format', JSON.stringify(abime).slice(0, 60));
    }
    const plusRecent = await dechiffrerCopie(JSON.stringify({ ...o, schema: 'journalier-v2-copie-chiffree/2' }), 'un bon mot de passe');
    assert.match(!plusRecent.ok ? plusRecent.erreur : '', /plus récente/);
  });
});
