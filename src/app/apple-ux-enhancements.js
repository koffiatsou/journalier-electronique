/**
 * Journalier Électronique — Apple UX Enhancements Module (Lot 6)
 *
 * Ce module est strictement additif et non destructif :
 * - Il conserve à 100 % le moteur métier du Lot 5 (DataStore, IndexedDB, SyncManager, Agenda, PIA).
 * - Les <input type="range">, <input type="checkbox"> et <select> natifs restent la source de vérité.
 * - Intègre les améliorations UX Apple validées et corrige les 5 anomalies identifiées lors de l'audit.
 */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAppleUX);
} else {
  initAppleUX();
}

function initAppleUX() {
  initVoiceDictation();
  initSessionStepperAndStickyBar();
  initHomeDayRibbon();
  initQuickSessionBridge();
  // Niveaux Q2/Q4 : gérés par session-levels.js
  initQ3DirectLiquidItems();
  initGlobalDropdownCloser();
  initUniversalBubbleDeselection();
  initBubbleVisualSync();
  initReportsExportMenuEnhancements();
  initCollapsibleProfileSessions();
  initHistoryDetailDrawerToggle();
}

function initReportsExportMenuEnhancements() {
  const exportDetails = document.getElementById('reports-exports');
  if (!exportDetails) return;

  document.addEventListener('click', (e) => {
    if (exportDetails.open && !exportDetails.contains(e.target)) {
      exportDetails.removeAttribute('open');
    }
  });

  const exportBtn = document.getElementById('reports-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      setTimeout(() => {
        exportDetails.removeAttribute('open');
      }, 400);
    });
  }
}

function closeAllLiquidDropdowns() {
  document.querySelectorAll('.apple-liquid-dropdown').forEach(d => d.remove());
  document.querySelectorAll('.has-open-dropdown').forEach(el => el.classList.remove('has-open-dropdown'));
}

function initGlobalDropdownCloser() {
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.apple-item-liquid-badge') && !e.target.closest('.apple-liquid-dropdown')) {
      closeAllLiquidDropdowns();
    }
  });
}

/**
 * DÉSÉLECTION UNIVERSELLE :
 * Permet de désélectionner n'importe quelle bulle de select (ex. Point 6 Évolution modalité,
 * Objectif PIA, Point 4 Situation, Point 5 Transfert) en recliquant simplement dessus.
 */
function initUniversalBubbleDeselection() {
  document.querySelectorAll('.ux-select-bubbles').forEach(group => {
    const selectId = group.getAttribute('data-select-bubbles');
    const select = document.getElementById(selectId);
    if (!select) return;

    group.querySelectorAll('.ux-select-bubble').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const val = btn.dataset.value;
        if (btn.classList.contains('is-active') && val !== '' && val !== 'none') {
          e.preventDefault();
          e.stopImmediatePropagation();

          const defaultVal = select.querySelector('option[value=""]')
            ? ''
            : (select.querySelector('option[value="none"]') ? 'none' : '');
          select.value = defaultVal;

          group.querySelectorAll('.ux-select-bubble').forEach(b => {
            b.classList.toggle('is-active', b.dataset.value === defaultVal);
          });

          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, true);
    });
  });

  document.querySelectorAll('.ux-bubble input[type="radio"]').forEach(radio => {
    let wasChecked = radio.checked;
    radio.addEventListener('pointerdown', () => {
      wasChecked = radio.checked;
    });
    radio.addEventListener('click', () => {
      if (wasChecked) {
        radio.checked = false;
        const bubble = radio.closest('.ux-bubble');
        if (bubble) bubble.classList.remove('is-active');
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
}

/**
 * SYNCHRONISATION VISUELLE DE TOUTES LES BULLES :
 * Garantit que la couleur bleu Apple (#edf5ff) et la classe .is-active
 * s'appliquent immédiatement et de manière 100 % cohérente sur chaque case, y compris au reset.
 */
function initBubbleVisualSync() {
  const syncBubble = (input) => {
    const bubble = input.closest('.ux-bubble') || input.closest('.f-modalite-pill');
    if (bubble) {
      bubble.classList.toggle('is-active', Boolean(input.checked));
    }
  };

  document.querySelectorAll('.ux-bubble input, .f-modalite-pill input').forEach(input => {
    syncBubble(input);
    input.addEventListener('change', () => syncBubble(input));
    input.addEventListener('input', () => syncBubble(input));
  });

  const form = document.getElementById('observationForm');
  if (form) {
    form.addEventListener('change', () => {
      document.querySelectorAll('.ux-bubble input, .f-modalite-pill input').forEach(syncBubble);
    });
    form.addEventListener('reset', () => {
      setTimeout(() => {
        document.querySelectorAll('.ux-bubble input, .f-modalite-pill input').forEach(syncBubble);
      }, 10);
    });
  }
}

/**
 * 1. QUESTION 2 : L'ITEM DEVIENT LA JAUGE LIQUIDE DIRECTE
 * Pastille AU-DESSUS du libellé, avec micro-menu déroulant en 1 tap synchronisé avec l'input[type="range"].
 */
function initQ2DirectLiquidItems() {
  const items = document.querySelectorAll('.q2-observation-item');

  const q2Configs = [
    {
      level: 0,
      label: '🌱 Partiellement',
      badgeClass: 'badge-liquid-level-25',
      fillBg: 'linear-gradient(to right, rgba(234, 88, 12, 0.16) 0%, rgba(234, 88, 12, 0.16) 25%, #ffffff 25%, #ffffff 100%)'
    },
    {
      level: 1,
      label: '🌿 Suffisamment',
      badgeClass: 'badge-liquid-level-60',
      fillBg: 'linear-gradient(to right, rgba(0, 113, 227, 0.26) 0%, rgba(0, 113, 227, 0.26) 60%, #ffffff 60%, #ffffff 100%)'
    },
    {
      level: 2,
      label: '✨ Totalement',
      badgeClass: 'badge-liquid-level-100',
      fillBg: 'linear-gradient(to right, rgba(52, 199, 89, 0.28) 0%, rgba(52, 199, 89, 0.28) 100%, #ffffff 100%)'
    }
  ];

  items.forEach(item => {
    const checkbox = item.querySelector('input[type="checkbox"]');
    const range = item.querySelector('input[type="range"]');
    if (!checkbox || !range) return;

    const oldLevel = item.querySelector('.q2-level');
    if (oldLevel) oldLevel.style.setProperty('display', 'none', 'important');

    let badge = item.querySelector('.apple-item-liquid-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'apple-item-liquid-badge';
      badge.title = 'Choisir le niveau (Partiellement, Suffisamment, Totalement)';
      item.insertBefore(badge, item.firstChild);
    }

    const renderState = () => {
      if (!checkbox.checked) {
        item.style.setProperty('background', '#ffffff', 'important');
        badge.style.setProperty('display', 'none', 'important');
        item.classList.remove('is-observed', 'has-open-dropdown');
        return;
      }

      const val = Math.min(2, Math.max(0, parseInt(range.value, 10) || 0));
      const cfg = q2Configs[val];

      item.style.setProperty('background', cfg.fillBg, 'important');
      item.classList.add('is-observed');

      badge.style.setProperty('display', 'inline-flex', 'important');
      badge.className = `apple-item-liquid-badge ${cfg.badgeClass}`;
      badge.innerHTML = `<span>${cfg.label}</span><span class="apple-badge-chevron">▾</span>`;
    };

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const existingDropdown = item.querySelector('.apple-liquid-dropdown');
      if (existingDropdown) {
        existingDropdown.remove();
        item.classList.remove('has-open-dropdown');
        return;
      }
      closeAllLiquidDropdowns();

      item.classList.add('has-open-dropdown');
      const currentVal = parseInt(range.value, 10) || 0;
      const dropdown = document.createElement('div');
      dropdown.className = 'apple-liquid-dropdown';

      q2Configs.forEach((opt, idx) => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.className = `apple-dropdown-option ${idx === currentVal ? 'is-selected' : ''}`;
        optBtn.innerHTML = `<span>${opt.label}</span>`;
        optBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          range.value = String(idx);
          range.dispatchEvent(new Event('input', { bubbles: true }));
          range.dispatchEvent(new Event('change', { bubbles: true }));
          renderState();
          dropdown.remove();
          item.classList.remove('has-open-dropdown');
        });
        dropdown.appendChild(optBtn);
      });

      badge.appendChild(dropdown);
    });

    checkbox.addEventListener('change', renderState);
    range.addEventListener('input', renderState);
    range.addEventListener('change', renderState);

    let isDragging = false;
    item.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.apple-item-liquid-badge') || e.target.closest('.apple-liquid-dropdown')) return;
      isDragging = true;
    });

    item.addEventListener('pointermove', (e) => {
      if (!isDragging || !checkbox.checked) return;
      const rect = item.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      let targetVal = 0;
      if (ratio > 0.70) targetVal = 2;
      else if (ratio > 0.35) targetVal = 1;

      if (parseInt(range.value, 10) !== targetVal) {
        range.value = String(targetVal);
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
        renderState();
      }
    });

    window.addEventListener('pointerup', () => { isDragging = false; });

    renderState();
  });

  const form = document.getElementById('observationForm');
  if (form) {
    form.addEventListener('reset', () => {
      setTimeout(() => {
        items.forEach(item => {
          item.style.setProperty('background', '#ffffff', 'important');
          item.classList.remove('is-observed', 'has-open-dropdown');
          const badge = item.querySelector('.apple-item-liquid-badge');
          if (badge) badge.style.setProperty('display', 'none', 'important');
        });
      }, 15);
    });
  }
}

