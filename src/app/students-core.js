/* =========================================================
   JOURNALIER V74 — STUDENTS MANAGEMENT & DOSSIERS CORE
   Module extrait de journalier-core.js (Lot 3.5)
   Architecture local-first / 100% navigateur (RGPD)
   Gestion des fiches élèves, Bento Cards, groupements (École, Classe),
   modales de création / édition / profil, sélection des matières
   et historique de suivi pédagogique.
   ========================================================= */

(function (global) {
    'use strict';

// Utilitaires de secours en cas d'exécution isolée
function escapeHtmlFallback(value) {
    return typeof globalThis.escapeHtml === 'function'
        ? globalThis.escapeHtml(value)
        : String(value ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
}

const safeEscapeHtml = typeof globalThis.escapeHtml === 'function'
    ? globalThis.escapeHtml
    : (typeof escapeHtml === 'function' ? escapeHtml : escapeHtmlFallback);

const SUBJECT_OPTIONS = [
    "Mathématiques",
    "Français",
    "Anglais",
    "Néerlandais",
    "Latin",
    "Grec ancien",
    "Biologie",
    "Chimie",
    "Physique",
    "Sciences économiques",
    "Histoire",
    "Géographie",
    "FMTTN",
    "Philosophie / citoyenneté",
    "ECA",
    "EP&S"
];

const LEGACY_SUBJECT_OPTIONS = ["Langues modernes", "Sciences", "FHGES"];

function normalizeSubjectList(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === 'string') return value.split(',').map(x => x.trim()).filter(Boolean);
    return [];
}

function subjectOptionsForSelection(selected = []) {
    const current = SUBJECT_OPTIONS.slice();
    const legacy = normalizeSubjectList(selected).filter(x => LEGACY_SUBJECT_OPTIONS.includes(x) && !current.includes(x));
    const custom = normalizeSubjectList(selected).filter(x => !current.includes(x) && !LEGACY_SUBJECT_OPTIONS.includes(x));
    return [...current, ...legacy, ...custom];
}

const HISTORY_Q2_LEVEL_LABELS = Object.freeze(['Partiellement', 'Suffisamment', 'Totalement']);
const HISTORY_Q4_EFFECT_LABELS = Object.freeze(['Aucun effet', 'Effet partiel', 'Effet positif']);

/**
 * Résout un libellé textuel basé sur un index numérique avec repli sécurisé.
 * @param {*} value
 * @param {readonly string[]} labels
 * @param {string} [fallbackPrefix='Niveau encodé : ']
 * @returns {string}
 */
function resolveIndexedLabel(value, labels, fallbackPrefix = 'Niveau encodé : ') {
    if (value === null || value === undefined || value === '') return '';
    const level = Number(value);
    return Number.isInteger(level) && level >= 0 && level < labels.length
        ? labels[level]
        : `${fallbackPrefix}${String(value)}`;
}

function historyQ2LevelLabel(value) {
    return resolveIndexedLabel(value, HISTORY_Q2_LEVEL_LABELS);
}

function historyQ4EffectLabel(value) {
    return resolveIndexedLabel(value, HISTORY_Q4_EFFECT_LABELS);
}

const HISTORY_Q5_TRANSFER_LABELS = Object.freeze({
    observed: 'Observé',
    not_observed: 'Non observé',
    no_opportunity: 'Pas d’occasion',
    later: 'À observer plus tard',
    not_relevant: 'Non pertinent'
});

function historyQ5TransferLabel(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    return HISTORY_Q5_TRANSFER_LABELS[raw] || raw;
}

// Helpers de données sécurisés pour l'exécution isolée
function getStudentsData() {
    if (typeof window !== 'undefined' && window.DataStore?.getStudents) {
        return window.DataStore.getStudents();
    }
    if (typeof DataStore !== 'undefined' && DataStore?.getStudents) {
        return DataStore.getStudents();
    }
    return [];
}

function getSessionsData() {
    if (typeof window !== 'undefined' && window.DataStore?.getSessions) {
        return window.DataStore.getSessions();
    }
    if (typeof DataStore !== 'undefined' && DataStore?.getSessions) {
        return DataStore.getSessions();
    }
    return [];
}

function getStudentByName(name) {
    return getStudentsData().find(s => s.nom === name) || null;
}

function getStudentById(id) {
    return getStudentsData().find(s => String(s.id) === String(id) || String(s.studentId) === String(id)) || null;
}

function saveStudentsList(list) {
    const safeList = Array.isArray(list) ? list : [];
    if (typeof window !== 'undefined' && window.DataStore?.saveStudents) {
        window.DataStore.saveStudents(safeList);
    } else if (typeof DataStore !== 'undefined' && DataStore?.saveStudents) {
        DataStore.saveStudents(safeList);
    }
    window.JournalierV74?.refreshStudents?.();
    updateStudentDropdowns();
    renderStudentsView();
    if (typeof updateStats === 'function') updateStats();
    else if (typeof window !== 'undefined' && typeof window.updateStats === 'function') window.updateStats();
}

function sessionPartsSafe(entry) {
    if (typeof sessionParts === 'function') return sessionParts(entry);
    if (typeof window !== 'undefined' && typeof window.sessionParts === 'function') return window.sessionParts(entry);
    return {
        date: entry?.identification?.date || entry?.date || '',
        matiere: entry?.identification?.matiere || entry?.contexte?.matiere || entry?.matiere || '',
        eleve: entry?.identification?.eleve || entry?.eleve || '',
        start: entry?.periode?.start || entry?.start || '',
        end: entry?.periode?.end || entry?.end || ''
    };
}

function sessionSortKeySafe(entry) {
    if (typeof sessionSortKey === 'function') return sessionSortKey(entry);
    if (typeof window !== 'undefined' && typeof window.sessionSortKey === 'function') return window.sessionSortKey(entry);
    const p = sessionPartsSafe(entry);
    return `${p.date}${p.start}${p.end}`;
}

function isJournalSessionSafe(entry) {
    if (typeof isJournalSession === 'function') return isJournalSession(entry);
    if (typeof window !== 'undefined' && typeof window.isJournalSession === 'function') return window.isJournalSession(entry);
    return Boolean(entry && entry.type === 'SEANCE');
}

function sessionPeriodLabelSafe(entry) {
    if (typeof sessionPeriodLabel === 'function') return sessionPeriodLabel(entry);
    if (typeof window !== 'undefined' && typeof window.sessionPeriodLabel === 'function') return window.sessionPeriodLabel(entry);
    const p = sessionPartsSafe(entry);
    return p.start && p.end && p.start !== p.end ? `${p.start} → ${p.end}` : (p.start || p.end || '');
}

function reportHumanDateSafe(d) {
    if (typeof reportHumanDate === 'function') return reportHumanDate(d);
    if (typeof window !== 'undefined' && typeof window.reportHumanDate === 'function') return window.reportHumanDate(d);
    return String(d || '');
}

function safeShowToast(message, tone = 'info', duration = 3000) {
    if (typeof showAppToast === 'function') showAppToast(message, tone, duration);
    else if (typeof window !== 'undefined' && typeof window.showAppToast === 'function') window.showAppToast(message, tone, duration);
}

function safeCloseAllChoiceMenus() {
    if (typeof closeAllChoiceMenus === 'function') closeAllChoiceMenus();
    else if (typeof window !== 'undefined' && typeof window.closeAllChoiceMenus === 'function') window.closeAllChoiceMenus();
    else if (typeof document !== 'undefined') {
        document.querySelectorAll('.multi-select-menu,.search-select-menu').forEach(el => el.classList.add('hidden'));
    }
}

// -------------------------------------------------------------
// SÉLECTION DES MATIÈRES DANS LA MODALE ÉLÈVE
// -------------------------------------------------------------

// La sélection est gardée en mémoire : un filtre de recherche ne doit jamais faire « oublier » une matière cochée.
let studentSubjectSelection = new Set();
function currentStudentSubjects() { return [...studentSubjectSelection]; }

function renderStudentSubjectOptions(filter = '', selectedOverride = null) {
    if (typeof document === 'undefined') return;
    const wrap = document.getElementById('student-subject-options');
    if (!wrap) return;
    const q = String(filter || '').trim().toLowerCase();
    if (selectedOverride) studentSubjectSelection = new Set(selectedOverride);
    const selected = studentSubjectSelection;
    const options = subjectOptionsForSelection([...selected]).filter(x => !q || x.toLowerCase().includes(q));
    const rawQuery = String(filter || '').trim();
    const known = options.some(x => x.toLowerCase() === q) || subjectOptionsForSelection([...selected]).some(x => x.toLowerCase() === q);
    const items = options.map(x => {
        const isSelected = selected.has(x);
        const legacy = LEGACY_SUBJECT_OPTIONS.includes(x);
        const custom = !SUBJECT_OPTIONS.includes(x) && !legacy;
        return `<button type="button" class="student-subject-item ${isSelected ? 'is-selected' : ''} js-student-subject" data-value="${safeEscapeHtml(x)}" aria-pressed="${isSelected ? 'true' : 'false'}">${safeEscapeHtml(x)}${legacy ? ' · ancienne appellation à préciser' : ''}${custom ? ' · ajoutée' : ''}</button>`;
    });
    if (rawQuery && !known) {
        const label = rawQuery.charAt(0).toUpperCase() + rawQuery.slice(1);
        items.push(`<button type="button" class="student-subject-item js-student-subject" data-value="${safeEscapeHtml(label)}" aria-pressed="false">+ Ajouter la matière « ${safeEscapeHtml(label)} »</button>`);
    }
    wrap.innerHTML = items.length ? items.join('') : '<div class="search-select-empty">Aucune matière trouvée.</div>';
}

function toggleStudentSubject(value) {
    if (typeof document === 'undefined') return;
    const wrap = document.getElementById('student-subject-options');
    if (!wrap) return;
    const item = Array.from(wrap.querySelectorAll('.student-subject-item')).find(x => x.dataset.value === String(value));
    if (!item) return;
    const selected = !item.classList.contains('is-selected');
    item.classList.toggle('is-selected', selected);
    item.setAttribute('aria-pressed', selected ? 'true' : 'false');
    if (selected) studentSubjectSelection.add(String(value)); else studentSubjectSelection.delete(String(value));
    if (selected && item.textContent.startsWith('+ Ajouter')) {
        const search = document.getElementById('student-subject-search');
        if (search) search.value = '';
        renderStudentSubjectOptions('');
    }
    updateStudentSubjectsSummary();
}

function updateStudentSubjectsSummary() {
    if (typeof document === 'undefined') return;
    const box = document.getElementById('student-subjects-select');
    if (!box) return;
    const checked = currentStudentSubjects();
    const summary = document.getElementById('student-subjects-summary');
    if (!summary) return;
    if (!checked.length) {
        summary.className = 'placeholder';
        summary.textContent = 'Sélectionner une ou plusieurs matières…';
    } else if (checked.length <= 2) {
        summary.className = '';
        summary.textContent = checked.join(' · ');
    } else {
        summary.className = 'count';
        summary.textContent = `${checked.length} matières sélectionnées`;
    }
}

function filterStudentSubjects() {
    if (typeof document === 'undefined') return;
    renderStudentSubjectOptions(document.getElementById('student-subject-search')?.value || '');
}

function initStudentSubjects(selected = []) {
    if (typeof document === 'undefined') return;
    renderStudentSubjectOptions('', normalizeSubjectList(selected));
    updateStudentSubjectsSummary();
    const search = document.getElementById('student-subject-search');
    if (search) search.value = '';
}

// -------------------------------------------------------------
// SÉLECTION DE L'ÉLÈVE DANS LES MENUS DÉROULANTS
// -------------------------------------------------------------

function updateStudentDropdowns() {
    if (typeof document === 'undefined') return;
    const students = getStudentsData();
    ['f-eleve', 'r-eleve', 'modal-slot-eleve'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const current = el.value;
        el.replaceChildren();
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '-- Choisir un élève --';
        el.appendChild(placeholder);
        students.forEach(s => {
            const o = document.createElement('option');
            o.value = String(s.nom ?? '');
            o.textContent = `${s.nom ?? ''} (${s.classe ?? ''}${s.ecole ? ' - ' + s.ecole : ''})`;
            el.appendChild(o);
        });
        if (current) el.value = current;
    });
}

function prepareEditingStudentSelection(entry) {
    if (typeof document === 'undefined') return null;
    const select = document.getElementById('f-eleve');
    if (!select) return null;
    const students = getStudentsData();
    const originalName = String(entry?.identification?.eleve || '').trim();
    const originalId = String(entry?.identification?.eleveId || '').trim();
    const currentStudent = students.find(s => originalId && String(s.studentId) === originalId)
        || students.find(s => originalName && String(s.nom) === originalName)
        || null;

    const note = document.getElementById('session-student-edit-note');
    if (currentStudent) {
        select.value = String(currentStudent.nom || '');
        select.removeAttribute('data-orphan-session-student');
        if (note) { note.textContent = ''; note.classList.add('hidden'); }
        return currentStudent;
    }

    if (!originalName) return null;
    let option = Array.from(select.options).find(o => String(o.value) === originalName);
    if (!option) {
        option = document.createElement('option');
        option.value = originalName;
        option.textContent = `${originalName} (ancien élève — choisissez un élève actuel)`;
        select.appendChild(option);
    }
    select.value = originalName;
    select.setAttribute('data-orphan-session-student', 'true');
    if (note) {
        note.textContent = `Élève initial « ${originalName} » introuvable dans le dossier. Conservez-le ou choisissez un élève existant avant d’enregistrer.`;
        note.classList.remove('hidden');
    }
    return null;
}

// -------------------------------------------------------------
// BENTO CARDS & VUE DU DOSSIER ÉLÈVES
// -------------------------------------------------------------

let studentGroupMode = 'all';

function renderStudentBentoCard(s, db, piaRecords) {
    const sid = String(s.studentId || s.id || '');
    const studentSessions = db.filter(l => isJournalSessionSafe(l) && sessionPartsSafe(l).eleve === s.nom).sort((a, b) => sessionSortKeySafe(b).localeCompare(sessionSortKeySafe(a)));
    const countObs = studentSessions.length;
    const lastSession = studentSessions[0] || null;
    const lastDateStr = lastSession ? reportHumanDateSafe(sessionPartsSafe(lastSession).date) : 'Aucune séance';
    const lastSubjectStr = lastSession ? (sessionPartsSafe(lastSession).matiere || lastSession.contexte?.matiere || '') : '';
    const subjects = normalizeSubjectList(s.matieres);
    const initials = String(s.nom || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0] || '').join('').toLocaleUpperCase('fr') || '•';
    const piaRec = piaRecords?.[sid] || null;
    let piaStatusText = 'PIA à préparer';
    let piaTone = 'warning';
    if (piaRec) {
        const lc = String(piaRec.lifecycle || '').toUpperCase();
        if (lc === 'FINALISE') { piaStatusText = 'PIA finalisé'; piaTone = 'success'; }
        else if (lc === 'EN_VIGUEUR' || lc === 'ACTIF' || piaRec?.meeting1?.status === 'VALIDÉ' || piaRec?.meeting1?.status === 'VALIDÉE') { piaStatusText = 'PIA en vigueur'; piaTone = 'success'; }
        else if (lc === 'EN_REEVALUATION') { piaStatusText = 'En réévaluation'; piaTone = 'info'; }
        else { piaStatusText = 'Projet PIA en cours'; piaTone = 'warning'; }
    }
    const validatedObjs = Array.isArray(piaRec?.meeting1?.objectivesValidated) ? piaRec.meeting1.objectivesValidated.map(o => typeof o === 'string' ? o : o?.formulation || '').filter(Boolean) : [];
    const piaPreview = validatedObjs[0] || s.pia || 'Aucun objectif saisi dans le dossier.';
    const hues = [215, 162, 258, 335, 28, 192];
    let hash = 0;
    for (let i = 0; i < String(s.nom || '').length; i++) hash = (hash * 31 + String(s.nom || '').charCodeAt(i)) % 360;
    const hue = hues[Math.abs(hash) % hues.length];

    return `<article class="student-item student-record student-bento-card" data-student-id="${safeEscapeHtml(String(s.id))}">
        <div class="student-bento-top">
            <div class="student-bento-identity">
                <span class="student-avatar student-bento-avatar" style="--avatar-hue:${hue};" aria-hidden="true">${safeEscapeHtml(initials)}</span>
                <div class="student-record-identity student-bento-title-wrap">
                    <h3 class="student-name student-bento-name">${safeEscapeHtml(s.nom)}</h3>
                    <div class="student-bento-badges">
                        <span class="student-bento-badge is-class">${safeEscapeHtml(s.classe || 'Classe non précisée')}</span>
                        ${s.ecole ? `<span class="student-bento-badge is-school">${safeEscapeHtml(s.ecole)}</span>` : ''}
                    </div>
                </div>
            </div>
            <span class="student-bento-pia-pill is-${piaTone}">${safeEscapeHtml(piaStatusText)}</span>
        </div>

        <div class="student-bento-kpis">
            <div class="student-bento-kpi">
                <span class="student-bento-kpi-lbl">Suivi</span>
                <strong class="student-session-count student-bento-kpi-val">${countObs} séance${countObs === 1 ? '' : 's'}</strong>
            </div>
            <div class="student-bento-kpi">
                <span class="student-bento-kpi-lbl">Dernière séance</span>
                <strong class="student-bento-kpi-val">${safeEscapeHtml(lastDateStr)}${lastSubjectStr ? ` · ${safeEscapeHtml(lastSubjectStr)}` : ''}</strong>
            </div>
        </div>

        <section class="student-record-section student-bento-subjects-section">
            <h4>Matières principales</h4>
            <div class="student-subject-pills">${subjects.length ? subjects.map((subject, index) => `<span class="student-subject-pill tone-${index % 4}">${safeEscapeHtml(subject)}</span>`).join('') : '<span class="student-record-empty">Aucune matière définie</span>'}</div>
        </section>

        <details class="student-collapsible student-bento-pia-details">
            <summary>Repère PIA : <span>${safeEscapeHtml(piaPreview)}</span></summary>
            <section class="student-pia-panel">
                <p>${safeEscapeHtml(s.pia || 'Aucun objectif saisi dans le dossier.')}</p>
                <div class="v74-pia-dossier-mount" data-student-id="${safeEscapeHtml(sid)}"></div>
            </section>
        </details>

        <footer class="student-actions student-bento-footer">
            <div class="student-bento-quick-actions">
                <button class="student-bento-btn is-primary focus-ring" type="button" data-action="student-new-session" data-student-id="${safeEscapeHtml(String(s.id))}" title="Encoder une séance pour ${safeEscapeHtml(s.nom)}">✍️ +Séance</button>
                <button class="student-bento-btn focus-ring" type="button" data-action="student-open-pia" data-student-id="${safeEscapeHtml(String(s.id))}" title="Ouvrir Synthèse &amp; PIA pour ${safeEscapeHtml(s.nom)}">📊 PIA</button>
                <button class="btn-secondary student-bento-btn focus-ring" type="button" data-action="student-profile" data-student-id="${safeEscapeHtml(String(s.id))}">📂 Dossier</button>
            </div>
            <div class="student-bento-admin-actions">
                <button class="btn-quiet student-bento-icon-btn focus-ring" type="button" data-action="student-edit" data-student-id="${safeEscapeHtml(String(s.id))}" title="Modifier l’élève">Modifier</button>
                <button class="student-delete-action student-bento-icon-btn is-danger focus-ring" type="button" data-action="student-delete" data-student-id="${safeEscapeHtml(String(s.id))}" title="Supprimer l’élève">Supprimer</button>
            </div>
        </footer>
    </article>`;
}

