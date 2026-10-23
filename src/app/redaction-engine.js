/*
 * Moteur de rédaction déterministe — séances → blocs du Journalier papier.
 *
 * Principes :
 *  - aucune IA, aucun hasard : mêmes données = même texte ;
 *  - chaque phrase vient d'une donnée saisie (rien n'est inventé) ;
 *  - voix neutre : « l'élève » n'apparaît jamais comme pronom, pas de genre ;
 *  - aucun comptage (« six points… ») : les points sont nommés, avec leur niveau ;
 *  - module autonome : ne lit ni le DOM, ni le stockage, ni le réseau.
 *
 * Chaîne : séance brute → faits (normaliser) → bloc (construireBloc) → contrôles.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JournalierRedaction = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const NBSP = ' ';
  const NIVEAUX_OBS = ['Partiellement', 'Suffisamment', 'Totalement'];
  const EFFETS = ['aucun effet', 'effet partiel', 'effet positif'];
  const TRANSFERT = {
    observed: 'observé',
    not_observed: 'non observé',
    no_opportunity: 'pas d’occasion de l’observer',
    later: 'à observer plus tard'
    // not_relevant : volontairement omis de l'export
  };
  const PRESENCE = {
    present: 'present',
    absent_eleve: 'absent_eleve',
    absent_prof: 'absent_prof',
    absent_eleve_coteach: 'absent_eleve_coteach',
    absent_agent: 'absent_agent'
  };

  /* ---------- outils de langue ---------- */
  const txt = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
  const lowerFirst = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const upperFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const finPhrase = (s) => (!s ? s : /[.!?…]$/.test(s) ? s : s + '.');
  const deuxPoints = (label) => `${label}${NBSP}:`;
  function dateFR(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : txt(String(iso || ''));
  }
  function dateCourte(iso) {
    const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(iso || ''));
    return m ? `${m[2]}/${m[1]}` : '';
  }

  /* ---------- 1. séance brute → faits ---------- */
  function niveauValide(n, max) {
    return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
  }

  function normaliser(entry) {
    const e = entry || {};
    const id = e.identification || {}, ctx = e.contexte || {}, obj = e.objectif || {};
    const q2 = e.q2 || {}, q3 = e.q3 || {}, q4 = e.q4 || {}, q5 = e.q5 || {}, q6 = e.q6 || {};
    const statut = PRESENCE[ctx.presenceStatus] || 'present';
    const observations = (Array.isArray(q2.observations) ? q2.observations : [])
      .map((o) => (typeof o === 'string' ? { observation: o } : o || {}))
      .map((o) => ({ texte: txt(o.observation), niveau: niveauValide(Number(o.niveau), 2) }))
      .filter((o) => o.texte);
    const effets = q4.effets && typeof q4.effets === 'object' ? q4.effets : {};
    const aides = (Array.isArray(q4.types) ? q4.types : []).map((t) => txt(t)).filter(Boolean)
      .map((t) => ({ texte: t, effet: niveauValide(Number(effets[t]), 2) }));
    return {
      id: e.id,
      eleve: txt(id.eleve),
      date: txt(id.date),
      matiere: txt(ctx.matiere),
      titulaire: txt(ctx.titulaire),
      presence: statut,
      interventions: (Array.isArray(ctx.typeIntervention) ? ctx.typeIntervention : []).map(txt).filter(Boolean),
      notesClasse: txt(ctx.classNotes),
      objectifLecon: objectifPropre(statut, txt(obj.objectifLecon)),
      contenuClasse: txt(obj.contenuClasse) || txt(ctx.classNotes),
      monObjectif: txt(obj.objectifProfessionnel),
      observations,
      remarque: txt(q2.precision),
      competences: (Array.isArray(q3.indicateurs) ? q3.indicateurs : [])
        .map((i) => ({ texte: txt(i && i.texte), niveau: niveauValide(Number(i && i.appreciation), 2) }))
        .filter((i) => i.texte),
      precisionCompetence: txt(q3.precision),
      aides,
      precisionAide: txt(q4.precision),
      transfert: txt(q5.statut),
      precisionTransfert: txt(q5.precision),
      actions: (Array.isArray(q6.actions) ? q6.actions : []).map(txt).filter(Boolean),
      modalite: txt(q6.modalite),
      objectifSuite: txt(q6.objectif),
      collaborations: (Array.isArray(q6.collaborations) ? q6.collaborations : []).map(txt).filter(Boolean),
      precisionSuite: txt(q6.precision)
    };
  }

  /* Anciens enregistrements : le texte de repli d'un co-enseignement n'est pas un objectif. */
  function objectifPropre(statut, texte) {
    if (statut === 'absent_eleve_coteach' && /^(co-enseignement|intervention en co-enseignement)/i.test(texte)) return '';
    return texte;
  }

  /* ---------- 2. constats (analyse, sans rédaction) ---------- */
  function grouperParNiveau(items) {
    const groupes = [];
    for (let n = 2; n >= 0; n--) {
      const liste = items.filter((i) => i.niveau === n);
      if (liste.length) groupes.push({ niveau: n, items: liste });
    }
    const sans = items.filter((i) => i.niveau === null);
    if (sans.length) groupes.push({ niveau: null, items: sans });
    return groupes;
  }

  // Évolution : mêmes points observés dans une séance antérieure de la même matière.
  function evolution(faits, precedentes) {
    const avant = (precedentes || [])
      .filter((p) => p.eleve === faits.eleve && p.matiere === faits.matiere && p.date && p.date < faits.date && p.presence === 'present')
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    const res = [];
    faits.observations.forEach((o) => {
      if (o.niveau === null) return;
      for (const p of avant) {
        const trouve = p.observations.find((x) => x.texte === o.texte && x.niveau !== null);
        if (trouve) {
          if (trouve.niveau !== o.niveau) res.push({ texte: o.texte, de: trouve.niveau, dateDe: p.date, vers: o.niveau });
          return;
        }
      }
    });
    return res;
  }

  /* ---------- 3. réalisation en français ---------- */
  function ligneFonctionnement(faits) {
    if (!faits.observations.length) return null;
    return grouperParNiveau(faits.observations).map((g) => {
      const label = g.niveau === null ? 'Observé' : NIVEAUX_OBS[g.niveau];
      return `• ${label}${NBSP}: ${g.items.map((i) => lowerFirst(i.texte)).join(`${NBSP}; `)}.`;
    });
  }

  function ligneCompetence(faits) {
    if (!faits.competences.length) return null;
    const parts = faits.competences.map((c) =>
      c.niveau === null ? lowerFirst(c.texte) : `${lowerFirst(c.texte)} (${lowerFirst(NIVEAUX_OBS[c.niveau])})`);
    return `${upperFirst(parts.join(`${NBSP}; `))}.`;
  }

  /* Aides regroupées par effet, comme les observations par niveau :
     « • Effet positif : support visuel ; guidage verbal. » */
  function ligneAides(faits) {
    if (!faits.aides.length) return null;
    return grouperParNiveau(faits.aides.map((a) => ({ texte: a.texte, niveau: a.effet }))).map((g) => {
      const label = g.niveau === null ? 'Effet non précisé' : upperFirst(EFFETS[g.niveau]);
      return `• ${label}${NBSP}: ${g.items.map((i) => lowerFirst(i.texte)).join(`${NBSP}; `)}.`;
    });
  }

  function ligneTransfert(faits) {
    const mot = TRANSFERT[faits.transfert];
    const prec = finPhrase(faits.precisionTransfert);
    if (!mot) return prec || null;
    return prec ? `${upperFirst(mot)}. ${prec}` : `${upperFirst(mot)}.`;
  }

  function ligneSuite(faits) {
    const morceaux = [];
    if (faits.actions.length) morceaux.push(upperFirst(faits.actions.map(lowerFirst).join(`${NBSP}; `)) + '.');
    if (faits.modalite) morceaux.push(`Modalité${NBSP}: ${lowerFirst(faits.modalite)}.`);
    if (faits.objectifSuite) morceaux.push(`${finPhrase(upperFirst(faits.objectifSuite))}`);
    if (faits.collaborations.length) morceaux.push(`À prévoir${NBSP}: ${faits.collaborations.map(lowerFirst).join(`${NBSP}; `)}.`);
    if (faits.precisionSuite) morceaux.push(finPhrase(faits.precisionSuite));
    return morceaux.length ? morceaux.join(' ') : null;
  }

  function ligneEvolution(evo) {
    if (!evo.length) return null;
    const corps = evo.map((x) =>
      `${lowerFirst(x.texte)}${NBSP}: ${lowerFirst(NIVEAUX_OBS[x.de])} (${dateCourte(x.dateDe)}) → ${lowerFirst(NIVEAUX_OBS[x.vers])}`);
    return `${corps.join(`${NBSP}; `)}.`;
  }

  /* ---------- 4. bloc complet ---------- */
  const TEXTE_ABSENCE = {
    absent_eleve: 'Élève absent — séance non tenue.',
    absent_prof: 'Professeur absent — cours annulé.',
    absent_eleve_coteach: 'Élève absent — intervention en co-enseignement.',
    absent_agent: 'Agent du pôle absent — séance non assurée.'
  };

  function construireBloc(entry, precedentes) {
    const faits = normaliser(entry);
    const bloc = {
      type: (faits.presence === 'present' || faits.presence === 'absent_eleve_coteach') ? 'seance' : 'absence',
      presence: faits.presence,
      entete: { date: dateFR(faits.date), cours: faits.matiere, titulaire: faits.titulaire },
      peda: null,
      ortho: []
    };
    if (bloc.type === 'absence') {
      bloc.ortho.push({ label: null, texte: TEXTE_ABSENCE[faits.presence] });
      return bloc;
    }
    const interventions = faits.interventions.length ? faits.interventions.join(`${NBSP}; `) : '';
    bloc.peda = {
      objectifLecon: faits.objectifLecon,
      contenuClasse: faits.contenuClasse,
      monObjectif: faits.monObjectif,
      monIntervention: interventions,
      interventions: faits.interventions
    };
    if (faits.presence === 'absent_eleve_coteach') {
      bloc.ortho = [{ label: null, texte: TEXTE_ABSENCE.absent_eleve_coteach }];
      return bloc;
    }
    const l = [];
    const fonct = ligneFonctionnement(faits);
    if (fonct || faits.remarque) {
      const lignes = fonct ? fonct.slice() : [];
      if (faits.remarque) lignes.push(`Remarque${NBSP}: ${finPhrase(faits.remarque)}`);
      l.push({ label: 'Fonctionnement observé', lignes });
    }
    const comp = ligneCompetence(faits);
    if (comp) l.push({ label: 'Compétence travaillée', texte: comp });
    if (faits.precisionCompetence) l.push({ label: comp ? 'Précision' : 'Compétence travaillée', texte: finPhrase(faits.precisionCompetence) });
    const aides = ligneAides(faits);
    if (aides) l.push({ label: 'Aides mises en place', lignes: aides });
    if (faits.precisionAide) l.push({ label: 'Précision sur les aides', texte: finPhrase(faits.precisionAide) });
    const tr = ligneTransfert(faits);
    if (tr) l.push({ label: 'Transfert', texte: tr });
    const suite = ligneSuite(faits);
    if (suite) l.push({ label: 'Suite', texte: suite });
    const evo = ligneEvolution(evolution(faits, (precedentes || []).map(normaliser)));
    if (evo) l.push({ label: 'Évolution depuis la séance précédente', texte: evo });
    if (!l.length) l.push({ label: null, texte: 'Séance sans observation particulière.' });
    bloc.ortho = l;
    return bloc;
  }

  /* Texte brut d'un bloc (aperçu à l'écran, tests, repli sans Word). */
  function blocEnTexte(bloc) {
    const out = [`Date${NBSP}: ${bloc.entete.date} | Cours${NBSP}: ${bloc.entete.cours} | Titulaire${NBSP}: ${bloc.entete.titulaire}`];
    if (bloc.peda) {
      out.push('PARTIE PÉDAGOGIQUE');
      out.push(`Objectif de la leçon${NBSP}: ${bloc.peda.objectifLecon}`);
      if (bloc.peda.contenuClasse) out.push(`Contenu vu en classe${NBSP}: ${bloc.peda.contenuClasse}`);
      out.push(`Mon objectif${NBSP}: ${bloc.peda.monObjectif}`);
      out.push(`Mon intervention${NBSP}: ${bloc.peda.monIntervention}`);
      out.push('PARTIE ORTHOPÉDAGOGIQUE');
    }
    bloc.ortho.forEach((b) => {
      if (b.lignes) { out.push(b.label); b.lignes.forEach((x) => out.push('  ' + x)); }
      else out.push(b.label ? `${b.label}${NBSP}: ${b.texte}` : b.texte);
    });
    return out.join('\n');
  }

  /* ---------- 5. contrôles ---------- */
  const MOTS_NOMBRES = /\b(un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\s+(points?|items?|éléments?|aspects?|critères?|observations?)\b/i;
  function controler(bloc) {
    const t = blocEnTexte(bloc);
    const erreurs = [];
    if (/undefined|null|\[object|NaN/.test(t)) erreurs.push('valeur technique visible');
    if (MOTS_NOMBRES.test(t) || /\b\d+\s+(points?|items?|observations?)\b/i.test(t)) erreurs.push('comptage interdit');
    if (/\*\*|\[Fait\]/.test(t)) erreurs.push('marqueur parasite');
    if (/(^|\n)\s*[:;–]\s*(\n|$)/.test(t)) erreurs.push('ligne vide');
    if (/\s{2,}/.test(t.replace(/\n {2}/g, '\n'))) erreurs.push('espaces doubles');
    return erreurs;
  }

  /* ---------- 6. export dé-identifié (accents et casse ignorés) ---------- */
  const platCar = (c) => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const plat = (s) => Array.from(s).map(platCar).join('');
  function deIdentifier(texte, noms) {
    let out = String(texte);
    (noms || []).map(txt).filter((n) => n.length > 1).sort((a, b) => b.length - a.length).forEach((nom) => {
      const cible = Array.from(plat(nom));
      const car = Array.from(out), flat = Array.from(plat(out));
      const lettre = (c) => !!c && /[a-z0-9]/.test(c);
      let res = '', i = 0;
      while (i < car.length) {
        const ok = cible.every((c, k) => flat[i + k] === c)
          && !lettre(flat[i - 1]) && !lettre(flat[i + cible.length]);
        if (ok) { res += 'l’élève'; i += cible.length; } else { res += car[i]; i++; }
      }
      out = res;
    });
    return out.replace(/l’élève(?:[ \u00A0]+l’élève)+/g, 'l’élève');
  }

  /* ---------- 7. statistiques de présence ---------- */
  function statsPresence(entries) {
    const s = { total: 0, present: 0, absent_eleve: 0, absent_prof: 0, absent_eleve_coteach: 0, absent_agent: 0 };
    (entries || []).map(normaliser).forEach((f) => { s.total++; s[f.presence]++; });
    s.tauxPresence = s.total ? Math.round((s.present / s.total) * 100) : null;
    return s;
  }

  /* ---------- 8. synthèse par matière (réunion) : constats datés, sans comptage ---------- */
  const EFFET_MOT = { 0: 'aucun effet', 1: 'effet partiel', 2: 'effet positif' };
  function suiteNiveaux(suite) {
    const mots = (n) => lowerFirst(NIVEAUX_OBS[n]);
    const distincts = [...new Set(suite.map((x) => x.niveau))];
    if (suite.length === 1) return `${mots(suite[0].niveau)}.`;
    if (distincts.length === 1) return `${mots(suite[0].niveau)} à chaque séance.`;
    const etapes = [];
    suite.forEach((x) => { if (!etapes.length || etapes[etapes.length - 1].niveau !== x.niveau) etapes.push(x); });
    return `${etapes.map((x) => `${mots(x.niveau)} (${dateCourte(x.date)})`).join(' → ')}.`;
  }
  function dateCourte(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}/${m[2]}` : ''; }

  function synthese(entries) {
    const faits = (entries || []).map(normaliser).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const presentes = faits.filter((f) => f.presence === 'present');
    const parMatiere = new Map();
    presentes.forEach((f) => {
      const m = f.matiere || 'Matière non précisée';
      if (!parMatiere.has(m)) parMatiere.set(m, []);
      parMatiere.get(m).push(f);
    });
    const matieres = [];
    parMatiere.forEach((liste, matiere) => {
      const obs = new Map(), aides = new Map();
      liste.forEach((f) => {
        f.observations.forEach((o) => {
          if (o.niveau === null) return;
          if (!obs.has(o.texte)) obs.set(o.texte, []);
          obs.get(o.texte).push({ date: f.date, niveau: o.niveau });
        });
        f.aides.forEach((a) => {
          if (!aides.has(a.texte)) aides.set(a.texte, []);
          aides.get(a.texte).push(a.effet);
        });
      });
      const appuis = [], travail = [];
      obs.forEach((suite, texte) => {
        const ligne = `${upperFirst(texte)}${NBSP}: ${suiteNiveaux(suite)}`;
        (suite[suite.length - 1].niveau === 2 ? appuis : travail).push(ligne);
      });
      const lignesAides = [], sansEffet = [];
      aides.forEach((effets, texte) => {
        const connus = effets.filter((e) => e !== null);
        const uniques = [...new Set(connus)];
        const nom = lowerFirst(texte);
        if (!connus.length) lignesAides.push(nom);
        else if (uniques.length === 1 && uniques[0] === 0) sansEffet.push(nom);
        else if (uniques.length === 1) lignesAides.push(`${nom} (${EFFET_MOT[uniques[0]]})`);
        else lignesAides.push(`${nom} (effet variable${NBSP}: ${uniques.map((e) => EFFET_MOT[e].replace(/^effet /, '')).join(', puis ')})`);
      });
      const compMap = new Map();
      liste.forEach((f) => {
        f.competences.forEach((c) => compMap.set(c.texte, c.niveau));
        if (f.precisionCompetence) { const c = finPhrase(upperFirst(f.precisionCompetence)); if (!compMap.has(c)) compMap.set(c, undefined); }
      });
      const comps = [...compMap].map(([t, n]) => (n === undefined ? t : `${upperFirst(lowerFirst(t))} (${lowerFirst(NIVEAUX_OBS[n] || '')})`.replace(' ()', '')) + (n === undefined ? '' : '.'));
      matieres.push({
        matiere,
        dateDebut: liste[0].date,
        dateFin: liste[liste.length - 1].date,
        appuis, aTravailler: travail, aides: lignesAides, aidesSansEffet: sansEffet, competences: comps
      });
    });
    matieres.sort((a, b) => a.matiere.localeCompare(b.matiere, 'fr'));
    const st = statsPresence(entries);
    const morceaux = [];
    if (st.absent_prof) morceaux.push(`${st.absent_prof} cours annulé${st.absent_prof > 1 ? 's' : ''} (professeur absent)`);
    if (st.absent_eleve) morceaux.push(`${st.absent_eleve} absence${st.absent_eleve > 1 ? 's' : ''} de l’élève`);
    if (st.absent_eleve_coteach) morceaux.push(`${st.absent_eleve_coteach} intervention${st.absent_eleve_coteach > 1 ? 's' : ''} en classe en l’absence de l’élève`);
    if (st.absent_agent) morceaux.push(`${st.absent_agent} absence${st.absent_agent > 1 ? 's' : ''} de l’agent du pôle`);
    return {
      matieres,
      seances: presentes.length,
      absences: morceaux.length ? `Sur la période${NBSP}: ${morceaux.join(' ; ')}.` : ''
    };
  }

  return { normaliser, construireBloc, blocEnTexte, controler, deIdentifier, statsPresence, dateFR, synthese };
});