/**
 * 2. QUESTION 3 : INDICATEURS D'APPRENTISSAGE — ITEM DEVIENT LA JAUGE LIQUIDE DIRECTE
 * Pas de panneau secondaire déporté : la bulle/carte porte directement sa jauge et son niveau.
 * - Simple clic : sélectionne ou DÉSÉLECTIONNE instantanément (toggle).
 * - Clic maintenu + glissement horizontal (gauche/droite) sur PC/tactile : fait évoluer le niveau
 *   en continu entre "À renforcer", "En cours d’appropriation" et "Maîtrisé".
 * - Clic sur la pastille : micro-menu déroulant en 1 clic pour choisir directement le niveau.
 */
function initQ3DirectLiquidItems() {
  const sec = document.getElementById('q3-assessment-section');
  if (sec) {
    sec.classList.add('hidden');
    sec.style.setProperty('display', 'none', 'important');
  }

  const q3Configs = [
    {
      level: 0,
      label: '🌱 À renforcer',
      badgeClass: 'badge-liquid-level-25',
      fillBg: 'linear-gradient(to right, rgba(234, 88, 12, 0.16) 0%, rgba(234, 88, 12, 0.16) 25%, #ffffff 25%, #ffffff 100%)'
    },
    {
      level: 1,
      label: '💧 En cours d’appropriation',
      badgeClass: 'badge-liquid-level-60',
      fillBg: 'linear-gradient(to right, rgba(0, 113, 227, 0.26) 0%, rgba(0, 113, 227, 0.26) 60%, #ffffff 60%, #ffffff 100%)'
    },
    {
      level: 2,
      label: '✨ Maîtrisé',
      badgeClass: 'badge-liquid-level-100',
      fillBg: 'linear-gradient(to right, rgba(52, 199, 89, 0.28) 0%, rgba(52, 199, 89, 0.28) 100%, #ffffff 100%)'
    }
  ];

  function getQ3State() {
    if (!window.q3AssessmentState) {
      window.q3AssessmentState = (typeof q3AssessmentState !== 'undefined') ? q3AssessmentState : {};
    }
    return window.q3AssessmentState;
  }

  function attachItem(item) {
    const checkbox = item.querySelector('input[type="checkbox"][name="q3-learning"]');
    if (!checkbox) return;
    const id = String(checkbox.dataset.indicatorId || checkbox.value || '');

    let badge = item.querySelector('.apple-item-liquid-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'apple-item-liquid-badge';
      badge.title = 'Choisir le niveau (À renforcer, En cours d’appropriation, Maîtrisé)';
      item.insertBefore(badge, item.firstChild);
    }

    const getVal = () => {
      const state = getQ3State();
      if (Object.prototype.hasOwnProperty.call(state, id)) {
        return Math.min(2, Math.max(0, parseInt(state[id], 10) || 0));
      }
      return 1;
    };

    const setVal = (val) => {
      val = Math.min(2, Math.max(0, parseInt(val, 10) || 0));
      const state = getQ3State();
      state[id] = val;
      if (typeof q3AssessmentState !== 'undefined') q3AssessmentState[id] = val;
    };

    const renderState = () => {
      if (!checkbox.checked) {
        item.style.setProperty('background', '#ffffff', 'important');
        item.style.removeProperty('border-color');
        item.style.removeProperty('color');
        item.classList.remove('is-active', 'has-open-dropdown');
        badge.style.setProperty('display', 'none', 'important');
        return;
      }

      const val = getVal();
      const cfg = q3Configs[val];

      item.style.setProperty('background', cfg.fillBg, 'important');
      item.classList.add('is-active');

      badge.style.setProperty('display', 'inline-flex', 'important');
      badge.className = `apple-item-liquid-badge ${cfg.badgeClass}`;
      badge.innerHTML = `<span>${cfg.label}</span><span class="apple-badge-chevron">▾</span>`;
    };

    item._liquidRenderState = renderState;

    if (item.dataset.liquidHandlersAttached === 'true') {
      renderState();
      return;
    }
    item.dataset.liquidHandlersAttached = 'true';

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const existingDropdown = item.querySelector('.apple-liquid-dropdown');
      if (existingDropdown) {
        existingDropdown.remove();
        item.classList.remove('has-open-dropdown');
        return;
      }
      closeAllLiquidDropdowns();

      item.classList.add('has-open-dropdown');
      const currentVal = getVal();
      const dropdown = document.createElement('div');
      dropdown.className = 'apple-liquid-dropdown';

      q3Configs.forEach((opt, idx) => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.className = `apple-dropdown-option ${idx === currentVal ? 'is-selected' : ''}`;
        optBtn.innerHTML = `<span>${opt.label}</span>`;
        optBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          setVal(idx);
          renderState();
          dropdown.remove();
          item.classList.remove('has-open-dropdown');
        });
        dropdown.appendChild(optBtn);
      });

      badge.appendChild(dropdown);
    });

    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        const state = getQ3State();
        if (!Object.prototype.hasOwnProperty.call(state, id)) {
          setVal(1);
        }
      } else {
        const state = getQ3State();
        delete state[id];
        if (typeof q3AssessmentState !== 'undefined') delete q3AssessmentState[id];
      }
      renderState();
    });

    let isDragging = false;
    let hasDragged = false;
    let startX = 0;

    item.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.apple-item-liquid-badge') || e.target.closest('.apple-liquid-dropdown')) return;
      isDragging = true;
      hasDragged = false;
      startX = e.clientX;
    });

    item.addEventListener('pointermove', (e) => {
      if (!isDragging || !checkbox.checked) return;
      const delta = Math.abs(e.clientX - startX);
      if (delta > 8) {
        hasDragged = true;
      }
      const rect = item.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      let targetVal = 0;
      if (ratio > 0.70) targetVal = 2;
      else if (ratio > 0.35) targetVal = 1;

      if (getVal() !== targetVal) {
        setVal(targetVal);
        renderState();
      }
    });

    item.addEventListener('click', (e) => {
      if (hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        hasDragged = false;
      }
    });

    window.addEventListener('pointerup', () => {
      isDragging = false;
    });

    renderState();
  }

  const items = document.querySelectorAll('.q3-library-bubble, .q3-custom-item');
  items.forEach(attachItem);

  ['q3-learning-suggestions', 'q3-custom-list'].forEach(boxId => {
    const box = document.getElementById(boxId);
    if (box && !box._liquidObserver) {
      const observer = new MutationObserver(() => {
        box.querySelectorAll('.q3-library-bubble, .q3-custom-item').forEach(attachItem);
      });
      observer.observe(box, { childList: true });
      box._liquidObserver = observer;
    }
  });

  const form = document.getElementById('observationForm');
  if (form && !form._q3LiquidResetAttached) {
    form._q3LiquidResetAttached = true;
    form.addEventListener('reset', () => {
      setTimeout(() => {
        document.querySelectorAll('.q3-library-bubble, .q3-custom-item').forEach(item => {
          item.style.setProperty('background', '#ffffff', 'important');
          item.classList.remove('is-active', 'has-open-dropdown');
          const badge = item.querySelector('.apple-item-liquid-badge');
          if (badge) badge.style.setProperty('display', 'none', 'important');
        });
      }, 15);
    });
  }
}

