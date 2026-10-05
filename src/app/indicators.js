// V54 TEST — pont WBE → indicateurs Q3 de la bibliothèque d’indicateurs WBE v0.5
let INDICATOR_LIBRARY = null;
let INDICATOR_LIBRARY_STATUS = 'pending';
let q3AssessmentState = {};
let editingSessionId = null;

/* =========================================================
   DIAGNOSTIC TECHNIQUE — Bibliothèque indicateurs
   Invisible par défaut. Activation : ?diagnostic=1
   ou console : showJournalierDiagnostics()
   ========================================================= */
const JOURNALIER_DIAGNOSTICS = window.JOURNALIER_DIAGNOSTICS = {
    indicatorLibrary: {
        status: 'pending',
        version: null,
        count: 0,
        source: null,
        loadedAt: null,
        attempted: [],
        error: null
    },
    q3: {
        objective: '',
        subject: '',
        level: '',
        form: '',
        suggestions: 0
    }
};

function updateIndicatorDiagnosticPanel(){
    const panel=document.getElementById('journalier-dev-diagnostic');
    if(!panel) return;
    const lib=JOURNALIER_DIAGNOSTICS.indicatorLibrary;
    const q3=JOURNALIER_DIAGNOSTICS.q3;
    const ok=lib.status==='loaded';
    const status=ok
        ? `✓ v${escapeHtml(lib.version||'?')} — ${Number(lib.count||0)} indicateurs`
        : lib.status==='error'
            ? `⚠ Bibliothèque indisponible${lib.error ? ` — ${escapeHtml(lib.error)}` : ''}`
            : '⏳ Chargement…';
    const attempts=(lib.attempted||[]).map(x=>`<div style=\"margin-top:3px\">${escapeHtml(x.url)} → ${escapeHtml(x.result||'…')}</div>`).join('');
    panel.innerHTML=`
      <div style=\"font-weight:800;font-size:14px;margin-bottom:10px\">DIAGNOSTIC TECHNIQUE</div>
      <div style=\"font-weight:750\">Bibliothèque indicateurs</div>
      <div style=\"margin-top:4px;line-height:1.45\">${status}</div>
      ${lib.source?`<div style=\"margin-top:4px;color:#555\">Source : ${escapeHtml(lib.source)}</div>`:''}
      ${lib.loadedAt?`<div style=\"margin-top:3px;color:#777\">Chargée : ${escapeHtml(new Date(lib.loadedAt).toLocaleString('fr-BE'))}</div>`:''}
      ${lib.status==='error'?`<div style=\"margin-top:8px;color:#9b1c1c\">Dernière erreur : ${escapeHtml(lib.error||'inconnue')}</div>`:''}
      ${attempts?`<div style=\"margin-top:10px;padding-top:8px;border-top:1px solid #ddd;font-size:11px;color:#555\"><strong>Tentatives</strong>${attempts}</div>`:''}
      <div style=\"margin-top:12px;padding-top:8px;border-top:1px solid #ddd\">
        <div style=\"font-weight:750\">Moteur Q3</div>
        <div style=\"margin-top:4px\">${ok?'✓ Actif':'⚠ Bloqué : bibliothèque non chargée'}</div>
        ${q3.objective?`<div style=\"margin-top:5px;color:#555\">Objectif : ${escapeHtml(q3.objective)}</div>`:''}
        ${q3.subject?`<div style=\"margin-top:3px;color:#555\">Matière : ${escapeHtml(q3.subject)}</div>`:''}
        ${q3.level?`<div style=\"margin-top:3px;color:#555\">Niveau : ${escapeHtml(q3.level)}</div>`:''}
        ${q3.form?`<div style=\"margin-top:3px;color:#555\">Forme : ${escapeHtml(q3.form)}</div>`:''}
        <div style=\"margin-top:3px;color:#555\">Suggestions : ${Number(q3.suggestions||0)}</div>
      </div>`;
}

function initJournalierDiagnostics(){
    const params=new URLSearchParams(window.location.search);
    const enabled=params.get('diagnostic')==='1' || window.location.hash==='#diagnostic';
    if(!enabled) return;
    const panel=document.createElement('div');
    panel.id='journalier-dev-diagnostic';
    panel.style.cssText='position:fixed;right:16px;bottom:16px;z-index:99999;width:min(430px,calc(100vw - 32px));max-height:70vh;overflow:auto;background:#fff;border:1px solid #cfd4dc;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.18);padding:14px;font:12px/1.45 -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111';
    document.body.appendChild(panel);
    updateIndicatorDiagnosticPanel();
}

window.showJournalierDiagnostics=()=>{
    if(!document.getElementById('journalier-dev-diagnostic')){
        const url=new URL(window.location.href);
        url.searchParams.set('diagnostic','1');
        window.history.replaceState({},'',url);
        initJournalierDiagnostics();
    }
    updateIndicatorDiagnosticPanel();
};

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initJournalierDiagnostics,{once:true});
else initJournalierDiagnostics();

const SUPPORTED_INDICATOR_VERSIONS = Object.freeze(['0.5', '0.5.1', '0.4']);
const INDICATOR_ARRAY_FIELDS = Object.freeze([
    'niveaux',
    'niveaux_preferentiels',
    'formes',
    'mots_cles_rapprochement',
    'concepts_rapprochement',
    'actions_associees',
    'exemples_formulation_terrain'
]);
const INDICATOR_STRING_FIELDS = Object.freeze([
    'domaine',
    'sous_domaine',
    'specificite',
    'specificite_rapprochement',
    'mode_niveau'
]);

function normalizeIndicatorLibraryV05(data){
    if(!data || typeof data!=='object') throw new Error('Bibliothèque JSON invalide');
    if(!SUPPORTED_INDICATOR_VERSIONS.includes(String(data.version||''))) throw new Error(`Version JSON inattendue: ${data.version || 'inconnue'}`);
    if(!Array.isArray(data.indicateurs_apprentissage)) throw new Error('indicateurs_apprentissage absent ou invalide');

    data.indicateurs_apprentissage = data.indicateurs_apprentissage
        .filter(x=>x && typeof x==='object' && x.id && x.matiere && x.texte)
        .map(x=>{
            const out={...x};
            INDICATOR_ARRAY_FIELDS.forEach(key=>{ if(!Array.isArray(out[key])) out[key]=[]; });
            INDICATOR_STRING_FIELDS.forEach(key=>{ if(out[key]==null) out[key]=''; });
            return out;
        });

    data.familles_matieres = (data.familles_matieres && typeof data.familles_matieres==='object') ? data.familles_matieres : {};
    data.moteur_rapprochement = (data.moteur_rapprochement && typeof data.moteur_rapprochement==='object') ? data.moteur_rapprochement : {};
    data.moteur_rapprochement.actions = (data.moteur_rapprochement.actions && typeof data.moteur_rapprochement.actions==='object') ? data.moteur_rapprochement.actions : {};
    data.moteur_rapprochement.ponts_terrain = Array.isArray(data.moteur_rapprochement.ponts_terrain) ? data.moteur_rapprochement.ponts_terrain : [];
    data.wbe_corpus = (data.wbe_corpus && typeof data.wbe_corpus==='object') ? data.wbe_corpus : {};
    data.moteur_rapprochement.wbe_structure = (data.moteur_rapprochement.wbe_structure && typeof data.moteur_rapprochement.wbe_structure==='object') ? data.moteur_rapprochement.wbe_structure : {};
    data.indicateurs_apprentissage.forEach(x=>{ if(!x.referentiel_wbe || typeof x.referentiel_wbe!=='object') x.referentiel_wbe={}; });

    const ids=new Set();
    const duplicates=[];
    const byId = new Map();
    data.indicateurs_apprentissage.forEach(x=>{
        const sid = String(x.id);
        if(ids.has(sid)) duplicates.push(sid);
        ids.add(sid);
        if(!byId.has(sid)) byId.set(sid, x);
    });
    data.indicateurs_par_id = byId;
    if(duplicates.length) console.warn('⚠ IDs d’indicateurs dupliqués dans la bibliothèque v0.4',duplicates);
    if(!data.indicateurs_apprentissage.some(x=>x.mots_cles_rapprochement.length || x.concepts_rapprochement.length || x.exemples_formulation_terrain.length)){
        console.warn('⚠ La bibliothèque v0.4 ne contient aucun signal sémantique exploitable.');
    }
    return data;
}

/**
 * Recherche un indicateur par son identifiant unique.
 * Utilise l'index Map en O(1) si disponible, avec repli linéaire.
 * @param {string|number} id
 * @returns {object|null}
 */
function findIndicatorById(id) {
    if (!id || !INDICATOR_LIBRARY) return null;
    const sid = String(id);
    if (INDICATOR_LIBRARY.indicateurs_par_id instanceof Map) {
        return INDICATOR_LIBRARY.indicateurs_par_id.get(sid) || null;
    }
    return INDICATOR_LIBRARY.indicateurs_apprentissage?.find(x => String(x.id || '') === sid) || null;
}
window.findIndicatorById = findIndicatorById;

async function loadIndicatorLibrary() {
    const url = './bibliotheque_indicateurs_v0_5_1.json';
    JOURNALIER_DIAGNOSTICS.indicatorLibrary.status='pending';
    JOURNALIER_DIAGNOSTICS.indicatorLibrary.attempted=[];
    updateIndicatorDiagnosticPanel();
    try {
        JOURNALIER_DIAGNOSTICS.indicatorLibrary.attempted.push({url,result:'en cours'});
        updateIndicatorDiagnosticPanel();
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        INDICATOR_LIBRARY = normalizeIndicatorLibraryV05(data);
        INDICATOR_LIBRARY_STATUS = 'loaded';
        const attempt=JOURNALIER_DIAGNOSTICS.indicatorLibrary.attempted.at(-1);
        if(attempt) attempt.result=`HTTP ${response.status} — valide`;
        JOURNALIER_DIAGNOSTICS.indicatorLibrary={
            ...JOURNALIER_DIAGNOSTICS.indicatorLibrary,
            status:'loaded',
            version:String(data.version||''),
            count:Number(data.indicateurs_apprentissage?.length||0),
            source:url.replace(/^\.\//,''),
            loadedAt:new Date().toISOString(),
            error:null
        };
        updateIndicatorDiagnosticPanel();
        if (typeof updateObservationSuggestions === 'function') updateObservationSuggestions();
        console.log('✓ Bibliothèque JSON chargée', {source:url,version:data.version,apprentissage:data.indicateurs_apprentissage.length});
    } catch (error) {
        INDICATOR_LIBRARY_STATUS='error';
        JOURNALIER_DIAGNOSTICS.indicatorLibrary={
            ...JOURNALIER_DIAGNOSTICS.indicatorLibrary,
            status:'error', source:url.replace(/^\.\//,''), loadedAt:null,
            error:error?.message||String(error||'Erreur inconnue')
        };
        const attempt=JOURNALIER_DIAGNOSTICS.indicatorLibrary.attempted.at(-1);
        if(attempt) attempt.result=error?.message||String(error);
        updateIndicatorDiagnosticPanel();
        console.error('✗ Impossible de charger la bibliothèque d’indicateurs',error);
    }
}

loadIndicatorLibrary();