function renderStudentsView() {
    if (typeof document === 'undefined') return;
    const students = getStudentsData();
    const container = document.getElementById('students-list-container');
    if (!container) return;

    document.querySelectorAll('[data-student-group-mode]').forEach(btn => {
        if (!btn.dataset.groupBound) {
            btn.dataset.groupBound = 'true';
            btn.addEventListener('click', () => {
                studentGroupMode = btn.dataset.studentGroupMode || 'all';
                document.querySelectorAll('[data-student-group-mode]').forEach(b => {
                    const active = b.dataset.studentGroupMode === studentGroupMode;
                    b.classList.toggle('active', active);
                    b.setAttribute('aria-selected', String(active));
                });
                renderStudentsView();
            });
        }
    });

    const search = (document.getElementById('student-search')?.value || '').trim().toLowerCase();
    const db = getSessionsData();
    const piaRecords = (typeof window !== 'undefined' && window.DataStore?.getState?.()?.meta?.piaRecords)
        || (typeof DataStore !== 'undefined' && DataStore?.getState?.()?.meta?.piaRecords)
        || {};
    const filtered = students.filter(s => `${s.nom} ${s.classe || ''} ${s.ecole || ''} ${s.pia || ''} ${normalizeSubjectList(s.matieres).join(' ')}`.toLowerCase().includes(search));
    const count = document.getElementById('student-count');
    if (count) count.textContent = `${filtered.length} élève${filtered.length > 1 ? 's' : ''}`;
    if (students.length === 0) { container.innerHTML = '<div class="card"><p style="color:var(--text-sub);margin:0;">Aucun élève enregistré.</p></div>'; return; }
    if (filtered.length === 0) { container.innerHTML = '<div class="card"><p style="color:var(--text-sub);margin:0;">Aucun résultat pour cette recherche.</p></div>'; return; }

    if (studentGroupMode === 'school' || studentGroupMode === 'class') {
        const groups = new Map();
        filtered.forEach(s => {
            const key = studentGroupMode === 'school'
                ? (String(s.ecole || '').trim() || 'École non précisée')
                : (String(s.classe || '').trim() || 'Classe non précisée');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(s);
        });
        container.innerHTML = `<div class="student-groups-stack">${[...groups.entries()].map(([groupTitle, list]) => `
            <details class="student-group-accordion" open>
                <summary class="student-group-summary">
                    <div class="student-group-title-wrap">
                        <span class="student-group-chevron" aria-hidden="true">⌄</span>
                        <strong>${safeEscapeHtml(groupTitle)}</strong>
                    </div>
                    <span class="student-group-badge">${list.length} élève${list.length > 1 ? 's' : ''}</span>
                </summary>
                <div class="student-bento-grid">
                    ${list.map(s => renderStudentBentoCard(s, db, piaRecords)).join('')}
                </div>
            </details>
        `).join('')}</div>`;
    } else {
        container.innerHTML = `<div class="student-bento-grid">${filtered.map(s => renderStudentBentoCard(s, db, piaRecords)).join('')}</div>`;
    }

    container.querySelectorAll('.v74-pia-dossier-mount').forEach(mount => {
        mount.innerHTML = window.JournalierV74?.piaImportDossierHtml?.(mount.dataset.studentId) || '';
    });
    container.querySelectorAll('[data-action="student-new-session"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const st = getStudentsData().find(x => String(x.id) === String(btn.dataset.studentId));
            if (!st) return;
            if (typeof clearObservationForm === 'function') clearObservationForm();
            else if (typeof window !== 'undefined' && typeof window.clearObservationForm === 'function') window.clearObservationForm();
            const sel = document.getElementById('f-eleve');
            if (sel) { sel.value = st.nom; sel.dispatchEvent(new Event('change', { bubbles: true })); }
            if (typeof showTab === 'function') showTab('form');
            else if (typeof window !== 'undefined' && typeof window.showTab === 'function') window.showTab('form');
        });
    });
    container.querySelectorAll('[data-action="student-open-pia"]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const st = getStudentsData().find(x => String(x.id) === String(btn.dataset.studentId));
            if (!st) return;
            const rSel = document.getElementById('r-eleve');
            if (rSel) {
                rSel.value = st.nom;
                rSel.dispatchEvent(new Event('change', { bubbles: true }));
                rSel.dispatchEvent(new CustomEvent('journalier:student-context-change', { bubbles: true }));
            }
            if (typeof showTab === 'function') showTab('reports');
            else if (typeof window !== 'undefined' && typeof window.showTab === 'function') window.showTab('reports');
            if (typeof setReportsTab === 'function') setReportsTab('synthesis');
            else if (typeof window !== 'undefined' && typeof window.setReportsTab === 'function') window.setReportsTab('synthesis');
        });
    });
}