window.refreshQ3LiquidItems = initQ3DirectLiquidItems;

/**
 * 3. QUESTION 4 : L'ITEM D'ADAPTATION DEVIENT LA JAUGE DIRECTE
 * Pastille AU-DESSUS du mot, synchronisée avec #q4-effect-sliders input[data-type="..."].
 */
function initQ4DirectLiquidItems() {
  const q4Container = document.getElementById('q4-types-select');
  if (!q4Container) return;

  const q4Configs = [
    {
      level: 0,
      label: '⚪ Aucun effet',
      badgeClass: 'badge-liquid-level-0',
      fillBg: '#ffffff'
    },
    {
      level: 1,
      label: '💡 Partiel',
      badgeClass: 'badge-liquid-level-60',
      fillBg: 'linear-gradient(to right, rgba(0, 113, 227, 0.26) 0%, rgba(0, 113, 227, 0.26) 55%, #ffffff 55%, #ffffff 100%)'
    },
    {
      level: 2,
      label: '✨ Positif',
      badgeClass: 'badge-liquid-level-100',
      fillBg: 'linear-gradient(to right, rgba(52, 199, 89, 0.28) 0%, rgba(52, 199, 89, 0.28) 100%, #ffffff 100%)'
    }
  ];

  const bubbles = q4Container.querySelectorAll('.ux-bubble');
  bubbles.forEach(bubble => {
    const checkbox = bubble.querySelector('input[name="q4-type"]');
    if (!checkbox) return;
    const type = checkbox.value;

    const oldWrap = bubble.querySelector('.q4-inline-slider-wrap');
    if (oldWrap) oldWrap.remove();

    let badge = bubble.querySelector('.apple-item-liquid-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'apple-item-liquid-badge';
      badge.title = 'Choisir le niveau d’effet (Aucun effet, Partiel, Positif)';
      bubble.insertBefore(badge, bubble.firstChild);
    }

    const renderQ4State = () => {
      if (!checkbox.checked) {
        bubble.style.setProperty('background', '#ffffff', 'important');
        badge.style.setProperty('display', 'none', 'important');
        bubble.classList.remove('is-observed', 'has-open-dropdown');
        return;
      }

      const realRange = document.querySelector(`#q4-effect-sliders input[data-type="${CSS.escape(type)}"]`);
      const val = realRange ? parseInt(realRange.value, 10) : 1;
      const cfg = q4Configs[val] || q4Configs[1];

      bubble.style.setProperty('background', cfg.fillBg, 'important');
      bubble.classList.add('is-observed');

      badge.style.setProperty('display', 'inline-flex', 'important');
      badge.className = `apple-item-liquid-badge ${cfg.badgeClass}`;
      badge.innerHTML = `<span>${cfg.label}</span><span class="apple-badge-chevron">▾</span>`;
    };

    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const existingDropdown = bubble.querySelector('.apple-liquid-dropdown');
      if (existingDropdown) {
        existingDropdown.remove();
        bubble.classList.remove('has-open-dropdown');
        return;
      }
      closeAllLiquidDropdowns();

      bubble.classList.add('has-open-dropdown');
      const realRange = document.querySelector(`#q4-effect-sliders input[data-type="${CSS.escape(type)}"]`);
      const currentVal = realRange ? parseInt(realRange.value, 10) : 1;
      const dropdown = document.createElement('div');
      dropdown.className = 'apple-liquid-dropdown';

      q4Configs.forEach((opt, idx) => {
        const optBtn = document.createElement('button');
        optBtn.type = 'button';
        optBtn.className = `apple-dropdown-option ${idx === currentVal ? 'is-selected' : ''}`;
        optBtn.innerHTML = `<span>${opt.label}</span>`;
        optBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (realRange) {
            realRange.value = String(idx);
            realRange.dispatchEvent(new Event('input', { bubbles: true }));
            realRange.dispatchEvent(new Event('change', { bubbles: true }));
          }
          renderQ4State();
          dropdown.remove();
          bubble.classList.remove('has-open-dropdown');
        });
        dropdown.appendChild(optBtn);
      });

      badge.appendChild(dropdown);
    });

    let isDragging = false;
    let dragStartX = 0;
    bubble.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.apple-item-liquid-badge') || e.target.closest('.apple-liquid-dropdown')) return;
      isDragging = false;
      dragStartX = e.clientX;
      const onMove = (ev) => {
        if (!checkbox.checked) return;
        const dist = Math.abs(ev.clientX - dragStartX);
        if (dist > 6) isDragging = true;
        if (!isDragging) return;
        const rect = bubble.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
        let targetVal = 0;
        if (ratio > 0.70) targetVal = 2;
        else if (ratio > 0.35) targetVal = 1;
        const realRange = document.querySelector(`#q4-effect-sliders input[data-type="${CSS.escape(type)}"]`);
        if (realRange && parseInt(realRange.value, 10) !== targetVal) {
          realRange.value = String(targetVal);
          realRange.dispatchEvent(new Event('input', { bubbles: true }));
          realRange.dispatchEvent(new Event('change', { bubbles: true }));
          renderQ4State();
        }
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    bubble.addEventListener('click', (e) => {
      if (isDragging) {
        e.preventDefault();
        e.stopPropagation();
        isDragging = false;
      }
    }, true);

    checkbox.addEventListener('change', () => {
      setTimeout(renderQ4State, 20);
    });

    renderQ4State();
  });

  const realBox = document.getElementById('q4-effect-sliders');
  if (realBox) {
    const observer = new MutationObserver(() => {
      bubbles.forEach(b => {
        const cb = b.querySelector('input[name="q4-type"]');
        if (cb && cb.checked) {
          const type = cb.value;
          const realRange = document.querySelector(`#q4-effect-sliders input[data-type="${CSS.escape(type)}"]`);
          const val = realRange ? parseInt(realRange.value, 10) : 1;
          const cfg = q4Configs[val] || q4Configs[1];
          b.style.setProperty('background', cfg.fillBg, 'important');
          b.classList.add('is-observed');
          const badge = b.querySelector('.apple-item-liquid-badge');
          if (badge) {
            badge.style.setProperty('display', 'inline-flex', 'important');
            badge.className = `apple-item-liquid-badge ${cfg.badgeClass}`;
            badge.innerHTML = `<span>${cfg.label}</span><span class="apple-badge-chevron">▾</span>`;
          }
        } else {
          b.style.setProperty('background', '#ffffff', 'important');
          b.classList.remove('is-observed', 'has-open-dropdown');
          const badge = b.querySelector('.apple-item-liquid-badge');
          if (badge) badge.style.setProperty('display', 'none', 'important');
        }
      });
    });
    observer.observe(realBox, { childList: true, subtree: true, attributes: true });
  }
}

