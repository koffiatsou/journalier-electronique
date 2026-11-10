import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
// @ts-expect-error : script de compilation en JavaScript, sans déclaration de types
import { choisirSorties } from '../scripts/build.mjs';

describe('page d’entrée de la compilation', () => {
  it('appelle le fichier de src/main.tsx, pas un morceau chargé à la demande qui apparaît avant lui', () => {
    const sorties = {
      'dist/assets/chunks/philosophie-AAAA.js': { entryPoint: 'src/data/referentiel/philosophie.json' },
      'dist/assets/chunks/arts-BBBB.js': { entryPoint: 'src/data/referentiel/arts.json' },
      'dist/assets/main-CCCC.js': { entryPoint: 'src/main.tsx' },
      'dist/assets/main-DDDD.css': { entryPoint: 'src/main.tsx' }
    };
    assert.deepEqual(choisirSorties(sorties), { js: 'main-CCCC.js', css: 'main-DDDD.css' });
  });
  it('ne choisit aucun script plutôt qu’un morceau quand l’entrée manque', () => {
    assert.equal(choisirSorties({ 'dist/assets/chunks/arts-BBBB.js': { entryPoint: 'src/data/referentiel/arts.json' } }).js, undefined);
  });
});