// -------------------------------------------------------------
// PROFIL ÉLÈVE & DOSSIER MODAL
// -------------------------------------------------------------

function renderStudentPIAAdminProfile(st) {
    const admin = st?.administrativeInfo || st || {};
    const checkFn = window?.JournalierV74?.countMissingPIAInfo;
    const check = typeof checkFn === 'function' ? checkFn(st) : null;
    const isComplete = check ? check.isComplete : Boolean(admin.nom && admin.dateNaissance && admin.coordonneesEcole && admin.titulaire && admin.coordonneesCpms && admin.responsable);
    const missingCount = check ? check.missingCount : 0;
    const badgeText = isComplete ? '✓ Tableau T1 complet' : `${missingCount} info(s) T1 manquante(s)`;
    const badgeStyle = isComplete ? 'background:#dcfce7;color:#166534;' : 'background:#fef3c7;color:#92400e;';

    return `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <h4 style="margin:0;">Informations pour le PIA officiel (Tableau T1)</h4>
        <span style="font-size:0.72rem;padding:2px 8px;border-radius:10px;font-weight:600;${badgeStyle}">${safeEscapeHtml(badgeText)}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px 12px;font-size:0.8rem;color:#334155;margin-top:6px;">
        <div><strong>Date de naissance :</strong> ${safeEscapeHtml(admin.dateNaissance || '—')}</div>
        <div><strong>Option / Filière :</strong> ${safeEscapeHtml(admin.option || '—')}</div>
        <div><strong>Titulaire :</strong> ${safeEscapeHtml(admin.titulaire || '—')}</div>
        <div><strong>Représentant Pôle :</strong> ${safeEscapeHtml(admin.representantPole || 'Pôle Territorial WBE BXL')}</div>
        <div><strong>Coordonnées école :</strong> ${safeEscapeHtml(admin.coordonneesEcole || '—')}</div>
        <div><strong>Coordonnées CPMS :</strong> ${safeEscapeHtml(admin.coordonneesCpms || '—')}</div>
        <div><strong>Responsable :</strong> ${safeEscapeHtml(admin.responsable || '—')}</div>
        <div><strong>Coordonnées responsable :</strong> ${safeEscapeHtml(admin.coordonneesResponsable || '—')}</div>
    </div>
    <div style="margin-top:8px;font-size:0.72rem;color:#64748b;line-height:1.4;">🔒 Stockage chiffré local (AES-GCM). Exclu des exports dé-identifiés. Les coordonnées personnelles doivent être validées avec votre direction.</div>`;
}

