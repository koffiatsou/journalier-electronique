/**
 * Journalier Électronique — Référentiel des Aménagements Raisonnables WBE
 * 
 * - Compile les fiches d'aménagements et d'outils concrets WBE (Fondamental & Kit Secondaire).
 * - Rapprochement automatique et contextuel avec les propositions et constats du PIA.
 * - Intégration discrète et ciblée dans l'onglet PIA (Synthèse & PIA annuel), sans surcharge visuelle.
 * - 100% Local, zéro requête externe, respect strict du RGPD.
 */

(function() {
  'use strict';

  let _data = null;
  let _loadingPromise = null;
  let _activeTargetInput = null;

  async function loadData() {
    if (_data && _data.items && _data.items.length) return _data;
    if (_loadingPromise) return _loadingPromise;

    _loadingPromise = (async () => {
      try {
        const pathName = (typeof window !== 'undefined' && window.location?.pathname) || '';
        const basePath = pathName.startsWith('/journalier-electronique')
          ? '/journalier-electronique'
          : '';
        const candidateUrls = [
          basePath ? `${basePath}/referentiel_amenagements_wbe.json` : null,
          './referentiel_amenagements_wbe.json',
          '/journalier-electronique/referentiel_amenagements_wbe.json',
          '/referentiel_amenagements_wbe.json'
        ].filter(Boolean);

        const uniqueUrls = [...new Set(candidateUrls)];
        for (const url of uniqueUrls) {
          try {
            const res = await fetch(url);
            if (!res.ok) continue;
            let data = null;
            if (typeof res.text === 'function') {
              const text = await res.text();
              if (!text || text.trim().startsWith('<')) continue;
              data = JSON.parse(text);
            } else if (typeof res.json === 'function') {
              data = await res.json();
            } else {
              continue;
            }
            _data = data;
            return _data;
          } catch (_) {
            // try next
          }
        }
        throw new Error('Référentiel WBE introuvable sur les chemins testés');
      } catch (err) {
        console.warn('[ReferentielWBE] Chargement du référentiel local :', err);
        return { items: [] };
      } finally {
        _loadingPromise = null;
      }
    })();

    return _loadingPromise;
  }

  function normalizeText(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  function searchItems(query = '', filters = {}) {
    if (!_data || !_data.items) return [];
    const qNorm = normalizeText(query);
    const tokens = qNorm.split(/\s+/).filter(t => t.length > 1);

    return _data.items.filter(item => {
      // Filtre niveau (Fondamental, Secondaire, Universel)
      if (filters.niveau && filters.niveau !== 'tous') {
        const itemNiv = (item.niveau || '').toLowerCase();
        if (filters.niveau === 'fondamental' && itemNiv !== 'fondamental') return false;
        if (filters.niveau === 'secondaire' && itemNiv !== 'secondaire') return false;
        if (filters.niveau === 'universel' && itemNiv !== 'universel') return false;
      }

      // Filtre domaine
      if (filters.domaine && filters.domaine !== 'tous') {
        if (normalizeText(item.domaine) !== normalizeText(filters.domaine)) return false;
      }

      if (!tokens.length) return true;

      const haystack = normalizeText(`${item.titre} ${item.description || ''} ${item.domaine || ''} ${item.sousDomaine || ''} ${item.code || ''}`);
      return tokens.every(token => haystack.includes(token));
    });
  }

  function getDomainsList() {
    if (!_data || !_data.items) return [];
    const set = new Set();
    _data.items.forEach(it => {
      if (it.domaine) set.add(it.domaine);
    });
    return Array.from(set).sort();
  }

  /**
   * Rapprochement automatique : trouve les 2 à 4 aménagements les plus pertinents
   * pour un contexte donné (titre d'objectif, aspect PIA, mot-clé).
   */
  function findBestMatches(contextText = '', maxResults = 3) {
    if (!_data || !_data.items || !_data.items.length) return [];
    const textNorm = normalizeText(contextText);
    if (!textNorm) {
      // Suggestions universelles par défaut
      return _data.items.filter(i => i.niveau === 'Universel' && i.titre && i.titre.length > 15).slice(0, maxResults);
    }

    const domainKeywords = [
      { key: 'math', terms: ['math', 'calcul', 'arithmetique', 'geometrie', 'nombre', 'operation', 'fraction', 'algebrenombres', 'table', 'regle', 'compas', 'equerre'], domain: 'Mathématiques' },
      { key: 'ecrit', terms: ['ecriture', 'ecrit', 'copie', 'graphisme', 'motricite', 'stylo', 'clavier', 'lenteur', 'soin'], domain: 'Langage écrit' },
      { key: 'lecture', terms: ['lecture', 'lire', 'dechiffr', 'comprehension', 'texte', 'dyslex'], domain: 'Langage écrit' },
      { key: 'attention', terms: ['attention', 'concentr', 'vigilance', 'distrait', 'fatigue', 'agite', 'bouge'], domain: 'Fonctions exécutives' },
      { key: 'orga', terms: ['organisation', 'temps', 'espace', 'materiel', 'agenda', 'consigne', 'planif'], domain: 'Organisation' },
      { key: 'social', terms: ['comportement', 'emotion', 'estime', 'angoisse', 'relation', 'groupe'], domain: 'Socio-affectif' }
    ];

    let matchedDomain = null;
    for (const dk of domainKeywords) {
      if (dk.terms.some(t => textNorm.includes(t))) {
        matchedDomain = dk.domain;
        break;
      }
    }

    // Calculer un score de pertinence pour chaque fiche
    const scored = _data.items.map(item => {
      let score = 0;
      const haystack = normalizeText(`${item.titre} ${item.description || ''} ${item.domaine || ''} ${item.sousDomaine || ''}`);
      
      if (matchedDomain && item.domaine && normalizeText(item.domaine).includes(normalizeText(matchedDomain))) {
        score += 8;
      }
      
      const words = textNorm.split(/\s+/).filter(w => w.length >= 4);
      words.forEach(w => {
        if (haystack.includes(w)) score += 3;
      });

      // Bonus pour les fiches secondaires si mention de secondaire/cycle supérieur
      if (textNorm.includes('secondaire') && item.niveau === 'Secondaire') score += 4;
      // Bonus pour fiches matérielles ou concrètes avec titre clair
      if (item.titre && item.titre.length > 12 && !/^\d+\.\d+/.test(item.titre)) score += 2;

      return { item, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.filter(s => s.score > 2).slice(0, maxResults).map(s => s.item);

    // Si pas assez de résultats spécifiques, compléter par des universels pertinents
    if (top.length < maxResults) {
      const universals = _data.items.filter(i => i.niveau === 'Universel' && !top.includes(i));
      top.push(...universals.slice(0, maxResults - top.length));
    }

    return top;
  }

  function createModalHtml() {
    return `
      <div id="referentiel-wbe-modal" class="modal-overlay" style="display:none;z-index:9999;" role="dialog" aria-modal="true" aria-labelledby="ref-modal-title">
        <div class="modal-card" style="max-width:960px;width:calc(100% - 24px);max-height:90vh;display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:18px;">
          <!-- En-tête -->
          <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.35rem;">📚</span>
              <div>
                <h3 id="ref-modal-title" style="margin:0;font-size:1.05rem;font-weight:750;color:#0f172a;">
                  Référentiel des Aménagements WBE
                </h3>
                <p style="margin:2px 0 0;font-size:0.75rem;color:#64748b;">
                  Pôle Territorial WBE · Fondamental &amp; Secondaire
                </p>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" id="btn-close-ref-modal" class="btn-secondary" style="border:0;background:#e2e8f0;color:#475569;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;cursor:pointer;font-size:1rem;font-weight:700;" aria-label="Fermer">✕</button>
            </div>
          </div>

          <!-- Barre de recherche et filtres -->
          <div style="padding:14px 20px;border-bottom:1px solid #f1f5f9;background:#fff;display:flex;flex-direction:column;gap:10px;">
            <div style="display:flex;gap:10px;align-items:center;">
              <div style="position:relative;flex:1;">
                <input type="text" id="ref-search-input" placeholder="Rechercher un aménagement, un outil, une aide (ex. dys, géométrie, fatigue, lecture, mémorisation...)" style="width:100%;padding:10px 14px 10px 36px;border:1.5px solid #cbd5e1;border-radius:10px;font-size:0.86rem;outline:none;box-sizing:border-box;">
                <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:0.95rem;color:#94a3b8;">🔍</span>
              </div>
              <button type="button" id="ref-btn-clear-search" style="border:1px solid #e2e8f0;background:#f8fafc;padding:9px 12px;border-radius:8px;cursor:pointer;font-size:0.78rem;font-weight:600;color:#64748b;">Effacer</button>
            </div>

            <!-- Filtres rapides par niveau et domaine -->
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <span style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase;">Niveau :</span>
              <button type="button" class="ref-filter-pill is-active" data-ref-niveau="tous">Tous</button>
              <button type="button" class="ref-filter-pill" data-ref-niveau="fondamental">Fondamental (Wapi A)</button>
              <button type="button" class="ref-filter-pill" data-ref-niveau="secondaire">Secondaire (Kit outils)</button>
              <button type="button" class="ref-filter-pill" data-ref-niveau="universel">Aménagements Universels</button>

              <div style="margin-left:auto;display:flex;align-items:center;gap:6px;">
                <label for="ref-domain-select" style="font-size:0.72rem;font-weight:700;color:#64748b;text-transform:uppercase;">Domaine :</label>
                <select id="ref-domain-select" style="padding:5px 8px;border:1px solid #cbd5e1;border-radius:7px;font-size:0.76rem;background:#fff;color:#1e293b;">
                  <option value="tous">Tous les domaines</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Zone de résultats avec scroll -->
          <div id="ref-results-container" style="flex:1;overflow-y:auto;padding:16px 20px;background:#f8fafc;display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:12px;align-content:start;">
            <div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:#64748b;">
              Chargement des fiches...
            </div>
          </div>

          <!-- Pied de page -->
          <div style="padding:10px 20px;border-top:1px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:space-between;font-size:0.74rem;color:#64748b;">
            <span>💡 <em>Cliquez sur « Insérer » pour coller l'intitulé directement dans le champ actif.</em></span>
            <span style="font-weight:600;color:#0284c7;">100 % Local &amp; Souverain</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderCards(items) {
    const container = document.getElementById('ref-results-container');
    if (!container) return;

    if (!items.length) {
      container.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:50px 20px;color:#64748b;">
          <p style="font-size:1.05rem;margin:0 0 6px;">Aucun aménagement trouvé pour ces critères.</p>
          <small>Essayez un mot-clé plus court ou réinitialisez les filtres.</small>
        </div>
      `;
      return;
    }

    container.innerHTML = items.map(item => {
      const nivColor = item.niveau === 'Secondaire'
        ? 'background:#f3e8ff;color:#7e22ce;border-color:#e9d5ff;'
        : (item.niveau === 'Universel'
          ? 'background:#e0f2fe;color:#0369a1;border-color:#bae6fd;'
          : 'background:#dcfce7;color:#15803d;border-color:#bbf7d0;');

      const codeBadge = item.code ? `<span style="font-weight:800;color:#0f172a;font-size:0.72rem;background:#e2e8f0;padding:2px 6px;border-radius:5px;">${escapeHtml(item.code)}</span>` : '';
      const sourceBadge = item.source.includes('Secondaire')
        ? `<span style="font-size:0.68rem;color:#9333ea;font-weight:700;">🎒 Secondaire</span>`
        : `<span style="font-size:0.68rem;color:#16a34a;font-weight:700;">🌱 Fondamental</span>`;

      return `
        <div class="ref-card" style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;flex-direction:column;justify-content:space-between;gap:10px;box-shadow:0 1px 3px rgba(0,0,0,0.02);transition:transform .12s,box-shadow .12s;">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
              <div style="display:flex;align-items:center;gap:6px;">
                ${codeBadge}
                ${sourceBadge}
              </div>
              <span style="font-size:0.68rem;padding:2px 7px;border-radius:999px;border:1px solid transparent;font-weight:700;${nivColor}">
                ${escapeHtml(item.domaine || 'Aménagement')}
              </span>
            </div>

            <h4 style="margin:0 0 6px;font-size:0.86rem;font-weight:750;color:#0f172a;line-height:1.35;">
              ${escapeHtml(item.titre || item.code)}
            </h4>

            ${item.description ? `
              <p style="margin:0;font-size:0.76rem;color:#475569;line-height:1.45;max-height:85px;overflow:hidden;text-overflow:ellipsis;">
                ${escapeHtml(item.description)}
              </p>
            ` : ''}

            ${item.sousDomaine ? `
              <div style="margin-top:6px;font-size:0.68rem;color:#64748b;font-style:italic;">
                ${escapeHtml(item.sousDomaine)}
              </div>
            ` : ''}
          </div>

          <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:8px;padding-top:8px;border-top:1px dashed #f1f5f9;">
            <button type="button" class="btn-ref-copy" data-text="${escapeAttr(item.titre)}" style="border:1px solid #cbd5e1;background:#f8fafc;color:#334155;padding:5px 9px;border-radius:6px;font-size:0.72rem;font-weight:600;cursor:pointer;">
              📋 Copier
            </button>
            <button type="button" class="btn-ref-insert" data-text="${escapeAttr(item.titre)}" style="border:0;background:#0a84ff;color:#fff;padding:5px 11px;border-radius:6px;font-size:0.72rem;font-weight:700;cursor:pointer;">
              ＋ Insérer
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach actions
    container.querySelectorAll('.btn-ref-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txt = btn.dataset.text;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(txt).then(() => {
            btn.textContent = '✓ Copié !';
            setTimeout(() => { btn.textContent = '📋 Copier'; }, 1500);
          });
        }
      });
    });

    container.querySelectorAll('.btn-ref-insert').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const txt = btn.dataset.text;
        insertIntoActiveInput(txt);
        closeModal();
      });
    });
  }

  function insertIntoActiveInput(text) {
    if (!_activeTargetInput) {
      _activeTargetInput = document.querySelector('.synth-prop-card textarea:focus') ||
                           document.querySelector('textarea:focus') ||
                           document.querySelector('.synth-prop-card.is-pending textarea') ||
                           document.querySelector('.synth-prop-card textarea') ||
                           document.getElementById('seance-obs') ||
                           document.getElementById('q4-precision');
    }

    if (_activeTargetInput) {
      const current = _activeTargetInput.value.trim();
      const isObjectiveInput = _activeTargetInput.classList.contains('synth-prop-textarea') ||
                               Boolean(_activeTargetInput.closest?.('.synth-prop-card')) ||
                               _activeTargetInput.name === 'objectif' ||
                               _activeTargetInput.dataset.synthPropText !== undefined;
      const bulletPrefix = isObjectiveInput ? '  - ' : '• ';

      if (current.includes(text)) {
        if (window.showAppToast) {
          window.showAppToast(`Cet aménagement est déjà présent dans l’objectif.`, 'info', 2200);
        }
        return;
      }

      if (current) {
        _activeTargetInput.value = `${current}\n${bulletPrefix}${text}`;
      } else {
        _activeTargetInput.value = isObjectiveInput ? `${bulletPrefix}${text}` : text;
      }
      _activeTargetInput.dispatchEvent(new Event('input', { bubbles: true }));
      _activeTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
      _activeTargetInput.focus();

      if (_activeTargetInput.dataset?.synthPropText !== undefined && window.JournalierV74?.decideSynthesisProposal) {
        const pIdx = Number(_activeTargetInput.dataset.synthPropText);
        const pia = window._lastSynthesisPIA || window.JournalierDataStore?.getState?.()?.activePIA;
        if (pia) {
          window.JournalierV74.decideSynthesisProposal(pia, pIdx, 'SAVE_ONLY', _activeTargetInput.value);
        }
      }

      if (window.showAppToast) {
        window.showAppToast(`✓ Aménagement ajouté en sous-point à l’objectif`, 'success', 2500);
      }
    } else {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
      if (window.showAppToast) {
        window.showAppToast(`✓ Aménagement copié dans le presse-papiers`, 'info', 3000);
      }
    }
  }

  function escapeHtml(str) {
    return typeof globalThis.escapeHtml === 'function'
      ? globalThis.escapeHtml(str)
      : String(str ?? '').replace(/[&<>"']/g, function (ch) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
  }

  function escapeAttr(str) {
    return typeof globalThis.escapeAttr === 'function'
      ? globalThis.escapeAttr(str)
      : String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
  }

  let currentFilters = { niveau: 'tous', domaine: 'tous' };

  function applyFilterAndSearch() {
    const input = document.getElementById('ref-search-input');
    const query = input ? input.value : '';
    const results = searchItems(query, currentFilters);
    renderCards(results);
  }

  function openModal(targetInput = null, initialQuery = '', prefilterDomain = '') {
    _activeTargetInput = targetInput;
    const modal = document.getElementById('referentiel-wbe-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const input = document.getElementById('ref-search-input');
    if (input) {
      input.value = initialQuery;
      setTimeout(() => input.focus(), 80);
    }

    loadData().then(() => {
      const domainSelect = document.getElementById('ref-domain-select');
      if (domainSelect && domainSelect.options.length <= 1) {
        const domains = getDomainsList();
        domains.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d;
          domainSelect.appendChild(opt);
        });
      }
      if (prefilterDomain && domainSelect) {
        domainSelect.value = prefilterDomain;
        currentFilters.domaine = prefilterDomain;
      } else {
        currentFilters.domaine = 'tous';
      }
      applyFilterAndSearch();
    });
  }

  function closeModal() {
    const modal = document.getElementById('referentiel-wbe-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  /**
   * Injection intelligente et discrète dans les propositions PIA & Synthèse
   */
  function attachContextualSuggestions() {
    // 1. Propositions dans le PIA annuel
    const v74Props = document.querySelectorAll('.v74-prop:not([data-wbe-augmented="true"])');
    v74Props.forEach(card => {
      card.dataset.wbeAugmented = 'true';
      const textarea = card.querySelector('textarea[data-v74-prop-formulation]');
      const titleEl = card.querySelector('.v74-prop-title');
      const aspectEl = card.querySelector('.v74-prop-aspect');
      const contextText = `${titleEl?.textContent || ''} ${aspectEl?.textContent || ''} ${textarea?.value || ''}`;

      loadData().then(() => {
        const matches = findBestMatches(contextText, 3);
        if (!matches.length || !textarea) return;

        const container = document.createElement('div');
        container.className = 'pia-context-suggestions';
        container.innerHTML = `
          <div class="pia-suggestions-head">
            <span class="pia-suggestions-label">💡 Aides suggérées (Référentiel) :</span>
            <button type="button" class="pia-btn-open-ref" title="Explorer d'autres aménagements">+ Autres aides</button>
          </div>
          <div class="pia-suggestions-chips">
            ${matches.map(m => `
              <button type="button" class="pia-chip-item" data-text="${escapeAttr(m.titre)}" title="Cliquer pour ajouter cette aide">
                <span class="pia-chip-bullet">＋</span>
                <span>${escapeHtml(m.titre.length > 55 ? m.titre.slice(0, 52) + '...' : m.titre)}</span>
              </button>
            `).join('')}
          </div>
        `;

        // Événements
        container.querySelectorAll('.pia-chip-item').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const textToInsert = btn.dataset.text;
            insertIntoActiveInput(textToInsert);
          });
        });

        const moreBtn = container.querySelector('.pia-btn-open-ref');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(textarea, '', titleEl?.textContent || '');
          });
        }

        // Insérer juste sous le textarea
        textarea.parentElement?.insertAdjacentElement('afterend', container);
      });
    });

    // 2. Propositions dans la Synthèse
    const synthProps = document.querySelectorAll('.synth-prop-card:not([data-wbe-augmented="true"])');
    synthProps.forEach(card => {
      card.dataset.wbeAugmented = 'true';
      const textarea = card.querySelector('textarea.synth-prop-textarea');
      const themeEl = card.querySelector('.synth-prop-theme');
      const domainEl = card.querySelector('.synth-prop-domain');
      const contextText = `${themeEl?.textContent || ''} ${domainEl?.textContent || ''} ${textarea?.value || ''}`;

      loadData().then(() => {
        const matches = findBestMatches(contextText, 3);
        if (!matches.length || !textarea) return;

        const container = document.createElement('div');
        container.className = 'pia-context-suggestions';
        container.innerHTML = `
          <div class="pia-suggestions-head">
            <span class="pia-suggestions-label">💡 Aides suggérées (Référentiel) :</span>
            <button type="button" class="pia-btn-open-ref" title="Explorer d'autres aménagements">+ Autres aides</button>
          </div>
          <div class="pia-suggestions-chips">
            ${matches.map(m => `
              <button type="button" class="pia-chip-item" data-text="${escapeAttr(m.titre)}" title="Cliquer pour ajouter cette aide">
                <span class="pia-chip-bullet">＋</span>
                <span>${escapeHtml(m.titre.length > 55 ? m.titre.slice(0, 52) + '...' : m.titre)}</span>
              </button>
            `).join('')}
          </div>
        `;

        container.querySelectorAll('.pia-chip-item').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const textToInsert = btn.dataset.text;
            _activeTargetInput = textarea;
            insertIntoActiveInput(textToInsert);
            btn.classList.add('is-added');
            const bullet = btn.querySelector('.pia-chip-bullet');
            if (bullet) bullet.textContent = '✓';
          });
        });

        const moreBtn = container.querySelector('.pia-btn-open-ref');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal(textarea, '', themeEl?.textContent || '');
          });
        }

        textarea.parentElement?.insertAdjacentElement('afterend', container);
      });
    });

    // 3. Bouton discret dans l'en-tête de la synthèse et du PIA annuel
    const piaMount = document.getElementById('reports-pia-mount');
    if (piaMount && !document.getElementById('btn-pia-ref-helper')) {
      const annualHeader = piaMount.querySelector('.v74-annual-head');
      if (annualHeader) {
        const refBtn = document.createElement('button');
        refBtn.id = 'btn-pia-ref-helper';
        refBtn.type = 'button';
        refBtn.className = 'v74-btn v74-btn-neutral';
        refBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:0.76rem;margin-left:auto;';
        refBtn.innerHTML = `<span>📚</span> <span>Référentiel WBE</span>`;
        refBtn.addEventListener('click', () => openModal(null));
        annualHeader.appendChild(refBtn);
      }
    }

    const synthValidationSec = document.querySelector('.synth-validation-section .synth-section-head');
    if (synthValidationSec && !document.getElementById('btn-synth-ref-helper')) {
      const refBtn = document.createElement('button');
      refBtn.id = 'btn-synth-ref-helper';
      refBtn.type = 'button';
      refBtn.className = 'btn-secondary';
      refBtn.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:0.75rem;padding:5px 10px;';
      refBtn.innerHTML = `<span>📚</span> <span>Référentiel WBE</span>`;
      refBtn.addEventListener('click', () => openModal(null));
      synthValidationSec.appendChild(refBtn);
    }
  }

  function initUI() {
    if (!document.getElementById('referentiel-wbe-modal')) {
      document.body.insertAdjacentHTML('beforeend', createModalHtml());
    }

    // Modal controls
    const closeBtn = document.getElementById('btn-close-ref-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    const modalOverlay = document.getElementById('referentiel-wbe-modal');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalOverlay && modalOverlay.style.display !== 'none') {
        closeModal();
      }
    });

    const searchInput = document.getElementById('ref-search-input');
    if (searchInput) {
      let timer = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(applyFilterAndSearch, 150);
      });
    }

    const clearBtn = document.getElementById('ref-btn-clear-search');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        applyFilterAndSearch();
      });
    }

    document.querySelectorAll('.ref-filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.ref-filter-pill').forEach(p => p.classList.remove('is-active'));
        pill.classList.add('is-active');
        currentFilters.niveau = pill.dataset.refNiveau || 'tous';
        applyFilterAndSearch();
      });
    });

    const domainSelect = document.getElementById('ref-domain-select');
    if (domainSelect) {
      domainSelect.addEventListener('change', () => {
        currentFilters.domaine = domainSelect.value || 'tous';
        applyFilterAndSearch();
      });
    }

    // Préchargement discret des données
    loadData();

    // Surveillance pour brancher les suggestions dans les onglets PIA et Synthèse
    attachContextualSuggestions();
    const observer = new MutationObserver(() => {
      attachContextualSuggestions();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Styles CSS
  const style = document.createElement('style');
  style.textContent = `
    .ref-filter-pill {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #475569;
      font-size: 0.73rem;
      font-weight: 650;
      padding: 4px 10px;
      border-radius: 999px;
      cursor: pointer;
      transition: all .15s ease;
    }
    .ref-filter-pill:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
    }
    .ref-filter-pill.is-active {
      background: #2563eb;
      color: #fff;
      border-color: #2563eb;
      box-shadow: 0 2px 6px rgba(37,99,235,0.25);
    }
    .ref-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 14px rgba(15,23,42,0.06) !important;
      border-color: #93c5fd !important;
    }

    /* Suggestions contextuelles discrètes */
    .pia-context-suggestions {
      margin-top: 6px;
      margin-bottom: 8px;
      padding: 8px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      font-size: 0.74rem;
    }
    .pia-suggestions-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .pia-suggestions-label {
      font-weight: 700;
      color: #334155;
    }
    .pia-btn-open-ref {
      border: none;
      background: transparent;
      color: #2563eb;
      font-size: 0.72rem;
      font-weight: 600;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .pia-btn-open-ref:hover {
      text-decoration: underline;
      background: #eff6ff;
    }
    .pia-suggestions-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pia-chip-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #1e293b;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 500;
      cursor: pointer;
      transition: all .12s ease;
      text-align: left;
    }
    .pia-chip-item:hover {
      background: #f0fdf4;
      border-color: #86efac;
      color: #166534;
      transform: translateY(-1px);
    }
    .pia-chip-bullet {
      color: #16a34a;
      font-weight: 800;
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  // API Globale
  window.ReferentielAmenagements = {
    load: loadData,
    search: searchItems,
    findBestMatches: findBestMatches,
    open: openModal,
    close: closeModal,
    insert: insertIntoActiveInput
  };

})();
