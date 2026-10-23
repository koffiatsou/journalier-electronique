/*
 * Export des séances dans le Journalier papier (modèle Word officiel).
 *
 * Un fichier = un élève + une période (en général l'année) ; un bloc par séance.
 * Principe : on remplit le modèle papier au lieu de le reconstruire, en clonant son
 * bloc type (« Partie pédagogique » / « Partie orthopédagogique »).
 * Le texte vient de JournalierRedaction (moteur déterministe) ; ici, on ne rédige rien.
 *
 * Script classique, sans « export » : testable dans Node avec un shim (voir tests/).
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JournalierSeancesDocx = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const TEMPLATE_URLS = ['./modeles/Journalier_modele_papier.docx', '/modeles/Journalier_modele_papier.docx'];
  const NBSP = ' ';
  const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'van', 'von', 'der', 'den', 'el', 'al', 'ben', 'ait']);

  const esc = (s) => String(s == null ? '' : s)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* ---------- petits constructeurs OpenXML ---------- */
  const run = (t, bold) => (t === '' ? '' :
    `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`);
  const para = (runs, opts = {}) => {
    const ppr = [];
    if (opts.puce) ppr.push('<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
    if (opts.retrait) ppr.push(`<w:ind w:left="${opts.retrait}"/>`);
    return `<w:p>${ppr.length ? `<w:pPr>${ppr.join('')}</w:pPr>` : ''}${runs}</w:p>`;
  };
  const etiquette = (label, valeur) => para(run(`${label}${NBSP}: `, true) + run(valeur || ''));

  /* ---------- découpage du XML du modèle ---------- */
  function decouperTables(xml) {
    const tables = [];
    const re = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
    let m;
    while ((m = re.exec(xml))) tables.push({ debut: m.index, fin: m.index + m[0].length, xml: m[0] });
    return tables;
  }
  const lignes = (tbl) => tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [];
  const cellules = (tr) => tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || [];
  const texteDe = (x) => x.replace(/<[^>]+>/g, '');
  // remplace le contenu d'une cellule en gardant ses propriétés (largeur, fusion)
  function remplirCellule(tc, paragraphes) {
    const pr = (tc.match(/^<w:tc>(<w:tcPr>[\s\S]*?<\/w:tcPr>)/) || [, ''])[1];
    return `<w:tc>${pr}${paragraphes || '<w:p/>'}</w:tc>`;
  }
  const remplacerCellule = (tr, i, nouveau) => {
    const cs = cellules(tr);
    return tr.replace(cs[i], () => nouveau);
  };

  /* ---------- bloc d'une séance ---------- */
  function blocOrthoParagraphes(bloc) {
    const out = [para(run(`Mes observations, remarques, besoins,…${NBSP}: `, true))];
    bloc.ortho.forEach((b) => {
      if (b.lignes) {
        out.push(para(run(b.label, true)));
        b.lignes.forEach((l) => out.push(para(run(l), { retrait: 284 })));
      } else if (b.label) out.push(etiquette(b.label, b.texte));
      else out.push(para(run(b.texte)));
    });
    return out.join('');
  }

  function construireTableBloc(proto, bloc) {
    const rows = lignes(proto);
    // rows : 0 « Partie pédagogique » | 1 Date/Cours/Titulaire | 2 Objectif/Mon objectif/Intervention | 3 « Partie orthopédagogique » | 4 Observations
    const e = bloc.entete;
    const r1 = cellules(rows[1]);
    let l1 = rows[1];
    l1 = remplacerCellule(l1, 0, remplirCellule(r1[0], etiquette('Date', e.date)));
    l1 = remplacerCellule(l1, 1, remplirCellule(r1[1], etiquette('Cours', e.cours)));
    l1 = remplacerCellule(l1, 2, remplirCellule(r1[2], etiquette('Titulaire', e.titulaire)));

    const obsCell = cellules(rows[4])[0];
    const obs = remplirCellule(obsCell, blocOrthoParagraphes(bloc));
    const l4 = rows[4].replace(obsCell, () => obs);

    if (bloc.type === 'absence') {
      // absence : une ligne d'en-tête + une ligne de texte, sans les parties vides
      const l4abs = rows[4].replace(obsCell, () => remplirCellule(obsCell, bloc.ortho.map((b) => para(run(b.texte))).join('')));
      return proto.replace(/<w:tr[ >][\s\S]*<\/w:tr>/, () => l1 + l4abs);
    }

    const r2 = cellules(rows[2]);
    const p = bloc.peda;
    const objLecon = etiquette('Objectif de la leçon', p.objectifLecon) +
      (p.contenuClasse ? etiquette('Contenu vu en classe', p.contenuClasse) : '');
    const interv = para(run(`Mon intervention${NBSP}: `, true)) +
      (p.interventions || []).map((t) => para(run(t), { puce: true })).join('');
    let l2 = rows[2];
    l2 = remplacerCellule(l2, 0, remplirCellule(r2[0], objLecon));
    l2 = remplacerCellule(l2, 1, remplirCellule(r2[1], etiquette('Mon objectif', p.monObjectif)));
    l2 = remplacerCellule(l2, 2, remplirCellule(r2[2], interv));
    return proto.replace(/<w:tr[ >][\s\S]*<\/w:tr>/, () => rows[0] + l1 + l2 + rows[3] + l4);
  }

  function dateBelge(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
  }

  /* ---------- identité de l'élève (première table du modèle) ---------- */
  function remplirIdentite(tbl, id) {
    const valeurs = { 'nom de l’enfant': id.nom, 'prenom': id.prenom, 'date de naissance': dateBelge(id.dateNaissance),
      'classe': id.classe, 'titulaire': id.titulaire, 'ecole cooperante': id.ecole };
    let out = tbl;
    lignes(tbl).forEach((tr) => {
      const cs = cellules(tr);
      if (cs.length < 2) return;
      const lab = texteDe(cs[0]).replace(/[\s\u00A0\u202F:]+$/g, '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const v = valeurs[lab];
      if (v === undefined || v === '') return;
      const rpr = ((cs[0].match(/<w:rPr>[\s\S]*?<\/w:rPr>/) || [''])[0]).replace(/<w:b\/>|<w:bCs\/>/g, '');
      const ppr = ((cs[0].match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || ['<w:pPr/>'])[0]).replace(/<w:b\/>|<w:bCs\/>/g, '');
      const nouvelle = remplirCellule(cs[1], `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${esc(v)}</w:t></w:r></w:p>`);
      out = out.replace(tr, () => remplacerCellule(tr, 1, nouvelle));
    });
    return out;
  }

  /* ---------- assemblage ---------- */
  function noms(eleve) {
    const brut = [eleve.nom, eleve.prenom].filter(Boolean).join(' ');
    const mots = brut.split(/[\s-]+/).filter((w) => w.length >= 3 && !PARTICULES.has(w.toLowerCase()));
    return [brut, eleve.nom, eleve.prenom, ...mots].filter(Boolean);
  }

  function anneeScolaire(iso) {
    const m = /^(\d{4})-(\d{2})/.exec(iso || '');
    if (!m) return '';
    const a = Number(m[1]);
    return Number(m[2]) >= 8 ? `${a}-${a + 1}` : `${a - 1}-${a}`;
  }

  /* docXml du modèle → docXml rempli. blocs : sorties de JournalierRedaction.construireBloc */
  function remplirDocument(docXml, blocs, identite) {
    const tables = decouperTables(docXml);
    if (tables.length < 2) throw new Error('Le modèle Journalier est inattendu (tables introuvables).');
    const proto = tables[1].xml;
    const derniere = tables[tables.length - 1];
    const separateur = '<w:p><w:pPr><w:rPr><w:sz w:val="10"/><w:szCs w:val="10"/></w:rPr></w:pPr></w:p>';
    const corps = blocs.map((b) => construireTableBloc(proto, b)).join(separateur);
    return docXml.slice(0, tables[0].debut) + remplirIdentite(tables[0].xml, identite) +
      docXml.slice(tables[0].fin, tables[1].debut) + corps + docXml.slice(derniere.fin);
  }

  /* Préparation des blocs : moteur + dé-identification éventuelle. */
  function preparerBlocs(seances, eleve, deidentifie) {
    const R = root.JournalierRedaction;
    if (!R) throw new Error('Le moteur de rédaction n’est pas chargé.');
    const tri = seances.slice().sort((a, b) => String((a.identification || {}).date).localeCompare(String((b.identification || {}).date)));
    const blocs = tri.map((s, i) => {
      const avant = tri.slice(0, i);
      const bloc = R.construireBloc(Object.assign({}, s, { contexte: Object.assign({ titulaire: eleve.titulaire || '' }, s.contexte || {}) }), avant);
      return bloc;
    });
    if (!deidentifie) return blocs;
    const liste = noms(eleve);
    const nettoyer = (t) => (typeof t === 'string' ? R.deIdentifier(t, liste) : t);
    blocs.forEach((b) => {
      b.entete.titulaire = '';
      if (b.peda) { b.peda.objectifLecon = nettoyer(b.peda.objectifLecon); b.peda.contenuClasse = nettoyer(b.peda.contenuClasse); b.peda.monObjectif = nettoyer(b.peda.monObjectif); }
      b.ortho.forEach((o) => { o.texte = nettoyer(o.texte); if (o.lignes) o.lignes = o.lignes.map(nettoyer); });
    });
    return blocs;
  }

  async function chargerModele() {
    for (const url of TEMPLATE_URLS) {
      try {
        const r = await root.fetch(url, { cache: 'no-store' });
        if (r.ok) return new Uint8Array(await r.arrayBuffer());
      } catch (_) { /* url suivante */ }
    }
    throw new Error('Impossible de charger le modèle Journalier (.docx) depuis public/modeles/.');
  }

  /* Point d'entrée : retourne { bytes, nomFichier, blocs }. */
  async function construire({ seances, eleve, deidentifie, modeleBytes }) {
    const D = root.JournalierDocx;
    if (!D) throw new Error('Le module d’export Word n’est pas prêt.');
    const entries = await D.unzipEntries(modeleBytes || await chargerModele());
    if (!entries['word/document.xml']) throw new Error('Modèle Journalier invalide.');
    const dec = new TextDecoder('utf-8'), enc = new TextEncoder();
    const blocs = preparerBlocs(seances, eleve, !!deidentifie);
    const identite = deidentifie
      ? { classe: eleve.classe, ecole: '', titulaire: '', nom: '', prenom: '', dateNaissance: '' }
      : { nom: eleve.nom, prenom: eleve.prenom || '', dateNaissance: eleve.dateNaissance || (eleve.admin || {}).dateNaissance || '',
          classe: eleve.classe || '', titulaire: eleve.titulaire || (eleve.admin || {}).titulaire || '', ecole: eleve.ecole || '' };
    entries['word/document.xml'] = enc.encode(remplirDocument(dec.decode(entries['word/document.xml']), blocs, identite));
    if (entries['docProps/core.xml']) {
      let core = dec.decode(entries['docProps/core.xml']);
      core = core.replace(/<dc:creator>[\s\S]*?<\/dc:creator>/, '<dc:creator>Pôle Territorial WBE BXL</dc:creator>')
        .replace(/<cp:lastModifiedBy>[\s\S]*?<\/cp:lastModifiedBy>/, '<cp:lastModifiedBy>Pôle Territorial WBE BXL</cp:lastModifiedBy>');
      entries['docProps/core.xml'] = enc.encode(core);
    }
    const bytes = D.buildZipStoreArchive(Object.entries(entries).map(([name, data]) => ({ name, data })));
    const an = anneeScolaire(((seances[0] || {}).identification || {}).date);
    const base = deidentifie ? 'Journalier - dé-identifié' : `Journalier - ${eleve.nom || 'élève'}`;
    return { bytes, nomFichier: `${base}${an ? ' - ' + an : ''}.docx`, blocs };
  }

  async function exporter(opts) {
    const r = await construire(opts);
    const blob = new Blob([r.bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const a = root.document.createElement('a');
    const nom = typeof root.sanitizeFilename === 'function' ? root.sanitizeFilename(r.nomFichier) : r.nomFichier;
    a.href = URL.createObjectURL(blob); a.download = nom;
    root.document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return r;
  }

  return { construire, exporter, remplirDocument, preparerBlocs, anneeScolaire };
});