function attachStudentModalAutoSuggest() {
    if (typeof document === 'undefined') return;
    const ecoleInput = document.getElementById('student-modal-ecole');
    if (!ecoleInput || ecoleInput._jrSuggestBound) return;
    ecoleInput._jrSuggestBound = true;
    ecoleInput.addEventListener('change', () => {
        const ecoVal = ecoleInput.value.trim();
        if (!ecoVal) return;
        const suggestFn = window?.JournalierV74?.suggestSchoolAdminData;
        if (typeof suggestFn !== 'function') return;
        const suggestions = suggestFn(ecoVal, getStudentsData());
        const coordEcoleInput = document.getElementById('student-modal-coordonnees-ecole');
        const coordCpmsInput = document.getElementById('student-modal-coordonnees-cpms');
        const titulaireInput = document.getElementById('student-modal-titulaire');
        if (coordEcoleInput && !coordEcoleInput.value && suggestions.coordonneesEcole) {
            coordEcoleInput.value = suggestions.coordonneesEcole;
        }
        if (coordCpmsInput && !coordCpmsInput.value && suggestions.coordonneesCpms) {
            coordCpmsInput.value = suggestions.coordonneesCpms;
        }
        if (titulaireInput && !titulaireInput.value && suggestions.titulaire) {
            titulaireInput.value = suggestions.titulaire;
        }
    });
}

function openStudentProfile(id) {
    if (typeof document === 'undefined') return;
    const st = getStudentsData().find(x => String(x.id) === String(id));
    if (!st) return;
    const logs = getSessionsData().filter(l => isJournalSessionSafe(l) && sessionPartsSafe(l).eleve === st.nom).sort((a, b) => sessionSortKeySafe(b).localeCompare(sessionSortKeySafe(a)));
    const observations = logs.flatMap(l => (l.q2?.observations || []).map(x => x.observation));
    const adaptations = logs.flatMap(l => l.q4?.types || []);
    const recent = logs.slice(0, 5);
    const subjects = normalizeSubjectList(st.matieres);
    const q2LevelLabels = ['Partiellement', 'Suffisamment', 'Totalement'];
    const q4EffectLabels = ['Aucun effet', 'Effet partiel', 'Effet positif'];
    const recentCards = recent.map(log => {
        const parts = sessionPartsSafe(log), q2 = log.q2 || {}, q3 = log.q3 || {}, q4 = log.q4 || {}, q5 = log.q5 || {}, q6 = log.q6 || {};
        const observationsQ2 = (q2.observations || []).map(item => ({ text: item.observation, level: q2LevelLabels[Number(item.niveau)] || '' })).filter(item => item.text);
        const effects = Object.entries(q4.effets || {}).map(([name, value]) => ({ text: name, level: q4EffectLabels[Number(value)] || `Niveau encodé : ${value}`, tone: `is-effect-${['none', 'partial', 'positive'][Number(value)] || 'none'}` }));
        const transferFr = historyQ5TransferLabel(q5.statut);
        const groups = [
            ['Observation · Q2', observationsQ2, 'is-observation'],
            ['Apprentissage · Q3', (q3.indicateurs || []).map(item => ({ text: item.texte })).filter(item => item.text), 'is-learning'],
            ['Adaptation · Q4', (q4.types || []).map(text => ({ text })), 'is-adaptation'],
            ['Effets · Q4', effects, 'is-effect'],
            ['Transfert · Q5', transferFr ? [{ text: transferFr }] : [], 'is-transfer'],
            ['Suite · Q6', (q6.actions || []).map(text => ({ text })), 'is-followup']
        ].filter(([, items]) => items.length);
        return `<article class="profile-session-card">
            <header class="profile-session-head"><div><strong>${safeEscapeHtml(parts.date)} · ${safeEscapeHtml(parts.matiere)}</strong><span>${safeEscapeHtml(sessionPeriodLabelSafe(log))}</span></div><button class="btn-quiet focus-ring" type="button" data-action="history-edit" data-session-id="${safeEscapeHtml(String(log.id))}">Modifier</button></header>
            <div class="profile-session-body">
                <h4>${safeEscapeHtml(log.objectif?.objectifLecon || log.objectif?.objectifProfessionnel || 'Séance enregistrée')}</h4>
                <div class="profile-session-groups">${groups.length ? groups.map(([title, items, tone]) => `<section class="profile-session-group ${tone}"><h5>${safeEscapeHtml(title)}</h5><div>${items.map(item => `<span class="profile-session-pill">${safeEscapeHtml(item.text)}${item.level ? `<b class="${item.tone || ''}">${safeEscapeHtml(item.level)}</b>` : ''}</span>`).join('')}</div></section>`).join('') : '<p class="student-record-empty">Aucun élément Q2–Q6 renseigné pour cette séance.</p>'}</div>
            </div>
        </article>`;
    }).join('');
    const body = `<div class="profile-summary"><div class="profile-stat tone-blue"><strong>${logs.length}</strong><span>séances</span></div><div class="profile-stat tone-purple"><strong>${new Set(observations).size}</strong><span>observations distinctes</span></div><div class="profile-stat tone-green"><strong>${new Set(adaptations).size}</strong><span>adaptations renseignées</span></div></div>
        <section class="profile-block profile-subject-block"><h4>Matières principales</h4><div class="student-subject-pills">${subjects.length ? subjects.map((subject, index) => `<span class="student-subject-pill tone-${index % 4}">${safeEscapeHtml(subject)}</span>`).join('') : '<span class="student-record-empty">Aucune matière définie</span>'}</div></section>
        <section class="profile-block profile-pia-block"><h4>Repère PIA du dossier</h4><p>${safeEscapeHtml(st.pia || 'Aucun objectif saisi dans le dossier.')}</p>${window.JournalierV74?.piaImportDossierHtml?.(String(st.studentId || st.id)) || ''}</section>
        <section class="profile-block profile-pia-admin-block">${renderStudentPIAAdminProfile(st)}</section>
        <section class="profile-recent-section"><header><div><div class="page-kicker">Données enregistrées</div><h4>Séances récentes</h4></div><span>${recent.length} / ${logs.length}</span></header>${recent.length ? `<div class="profile-session-list">${recentCards}</div>` : '<p class="student-record-empty">Aucune séance enregistrée pour cet élève.</p>'}</section>`;
    document.getElementById('student-profile-title').textContent = st.nom;
    document.getElementById('student-profile-meta').textContent = `${st.classe || 'Classe non précisée'}${st.ecole ? ' · ' + st.ecole : ''}`;
    const profileBodyEl = document.getElementById('student-profile-body');
    if (profileBodyEl) {
        profileBodyEl.innerHTML = body;
        profileBodyEl.querySelectorAll('[data-action="history-edit"]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const sid = btn.dataset.sessionId || '';
                if (sid) {
                    closeStudentProfile();
                    if (typeof editHistorySession === 'function') editHistorySession(sid);
                    else if (typeof window !== 'undefined' && typeof window.editHistorySession === 'function') window.editHistorySession(sid);
                }
            });
        });
    }
    document.getElementById('studentProfileModal')?.classList.remove('hidden');
}