/**
 * 3. STEPPER TACTILE & BARRE D'ACTION STICKY (Onglet Séance)
 * Compatible avec #page-stage (V37) : la barre sticky n'est visible que lorsque #view-form est dans #page-stage.
 */
function initSessionStepperAndStickyBar() {
  const formView = document.getElementById('view-form');
  const obsForm = document.getElementById('observationForm');
  if (!formView || !obsForm) return;

  const titleElements = Array.from(obsForm.querySelectorAll('.card-title'))
    .filter(el => /^[1-6]\./.test(el.textContent.trim()));
  if (titleElements.length < 6) return;

  const cards = titleElements.map(el => el.closest('.card'));
  const stepTitles = [
    'Créneau et pédagogie',
    'Fonctionnement observé',
    'Compétence travaillée',
    'Ce qui a aidé',
    'Transfert',
    'Suite'
  ];

  let stepper = document.getElementById('apple-session-stepper');
  if (stepper) {
    stepper.innerHTML = '';
  } else {
    stepper = document.createElement('nav');
    stepper.id = 'apple-session-stepper';
    stepper.className = 'apple-session-stepper';
    stepper.setAttribute('aria-label', 'Étapes de la séance');
    formView.insertBefore(stepper, obsForm);
  }

  const getScrollContainer = () => {
    return document.querySelector('.main-container') || formView.closest('.main-container') || document.documentElement;
  };

  const scrollToCard = (targetCard) => {
    if (!targetCard) return;
    const container = getScrollContainer();
    if (container && container !== document.documentElement && container.scrollTo) {
      const containerRect = container.getBoundingClientRect();
      const cardRect = targetCard.getBoundingClientRect();
      const offset = 85;
      const targetScroll = container.scrollTop + (cardRect.top - containerRect.top) - offset;

      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth'
      });
    } else {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const getPresenceMode = () => document.getElementById('f-presence-status')?.value || 'present';

  const getStepSummary = (idx) => {
    const presence = getPresenceMode();
    const isStudentAbsent = presence !== 'present';
    if (idx === 0) {
      const eleve = document.getElementById('f-eleve')?.value?.trim() || '';
      const dateRaw = document.getElementById('f-date')?.value?.trim() || '';
      const dateStr = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw.split('-').reverse().join('/') : dateRaw;
      const mat = document.getElementById('f-matiere')?.value?.trim() || '';
      const pStart = document.getElementById('f-periode-start')?.value || '';
      const pEnd = document.getElementById('f-periode-end')?.value || '';
      const per = pStart && pEnd && pStart !== pEnd ? `${pStart}→${pEnd}` : pStart;
      const badgeMap = {
        absent_eleve_coteach: '🟣 Co-ens. (élève absent)',
        absent_eleve: '🟠 Élève absent',
        absent_prof: '🔵 Prof. absent',
        absent_agent: '🟤 Agent absent'
      };
      const parts = [badgeMap[presence] || '', eleve, dateStr, per, mat].filter(Boolean);
      return parts.length >= 2 ? `✓ ${parts.join(' · ')}` : 'À compléter';
    }
    if (idx === 1) {
      if (isStudentAbsent) return 'Non applicable (élève absent)';
      const checked = obsForm.querySelectorAll('input[name="q2-comprehension"]:checked, input[name="q2-organisation"]:checked, input[name="q2-realisation"]:checked, input[name="q2-aide"]:checked');
      const txt = document.getElementById('f-q2-txt')?.value?.trim();
      if (checked.length > 0) return `✓ ${checked.length} observation${checked.length > 1 ? 's' : ''} cochée${checked.length > 1 ? 's' : ''}${txt ? ' + note' : ''}`;
      if (txt) return '✓ Note qualitative renseignée';
      return 'Facultatif · 0 observation';
    }
    if (idx === 2) {
      if (isStudentAbsent) return 'Non applicable (élève absent)';
      const txt = document.getElementById('f-q3-txt')?.value?.trim();
      return txt ? '✓ Renseignée' : 'Facultatif';
    }
    if (idx === 3) {
      if (isStudentAbsent) return 'Non applicable (élève absent)';
      const statusSel = document.getElementById('q4-status-value');
      const statusVal = statusSel?.value || 'none';
      const checked = obsForm.querySelectorAll('input[name="q4-type"]:checked');
      const txt = document.getElementById('f-q4-txt')?.value?.trim();
      if (checked.length > 0) return `✓ ${checked.length} adaptation${checked.length > 1 ? 's' : ''} (${Array.from(checked).slice(0, 2).map(c => c.value).join(', ')}${checked.length > 2 ? '…' : ''})`;
      if (statusVal && statusVal !== 'none') return `✓ ${statusSel.options[statusSel.selectedIndex]?.text || statusVal}`;
      if (txt) return '✓ Précision renseignée';
      return 'Aucune adaptation';
    }
    if (idx === 4) {
      if (isStudentAbsent) return 'Non applicable (élève absent)';
      const sel = document.getElementById('q5-transfer-value');
      const val = sel?.value?.trim() || '';
      const txt = document.getElementById('f-q5-txt')?.value?.trim();
      if (val) return `✓ ${sel.options[sel.selectedIndex]?.text || val}`;
      if (txt) return '✓ Précision renseignée';
      return 'Non renseigné';
    }
    if (idx === 5) {
      const actions = obsForm.querySelectorAll('input[name="q6-action"]:checked');
      const collabs = obsForm.querySelectorAll('input[name="q6-collab"]:checked');
      const mod = document.getElementById('q6-modality-value')?.value?.trim();
      const obj = document.getElementById('q6-objective-value')?.value?.trim();
      const txt = document.getElementById('f-q6-txt')?.value?.trim();
      const total = actions.length + collabs.length + (mod ? 1 : 0) + (obj ? 1 : 0);
      if (total > 0) return `✓ ${actions.length} action${actions.length > 1 ? 's' : ''}${collabs.length ? ` · ${collabs.length} relais` : ''}`;
      if (txt) return '✓ Précision renseignée';
      return 'Facultatif';
    }
    return '';
  };

  const setCardCollapsed = (card, collapsed) => {
    if (!card) return;
    card.classList.toggle('is-step-collapsed', Boolean(collapsed));
    const head = card.querySelector('.card-title');
    if (head) head.setAttribute('aria-expanded', String(!collapsed));
    if (!collapsed && stepper) {
      const i = cards.indexOf(card);
      stepper.querySelectorAll('.apple-step-item').forEach((b, k) => b.classList.toggle('is-active', k === i));
    }
  };

  /* Une seule étape ouverte à la fois : ouvrir une étape referme les autres. */
  const openStep = (idx, options = {}) => {
    cards.forEach((c, i) => setCardCollapsed(c, i !== idx));
    if (options.scroll !== false) scrollToCard(cards[idx]);
  };

  cards.forEach((card, idx) => {
    if (!card) return;
    card.classList.add('apple-session-step-card');
    card.dataset.stepIndex = String(idx);
    const titleEl = titleElements[idx];
    if (titleEl && !titleEl.dataset.accordionInit) {
      titleEl.dataset.accordionInit = 'true';
      titleEl.classList.add('apple-session-step-head');
      titleEl.setAttribute('role', 'button');
      titleEl.setAttribute('tabindex', '0');
      titleEl.setAttribute('aria-expanded', idx === 0 ? 'true' : 'false');

      const rawTitle = titleEl.textContent.trim();
      titleEl.innerHTML = `
        <div class="apple-step-head-left">
          <span class="apple-step-card-chevron" aria-hidden="true"></span>
          <span class="apple-step-head-title">${rawTitle}</span>
        </div>
        <div class="apple-step-head-right">
          <span class="apple-step-summary-pill" data-step-summary="${idx}">${getStepSummary(idx)}</span>
        </div>
      `;

      let bodyWrap = card.querySelector('.apple-session-step-body');
      if (!bodyWrap) {
        bodyWrap = document.createElement('div');
        bodyWrap.className = 'apple-session-step-body';
        const childrenToMove = Array.from(card.children).filter(el => el !== titleEl);
        childrenToMove.forEach(el => bodyWrap.appendChild(el));
        card.appendChild(bodyWrap);
      }

      if (idx < 5 && !bodyWrap.querySelector('.apple-step-next-bar')) {
        const nextBar = document.createElement('div');
        nextBar.className = 'apple-step-next-bar';
        nextBar.innerHTML = `<button type="button" class="btn-secondary apple-step-next-btn focus-ring" data-step-next="${idx + 1}">Étape suivante : ${idx + 2}. ${stepTitles[idx + 1]}</button>`;
        nextBar.querySelector('button')?.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (cards[idx + 1]) openStep(idx + 1);
        });
        bodyWrap.appendChild(nextBar);
      }

      const toggleStep = (e) => {
        if (e.target.closest('button, input, select, textarea, a')) return;
        if (card.classList.contains('is-step-collapsed')) openStep(idx, { scroll: false });
        else setCardCollapsed(card, true);
      };

      titleEl.addEventListener('click', toggleStep);
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleStep(e);
        }
      });

      // Par défaut : seule l'étape 1 est ouverte
      setCardCollapsed(card, idx >= 1);
    }
  });

  cards.forEach((card, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `apple-step-item ${idx === 0 ? 'is-active' : ''}`;
    btn.innerHTML = `
      <span class="apple-step-num">${idx + 1}</span>
      <span>${stepTitles[idx]}</span>
    `;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openStep(idx);
    });
    stepper.appendChild(btn);
  });

  const refreshStepSummaries = () => {
    const presence = getPresenceMode();
    cards.forEach((card, idx) => {
      if (!card) return;
      const isNonApplicable = presence !== 'present' && (idx >= 1 && idx <= 4);
      card.classList.toggle('is-step-non-applicable', isNonApplicable);
      const pill = card.querySelector(`[data-step-summary="${idx}"]`);
      if (pill) {
        const text = getStepSummary(idx);
        pill.textContent = text;
        pill.classList.toggle('is-filled', text.startsWith('✓'));
        pill.classList.toggle('is-non-applicable', isNonApplicable);
      }
    });
  };

  const applyPresenceModeUI = (mode, options = {}) => {
    const validModes = ['present', 'absent_eleve_coteach', 'absent_eleve', 'absent_prof', 'absent_agent'];
    const normalized = validModes.includes(mode) ? mode : 'present';
    const hiddenInput = document.getElementById('f-presence-status');
    if (hiddenInput) hiddenInput.value = normalized;

    const banner = document.getElementById('session-presence-banner');
    if (banner) {
      banner.querySelectorAll('[data-presence-choice]').forEach((btn) => {
        const active = btn.getAttribute('data-presence-choice') === normalized;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-checked', String(active));
      });
    }

    const hintEl = document.getElementById('session-presence-hint');
    const hints = {
      present: 'Séance d’accompagnement habituelle avec l’élève présent.',
      absent_eleve_coteach: 'Élève absent · Intervention maintenue en classe (co-enseignement / prise de notes). Pas de partie orthopédagogique : indiquez le contenu vu en classe.',
      absent_eleve: 'Élève absent · Séance non tenue. Cette absence sera tracée dans l’historique sans fausser l’analyse des observations.',
      absent_prof: 'Professeur absent / Cours annulé · Créneau tracé dans l’historique sans impact sur le taux de présence de l’élève.',
      absent_agent: 'Agent du pôle absent · Votre absence est tracée dans le Journalier, sans impact sur le taux de présence de l’élève.'
    };
    if (hintEl) hintEl.textContent = hints[normalized] || hints.present;

    const notesField = document.getElementById('f-class-notes-field');
    if (notesField) {
      notesField.classList.remove('hidden');
      notesField.classList.toggle('is-emphasis', normalized === 'absent_eleve_coteach');
    }

    if (!options.preserveCollapse) {
      if (normalized === 'present') {
        cards.forEach((c, i) => setCardCollapsed(c, i >= 1));
      } else if (normalized === 'absent_eleve_coteach') {
        // Co-enseignement : seule la partie pédagogique (0) reste ouverte, la suite (5) est un clic
        cards.forEach((c, i) => setCardCollapsed(c, i >= 1));
        // Cocher automatiquement Coenseignement si aucune modalité n'est cochée
        const anyModality = obsForm.querySelectorAll('input[name="f-type-interv"]:checked');
        if (anyModality.length === 0) {
          const coensInput = obsForm.querySelector('input[name="f-type-interv"][value="Coenseignement"]');
          if (coensInput) {
            coensInput.checked = true;
            coensInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      } else {
        // absent_eleve ou absent_prof : garder uniquement Contexte (0) et éventuellement Suites (5)
        cards.forEach((c, i) => setCardCollapsed(c, i >= 1));
      }
    }

    refreshStepSummaries();
  };

  window.setSessionPresenceMode = applyPresenceModeUI;

  const presenceBanner = document.getElementById('session-presence-banner');
  if (presenceBanner && !presenceBanner.dataset.presenceWired) {
    presenceBanner.dataset.presenceWired = 'true';
    presenceBanner.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-presence-choice]');
      if (!btn) return;
      e.preventDefault();
      applyPresenceModeUI(btn.getAttribute('data-presence-choice') || 'present');
    });
  }

  obsForm.addEventListener('change', refreshStepSummaries);
  obsForm.addEventListener('input', refreshStepSummaries);
  obsForm.addEventListener('reset', () => setTimeout(() => applyPresenceModeUI('present'), 30));
  applyPresenceModeUI(getPresenceMode(), { preserveCollapse: true });

  const container = getScrollContainer();
  const handleScroll = () => {
    if (!formView.closest('#page-stage')) return;
    const containerTop = container.getBoundingClientRect ? container.getBoundingClientRect().top : 0;
    let activeIndex = 0;
    cards.forEach((card, idx) => {
      const rect = card.getBoundingClientRect();
      if (rect.top - containerTop <= 160) {
        activeIndex = idx;
      }
    });
    const buttons = stepper.querySelectorAll('.apple-step-item');
    buttons.forEach((b, i) => {
      b.classList.toggle('is-active', i === activeIndex);
    });
  };

  if (container) {
    container.addEventListener('scroll', handleScroll, { passive: true });
  }

  if (!document.getElementById('apple-sticky-bar')) {
    const stickyBar = document.createElement('div');
    stickyBar.id = 'apple-sticky-bar';
    stickyBar.className = 'apple-sticky-bar';
    stickyBar.innerHTML = `
      <div class="apple-sticky-progress-wrap">
        <div class="apple-sticky-progress-bar">
          <div class="apple-sticky-progress-fill" id="apple-sticky-progress-fill" style="width: 16%;"></div>
        </div>
        <span class="apple-sticky-progress-text" id="apple-sticky-progress-text">0/6 rubriques renseignées</span>
      </div>
      <button type="button" class="apple-sticky-save-btn focus-ring" id="apple-sticky-save-btn">
        <span>💾 Enregistrer la séance</span>
      </button>
    `;

    const stickySaveBtn = stickyBar.querySelector('#apple-sticky-save-btn');
    stickySaveBtn.addEventListener('click', () => {
      const realSaveBtn = document.getElementById('save-session-btn');
      if (realSaveBtn) {
        realSaveBtn.click();
      } else {
        obsForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });

    document.body.appendChild(stickyBar);

    const updateProgress = () => {
      let filledCount = 0;

      // 1. Contexte : élève + matière renseignés
      const eleveVal = document.getElementById('f-eleve')?.value?.trim();
      const matiereVal = document.getElementById('f-matiere')?.value?.trim();
      if (eleveVal && matiereVal) filledCount++;

      // 2. Fonctionnement : au moins une case Q2 cochée ou précision Q2
      const q2Checked = obsForm.querySelectorAll('input[name="q2-comprehension"]:checked, input[name="q2-organisation"]:checked, input[name="q2-realisation"]:checked, input[name="q2-aide"]:checked');
      if (q2Checked.length > 0 || document.getElementById('f-q2-txt')?.value?.trim()) filledCount++;

      // 3. Indicateurs : au moins un indicateur Q3 coché ou précision Q3
      const q3Checked = obsForm.querySelectorAll('input[name="q3-learning"]:checked');
      if (q3Checked.length > 0 || document.getElementById('f-q3-txt')?.value?.trim()) filledCount++;

      // 4. Adaptation : situation != 'none' ou type coché ou précision Q4
      const q4Status = document.getElementById('q4-status-value')?.value;
      const q4Checked = obsForm.querySelectorAll('input[name="q4-type"]:checked');
      if ((q4Status && q4Status !== 'none') || q4Checked.length > 0 || document.getElementById('f-q4-txt')?.value?.trim()) filledCount++;

      // 5. Transfert : statut sélectionné ou précision Q5
      const q5Status = document.getElementById('q5-transfer-value')?.value?.trim();
      if (q5Status || document.getElementById('f-q5-txt')?.value?.trim()) filledCount++;

      // 6. Suite : action cochée, évolution modalité/objectif, collaboration ou précision Q6
      const q6Checked = obsForm.querySelectorAll('input[name="q6-action"]:checked, input[name="q6-collab"]:checked');
      const q6Mod = document.getElementById('q6-modality-value')?.value?.trim();
      const q6Obj = document.getElementById('q6-objective-value')?.value?.trim();
      if (q6Checked.length > 0 || q6Mod || q6Obj || document.getElementById('f-q6-txt')?.value?.trim()) filledCount++;

      const pct = Math.max(8, Math.min(100, Math.round((filledCount / 6) * 100)));
      const fillEl = document.getElementById('apple-sticky-progress-fill');
      const textEl = document.getElementById('apple-sticky-progress-text');
      if (fillEl) fillEl.style.width = `${pct}%`;
      if (textEl) textEl.textContent = `${filledCount}/6 rubriques renseignées`;

      const realSaveText = document.getElementById('save-session-btn')?.textContent?.trim();
      if (realSaveText && stickySaveBtn.querySelector('span')) {
        stickySaveBtn.querySelector('span').textContent = realSaveText;
      }
    };

    const updateStickyVisibility = () => {
      const inStage = Boolean(formView.closest('#page-stage'));
      const isFormVisible = inStage && !formView.classList.contains('hidden');
      stickyBar.style.display = isFormVisible ? 'flex' : 'none';
      if (isFormVisible) {
        updateProgress();
      }
    };

    obsForm.addEventListener('change', updateProgress);
    obsForm.addEventListener('input', updateProgress);
    obsForm.addEventListener('reset', () => setTimeout(updateProgress, 20));

    document.querySelectorAll('.nav-btn, .tab-btn').forEach(tab => {
      tab.addEventListener('click', () => setTimeout(updateStickyVisibility, 40));
    });

    const pageStage = document.getElementById('page-stage');
    if (pageStage) {
      const stageObs = new MutationObserver(updateStickyVisibility);
      stageObs.observe(pageStage, { childList: true });
    }

    updateStickyVisibility();
  }
}

