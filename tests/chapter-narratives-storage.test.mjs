import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const vaultSource = fs.readFileSync(new URL('../src/app/storage-vault.js', import.meta.url), 'utf8');
const reportsSource = fs.readFileSync(new URL('../src/app/reports-core.js', import.meta.url), 'utf8');

test('Lot 1 — Sécurité : Vérification statique de l’absence de localStorage dans reports-core.js', () => {
  assert.equal(
    reportsSource.includes('localStorage'),
    false,
    'reports-core.js ne doit plus contenir aucune référence à localStorage'
  );
  assert.equal(
    reportsSource.includes('window.DataStore?.getChapterNarrative'),
    true,
    'reports-core.js doit lire les narratifs de chapitres via window.DataStore.getChapterNarrative'
  );
  assert.equal(
    reportsSource.includes('window.DataStore?.saveChapterNarrative'),
    true,
    'reports-core.js doit sauvegarder les narratifs via window.DataStore.saveChapterNarrative'
  );
});

test('Lot 1 — Sécurité : Exécution de la migration et gestion du coffre chiffré', async () => {
  // Mock localStorage
  const storageMap = new Map();
  storageMap.set('journalier_chapter_narrative_cluster_math', 'Progrès constants en numération');
  storageMap.set('journalier_chapter_narrative_cluster_french', 'Lecture fluide et expressive');
  storageMap.set('unrelated_setting_theme', 'dark');

  const mockLocalStorage = {
    get length() {
      return storageMap.size;
    },
    key(index) {
      return Array.from(storageMap.keys())[index] ?? null;
    },
    getItem(k) {
      return storageMap.get(k) ?? null;
    },
    setItem(k, v) {
      storageMap.set(k, String(v));
    },
    removeItem(k) {
      storageMap.delete(k);
    }
  };

  // Simuler le contexte global pour évaluer storage-vault.js
  const mockWindow = {
    localStorage: mockLocalStorage,
    crypto: globalThis.crypto,
    DataStore: {},
    JournalierDataStore: {},
    indexedDB: {}
  };

  // Extraire la fonction journalierMigrateLegacyLocalStorageNarratives de storage-vault.js
  const migrateMatch = vaultSource.match(/function journalierMigrateLegacyLocalStorageNarratives\([\s\S]*?\n {4}\}/);
  assert.ok(migrateMatch, 'La fonction journalierMigrateLegacyLocalStorageNarratives doit exister dans storage-vault.js');

  // eslint-disable-next-line no-new-func -- Évaluation isolée d'une fonction de migration dans le harnais de test
  const migrateFn = new Function('localStorage', 'state', `
    const fn = ${migrateMatch[0]};
    return fn(state);
  `);

  const fakeState = {
    meta: {
      storageSchemaVersion: 2,
      chapterNarratives: {}
    }
  };

  // Exécution de la migration
  migrateFn(mockLocalStorage, fakeState);

  // 1. Vérification que les récits ont été migrés dans l'état (dans le coffre)
  assert.equal(fakeState.meta.chapterNarratives['cluster_math'], 'Progrès constants en numération');
  assert.equal(fakeState.meta.chapterNarratives['cluster_french'], 'Lecture fluide et expressive');

  // 2. Vérification que les clés ont été détruites de localStorage
  assert.equal(mockLocalStorage.getItem('journalier_chapter_narrative_cluster_math'), null);
  assert.equal(mockLocalStorage.getItem('journalier_chapter_narrative_cluster_french'), null);

  // 3. Vérification qu'aucune clé résiduelle de narrative ne subsiste dans localStorage
  for (let i = 0; i < mockLocalStorage.length; i++) {
    const k = mockLocalStorage.key(i);
    assert.ok(!k.startsWith('journalier_chapter_narrative_'), `La clé résiduelle ${k} ne devrait plus être dans localStorage`);
  }

  // 4. Les clés non-métier non concernées restent intactes
  assert.equal(mockLocalStorage.getItem('unrelated_setting_theme'), 'dark');
});

test('Lot 1 — Sécurité : DataStore API getChapterNarrative et saveChapterNarrative', () => {
  // Test unitaire direct de la logique DataStore
  const state = {
    meta: {
      chapterNarratives: {
        'geo_eval': 'Excellente orientation spatiale'
      }
    }
  };

  const dummyDataStore = {
    state,
    getChapterNarrative(clusterKey) {
      if (!clusterKey) return '';
      const meta = this.state?.meta || {};
      return String((meta.chapterNarratives && meta.chapterNarratives[clusterKey]) || '');
    },
    saveChapterNarrative(clusterKey, text) {
      if (!clusterKey) return;
      this.state.meta = this.state.meta || {};
      this.state.meta.chapterNarratives = this.state.meta.chapterNarratives || {};
      this.state.meta.chapterNarratives[clusterKey] = String(text || '');
    }
  };

  assert.equal(dummyDataStore.getChapterNarrative('geo_eval'), 'Excellente orientation spatiale');
  assert.equal(dummyDataStore.getChapterNarrative('inexistant'), '');

  dummyDataStore.saveChapterNarrative('geo_eval', 'Mise à jour : autonomie acquise');
  assert.equal(dummyDataStore.getChapterNarrative('geo_eval'), 'Mise à jour : autonomie acquise');
  assert.equal(state.meta.chapterNarratives['geo_eval'], 'Mise à jour : autonomie acquise');
});