function closeStudentProfile() {
    if (typeof document !== 'undefined') {
        document.getElementById('studentProfileModal')?.classList.add('hidden');
    }
}

// -------------------------------------------------------------
// AJOUT / MODIFICATION D'UN ÉLÈVE DANS LE DOSSIER
// -------------------------------------------------------------

function openAddStudentModal() {
    if (typeof document === 'undefined') return;
    document.getElementById('student-modal-title').innerText = 'Ajouter un Élève';
    document.getElementById('student-modal-id').value = '';
    document.getElementById('student-modal-nom').value = '';
    document.getElementById('student-modal-classe').value = '';
    document.getElementById('student-modal-ecole').value = '';
    document.getElementById('student-modal-pia').value = '';
    document.getElementById('student-pia-file').value = '';
    document.getElementById('student-pia-file-name').textContent = 'Le PIA est traité localement ; le document original et son nom de fichier ne sont pas conservés par Journalier.';

    const setVal = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val; };
    setVal('student-modal-date-naissance', '');
    setVal('student-modal-option', '');
    setVal('student-modal-titulaire', '');
    setVal('student-modal-coordonnees-ecole', '');
    setVal('student-modal-coordonnees-cpms', '');
    setVal('student-modal-representant-pole', 'Pôle Territorial WBE BXL');
    setVal('student-modal-responsable', '');
    setVal('student-modal-coordonnees-responsable', '');
    const badge = document.getElementById('student-modal-pia-info-badge');
    if (badge) badge.textContent = '(optionnel)';

    initStudentSubjects([]);
    safeCloseAllChoiceMenus();
    attachStudentModalAutoSuggest();
    const modal = document.getElementById('studentModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.removeAttribute('aria-hidden');
        modal.style.display = 'flex';
    }
}

function openEditStudentModal(id) {
    if (typeof document === 'undefined') return;
    const students = getStudentsData();
    const s = students.find(item => String(item.id) === String(id));
    if (s) {
        document.getElementById('student-modal-title').innerText = 'Modifier l’Élève';
        document.getElementById('student-modal-id').value = s.id;
        document.getElementById('student-modal-nom').value = s.nom;
        document.getElementById('student-modal-classe').value = s.classe || '';
        document.getElementById('student-modal-ecole').value = s.ecole || '';
        document.getElementById('student-modal-pia').value = s.pia || '';
        document.getElementById('student-pia-file').value = '';
        document.getElementById('student-pia-file-name').textContent = s.piaFileName ? `PIA structuré disponible : ${s.piaFileName ? "source déjà sélectionnée" : "source structurée"}.` : 'Le PIA est traité localement ; le document original et son nom de fichier ne sont pas conservés par Journalier.';

        const setVal = (fid, val) => { const el = document.getElementById(fid); if (el) el.value = val; };
        const admin = s.administrativeInfo || {};
        setVal('student-modal-date-naissance', s.dateNaissance || admin.dateNaissance || '');
        setVal('student-modal-option', s.option || admin.option || '');
        setVal('student-modal-titulaire', s.titulaire || admin.titulaire || '');
        setVal('student-modal-coordonnees-ecole', s.coordonneesEcole || admin.coordonneesEcole || '');
        setVal('student-modal-coordonnees-cpms', s.coordonneesCpms || admin.coordonneesCpms || '');
        setVal('student-modal-representant-pole', s.representantPole || admin.representantPole || 'Pôle Territorial WBE BXL');
        setVal('student-modal-responsable', s.responsable || admin.responsable || '');
        setVal('student-modal-coordonnees-responsable', s.coordonneesResponsable || admin.coordonneesResponsable || '');

        const badge = document.getElementById('student-modal-pia-info-badge');
        if (badge) {
            if (typeof window.JournalierV74?.countMissingPIAInfo === 'function') {
                const check = window.JournalierV74.countMissingPIAInfo(s);
                badge.textContent = check.isComplete ? '✓ Complet' : `(${check.missingCount} manquant${check.missingCount > 1 ? 's' : ''})`;
            } else {
                badge.textContent = '';
            }
        }

        initStudentSubjects(s.matieres || []);
        safeCloseAllChoiceMenus();
        attachStudentModalAutoSuggest();
        const modal = document.getElementById('studentModal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.removeAttribute('aria-hidden');
            modal.style.display = 'flex';
        }
    }
}

function closeStudentModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('studentModal');
    if (!modal) return;
    safeCloseAllChoiceMenus();
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
}

function showPIAImportName(input) {
    if (typeof document === 'undefined') return;
    const file = input?.files?.[0] || null;
    const name = file?.name || '';
    const target = document.getElementById('student-pia-file-name');
    const status = document.getElementById('pia-local-security-status');
    if (target) target.textContent = name ? `PIA sélectionné : ${name} · traitement local, sans conservation du fichier original.` : 'Le PIA est traité localement ; le document original et son nom de fichier ne sont pas conservés par Journalier.';
    if (status) status.textContent = name ? '✓ Fichier sélectionné localement — aucune transmission du document original pendant cette étape.' : '✓ Traitement local activé';
    safeShowToast(name ? 'PIA sélectionné — le document original reste sur votre appareil.' : 'Aucun PIA sélectionné.', name ? 'info' : 'error');
}