/**
 * 4. COCKPIT ACCUEIL : Ruban synoptique des 8 Périodes de la journée
 * Utilise dynamiquement window.JournalierAgendaConfig?.getPeriods() et les vraies lignes .home-row de #home-today-list.
 * Ne tronque jamais le message vide « Rien à traiter pour le moment. ».
 */
function initHomeDayRibbon() {
  const homeView = document.getElementById('view-accueil');
  if (!homeView) return;

  let ribbonCard = document.getElementById('apple-day-ribbon-card');
  if (!ribbonCard) {
    ribbonCard = document.createElement('div');
    ribbonCard.id = 'apple-day-ribbon-card';
    ribbonCard.className = 'apple-day-ribbon-card';

    const pageHead = homeView.querySelector('.page-head');
    const homeToday = homeView.querySelector('.home-today');
    if (pageHead && homeToday) {
      homeView.insertBefore(ribbonCard, homeToday);
    }
  }

  renderAndSyncDayRibbon();

  const homeTodayList = document.getElementById('home-today-list');
  if (homeTodayList && !homeTodayList.dataset.appleRibbonObserved) {
    homeTodayList.dataset.appleRibbonObserved = 'true';
    const observer = new MutationObserver(renderAndSyncDayRibbon);
    observer.observe(homeTodayList, { childList: true, subtree: true });
  }

  document.getElementById('agenda-period-config-save')?.addEventListener('click', () => {
    setTimeout(renderAndSyncDayRibbon, 50);
  });
}

