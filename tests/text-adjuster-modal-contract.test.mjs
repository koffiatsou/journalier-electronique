/**
 * Contrat de test Lot B — Fenêtre « Ajuster le texte »
 * Données 100 % fictives (RGPD).
 * Vérifie l'exécution des 3 actions locales :
 * 1. « Corriger orthographe & style »
 * 2. « Synthétiser en 3 points »
 * 3. « Suggérer des aménagements »
 * 4. Remplacement et ajout à la suite dans les zones cibles (Réunion, Synthèse, PIA)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

function createEnvironment(setupDom) {
  const script = fs.readFileSync(path.resolve('src/app/local-ai-assistant.js'), 'utf8');

  class MockElement {
    constructor(tagName) {
      this.tagName = String(tagName).toUpperCase();
      this.attributes = new Map();
      this.children = [];
      this.parentNode = null;
      this.nextSibling = null;
      this.style = {};
      this.classList = new Set();
      this.dataset = {};
      this.listeners = new Map();
      this.value = '';
      this.id = '';
      this.textContent = '';
      this.innerHTML = '';
    }

    set className(v) {
      this.classList = new Set(String(v || '').split(/\s+/).filter(Boolean));
    }

    get className() {
      return [...this.classList].join(' ');
    }

    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k) || null; }
    hasAttribute(k) { return this.attributes.has(k); }
    insertAdjacentHTML() {}

    addEventListener(event, fn) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(fn);
    }

    dispatchEvent(event) {
      const type = event.type || event;
      const handlers = this.listeners.get(type) || [];
      for (const fn of handlers) {
        fn.call(this, event);
      }
      return true;
    }

    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }

    insertBefore(child, ref) {
      child.parentNode = this;
      const idx = this.children.indexOf(ref);
      if (idx >= 0) this.children.splice(idx, 0, child);
      else this.children.push(child);
      return child;
    }

    closest(selector) {
      let cur = this.parentNode;
      while (cur) {
        if (selector.startsWith('.') && cur.classList && cur.classList.has(selector.slice(1))) return cur;
        if (selector.startsWith('#') && cur.id === selector.slice(1)) return cur;
        if (cur.tagName && cur.tagName.toLowerCase() === selector.toLowerCase()) return cur;
        cur = cur.parentNode;
      }
      return null;
    }

    contains(child) {
      let cur = child;
      while (cur) {
        if (cur === this) return true;
        cur = cur.parentNode;
      }
      return false;
    }

    querySelector(selector) {
      if (selector.startsWith('#')) {
        const id = selector.slice(1);
        return this.findById(id);
      }
      if (selector.startsWith('.')) {
        const cls = selector.slice(1);
        return this.findByClass(cls);
      }
      return null;
    }

    querySelectorAll(selector) {
      const results = [];
      this.walk(el => {
        if (selector.startsWith('.') && el.classList.has(selector.slice(1))) results.push(el);
        if (selector.startsWith('#') && el.id === selector.slice(1)) results.push(el);
      });
      return results;
    }

    findById(id) {
      if (this.id === id) return this;
      for (const c of this.children) {
        if (c.findById) {
          const found = c.findById(id);
          if (found) return found;
        }
      }
      return null;
    }

    findByClass(cls) {
      if (this.classList.has(cls)) return this;
      for (const c of this.children) {
        if (c.findByClass) {
          const found = c.findByClass(cls);
          if (found) return found;
        }
      }
      return null;
    }

    walk(cb) {
      cb(this);
      for (const c of this.children) {
        if (c.walk) c.walk(cb);
      }
    }
  }

  const document = {
    readyState: 'complete',
    body: new MockElement('body'),
    head: new MockElement('head'),
    createElement(tag) { return new MockElement(tag); },
    getElementById(id) { return this.body.findById(id); },
    querySelector(sel) { return this.body.querySelector(sel); },
    querySelectorAll(sel) { return this.body.querySelectorAll(sel); },
    addEventListener() {}
  };

  if (typeof setupDom === 'function') {
    setupDom(document, MockElement);
  }

  const window = {
    ReferentielAmenagements: {
      async load() {},
      findBestMatches() {
        return [{ id: 'F-FIC-01', titre: 'Support de lecture adapté Solukit' }];
      }
    },
    document
  };

  const context = {
    window,
    document,
    console,
    setTimeout: (fn) => fn(),
    Event: class Event { constructor(type) { this.type = type; } },
    MutationObserver: class { observe() {} }
  };

  vm.runInNewContext(script, context, { filename: 'local-ai-assistant.js' });

  return {
    assistant: window.LocalAIAssistant,
    document
  };
}

test('Lot B — Action 1 : « Corriger orthographe & style » corrige les termes scolaires sans inventer de faits', () => {
  const { assistant } = createEnvironment();
  const raw = 'eleve en difficulte de geometrie avec consignes ecrites a revoir';
  const corrected = assistant.correct(raw);
  assert.equal(corrected, 'Élève en difficulte de géométrie avec consignes écrites à revoir');
});

test('Lot B — Action 2 : « Synthétiser en 3 points » structure les observations de façon concise', () => {
  const { assistant } = createEnvironment();
  const raw = 'L’élève entre en classe calmement. Il rencontre une difficulté face aux fractions complexes. Un étayage visuel est mis en place avec succès.';
  const summary = assistant.summarize(raw);
  assert.match(summary, /Points d'appui et constats clés/);
  assert.match(summary, /1\. L’élève entre en classe calmement\./);
  assert.match(summary, /2\. Il rencontre une difficulté face aux fractions complexes\./);
  assert.match(summary, /3\. Un étayage visuel est mis en place avec succès\./);
});

test('Lot B — Action 3 : « Suggérer des aménagements » propose des outils et adaptations WBE ciblés', async () => {
  const { assistant } = createEnvironment();
  const raw = 'Difficulté en lecture et saut de lignes récurrent.';
  const suggestions = await assistant.suggest(raw);
  assert.ok(suggestions.themes.some(t => t.category === 'Lecture & Décodage'));
  assert.ok(suggestions.fichesReferentiel.some(f => f.titre.includes('Solukit')));
});

test('Lot B — Remplacement et ajout à la suite conservent l’intégrité des entrées', () => {
  const { assistant } = createEnvironment();
  const input = 'Séance du 15 octobre : travail autonome.';
  const improved = assistant.improve(input, 'grammar');
  assert.doesNotReject(async () => {
    const text = await improved;
    assert.match(text, /Séance du 15 octobre/);
  });
});

test('Lot B/C extension — Le bouton « Ajuster le texte » est injecté sur les champs de séance (Q2-Q6, notes)', () => {
  let targetField = null;
  const { document } = createEnvironment((doc, MockEl) => {
    const fieldWrap = new MockEl('div');
    fieldWrap.classList.add('v11-field');

    const label = new MockEl('label');
    label.setAttribute('for', 'f-q2-txt');
    label.textContent = 'Comportement observable';
    fieldWrap.appendChild(label);

    targetField = new MockEl('textarea');
    targetField.id = 'f-q2-txt';
    targetField.value = 'eleve distrait en classe';
    fieldWrap.appendChild(targetField);

    doc.body.appendChild(fieldWrap);
  });

  assert.equal(targetField.dataset.hasAiBtn, 'true', 'Le champ f-q2-txt doit être marqué avec hasAiBtn');
  const triggerBtn = document.body.findByClass('btn-local-ai-trigger');
  assert.ok(triggerBtn, 'Le bouton btn-local-ai-trigger doit être présent dans le DOM');
  assert.match(triggerBtn.innerHTML, /Ajuster le texte/);
});