function saveStudent(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (typeof document === 'undefined') return;
    const id = document.getElementById('student-modal-id')?.value;
    const nom = document.getElementById('student-modal-nom')?.value.trim();
    const classe = document.getElementById('student-modal-classe')?.value.trim();
    const ecole = document.getElementById('student-modal-ecole')?.value.trim();
    const pia = document.getElementById('student-modal-pia')?.value.trim();
    const matieres = currentStudentSubjects();
    if (!nom) {
        if (typeof alert === 'function') alert("Le nom de l'élève est requis.");
        return;
    }

    const getVal = (fid) => document.getElementById(fid)?.value?.trim() || '';
    const dateNaissance = getVal('student-modal-date-naissance');
    const option = getVal('student-modal-option');
    const titulaire = getVal('student-modal-titulaire');
    const coordonneesEcole = getVal('student-modal-coordonnees-ecole');
    const coordonneesCpms = getVal('student-modal-coordonnees-cpms');
    const representantPole = getVal('student-modal-representant-pole') || 'Pôle Territorial WBE BXL';
    const responsable = getVal('student-modal-responsable');
    const coordonneesResponsable = getVal('student-modal-coordonnees-responsable');

    const administrativeInfo = {
        nom,
        dateNaissance,
        classe,
        option,
        ecole,
        coordonneesEcole,
        titulaire,
        coordonneesCpms,
        representantPole,
        responsable,
        coordonneesResponsable
    };

    const studentPayload = {
        nom,
        classe,
        ecole,
        matieres,
        pia,
        dateNaissance,
        option,
        titulaire,
        coordonneesEcole,
        coordonneesCpms,
        representantPole,
        responsable,
        coordonneesResponsable,
        administrativeInfo
    };

    try {
        let students = getStudentsData();
        if (id) {
            students = students.map(s => String(s.id) === String(id) ? { ...s, id: parseInt(id, 10), ...studentPayload } : s);
        } else {
            const newId = Date.now();
            students.push({ id: newId, studentId: String(newId), ...studentPayload });
            const pending = (typeof window !== 'undefined' && window.__journalierPendingPIAImport) || (typeof globalThis !== 'undefined' && globalThis.__journalierPendingPIAImport);
            if (pending && !String(pending.studentId || '').trim()) {
                pending.studentId = String(newId);
            }
        }
        saveStudentsList(students);
    } finally {
        safeCloseAllChoiceMenus();
        closeStudentModal();
        if (document.activeElement && typeof document.activeElement.blur === 'function') document.activeElement.blur();
    }
    // Rafraîchissement explicite des vues dépendantes du dossier.
    updateStudentDropdowns();
    renderStudentsView();
    if (typeof updateStats === 'function') updateStats();
    else if (typeof window !== 'undefined' && typeof window.updateStats === 'function') window.updateStats();

    const currentStudent = document.getElementById('r-eleve')?.value;
    if (currentStudent === nom) loadStudentHistory();
    const profileModal = document.getElementById('studentProfileModal');
    const profileTitle = document.getElementById('student-profile-title');
    if (profileModal && !profileModal.classList.contains('hidden') && profileTitle && profileTitle.textContent === nom) {
        const updated = getStudentsData().find(x => x.nom === nom);
        if (updated) openStudentProfile(updated.id);
    }
    safeShowToast(id ? '✓ Modifications de l’élève enregistrées.' : '✓ Élève ajouté au dossier.', 'success', 4200);
}

function deleteStudent(id) {
    if (typeof confirm === 'function' && !confirm("Voulez-vous vraiment supprimer cet élève ?")) {
        return;
    }
    let students = getStudentsData().filter(s => String(s.id) !== String(id));
    saveStudentsList(students);
    safeShowToast('✓ Élève supprimé du dossier.', 'success', 3600);
}

// -------------------------------------------------------------
// HISTORIQUE DE L'ÉLÈVE & DÉTAIL D'UNE SÉANCE
// -------------------------------------------------------------

/* Une séance, telle qu'elle sortira dans le Word : mêmes mots que la feuille papier. */
function renderJournalierPaperHtml(entry, parts) {
    const R = (typeof window !== 'undefined') ? window.JournalierRedaction : null;
    if (!R) return '<p class="history-detail-description">Le moteur de rédaction n’est pas chargé.</p>';
    const key = log => `${sessionPartsSafe(log).date || ''}|${sessionSortKeySafe(log)}`;
    const earlier = getSessionsData()
        .filter(log => isJournalSessionSafe(log) && sessionPartsSafe(log).eleve === parts.eleve && key(log) < key(entry))
        .sort((a, b) => key(a).localeCompare(key(b)));
    const bloc = R.construireBloc(entry, earlier);
    const esc = safeEscapeHtml;
    const line = (label, value) => `<p class="jr-line"><strong>${esc(label)}</strong> ${esc(value || '—')}</p>`;
    const peda = bloc.peda ? `<section class="jr-zone jr-zone-peda"><h4>Partie pédagogique</h4>
        ${line('Objectif de la leçon :', bloc.peda.objectifLecon)}
        ${bloc.peda.contenuClasse ? line('Contenu vu en classe :', bloc.peda.contenuClasse) : ''}
        ${line('Mon objectif :', bloc.peda.monObjectif)}
        ${line('Mon intervention :', bloc.peda.monIntervention)}
    </section>` : '';
    const ortho = bloc.ortho.map(b => {
        if (b.lignes) return `<div class="jr-block"><strong>${esc(b.label)}</strong>${b.lignes.map(l => `<p class="jr-sub">${esc(l)}</p>`).join('')}</div>`;
        return b.label ? line(`${b.label} :`, b.texte) : `<p class="jr-line">${esc(b.texte)}</p>`;
    }).join('');
    return `<div class="jr-paper">
        <p class="jr-head"><span>Date : <strong>${esc(bloc.entete.date)}</strong></span><span>Cours : <strong>${esc(bloc.entete.cours)}</strong></span><span>Titulaire : <strong>${esc(bloc.entete.titulaire || '—')}</strong></span></p>
        ${peda}
        <section class="jr-zone jr-zone-ortho"><h4>${bloc.peda ? 'Partie orthopédagogique' : 'Mes observations'}</h4>${ortho}</section>
    </div>`;
}

