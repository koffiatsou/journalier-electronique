/*
 * PIA de la V75 : lecture seule. Le PIA de la V2 a une autre structure (profil, deux procès-verbaux, aménagements P / O / M) :
 * convertir automatiquement obligerait à deviner où ranger chaque phrase. On ne le fait donc pas ; on rend à la place
 * une fiche lisible de ce que la V75 avait enregistré, à relire et à recopier dans le PIA de la V2.
 */

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Brut) : {});
const texte = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const TYPES_AMENAGEMENT: Readonly<Record<string, string>> = { P: 'pédagogique', O: 'organisationnel', M: 'matériel' };

/** Un objectif de la V75 est une phrase, ou un objet avec une « formulation ». */
const objectif = (v: unknown): string => (typeof v === 'string' ? v.trim() : texte(objet(v).formulation) || texte(objet(v).objectif) || texte(objet(v).texte));

function reunion(titre: string, r: unknown): string[] {
  const m = objet(r);
  const lignes: string[] = [];
  const ajouter = (libelle: string, valeur: string): void => { if (valeur) lignes.push(`  ${libelle} : ${valeur}`); };
  ajouter('Date', texte(m.date));
  ajouter('Contexte', texte(m.context));
  const presents = Object.entries(objet(m.participants)).filter(([, v]) => v === true).map(([k]) => k);
  if (presents.length) ajouter('Présents', presents.join(', '));
  for (const [acteur, avis] of Object.entries(objet(m.feedback))) ajouter(`Retour (${acteur})`, texte(avis));
  const valides = liste(m.objectivesValidated).map(objectif).filter(Boolean);
  if (valides.length) { lignes.push('  Objectifs validés :'); valides.forEach((o) => lignes.push(`    - ${o}`)); }
  const evaluation = liste(m.evaluation).map(objet).filter((e) => texte(e.objectif));
  if (evaluation.length) {
    lignes.push('  Évaluation des objectifs :');
    evaluation.forEach((e) => lignes.push(`    - ${texte(e.objectif)}${texte(e.state) ? ` — ${texte(e.state)}` : ''}${texte(e.note) ? ` — ${texte(e.note)}` : ''}`));
  }
  const suite = liste(m.objectivesToContinue).map(objectif).filter(Boolean);
  if (suite.length) { lignes.push('  Objectifs à poursuivre :'); suite.forEach((o) => lignes.push(`    - ${o}`)); }
  ajouter('Décisions', texte(m.decisions));
  ajouter('Objectifs modifiés', texte(m.objectivesModified));
  ajouter('Moyens', texte(m.means));
  ajouter('Adaptations', texte(m.adaptations));
  ajouter('Informations', texte(m.information));
  ajouter('Perspectives', liste(m.perspectives).map(objectif).filter(Boolean).join(' ; '));
  ajouter('Notes', texte(m.notes));
  return lignes.length ? [titre, ...lignes] : [];
}

export interface FichePiaV75 {
  /** Il y a quelque chose à montrer (PIA, objectifs du dossier ou coordonnées). */
  contenu: boolean;
  /** Année scolaire du PIA de la V75, si elle est connue. */
  annee: string;
  texte: string;
}

export function fichePiaV75(eleveBrut: unknown, piaBrut: { record: unknown; imported: unknown } | undefined): FichePiaV75 {
  const eleve = objet(eleveBrut);
  const admin = objet(eleve.administrativeInfo);
  const record = objet(piaBrut?.record);
  const imported = objet(piaBrut?.imported ?? record.sourceContinuity);
  const lignes: string[] = [];
  let contenu = false;

  const coordonnees: [string, string][] = [
    ['Date de naissance', texte(eleve.dateNaissance) || texte(admin.dateNaissance)],
    ['Option', texte(eleve.option) || texte(admin.option)],
    ['Titulaire', texte(eleve.titulaire) || texte(admin.titulaire)],
    ['Coordonnées de l’école', texte(eleve.coordonneesEcole) || texte(admin.coordonneesEcole)],
    ['CPMS', texte(eleve.coordonneesCpms) || texte(admin.coordonneesCpms)],
    ['Représentant du Pôle', texte(eleve.representantPole) || texte(admin.representantPole)],
    ['Responsable', texte(eleve.responsable) || texte(admin.responsable)],
    ['Coordonnées du responsable', texte(eleve.coordonneesResponsable) || texte(admin.coordonneesResponsable)]
  ];
  const remplies = coordonnees.filter(([, v]) => v);
  if (remplies.length) { lignes.push('Coordonnées du dossier (V75)'); remplies.forEach(([k, v]) => lignes.push(`  ${k} : ${v}`)); }

  const objectifsDossier = texte(eleve.pia);
  if (objectifsDossier) { contenu = true; lignes.push('Objectifs saisis dans le dossier', ...objectifsDossier.split(/\n/).map((l) => `  ${l.trim()}`).filter((l) => l.trim())); }

  const annee = texte(record.schoolYear);
  if (Object.keys(record).length) {
    const blocs = [
      ...reunion('Réunion 1', record.meeting1),
      ...reunion('Réunion 2', record.meeting2)
    ];
    const amenagements = liste(record.amenagements).map(objet).filter((a) => texte(a.texte));
    if (amenagements.length) {
      blocs.push('Aménagements');
      amenagements.forEach((a) => {
        const t = texte(a.type);
        blocs.push(`  - (${t || '?'}) ${TYPES_AMENAGEMENT[t] ? `${TYPES_AMENAGEMENT[t]} : ` : ''}${texte(a.texte)}${texte(a.effetDocumente) ? ` — effet : ${texte(a.effetDocumente)}` : ''}${texte(a.suitePrevue) ? ` — suite : ${texte(a.suitePrevue)}` : ''}`);
      });
    }
    if (blocs.length) { contenu = true; lignes.push(`PIA de la V75${annee ? ` — année ${annee}` : ''}`, ...blocs); }
  }
  const precedent = objet(imported.extracted);
  const anciens = liste(precedent.objectives).map(objectif).filter(Boolean);
  if (imported.present !== false && anciens.length) { contenu = true; lignes.push('PIA précédent repris dans la V75 (objectifs)', ...anciens.map((o) => `  - ${o}`)); }

  return { contenu, annee, texte: lignes.join('\n') };
}
