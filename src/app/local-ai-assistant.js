/**
 * Journalier Électronique — Assistant de rédaction local (Traitement local / Hors-ligne)
 * 
 * - Traitement local sur l'appareil de l'utilisateur.
 * - Moteur local de reformulation pédagogique WBE, correction et croisement sémantique
 *   avec le Référentiel des Aménagements Raisonnables.
 * - Respect strict de la validation humaine (l'utilisateur valide, modifie ou refuse).
 */

(function() {
  'use strict';

  let _activeInput = null;

  /** Normalise le français pour faire correspondre les mots du dictionnaire malgré les accents. */
  function normalizeDictionaryText(value) {
    return String(value || '')
      .toLocaleLowerCase('fr-BE')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[’']/g, ' ')
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Dictionnaire de correspondances sémantiques entre difficultés et fiches du référentiel
  const THEMATIC_RULES = [
    {
      keywords: ['ecriture', 'ecrit', 'copie', 'graphisme', 'lent', 'fatigue', 'main', 'stylo', 'dysprax', 'douleur'],
      category: 'Graphisme & Écriture',
      secondaryTools: ['Pupitre incliné à 20°', 'PenAgain / Manchons ergonomiques', 'Stylos ou critériums lestés (tremblements)'],
      universalAdapts: ['Réduire le volume d’écrit', 'Fournir un support de cours pré-rempli ou à trous', 'Autoriser l’enregistrement vocal ou la dictée numérique']
    },
    {
      keywords: ['lecture', 'lire', 'dechiffr', 'dyslex', 'ligne', 'saut', 'lent', 'comprend pas'],
      category: 'Lecture & Décodage',
      secondaryTools: ['Lattes de lecture colorées / Solukit', 'Finger Focus', 'Stylo lecteur C-Pen Reader (synthèse vocale)'],
      universalAdapts: ['Aérer le document (police 14, interligne 1.5, texte non justifié)', 'Surligner les passages et mots-clés préalablement', 'Lecture audio ou à voix haute par un tiers']
    },
    {
      keywords: ['attention', 'concentr', 'distrait', 'bouge', 'agite', 'regard', 'reveur', 'fatig'],
      category: 'Attention & Concentration',
      secondaryTools: ['Time Timer (visualisation du temps / méthode Pomodoro)', 'Casque anti-bruit ou réducteurs Calmer', 'Coussin dynamique Dynair / Bande fidget de pieds'],
      universalAdapts: ['Fractionner les consignes en une seule tâche à la fois', 'Établir des pauses régulières de récupération cognitive', 'Placer l’élève face au tableau, loin des fenêtres et des sources de distraction']
    },
    {
      keywords: ['math', 'geometrie', 'compas', 'regle', 'equerre', 'calcul', 'table', 'operation', 'fraction'],
      category: 'Mathématiques & Géométrie',
      secondaryTools: ['Thamographe (instrument de géométrie tout-en-un sans pointe)', 'Compas ergonomique Twist’n Safe ou Bullseye', 'L’Eker graduée à poignée ergonomique', 'Flashcards des formules et propriétés'],
      universalAdapts: ['Laisser à disposition l’abaque des nombres et des grandeurs plastifié', 'Autoriser le recours aux tables de multiplication ou à la calculatrice', 'Agrandir les zones de tracés géométriques et espacer les exercices']
    },
    {
      keywords: ['consigne', 'compris', 'demarche', 'perdu', 'procedure', 'etape', 'sens'],
      category: 'Compréhension & Procédures',
      secondaryTools: ['Fiches mémos plastifiées de synthèse', 'Guides procéduraux étape par étape'],
      universalAdapts: ['Demander à l’élève de reformuler la consigne avec ses propres mots', 'Mettre en évidence les verbes d’action clés', 'Fournir un exemple traité ou un modèle de référence']
    },
    {
      keywords: ['angoisse', 'peur', 'blocage', 'refus', 'confiance', 'pleure', 'isolement'],
      category: 'Socio-affectif & Estime de soi',
      secondaryTools: ['Bandes anti-stress / Fidget discret', 'Baromètre visuel des émotions'],
      universalAdapts: ['Valoriser immédiatement les réussites intermédiaires et les efforts', 'Dédramatiser l’erreur comme une étape normale d’apprentissage', 'Offrir un cadre prévisible et rassurant']
    }
  ];

  // Moteur de reformulation pédagogique locale
  function localPedagogicalReformulate(text) {
    let s = String(text || '').trim();
    if (!s) return '';

    // Détection des puces ou phrases télégraphiques
    const lines = s.split(/\n|[;·•]|\.\s+/).map(l => l.trim()).filter(Boolean);
    const cleanedClauses = [];

    lines.forEach(line => {
      let l = line.replace(/^[-*•·]\s*/, '').trim();
      if (!l) return;

      // Adoucissement et tournures professionnelles
      l = l.replace(/\b(ne veut pas|veut pas|refuse)\s+de\s+/gi, "manifeste une réserve ou une hésitation à ");
      l = l.replace(/\b(ne veut pas|veut pas|refuse)\b/gi, "manifeste une réserve ou une hésitation face à");
      l = l.replace(/\b(comprend rien|ne comprend pas|pige pas)\b/gi, "rencontre des difficultés pour appréhender");
      l = l.replace(/\b(tres lent|trop lent|lent)\b/gi, "nécessite un temps de traitement plus étendu");
      l = l.replace(/\b(fait n'importe quoi|bacle)\b/gi, "adopte une démarche impulsive nécessitant un cadrage");
      l = l.replace(/\b(distrait|dans la lune|reveur)\b/gi, "éprouve une fatigabilité attentionnelle avec fluctuations de vigilance");
      l = l.replace(/\b(nul|mauvais)\b/gi, "se situe en phase de consolidation sur");
      l = l.replace(/\b(bloque|est bloque)\b/gi, "présente un point de blocage méthodologique nécessitant un étayage");

      // Mise en majuscule initiale
      l = l.charAt(0).toUpperCase() + l.slice(1);
      cleanedClauses.push(l);
    });

    if (cleanedClauses.length === 1) {
      return cleanedClauses[0].endsWith('.') ? cleanedClauses[0] : cleanedClauses[0] + '.';
    }

    return cleanedClauses.map(c => `• ${c.endsWith('.') ? c : c + '.'}`).join('\n');
  }

  // Moteur de correction orthographique et typographique
  function localGrammarCorrect(text) {
    let s = String(text || '').trim();
    if (!s) return '';

    // Nettoyage des espaces et ponctuation
    s = s.replace(/\s+/g, ' ');
    s = s.replace(/\s*([,;:.!?])\s*/g, '$1 ');
    s = s.replace(/\s+([,;.])/g, '$1');
    s = s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');

    // Corrections fréquentes de français / éducation
    const repls = [
      [/\bdyscalculi\b/gi, 'dyscalculie'],
      [/\bdyslexi\b/gi, 'dyslexie'],
      [/\bdysorthographi\b/gi, 'dysorthographie'],
      [/\bamenagement\b/gi, 'aménagement'],
      [/\bamenagements\b/gi, 'aménagements'],
      [/\bseance\b/gi, 'séance'],
      [/\bseances\b/gi, 'séances'],
      [/\beleve\b/gi, 'élève'],
      [/\beleves\b/gi, 'élèves'],
      [/\bgeometrie\b/gi, 'géométrie'],
      [/\bevaluation\b/gi, 'évaluation'],
      [/\bpedagogique\b/gi, 'pédagogique'],
      [/\bmathematique\b/gi, 'mathématique'],
      [/\bmathematiques\b/gi, 'mathématiques'],
      [/\bconsignes ecrites\b/gi, 'consignes écrites'],
      [/\ba revoir\b/gi, 'à revoir'],
      [/\ba evaluer\b/gi, 'à évaluer'],
      [/\ba examiner\b/gi, 'à examiner']
    ];

    repls.forEach(([pat, rep]) => {
      s = s.replace(pat, rep);
    });

    if (s.length > 0) {
      s = s.charAt(0).toUpperCase() + s.slice(1);
    }
    return s;
  }

  // Moteur de suggestions d'aménagements
  async function localSuggestAccommodations(text) {
    const raw = normalizeDictionaryText(text);

    // Le référentiel doit être chargé avant toute recherche, y compris sur iPad/Safari.
    if (window.ReferentielAmenagements && typeof window.ReferentielAmenagements.load === 'function') {
      await window.ReferentielAmenagements.load();
    }
    const suggestions = [];

    THEMATIC_RULES.forEach(rule => {
      const match = rule.keywords.some(kw => raw.includes(normalizeDictionaryText(kw))); 
      if (match) {
        suggestions.push({
          category: rule.category,
          tools: rule.secondaryTools,
          universal: rule.universalAdapts
        });
      }
    });

    let relatedFiches = [];
    if (window.ReferentielAmenagements && typeof window.ReferentielAmenagements.findBestMatches === 'function') {
      relatedFiches = window.ReferentielAmenagements.findBestMatches(text, 4);
    }

    return {
      themes: suggestions,
      fichesReferentiel: relatedFiches
    };
  }

  // Moteur de synthèse en 3 points
  function localSummarize3Points(text) {
    const s = String(text || '').trim();
    if (!s) return 'Aucune donnée textuelle à synthétiser.';

    const sentences = s.split(/\n|[.!?]+/).map(x => x.trim()).filter(x => x.length > 5);
    if (sentences.length <= 3) {
      return `Points d'appui et constats clés :\n` +
        sentences.map((st, i) => `${i + 1}. ${st.charAt(0).toUpperCase() + st.slice(1)}.`).join('\n');
    }

    return `Synthèse en 3 axes structurés :\n` +
      `1. Situation et mobilisation : ${sentences[0]}.\n` +
      `2. Démarche et étayage : ${sentences[Math.floor(sentences.length / 2)]}.\n` +
      `3. Piste d'action retenue : ${sentences[sentences.length - 1]}.`;
  }

  // Création du dialogue modal interactif
  function createAIMenuModalHtml() {
    return `
      <div id="local-ai-modal" class="modal-overlay" style="display:none;z-index:10000;" role="dialog" aria-modal="true" aria-labelledby="ai-modal-title">
        <div class="modal-card" style="max-width:760px;width:calc(100% - 24px);max-height:92vh;display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:18px;">
          <!-- Header -->
          <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0;background:#f8fafc;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.25rem;">✎</span>
              <div>
                <h3 id="ai-modal-title" style="margin:0;font-size:1.05rem;font-weight:750;color:#0f172a;">
                  Ajuster le texte
                </h3>
                <p style="margin:2px 0 0;font-size:0.75rem;color:#64748b;">
                  Traitement local sur votre appareil
                </p>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" id="btn-close-ai-modal" style="border:0;background:#e2e8f0;color:#475569;width:30px;height:30px;border-radius:50%;display:grid;place-items:center;cursor:pointer;font-size:1rem;font-weight:700;">✕</button>
            </div>
          </div>

          <!-- Actions rapides -->
          <div style="padding:12px 20px;border-bottom:1px solid #f1f5f9;background:#fff;display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="ai-action-btn is-active" data-action="grammar">
              ✏️ Corriger orthographe &amp; style
            </button>
            <button type="button" class="ai-action-btn" data-action="summarize">
              📝 Synthétiser en 3 points
            </button>
            <button type="button" class="ai-action-btn" data-action="suggest">
              🎯 Suggérer des aménagements
            </button>
            <button type="button" class="ai-action-btn" data-action="reformulate">
              ✎ Reformuler en style pro
            </button>
          </div>

          <!-- Contenu comparatif -->
          <div style="flex:1;overflow-y:auto;padding:16px 20px;background:#f8fafc;display:flex;flex-direction:column;gap:14px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label style="display:block;font-size:0.75rem;font-weight:750;color:#475569;margin-bottom:5px;text-transform:uppercase;">
                  Texte original :
                </label>
                <textarea id="ai-orig-text" rows="7" readonly style="width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:10px;padding:10px;font-size:0.84rem;background:#f1f5f9;color:#334155;resize:vertical;"></textarea>
              </div>

              <div>
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;gap:6px;flex-wrap:wrap;">
                  <label style="font-size:0.75rem;font-weight:750;color:#0284c7;text-transform:uppercase;margin:0;">
                    Proposition formulée :
                  </label>
                </div>
                <textarea id="ai-proposed-text" rows="7" style="width:100%;box-sizing:border-box;border:1.5px solid #38bdf8;border-radius:10px;padding:10px;font-size:0.84rem;background:#fff;color:#0f172a;line-height:1.45;outline:none;resize:vertical;"></textarea>
              </div>
            </div>

            <!-- Suggestions complémentaires du référentiel -->
            <div id="ai-suggestions-box" style="display:none;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;">
              <h4 style="margin:0 0 8px;font-size:0.82rem;color:#0f172a;display:flex;align-items:center;gap:6px;">
                <span>💡</span> <span>Pistes d'aménagements identifiées dans le référentiel WBE :</span>
              </h4>
              <div id="ai-suggestions-content" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:8px;"></div>
            </div>
          </div>

          <!-- Pied de page avec boutons de validation humaine -->
          <div style="padding:12px 20px;border-top:1px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <div style="font-size:0.75rem;color:#64748b;">
              🧑‍🏫 <em>L'assistant propose, vous disposez. Vous gardez 100% du contrôle rédactionnel.</em>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <button type="button" id="btn-cancel-ai" class="btn-secondary" style="border:1px solid #cbd5e1;background:#fff;padding:8px 14px;border-radius:8px;font-size:0.82rem;cursor:pointer;">
                Annuler
              </button>
              <button type="button" id="btn-append-ai" class="btn-secondary" style="border:1px solid #0284c7;background:#f0f9ff;color:#0369a1;padding:8px 14px;border-radius:8px;font-size:0.82rem;font-weight:600;cursor:pointer;">
                + Ajouter à la suite
              </button>
              <button type="button" id="btn-apply-ai" class="btn-primary" style="border:0;background:#0a84ff;color:#fff;padding:8px 16px;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;">
                ✓ Remplacer le texte
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /** Propose une reformulation locale sans ajouter de faits pédagogiques absents de la source. */
  async function improveTextLocally(text, action = 'reformulate') {
    const source = String(text || '').trim();
    if (!source) return '';

    // Moteur local déterministe : N'ajoute aucun fait, diagnostic, cause ou recommandation absent du texte.
    const normalize = action === 'summarize' ? localSummarize3Points : localGrammarCorrect;
    return String(normalize(source) || source).trim();
  }

  function openAIModalForInput(inputElement) {
    _activeInput = inputElement;
    const modal = document.getElementById('local-ai-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Rétablir le premier bouton d'action par défaut (Corriger orthographe & style)
    const buttons = modal.querySelectorAll('.ai-action-btn');
    buttons.forEach(b => b.classList.remove('is-active'));
    const defaultBtn = modal.querySelector('.ai-action-btn[data-action="grammar"]');
    if (defaultBtn) defaultBtn.classList.add('is-active');

    const origArea = document.getElementById('ai-orig-text');
    const text = inputElement ? String(inputElement.value || '').trim() : '';
    if (origArea) origArea.value = text;

    runAIAction('grammar', text);
  }

  function closeAIModal() {
    const modal = document.getElementById('local-ai-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  async function runAIAction(action, text) {
    const proposedArea = document.getElementById('ai-proposed-text');
    const suggBox = document.getElementById('ai-suggestions-box');
    const suggContent = document.getElementById('ai-suggestions-content');

    if (!proposedArea) return;
    proposedArea.value = "Traitement local en cours...";
    if (suggBox) suggBox.style.display = 'none';

    // Gestion de l'action suggest (recherche sémantique dans le dictionnaire et les 544 fiches)
    let suggestPromise = null;
    if (action === 'suggest') {
      suggestPromise = localSuggestAccommodations(text);
    }

    // Définition de la fonction déterministe
    const deterministicFallback = (source) => {
      if (action === 'grammar') return localGrammarCorrect(source);
      if (action === 'summarize') return localSummarize3Points(source);
      return localPedagogicalReformulate(source);
    };

    // Moteur déterministe local rapide
    setTimeout(() => {
      proposedArea.value = deterministicFallback(text);
    }, 50);

    // Si suggest, affichage des fiches du référentiel
    if (suggestPromise && suggBox && suggContent) {
      const res = await suggestPromise;
      suggBox.style.display = 'block';
      const items = [];

      res.themes.forEach(th => {
        th.universal.forEach(u => {
          items.push(`<div style="font-size:0.75rem;padding:6px 9px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
            <span><strong>${escapeHtml(th.category)} :</strong> ${escapeHtml(u)}</span>
            <button type="button" class="btn-ai-add-chip" data-text="${escapeAttr(u)}" style="border:0;background:#0284c7;color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:0.7rem;margin-left:6px;">+ Ajouter</button>
          </div>`);
        });
        th.tools.forEach(t => {
          items.push(`<div style="font-size:0.75rem;padding:6px 9px;background:#fdf4ff;border:1px solid #f0abfc;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
            <span><strong>Outil ${escapeHtml(th.category)} :</strong> ${escapeHtml(t)}</span>
            <button type="button" class="btn-ai-add-chip" data-text="${escapeAttr(t)}" style="border:0;background:#a855f7;color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:0.7rem;margin-left:6px;">+ Ajouter</button>
          </div>`);
        });
      });

      res.fichesReferentiel.forEach(f => {
        items.push(`<div style="font-size:0.75rem;padding:6px 9px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;display:flex;justify-content:space-between;align-items:center;">
          <span><strong>Fiche WBE :</strong> ${escapeHtml(f.titre)}</span>
          <button type="button" class="btn-ai-add-chip" data-text="${escapeAttr(f.titre)}" style="border:0;background:#16a34a;color:#fff;padding:2px 7px;border-radius:4px;cursor:pointer;font-size:0.7rem;margin-left:6px;">+ Ajouter</button>
        </div>`);
      });

      suggContent.innerHTML = items.length
        ? items.join('')
        : '<p style="font-size:0.75rem;color:#64748b;margin:0;">Aucune correspondance suffisamment précise. Essayez de décrire la tâche, la difficulté observée ou le contexte.</p>';

      suggContent.querySelectorAll('.btn-ai-add-chip').forEach(btn => {
        btn.addEventListener('click', () => {
          const chipText = btn.dataset.text;
          proposedArea.value += `\n• Aménagement préconisé : ${chipText}`;
          btn.textContent = '✓ Ajouté';
          btn.disabled = true;
        });
      });
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

  // Injecter automatiquement les boutons ✎ Ajuster le texte sur les champs de texte long
  function attachAIButtons() {
    // 1. Champs spécifiques de la séance (texte long)
    const sessionIds = [
      'f-classNotes',
      'f-q2-txt',
      'f-q3-txt',
      'f-q4-txt',
      'f-q5-txt',
      'f-q6-txt'
    ];
    const sessionTargets = sessionIds
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .map(el => ({ el, label: 'Ajuster le texte' }));

    // 2. Champ repères du PIA de la modale dossier élève
    const studentPiaEl = document.getElementById('student-modal-pia');
    const studentTargets = studentPiaEl ? [{ el: studentPiaEl, label: 'Ajuster le texte' }] : [];

    // 3. Champs de propositions du PIA annuel, Synthèse et réunions
    const documentTargets = [
      ...document.querySelectorAll('textarea[data-v74-prop-formulation]'),
      ...document.querySelectorAll('textarea[data-v74-domain-field]'),
      ...document.querySelectorAll('textarea[data-v74-meeting-field]'),
      ...document.querySelectorAll('textarea[data-synth-domain-input]'),
      ...document.querySelectorAll('textarea.synth-prop-textarea')
    ].map(el => ({ el, label: 'Ajuster le texte' }));

    const allTargets = [...sessionTargets, ...studentTargets, ...documentTargets];

    allTargets.forEach(t => {
      const el = t.el;
      if (el && !el.dataset.hasAiBtn) {
        el.dataset.hasAiBtn = 'true';

        const aiBtn = document.createElement('button');
        aiBtn.type = 'button';
        aiBtn.className = 'btn-secondary focus-ring btn-local-ai-trigger';
        aiBtn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;font-size:0.74rem;font-weight:600;padding:3px 9px;border-radius:9999px;cursor:pointer;background:rgba(0,113,227,0.06);color:#0284c7;border:1px solid rgba(2,132,199,0.25);transition:all .15s ease;min-height:28px;';
        aiBtn.title = 'Ajuster le texte (correction, reformulation pro ou synthèse)';
        aiBtn.innerHTML = `<span aria-hidden="true" style="font-size:0.75rem;">✎</span> <span>${escapeHtml(t.label)}</span>`;
        aiBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openAIModalForInput(el);
        });

        // Recherche du conteneur d'en-tête (label ou barre apple-voice)
        const parentContainer = el.closest ? (el.closest('.v11-field') || el.closest('.v74-domain-field') || el.closest('.v74-meeting-field') || el.parentElement) : el.parentElement;
        const voiceWrap = parentContainer && parentContainer.querySelector ? parentContainer.querySelector('.apple-voice-wrap') : null;
        const labelEl = (el.id && parentContainer && parentContainer.querySelector ? parentContainer.querySelector(`label[for="${el.id}"]`) : null) || (parentContainer && parentContainer.querySelector ? parentContainer.querySelector('label') : null);

        if (voiceWrap && voiceWrap.appendChild) {
          voiceWrap.appendChild(aiBtn);
        } else if (labelEl && labelEl.parentNode === parentContainer && (!labelEl.contains || !labelEl.contains(el))) {
          if (labelEl.style) {
            labelEl.style.display = 'flex';
            labelEl.style.justifyContent = 'space-between';
            labelEl.style.alignItems = 'center';
            labelEl.style.flexWrap = 'wrap';
            labelEl.style.gap = '8px';
          }
          const bar = document.createElement('div');
          bar.className = 'ai-trigger-label-bar';
          if (bar.style) {
            bar.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-left:auto;';
          }
          bar.appendChild(aiBtn);
          labelEl.appendChild(bar);
        } else if (el.parentNode) {
          const bar = document.createElement('div');
          bar.className = 'ai-trigger-label-bar';
          if (bar.style) {
            bar.style.cssText = 'display:flex;justify-content:flex-end;align-items:center;margin-bottom:4px;gap:6px;';
          }
          bar.appendChild(aiBtn);
          if (el.parentNode.insertBefore) {
            el.parentNode.insertBefore(bar, el);
          } else {
            el.parentNode.appendChild(bar);
          }
        }
      }
    });
  }

  // Purge unique des caches et marqueurs du prototype de modèle génératif
  function purgeLegacyModelCache() {
    if (typeof caches !== 'undefined') {
      caches.delete('journalier-ai-model-gemma-270m-v1').catch(() => {});
      caches.delete('transformers-cache').catch(() => {});
    }
    try {
      localStorage.removeItem('journalier_ai_model_enabled');
      localStorage.removeItem('journalier_ai_model_crash_marker');
    } catch (_) {}
  }

  function initUI() {
    if (!document.getElementById('local-ai-modal')) {
      document.body.insertAdjacentHTML('beforeend', createAIMenuModalHtml());
    }

    // Fermeture
    const closeBtn = document.getElementById('btn-close-ai-modal');
    if (closeBtn) closeBtn.addEventListener('click', closeAIModal);

    const cancelBtn = document.getElementById('btn-cancel-ai');
    if (cancelBtn) cancelBtn.addEventListener('click', closeAIModal);

    const modal = document.getElementById('local-ai-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeAIModal();
      });
    }

    purgeLegacyModelCache();

    // Boutons d'actions
    document.querySelectorAll('.ai-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ai-action-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const action = btn.dataset.action;
        const text = document.getElementById('ai-orig-text')?.value || '';
        runAIAction(action, text);
      });
    });

    // Remplacer le texte
    const applyBtn = document.getElementById('btn-apply-ai');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        const proposedArea = document.getElementById('ai-proposed-text');
        const textToApply = proposedArea ? proposedArea.value.trim() : '';

        if (_activeInput && textToApply) {
          _activeInput.value = textToApply;
          _activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          _activeInput.dispatchEvent(new Event('change', { bubbles: true }));
          _activeInput.focus();

          if (window.showAppToast) {
            window.showAppToast("✓ Texte reformulé appliqué avec succès", "success", 3000);
          }
        }
        closeAIModal();
      });
    }

    // Ajouter à la suite
    const appendBtn = document.getElementById('btn-append-ai');
    if (appendBtn) {
      appendBtn.addEventListener('click', () => {
        const proposedArea = document.getElementById('ai-proposed-text');
        const textToAppend = proposedArea ? proposedArea.value.trim() : '';

        if (_activeInput && textToAppend) {
          const prev = String(_activeInput.value || '').trim();
          _activeInput.value = prev ? `${prev}\n\n${textToAppend}` : textToAppend;
          _activeInput.dispatchEvent(new Event('input', { bubbles: true }));
          _activeInput.dispatchEvent(new Event('change', { bubbles: true }));
          _activeInput.focus();

          if (window.showAppToast) {
            window.showAppToast("✓ Texte ajouté à la suite", "success", 3000);
          }
        }
        closeAIModal();
      });
    }

    // Observer pour injecter les boutons sur les formulaires ouverts
    attachAIButtons();
    const observer = new MutationObserver(() => {
      attachAIButtons();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Styles CSS
  const style = document.createElement('style');
  style.textContent = `
    .ai-action-btn {
      border: 1px solid #cbd5e1;
      background: #f8fafc;
      color: #334155;
      font-size: 0.74rem;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      transition: all .15s ease;
    }
    .ai-action-btn:hover {
      background: #f1f5f9;
      border-color: #94a3b8;
    }
    .ai-action-btn.is-active {
      background: #0284c7;
      color: #fff;
      border-color: #0284c7;
      box-shadow: 0 2px 6px rgba(2,132,199,0.25);
    }
    .btn-local-ai-trigger:hover {
      background: rgba(0, 113, 227, 0.14) !important;
      border-color: rgba(2, 132, 199, 0.45) !important;
      transform: translateY(-0.5px);
    }
  `;
  document.head.appendChild(style);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }

  window.LocalAIAssistant = {
    open: openAIModalForInput,
    reformulate: localPedagogicalReformulate,
    correct: localGrammarCorrect,
    suggest: localSuggestAccommodations,
    summarize: localSummarize3Points,
    improve: improveTextLocally,
    normalizeDictionaryText: normalizeDictionaryText
  };

})();