function renderHistoryDetail(entry) {
    if (typeof document === 'undefined') return;
    const host = document.getElementById('student-history-detail');
    if (!host) return;
    if (!entry) { host.innerHTML = '<div class="history-detail-empty">Aucune séance à afficher pour ces filtres.</div>'; return; }
    const parts = sessionPartsSafe(entry), q2 = entry.q2 || {}, q3 = entry.q3 || {}, q4 = entry.q4 || {}, q5 = entry.q5 || {}, q6 = entry.q6 || {}, objective = entry.objectif || {};
    const q2ObsMap = new Map();
    (q2.observations || []).forEach(item => {
        const txt = String(item.observation || '').trim();
        if (!txt) return;
        const k = window.JournalierV74?.getSemanticConceptKeyV74 ? window.JournalierV74.getSemanticConceptKeyV74(txt) : txt.toLowerCase();
        if (!q2ObsMap.has(k) || txt.length > (q2ObsMap.get(k).text || '').length) {
            q2ObsMap.set(k, { text: txt, level: historyQ2LevelLabel(item.niveau) });
        }
    });
    const q2Observations = [...q2ObsMap.values(), ...(q2.precision ? [q2.precision] : [])].filter(item => typeof item === 'string' || item.text);
    const q3IndMap = new Map();
    (q3.indicateurs || []).forEach(item => {
        const txt = String(typeof item === 'string' ? item : item?.texte || '').trim();
        if (!txt) return;
        const k = window.JournalierV74?.getSemanticConceptKeyV74 ? window.JournalierV74.getSemanticConceptKeyV74(txt) : txt.toLowerCase();
        if (!q3IndMap.has(k) || txt.length > (q3IndMap.get(k) || '').length) {
            q3IndMap.set(k, txt);
        }
    });
    const q3LearningList = [...q3IndMap.values(), q3.precision].filter(Boolean);
    const q4Effects = Object.entries(q4.effets || {}).map(([name, value]) => ({ text: name, level: historyQ4EffectLabel(value), levelClass: `is-effect-${['none', 'partial', 'positive'][Number(value)] || 'none'}` }));
    const rawWbeSig = q3.repereWBE?.hit || q3.repereWBE?.signature || '';
    const cleanHistoryWbe = rawWbeSig ? (window.JournalierV74?.canonicalizeWbeChapter?.(rawWbeSig, objective.objectifLecon || '', parts.matiere || '') || String(rawWbeSig).split('|').pop().trim()) : '';

    const presenceMeta = (typeof window !== 'undefined' && window.JournalierAttendance?.getSessionPresenceMeta?.(entry))
        || (typeof getSessionPresenceMeta === 'function' ? getSessionPresenceMeta(entry) : { key: 'present', badge: 'Présent', css: 'is-present' });
    const classNotes = (typeof window !== 'undefined' && window.JournalierAttendance?.getSessionClassNotes?.(entry))
        || (typeof getSessionClassNotes === 'function' ? getSessionClassNotes(entry) : '');

    const sections = [
        ['Statut & Continuité', presenceMeta.key !== 'present' ? [presenceMeta.badge, ...(classNotes ? [`Notes de cours : ${classNotes}`] : [])] : (classNotes ? [`Notes de cours : ${classNotes}`] : []), 'is-reference'],
        ['Observation · Q2', q2Observations, 'is-observation'],
        ['Apprentissage · Q3', q3LearningList, 'is-learning'],
        ['Adaptation · Q4', [...new Set([...(q4.types || []), q4.precision].filter(Boolean))], 'is-adaptation'],
        ['Effets consignés · Q4', q4Effects, 'is-effect'],
        ['Transfert · Q5', [historyQ5TransferLabel(q5.statut), q5.precision].filter(Boolean), 'is-transfer'],
        ['Suite · Q6', [...new Set([...(q6.actions || []), q6.precision].filter(Boolean))], 'is-followup'],
        ['Repères WBE', cleanHistoryWbe ? [cleanHistoryWbe] : [], 'is-reference']
    ].filter(([, values]) => values.length);
    const sid = safeEscapeHtml(String(entry.id));
    const paperHtml = renderJournalierPaperHtml(entry, parts);
    host.innerHTML = `
        <header class="history-detail-head">
            <button type="button" class="btn-secondary history-detail-back" data-history-back>‹ Historique</button>
            <div class="history-detail-heading"><strong>${safeEscapeHtml(parts.date)} · ${safeEscapeHtml(parts.matiere)}</strong><span>${safeEscapeHtml(sessionPeriodLabelSafe(entry))}</span></div>
            <div class="history-detail-actions">
                <button type="button" class="history-edit-btn" data-session-id="${sid}" data-action="history-edit">Modifier</button>
                <details class="history-more-actions"><summary aria-label="Autres actions" title="Autres actions">⋯</summary><button type="button" data-session-id="${sid}" data-action="history-delete">Supprimer</button></details>
            </div>
        </header>
        <div class="history-detail-body">
            ${presenceMeta.key !== 'present' ? `<p class="history-detail-subject"><span class="session-presence-badge ${presenceMeta.css}">${safeEscapeHtml(presenceMeta.badge)}</span></p>` : ''}
            ${paperHtml}
            ${presenceMeta.key === 'absent_eleve_coteach' ? '<p class="history-detail-note">L’élève était absent : vous êtes intervenu en classe. Cette séance n’entre pas dans le taux de présence de l’élève.</p>' : ''}
        </div>`;

    // Les actions du détail sont re-bindées après chaque rendu du panneau.
    host.querySelector('[data-action="history-edit"]')?.addEventListener('click', event => {
        event.stopPropagation();
        const targetSid = event.currentTarget?.dataset.sessionId || '';
        if (typeof editHistorySession === 'function') editHistorySession(targetSid);
        else if (typeof window !== 'undefined' && typeof window.editHistorySession === 'function') window.editHistorySession(targetSid);
    });
    host.querySelector('[data-action="history-delete"]')?.addEventListener('click', event => {
        event.stopPropagation();
        const targetSid = event.currentTarget?.dataset.sessionId || '';
        if (typeof deleteHistorySession === 'function') deleteHistorySession(targetSid);
        else if (typeof window !== 'undefined' && typeof window.deleteHistorySession === 'function') window.deleteHistorySession(targetSid);
    });
}