function getConfiguredPeriodsForRibbon() {
  const configured = window.JournalierAgendaConfig?.getPeriods?.();
  if (Array.isArray(configured) && configured.length === 8) {
    return configured.map((p, idx) => ({
      index: idx,
      code: `P${idx + 1}`,
      label: p.label || `${idx + 1}e H`,
      timeRange: `${p.start} – ${p.end}`
    }));
  }
  return [
    { index: 0, code: 'P1', label: '1e H', timeRange: '08:25 – 09:15' },
    { index: 1, code: 'P2', label: '2e H', timeRange: '09:15 – 10:05' },
    { index: 2, code: 'P3', label: '3e H', timeRange: '10:20 – 11:10' },
    { index: 3, code: 'P4', label: '4e H', timeRange: '11:10 – 12:00' },
    { index: 4, code: 'P5', label: '5e H', timeRange: '13:00 – 13:50' },
    { index: 5, code: 'P6', label: '6e H', timeRange: '13:50 – 14:40' },
    { index: 6, code: 'P7', label: '7e H', timeRange: '14:55 – 15:45' },
    { index: 7, code: 'P8', label: '8e H', timeRange: '15:45 – 16:35' }
  ];
}

function renderAndSyncDayRibbon() {
  const ribbonCard = document.getElementById('apple-day-ribbon-card');
  if (!ribbonCard) return;

  const periods = getConfiguredPeriodsForRibbon();
  const labelToIndex = new Map(periods.map(p => [p.label, p.index]));

  // Extraire les vrais événements planifiés/réalisés depuis #home-today-list (.home-row.js-home-event)
  const slotStates = new Array(8).fill(null);
  const rows = document.querySelectorAll('#home-today-list .home-row.js-home-event');

  rows.forEach(row => {
    const periodText = row.querySelector('.home-period')?.textContent?.trim() || row.dataset.startPeriod || '';
    const titleText = row.querySelector('.home-event-title')?.textContent?.trim() || 'Activité';
    const badgeEl = row.querySelector('.status-badge');
    const statusText = badgeEl?.textContent?.trim() || 'Planifié';
    const isCancelled = badgeEl?.classList.contains('agenda-status-cancelled');
    if (isCancelled) return;
    const isDone = badgeEl?.classList.contains('agenda-status-realized') || statusText.includes('Réalisé') || statusText.includes('enregistrée');

    const parts = periodText.split('→').map(s => s.trim()).filter(Boolean);
    const startIdx = labelToIndex.has(parts[0]) ? labelToIndex.get(parts[0]) : -1;
    const endIdx = parts[1] && labelToIndex.has(parts[1]) ? labelToIndex.get(parts[1]) : startIdx;

    if (startIdx >= 0) {
      for (let i = startIdx; i <= Math.max(startIdx, endIdx); i++) {
        if (!slotStates[i] || isDone) {
          slotStates[i] = {
            title: titleText,
            isDone,
            statusLabel: isDone ? 'Réalisé' : 'À compléter',
            periodLabel: periods[i].label,
            iso: row.dataset.iso || ''
          };
        }
      }
    }
  });

  ribbonCard.innerHTML = `
    <div class="apple-ribbon-head">
      <div class="apple-ribbon-title">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--apple-blue)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        <span>Ligne de temps de la journée · Immersion en classe</span>
      </div>
      <span class="page-kicker" style="margin:0;">8 Périodes</span>
    </div>
    <div class="apple-ribbon-grid" id="apple-ribbon-grid">
      ${periods.map((item, idx) => {
        const slot = slotStates[idx];
        if (!slot) {
          return `
            <div class="apple-period-cell" data-period-idx="${idx + 1}" id="apple-period-${idx + 1}">
              <div class="apple-period-tag">${item.code} · ${item.timeRange}</div>
              <div class="apple-period-student" style="color:#8e8e93; font-weight:500;">Disponible</div>
              <div class="apple-period-sub">—</div>
            </div>
          `;
        }
        const stateCls = slot.isDone ? 'has-session is-done' : 'has-session is-pending';
        const badgeHtml = slot.isDone
          ? '<span class="apple-badge-done">Réalisé</span>'
          : '<span class="apple-badge-pending">À compléter</span>';
        return `
          <div class="apple-period-cell ${stateCls}" data-period-idx="${idx + 1}" data-period-label="${item.label}" id="apple-period-${idx + 1}" style="cursor:pointer;" title="${slot.title} (${item.label})">
            <div class="apple-period-tag">${item.code} · ${item.timeRange}</div>
            <div class="apple-period-student">${slot.title}</div>
            <div class="apple-period-sub">${badgeHtml}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  ribbonCard.querySelectorAll('.apple-period-cell.has-session').forEach(cell => {
    cell.addEventListener('click', () => {
      const pLabel = cell.dataset.periodLabel;
      const studentName = cell.querySelector('.apple-period-student')?.textContent?.trim() || '';
      const tabBtn = document.getElementById('tab-btn-form');
      if (tabBtn) tabBtn.click();
      if (pLabel) {
        const startSel = document.getElementById('f-periode-start');
        const endSel = document.getElementById('f-periode-end');
        if (startSel) {
          startSel.value = pLabel;
          startSel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (endSel) {
          endSel.value = pLabel;
          endSel.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
      const studentSel = document.getElementById('f-eleve');
      if (studentSel && studentName) {
        for (const opt of studentSel.options) {
          if (opt.value === studentName || opt.textContent.includes(studentName)) {
            studentSel.value = opt.value;
            studentSel.dispatchEvent(new Event('change', { bubbles: true }));
            break;
          }
        }
      }
    });
  });
}

/**
 * 5. PASSERELLE DIRECTE « Compléter une séance »
 * N'ajoute le bouton ✍️ Compléter une séance QUE sur les vraies séances planifiées non encodées
 * (contenant un <strong>Nom Élève</strong>), jamais sur l'état vide « Rien à traiter pour le moment. ».
 */
function initQuickSessionBridge() {
  const homeTaskList = document.getElementById('home-task-list');
  if (!homeTaskList) return;

  const enhancePendingSessionsInHome = () => {
    const items = homeTaskList.querySelectorAll('li');
    items.forEach(item => {
      if (item.dataset.quickBtnAdded === 'true') return;
      const strongEl = item.querySelector('strong');
      const rawText = (item.textContent || '').trim();

      // Ignorer strictement l'état vide "Rien à traiter pour le moment."
      if (!strongEl || rawText.startsWith('Rien à traiter')) {
        return;
      }

      item.dataset.quickBtnAdded = 'true';
      const studentName = strongEl.textContent.trim();
      const parts = rawText.split('·').map(s => s.trim());
      const periodRange = parts[1] || '';
      const subjectName = parts[2] || '';

      const quickBtn = document.createElement('button');
      quickBtn.type = 'button';
      quickBtn.className = 'apple-quick-session-btn focus-ring';
      quickBtn.innerHTML = '<span>✍️ Compléter une séance</span>';
      quickBtn.title = `Ouvrir le formulaire de séance pour ${studentName}`;

      quickBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const tabSeance = document.getElementById('tab-btn-form');
        if (tabSeance) tabSeance.click();

        const studentSelect = document.getElementById('f-eleve');
        if (studentSelect && studentName) {
          for (let i = 0; i < studentSelect.options.length; i++) {
            const opt = studentSelect.options[i];
            if (opt.value === studentName || opt.text.includes(studentName)) {
              studentSelect.selectedIndex = i;
              studentSelect.dispatchEvent(new Event('change', { bubbles: true }));
              break;
            }
          }
        }

        if (periodRange) {
          const [pStart, pEnd] = periodRange.split('→').map(s => s.trim());
          const startSel = document.getElementById('f-periode-start');
          const endSel = document.getElementById('f-periode-end');
          if (startSel && pStart) {
            startSel.value = pStart;
            startSel.dispatchEvent(new Event('change', { bubbles: true }));
          }
          if (endSel && (pEnd || pStart)) {
            endSel.value = pEnd || pStart;
            endSel.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        if (subjectName) {
          const matiereInput = document.getElementById('f-matiere');
          if (matiereInput) {
            matiereInput.value = subjectName;
            matiereInput.dataset.selectedSubject = subjectName;
            matiereInput.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      });

      item.appendChild(quickBtn);
    });
  };

  const observer = new MutationObserver(enhancePendingSessionsInHome);
  observer.observe(homeTaskList, { childList: true, subtree: true });
  enhancePendingSessionsInHome();
}

/**
 * 6. DICTÉE VOCALE NATIVE (Speech-to-Text locale navigateur, fr-BE)
 */
function initVoiceDictation() {
  const targetFieldIds = [
    { id: 'f-objLecon', label: 'Objectif de la leçon' },
    { id: 'f-objAgent', label: 'Objectif d’accompagnement' },
    { id: 'f-q2-txt', label: 'Comportement observable' },
    { id: 'f-q3-txt', label: 'Indicateurs d’apprentissage' },
    { id: 'f-q4-txt', label: 'Adaptation / médiation' },
    { id: 'f-q5-txt', label: 'Réinvestissement / transfert' },
    { id: 'f-q6-txt', label: 'Suite de l’accompagnement' },
    { id: 'student-modal-pia', label: 'Objectifs du PIA' }
  ];

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  targetFieldIds.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.appleVoiceInit === 'true') return;
    el.dataset.appleVoiceInit = 'true';

    const parentContainer = el.closest('.v11-field') || el.closest('div') || el.parentElement;
    if (!parentContainer) return;

    const labelEl = parentContainer.querySelector(`label[for="${id}"]`) || parentContainer.querySelector('label');
    const voiceBar = document.createElement('div');
    voiceBar.className = 'apple-voice-wrap';

    const dictateBtn = document.createElement('button');
    dictateBtn.type = 'button';
    dictateBtn.className = 'apple-voice-dictate-btn focus-ring';
    dictateBtn.innerHTML = `
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
        <line x1="12" y1="19" x2="12" y2="22"></line>
      </svg>
      <span>Dicter</span>
    `;
    dictateBtn.title = 'Dicter la note vocalement (Microphone)';

    const statusTip = document.createElement('span');
    statusTip.className = 'apple-voice-status-tip';
    statusTip.style.display = 'none';

    voiceBar.appendChild(dictateBtn);
    voiceBar.appendChild(statusTip);

    if (labelEl && labelEl.parentNode === parentContainer) {
      labelEl.style.display = 'flex';
      labelEl.style.justifyContent = 'space-between';
      labelEl.style.alignItems = 'center';
      labelEl.style.flexWrap = 'wrap';
      labelEl.style.gap = '8px';
      labelEl.appendChild(voiceBar);
    } else {
      parentContainer.insertBefore(voiceBar, el);
    }

    let recognitionInstance = null;
    let isListening = false;

    dictateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!SpeechRecognition) {
        window.showAppToast?.('La dictée vocale native est disponible sur Chrome, Edge ou Safari.', 'info', 3500);
        return;
      }

      if (isListening) {
        if (recognitionInstance) recognitionInstance.stop();
        return;
      }

      try {
        recognitionInstance = new SpeechRecognition();
        recognitionInstance.lang = 'fr-BE';
        recognitionInstance.continuous = true;
        recognitionInstance.interimResults = true;

        let finalTranscript = '';
        const initialText = el.value ? el.value.trim() : '';

        recognitionInstance.onstart = () => {
          isListening = true;
          dictateBtn.classList.add('is-listening');
          dictateBtn.querySelector('span').textContent = 'Arrêter';
          statusTip.className = 'apple-voice-status-tip listening';
          statusTip.textContent = 'Écoute en cours...';
          statusTip.style.display = 'inline-flex';
        };

        recognitionInstance.onresult = (event) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }
          const combined = (initialText ? initialText + ' ' : '') + finalTranscript + interimTranscript;
          el.value = combined;

          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        };

        recognitionInstance.onerror = (event) => {
          const msg = event.error === 'not-allowed' ? 'Microphone non autorisé' : 'Erreur d’écoute';
          stopListening(false, msg);
        };

        recognitionInstance.onend = () => {
          stopListening(true);
        };

        recognitionInstance.start();
      } catch (err) {
        console.warn('Journalier — démarrage de la dictée vocale impossible :', err);
        stopListening(false, 'Microphone ou reconnaissance vocale indisponible');
      }

      function stopListening(isSuccess = true, customMessage = null) {
        isListening = false;
        dictateBtn.classList.remove('is-listening');
        dictateBtn.querySelector('span').textContent = 'Dicter';
        statusTip.className = 'apple-voice-status-tip';
        statusTip.textContent = customMessage || (isSuccess ? '✓ Note complétée' : 'Écoute interrompue');
        setTimeout(() => {
          if (!isListening) statusTip.style.display = 'none';
        }, isSuccess ? 2200 : 3500);
      }
    });
  });
}

