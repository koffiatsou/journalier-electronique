import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const journalierCorePath = path.join(rootDir, 'src', 'app', 'journalier-core.js');
const v74RuntimePath = path.join(rootDir, 'src', 'v74', 'v74-runtime.js');
const refPath = path.join(rootDir, 'src', 'app', 'referentiel-amenagements.js');
const cssPath = path.join(rootDir, 'src', 'styles', 'apple-premium.css');

const journalierCoreCode = fs.readFileSync(journalierCorePath, 'utf8');
const reportsCorePath = path.join(rootDir, 'src', 'app', 'reports-core.js');
const reportsCoreCode = fs.existsSync(reportsCorePath) ? fs.readFileSync(reportsCorePath, 'utf8') : '';
const combinedReportsCode = journalierCoreCode + '\n' + reportsCoreCode;
const v74RuntimeCode = fs.readFileSync(v74RuntimePath, 'utf8');
const refCode = fs.readFileSync(refPath, 'utf8');
const cssCode = fs.readFileSync(cssPath, 'utf8');

test('Synthèse & PIA UX : Harmonisation complète des 4 points avec Master Accordions Apple HIG', () => {
  // Point 1
  assert.ok(
    combinedReportsCode.includes('synth-visual-card') && combinedReportsCode.includes('data-synth-kpi-expand'),
    'Point 1 possède son conteneur et son outil d’affichage'
  );
  // Point 2
  assert.ok(
    combinedReportsCode.includes('synth-timeline-card') && combinedReportsCode.includes('data-synth-chapters-expand'),
    'Point 2 possède son conteneur et son outil d’affichage'
  );
  // Point 3
  assert.ok(
    combinedReportsCode.includes('synth-domains-section') && combinedReportsCode.includes('data-synth-domains-expand'),
    'Point 3 possède son conteneur et son outil d’affichage'
  );
  // Point 4
  assert.ok(
    combinedReportsCode.includes('synth-validation-section') &&
    combinedReportsCode.includes('data-synth-proposals-expand'),
    'Point 4 possède son conteneur et son outil d’affichage unifié'
  );

  // Vérification que les 4 blocs utilisent la même structure de détails de section
  const occurrencesOfMasterAccordion = (combinedReportsCode.match(/details class="synth-section-accordion"/g) || []).length;
  assert.ok(occurrencesOfMasterAccordion >= 4, 'Les 4 points principaux (1, 2, 3, 4) disposent chacun du master accordion synth-section-accordion');
});

test('Synthèse & PIA UX : Bannissement du jargon technique ("accordéon", "repliable", "dépliable")', () => {
  // Vérification dans le HTML généré pour la synthèse
  const synthesisCodeSlice = combinedReportsCode.slice(
    combinedReportsCode.indexOf('function buildVisualSynthesisAndPIABridgeHtml'),
    combinedReportsCode.indexOf('function bindSynthesisPIABridgeEvents')
  );

  assert.doesNotMatch(
    synthesisCodeSlice,
    /Tout déplier \/ replier/i,
    'Le texte "Tout déplier / replier" a été remplacé par une formule plus noble'
  );
  assert.doesNotMatch(
    synthesisCodeSlice,
    />(?:Repliable|Dépliable|Accordéon)</i,
    'Aucun label visible utilisateur n’utilise repliable / dépliable / accordéon'
  );
});

test('Synthèse & PIA UX : Boutons Ajuster et Améliorer avec IA dans les chapitres et les domaines', () => {
  // Point 2 (Chapitres)
  assert.ok(
    combinedReportsCode.includes('data-synth-chapter-toggle') && combinedReportsCode.includes('data-synth-chapter-ai'),
    'Les chapitres longitudinaux disposent d’un bouton Ajuster et d’un bouton Améliorer avec IA'
  );
  // Point 3 (Domaines)
  assert.ok(
    combinedReportsCode.includes('data-synth-domain-toggle') && combinedReportsCode.includes('data-synth-domain-ai'),
    'Les 5 domaines disposent d’un bouton Ajuster et d’un bouton Améliorer avec IA'
  );
  // Point 4 (Objectifs)
  assert.ok(
    combinedReportsCode.includes('data-synth-prop-ai'),
    'Les objectifs du point 4 disposent d’un bouton Améliorer avec IA'
  );
});

test('Synthèse & PIA UX : Intégration des pistes suggérées en sous-point bullet d’objectif', () => {
  assert.ok(
    combinedReportsCode.includes('data-synth-add-aid'),
    'Les pastilles d’aides suggérées sont interactives et portent data-synth-add-aid'
  );
  assert.ok(
    combinedReportsCode.includes('  - ${aidText}') || combinedReportsCode.includes('- ${aidText}'),
    'Le clic sur une aide suggérée ajoute l’élément sous forme de sous-point à l’objectif'
  );
  assert.ok(
    refCode.includes('bulletPrefix') && refCode.includes('  - '),
    'Le référentiel d’aménagements insère également en sous-point indenté'
  );
});

test('Pédagogie & Classification : Distinction Autonomie, Comportemental et Physique/Psychomoteur', () => {
  // Le rythme et l'endurance relèvent de l'autonomie
  const autonomieTheme = v74RuntimeCode.includes('id:"autonomie"') && v74RuntimeCode.includes('Lié à l’autonomie');
  assert.ok(autonomieTheme, 'Le domaine Autonomie prend en compte le rythme et l’endurance');

  // Le physique et psychomoteur est réservé à une atteinte motrice/instrumentale
  assert.ok(
    combinedReportsCode.includes('isPhysical&&/\\b(geste|graph|motric|tenue.*outil'),
    'Le domaine physique est strictement réservé à la motricité et aux outils'
  );

  // Le comportemental est centré sur le refus, l'évitement ou la dynamique affective
  assert.ok(
    combinedReportsCode.includes('isAffective&&/\\b(refus|evit|opposit'),
    'Le domaine comportemental cible les conduites observables (évitement, refus)'
  );
});

test('Pédagogie & Rigueur : Épuration des artéfacts techniques et cohérence des points forts', () => {
  // Filtrage des mentions techniques de Q5
  assert.ok(
    v74RuntimeCode.includes('not_relevant|not_observed|no_opportunity|later'),
    'Les codes internes comme not_relevant ou no_opportunity sont filtrés des libellés'
  );
  // Un élément noté comme fragile ou à consolider n'est pas classé dans les points forts
  assert.ok(
    v74RuntimeCode.includes('if(/\\b(à consolider|a consolider|à renforcer|a renforcer|fragilité|difficulté)\\b/i.test('),
    'Les mentions "à consolider" ou "à renforcer" sont exclues des points forts'
  );
});