function loadStudentHistory() {
    if (typeof document === 'undefined') return;
    const student = document.getElementById('r-eleve')?.value || '', container = document.getElementById('student-history-list');
    if (!container) return;
    const workspace = document.getElementById('history-workspace'), detail = document.getElementById('student-history-detail'), count = document.getElementById('history-visible-count');
    let periodRange = null;
    try { if (typeof getReportRange === 'function') periodRange = getReportRange(document.getElementById('r-periode')?.value || 'ANNEE'); } catch (_) { periodRange = null; }
    const inPeriod = log => {
        if (!periodRange) return true;
        const d = sessionPartsSafe(log).date || '';
        return (!periodRange.start || d >= periodRange.start) && (!periodRange.end || d <= periodRange.end);
    };
    const allLogs = getSessionsData().filter(log => isJournalSessionSafe(log) && sessionPartsSafe(log).eleve === student && inPeriod(log)).sort((a, b) => sessionSortKeySafe(b).localeCompare(sessionSortKeySafe(a)));
    const kpiBar = document.getElementById('history-attendance-kpi-bar');
    if (container.dataset.student !== student) { container.dataset.student = student; container.dataset.visibleLimit = '15'; container.dataset.selectedSession = ''; }
    if (!student) {
        container.innerHTML = '<p class="reports-empty-state">Sélectionnez un élève pour afficher son historique.</p>';
        if (count) count.textContent = '';
        if (kpiBar) kpiBar.classList.add('hidden');
        if (detail) detail.innerHTML = '<div class="history-detail-empty">Le détail des séances apparaîtra ici après la sélection d’un élève.</div>';
        workspace?.classList.remove('is-detail-open');
        return;
    }
    const attStats = (typeof window !== 'undefined' && window.JournalierAttendance?.computeAttendanceStats?.(allLogs))
        || (typeof computeAttendanceStats === 'function' ? computeAttendanceStats(allLogs) : { attendanceRate: null, present: 0, coteach: 0, absentEleve: 0, absentProf: 0, totalStudentOpportunities: 0 });

    if (kpiBar) {
        if (allLogs.length > 0) {
            kpiBar.classList.remove('hidden');
            kpiBar.innerHTML = `
                <div class="history-attendance-kpi-item">
                    <strong>${attStats.attendanceRate !== null ? `${attStats.attendanceRate}%` : '—'}</strong>
                    <span>Taux de présence élève (${attStats.present}/${attStats.totalStudentOpportunities} cours maintenus)</span>
                </div>
                <div class="history-attendance-kpi-item">
                    <strong style="color:#15803d;">${attStats.present}</strong>
                    <span>🟢 Séance${attStats.present > 1 ? 's' : ''} avec élève présent</span>
                </div>
                <div class="history-attendance-kpi-item">
                    <strong style="color:#6b21a8;">${attStats.coteach}</strong>
                    <span>🟣 Co-ens. / Notes (élève absent)</span>
                </div>
                <div class="history-attendance-kpi-item">
                    <strong style="color:#c2410c;">${attStats.absentEleve}</strong>
                    <span>🟠 Absence${attStats.absentEleve > 1 ? 's' : ''} élève (sans séance)</span>
                </div>
                <div class="history-attendance-kpi-item">
                    <strong style="color:#0369a1;">${attStats.absentProf}</strong>
                    <span>🔵 Prof. absent / Cours annulé</span>
                </div>
                ${attStats.absentAgent ? `<div class="history-attendance-kpi-item"><strong style="color:#92400e;">${attStats.absentAgent}</strong><span>🟤 Agent du pôle absent</span></div>` : ''}
            `;
        } else {
            kpiBar.classList.add('hidden');
        }
    }
    const subjectSelect = document.getElementById('history-subject-filter'), currentSubject = subjectSelect?.value || '';
    const subjects = [...new Set(allLogs.map(log => sessionPartsSafe(log).matiere).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    if (subjectSelect) {
        subjectSelect.innerHTML = '<option value="">Toutes les matières</option>' + subjects.map(subject => `<option value="${safeEscapeHtml(subject)}">${safeEscapeHtml(subject)}</option>`).join('');
        subjectSelect.value = subjects.includes(currentSubject) ? currentSubject : '';
    }
    const selectedSubject = subjectSelect?.value || '', selectedPresence = document.getElementById('history-presence-filter')?.value || '', query = (document.getElementById('history-search')?.value || '').trim().toLocaleLowerCase('fr');
    const filteredLogs = allLogs.filter(log => {
        const parts = sessionPartsSafe(log), q2 = log.q2 || {}, q3 = log.q3 || {}, q4 = log.q4 || {}, q5 = log.q5 || {}, q6 = log.q6 || {};
        if (selectedSubject && parts.matiere !== selectedSubject) return false;
        const presenceStatus = (typeof window !== 'undefined' && window.JournalierAttendance?.getSessionPresenceStatus?.(log)) || (typeof getSessionPresenceStatus === 'function' ? getSessionPresenceStatus(log) : 'present');
        if (selectedPresence && presenceStatus !== selectedPresence) return false;
        if (!query) return true;
        const classNotes = (typeof window !== 'undefined' && window.JournalierAttendance?.getSessionClassNotes?.(log)) || (typeof getSessionClassNotes === 'function' ? getSessionClassNotes(log) : '');
        const presenceMeta = (typeof window !== 'undefined' && window.JournalierAttendance?.getSessionPresenceMeta?.(log)) || (typeof getSessionPresenceMeta === 'function' ? getSessionPresenceMeta(log) : { badge: '' });
        const searchable = [parts.date, parts.matiere, sessionPeriodLabelSafe(log), log.objectif?.objectifLecon, log.objectif?.objectifProfessionnel, classNotes, presenceMeta.badge, ...(q2.observations || []).map(item => item.observation), q2.precision, ...(q3.indicateurs || []).map(item => item.texte), q3.precision, ...(q4.types || []), q4.precision, q5.statut, q5.precision, ...(q6.actions || []), q6.precision].filter(Boolean).join(' ').toLocaleLowerCase('fr');
        return searchable.includes(query);
    });
    if (!allLogs.length) { container.innerHTML = '<p class="reports-empty-state">Aucune séance enregistrée pour cet élève.</p>'; if (count) count.textContent = '0 séance'; renderHistoryDetail(null); return; }
    if (!filteredLogs.length) { container.innerHTML = '<p class="reports-empty-state">Aucune séance ne correspond à ces filtres.</p>'; if (count) count.textContent = '0 séance'; renderHistoryDetail(null); return; }
    const visibleLimit = Math.max(15, Number(container.dataset.visibleLimit) || 15), visibleLogs = filteredLogs.slice(0, visibleLimit);
    const selected = visibleLogs.find(log => String(log.id) === container.dataset.selectedSession) || visibleLogs[0];
    container.dataset.selectedSession = String(selected.id);
    if (count) count.textContent = `${filteredLogs.length} entrée${filteredLogs.length === 1 ? '' : 's'}`;
    container.innerHTML = visibleLogs.map(log => {
        const parts = sessionPartsSafe(log), objective = log.objectif || {}, q2 = log.q2 || {}, q4 = log.q4 || {}, q5 = log.q5 || {};
        const pMeta = (typeof window !== 'undefined' && window.JournalierAttendance?.getSessionPresenceMeta?.(log)) || (typeof getSessionPresenceMeta === 'function' ? getSessionPresenceMeta(log) : { key: 'present', css: 'is-present', shortBadge: '' });
        const cNotes = (typeof window !== 'undefined' && window.JournalierAttendance?.getSessionClassNotes?.(log)) || (typeof getSessionClassNotes === 'function' ? getSessionClassNotes(log) : '');
        const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(parts.date || ''));
        const dateDay = dateMatch ? dateMatch[3] : safeEscapeHtml(parts.date || '');
        const dateMonth = dateMatch ? new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, 1).toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '') : 'Séance';
        const signals = [
            ...(q2.observations || []).map(item => {
                const level = historyQ2LevelLabel(item.niveau);
                return { text: item.observation, level: level?.toLocaleLowerCase('fr') || '', tone: 'is-observation', label: 'Observation' };
            }),
            ...(q4.types || []).map(item => ({ text: item, tone: 'is-adaptation', label: 'Aide' })),
            ...(q5.statut ? [{ text: historyQ5TransferLabel(q5.statut), tone: 'is-transfer', label: 'Transfert' }] : []),
            ...(cNotes ? [{ text: cNotes.slice(0, 55) + (cNotes.length > 55 ? '…' : ''), tone: 'is-learning', label: 'Notes' }] : [])
        ].filter(item => item.text).slice(0, 2);
        const title = objective.objectifLecon || objective.objectifProfessionnel || 'Objectif non renseigné';
        const id = safeEscapeHtml(String(log.id)), isSelected = String(log.id) === String(selected.id);
        const badgeHtml = pMeta.key !== 'present' ? `<span class="session-presence-badge ${pMeta.css}" style="margin-left:6px;">${safeEscapeHtml(pMeta.shortBadge)}</span>` : '';
        return `<button type="button" class="history-master-row" data-history-select="${id}" aria-current="${isSelected ? 'true' : 'false'}" aria-label="${safeEscapeHtml(`${dateDay} ${dateMonth}, ${parts.matiere}, ${title}`)}">
            <span class="history-date-rail"><strong>${dateDay}</strong><span>${safeEscapeHtml(dateMonth)}</span></span>
            <span class="history-master-content"><span><span class="history-master-title">${safeEscapeHtml(parts.matiere || 'Matière non renseignée')}${badgeHtml}</span><span class="history-master-meta">${safeEscapeHtml(sessionPeriodLabelSafe(log))}</span></span><span class="history-master-objective">${safeEscapeHtml(title)}</span>${signals.length ? `<span class="history-master-signals">${signals.map(signal => `<span class="history-signal ${signal.tone}"><span class="history-signal-label">${safeEscapeHtml(signal.label)}</span><span class="history-signal-text">${safeEscapeHtml(signal.text)}</span>${signal.level ? `<span class="history-signal-level">${safeEscapeHtml(signal.level)}</span>` : ''}</span>`).join('')}</span>` : ''}</span>
            <span class="history-master-chevron" aria-hidden="true">›</span>
        </button>`;
    }).join('') + (filteredLogs.length > visibleLogs.length ? `<div class="history-load-more"><button type="button" class="btn-secondary" data-history-load-more>Afficher 15 séances de plus · ${filteredLogs.length - visibleLogs.length} restantes</button></div>` : '');
    renderHistoryDetail(selected);
}

// -------------------------------------------------------------
// EXPOSITION DU MODULE & NAMESPACE GLOBAL
// -------------------------------------------------------------

var JournalierStudents = {
    SUBJECT_OPTIONS,
    LEGACY_SUBJECT_OPTIONS,
    HISTORY_Q2_LEVEL_LABELS,
    HISTORY_Q4_EFFECT_LABELS,
    HISTORY_Q5_TRANSFER_LABELS,
    normalizeSubjectList,
    subjectOptionsForSelection,
    resolveIndexedLabel,
    historyQ2LevelLabel,
    historyQ4EffectLabel,
    historyQ5TransferLabel,
    getStudents: getStudentsData,
    getStudentByName,
    getStudentById,
    saveStudentsList,
    renderStudentSubjectOptions,
    toggleStudentSubject,
    updateStudentSubjectsSummary,
    filterStudentSubjects,
    initStudentSubjects,
    currentStudentSubjects,
    updateStudentDropdowns,
    prepareEditingStudentSelection,
    renderStudentBentoCard,
    renderStudentsView,
    openStudentProfile,
    closeStudentProfile,
    openAddStudentModal,
    openEditStudentModal,
    closeStudentModal,
    showPIAImportName,
    saveStudent,
    deleteStudent,
    renderHistoryDetail,
    loadStudentHistory,
    renderStudentPIAAdminProfile,
    attachStudentModalAutoSuggest
};

if (typeof window !== 'undefined') {
    window.JournalierStudents = JournalierStudents;
    window.renderStudentsView = renderStudentsView;
    window.openStudentProfile = openStudentProfile;
    window.closeStudentProfile = closeStudentProfile;
    window.openAddStudentModal = openAddStudentModal;
    window.openEditStudentModal = openEditStudentModal;
    window.closeStudentModal = closeStudentModal;
    window.showPIAImportName = showPIAImportName;
    window.saveStudent = saveStudent;
    window.deleteStudent = deleteStudent;
    window.updateStudentDropdowns = updateStudentDropdowns;
    window.renderHistoryDetail = renderHistoryDetail;
    window.loadStudentHistory = loadStudentHistory;
}
if (typeof global !== 'undefined') {
    global.JournalierStudents = JournalierStudents;
}
if (typeof globalThis !== 'undefined') {
    globalThis.JournalierStudents = JournalierStudents;
}

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