/**
 * 7. DOSSIER ÉLÈVE (#studentProfileModal) — CARTES DE SÉANCE PLIABLES (ACCORDÉON APPLE HIG)
 *    Affiche par défaut uniquement l'en-tête compact (Date + Périodes + Matière + Bouton Modifier)
 *    et déplie/replie le détail pédagogique (Q1 à Q6) au clic sur la carte ou la date.
 */
function initCollapsibleProfileSessions() {
  const profileBody = document.getElementById('student-profile-body');
  if (!profileBody) return;

  const enhanceProfileSessionCards = () => {
    const cards = profileBody.querySelectorAll('.profile-session-card');
    cards.forEach((card) => {
      if (card.dataset.appleAccordionInit === 'true') return;
      card.dataset.appleAccordionInit = 'true';

      const head = card.querySelector('.profile-session-head') || card.querySelector(':scope > header');
      if (!head) return;
      head.classList.add('profile-session-head');

      let detailsWrap = card.querySelector('.profile-session-body, .apple-profile-session-details');
      if (!detailsWrap) {
        const childrenToWrap = Array.from(card.children).filter(el => el !== head);
        if (!childrenToWrap.length) return;
        detailsWrap = document.createElement('div');
        detailsWrap.className = 'apple-profile-session-details';
        childrenToWrap.forEach(el => detailsWrap.appendChild(el));
        card.appendChild(detailsWrap);
      } else {
        detailsWrap.classList.add('apple-profile-session-details');
      }

      // Ajouter le chevron Apple dans l'en-tête
      const titleBlock = head.firstElementChild;
      if (titleBlock && !titleBlock.querySelector('.apple-profile-session-chevron')) {
        const strongEl = titleBlock.querySelector('strong') || titleBlock;
        const chevron = document.createElement('span');
        chevron.className = 'apple-profile-session-chevron';
        chevron.setAttribute('aria-hidden', 'true');
        chevron.textContent = '▸';
        strongEl.insertBefore(chevron, strongEl.firstChild);
      }

      head.setAttribute('role', 'button');
      head.setAttribute('tabindex', '0');
      head.setAttribute('aria-expanded', 'false');
      head.title = 'Cliquer pour afficher ou masquer le détail de la séance';

      const toggleCard = (e) => {
        if (e.target.closest('button, a')) return;
        const expanded = card.classList.toggle('is-expanded');
        head.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      };

      head.addEventListener('click', toggleCard);
      head.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleCard(e);
        }
      });
    });
  };

  const observer = new MutationObserver(enhanceProfileSessionCards);
  observer.observe(profileBody, { childList: true, subtree: true });
  enhanceProfileSessionCards();
}

