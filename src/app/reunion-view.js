/* Réunion : ce qui ressort des séances, en langage simple, d'après le moteur de rédaction.
   Export officiel du PIA rendu visible. */
(function (root) {
  'use strict';
  const doc = root.document;
  if (!doc) return;
  const $ = (id) => doc.getElementById(id);
  const esc = (v) => (typeof root.escapeHtml === 'function' ? root.escapeHtml(v) : String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const dateBE = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };

  function periodLogs() {
    const student = $('r-eleve')?.value || '';
    if (!student) return { student, logs: [], range: null };
    let range = null;
    try { range = root.getReportRange($('r-periode')?.value || 'ANNEE'); } catch (_) { range = null; }
    const logs = root.getDB().filter((log) => {
      if (!root.isJournalSession(log)) return false;
      const p = root.sessionParts(log);
      if (p.eleve !== student) return false;
      return !range || ((!range.start || p.date >= range.start) && (!range.end || p.date <= range.end));
    });
    return { student, logs, range };
  }

  const liste = (titre, classe, items) => items.length
    ? `<div class="reunion-bloc ${classe}"><h4>${esc(titre)}</h4><ul>${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';

  function render() {
    const host = $('reunion-plain');
    if (!host) return;
    const R = root.JournalierRedaction;
    const { student, logs, range } = periodLogs();
    if (!R) { host.innerHTML = '<p class="reports-empty-state">Le moteur de rédaction n’est pas chargé.</p>'; return; }
    if (!student) { host.innerHTML = '<p class="reports-empty-state">Choisissez un élève en haut de la page.</p>'; return; }
    if (!logs.length) { host.innerHTML = '<p class="reports-empty-state">Aucune séance enregistrée pour cet élève sur la période choisie.</p>'; return; }
    const sy = R.synthese(logs);
    const periode = range && range.start && range.end ? `Du ${dateBE(range.start)} au ${dateBE(range.end)}` : 'Toute la période';
    const parMatiere = sy.matieres.map((m) => `<section class="reunion-mat">
        <h3>${esc(m.matiere)}</h3>
        ${liste('Points d’appui', 'is-appui', m.appuis)}
        ${liste('Points à travailler', 'is-travail', m.aTravailler)}
        ${liste('Compétence travaillée', 'is-comp', m.competences)}
        ${liste('Aides qui ont fonctionné', 'is-aides', m.aides)}
        ${liste('Aides sans effet constaté', 'is-aides', m.aidesSansEffet || [])}
        ${(m.appuis.length + m.aTravailler.length + m.competences.length + m.aides.length + (m.aidesSansEffet || []).length) ? '' : '<p class="reunion-vide">Pas d’observation encodée dans cette matière.</p>'}
      </section>`).join('');
    host.innerHTML = `<p class="reunion-periode">${esc(periode)} · ${esc(student)}</p>
      ${parMatiere || '<p class="reports-empty-state">Aucune séance avec l’élève présent sur la période.</p>'}
      ${sy.absences ? `<p class="reunion-absences">${esc(sy.absences)} Elles restent visibles dans le Journalier.</p>` : ''}`;
  }

  function showTab(name) { doc.querySelector(`[data-reports-tab="${name}"]`)?.click(); }

  async function exportPIA(moment, deid, fromPia) {
    if (typeof root.exportOfficialPIADocument !== 'function') { root.alert('L’export du PIA n’est pas encore prêt. Réessayez dans quelques secondes.'); return; }
    if (!($('r-eleve')?.value)) { root.alert('Sélectionnez un élève.'); return; }
    try {
      if (!fromPia) { showTab('pia'); await new Promise((r) => root.setTimeout(r, 600)); }
      await root.exportOfficialPIADocument(moment, 'docx', !!deid);
    } catch (e) { root.alert(`Export impossible : ${e?.message || e}`); }
  }

  function init() {
    ['r-eleve', 'r-periode', 'r-date-start', 'r-date-end', 'r-date-anchor'].forEach((id) => $(id)?.addEventListener('change', render));
    doc.querySelector('[data-reports-tab="meeting"]')?.addEventListener('click', render);
    $('reunion-open-pia')?.addEventListener('click', () => showTab('pia'));
    $('reunion-open-proposals')?.addEventListener('click', () => showTab('synthesis'));
    $('pia-export-word')?.addEventListener('click', () => exportPIA($('pia-export-moment')?.value || 'DECEMBRE', $('pia-export-anon')?.checked, true));
    render();
  }
  root.JournalierReunion = { render, exportPIA };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init); else init();
})(typeof window !== 'undefined' ? window : globalThis);