/**
 * 8. HISTORIQUE DES SÉANCES — TIROIR D'INSPECTION LATÉRAL REPLIABLE / OUVRABLE À LA DEMANDE
 *    - Ouvert automatiquement dès qu'une séance est affichée ou cliquée dans la liste (#student-history-list)
 *    - Bouton "✕ Masquer le détail" permettant de replier le panneau de droite à la demande
 *    - Tout clic sur une séance ou sa flèche dans la liste de gauche ré-ouvre immédiatement le panneau de droite
 */
function initHistoryDetailDrawerToggle() {
  const detailPanel = document.getElementById('student-history-detail');
  const workspace = document.getElementById('history-workspace') || detailPanel?.closest('.history-workspace');
  if (!detailPanel || !workspace) return;

  const injectCloseButton = () => {
    const head = detailPanel.querySelector('.history-detail-head');
    if (!head || head.querySelector('.apple-history-drawer-close')) return;

    const actionsWrap = head.querySelector('.history-detail-actions') || head.querySelector('div:last-child') || head;
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-secondary apple-history-drawer-close focus-ring';
    closeBtn.innerHTML = '✕ Masquer';
    closeBtn.title = 'Masquer le panneau de droite pour parcourir la liste en pleine largeur';
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      workspace.classList.add('is-detail-collapsed');
    });
    actionsWrap.appendChild(closeBtn);
  };

  // Ré-ouvrir le panneau de droite dès qu'on clique sur une séance (ou sa flèche ›) dans #student-history-list
  const listContainer = document.getElementById('student-history-list');
  if (listContainer) {
    listContainer.addEventListener('click', (e) => {
      if (e.target.closest('.history-master-row, [data-history-select]')) {
        workspace.classList.remove('is-detail-collapsed');
      }
    }, true);
  }

  const syncDrawerState = () => {
    const hasEmptyState = Boolean(detailPanel.querySelector('.history-detail-empty'));
    if (hasEmptyState) {
      workspace.classList.add('is-detail-collapsed');
    } else {
      workspace.classList.remove('is-detail-collapsed');
      injectCloseButton();
    }
  };

  const observer = new MutationObserver(syncDrawerState);
  observer.observe(detailPanel, { childList: true, subtree: true });
  syncDrawerState();
}
