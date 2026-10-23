/**
 * Contrat de non-régression : Question 3 — Modèle direct (Option B) & Terme "Maîtrisé"
 * Vérifie :
 * 1. Les 3 niveaux officiels de Q3 : "À renforcer", "En cours d’appropriation", "Maîtrisé"
 * 2. L'absence de panneau secondaire déporté (#q3-assessment-section masqué)
 * 3. La compatibilité ascendante de l'appréciation 2 ("Mobilisé" -> "Maîtrisé")
 * 4. La cohérence lexicale dans les synthèses et rapports
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const v74Code = readFileSync(resolve('src/v74/v74-runtime.js'), 'utf-8');
const coreCode = readFileSync(resolve('src/app/journalier-core.js'), 'utf-8') + '\n' + readFileSync(resolve('src/app/sessions-core.js'), 'utf-8') + '\n' + readFileSync(resolve('src/app/reports-core.js'), 'utf-8') + '\n' + readFileSync(resolve('src/app/students-core.js'), 'utf-8');
const appleCode = readFileSync(resolve('src/app/apple-ux-enhancements.js'), 'utf-8');
const htmlCode = readFileSync(resolve('index.html'), 'utf-8');

test('Q3 Échelle des appréciations : 2 = Maîtrisé dans v74-runtime.js', () => {
  assert.match(v74Code, /2\s*:\s*["']Maîtrisé["']/);
  assert.match(v74Code, /formatPiaQ3Appreciation/);
  // Vérifie que les anciens enregistrements avec 'Mobilisé' sont traduits par 'Maîtrisé'
  assert.match(v74Code, /raw===2\|\|raw==="2"\|\|raw==="Mobilisé"\|\|raw==="mobilisé"\|\|raw==="Maîtrisé"\|\|raw==="maîtrisé"\)return "Maîtrisé"/);
});

test('Q3 Échelle des appréciations : Maîtrisé dans journalier-core.js', () => {
  assert.match(coreCode, /function q3AssessmentLabel\(value\)\s*\{\s*return \['À renforcer','En cours d’appropriation','Maîtrisé'\]/);
  assert.match(coreCode, /return \(\{0:'À renforcer',1:'En cours d’appropriation',2:'Maîtrisé'\}\[Number\(app\)\]\|\|'non renseigné'\)/);
  assert.match(coreCode, /Acquis \/ Maîtrisé/);
});

test('Q3 Option B : Pas de panneau secondaire déporté (#q3-assessment-section)', () => {
  // Dans index.html, la section secondaire est masquée
  assert.match(htmlCode, /id="q3-assessment-section"\s+class="q3-assessment-section hidden"\s+style="display:none !important;"/);
  // Dans journalier-core.js, renderQ3Assessments ne l'affiche pas
  assert.match(coreCode, /section\.classList\.add\('hidden'\)/);
  assert.match(coreCode, /section\.style\.setProperty\('display','none','important'\)/);
});

test('Q3 Apple UX Enhancements : initQ3DirectLiquidItems avec glissement et pastille', () => {
  assert.match(appleCode, /function initQ3DirectLiquidItems\(\)/);
  assert.match(appleCode, /level:\s*2,\s*label:\s*['"]✨ Maîtrisé['"]/);
  // Vérifie la détection du glissement horizontal (drag)
  assert.match(appleCode, /isDragging/);
  assert.match(appleCode, /hasDragged/);
  // Vérifie que si l'utilisateur glisse, le clic n'annule pas la sélection
  assert.match(appleCode, /e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*hasDragged = false;/);
  // Vérifie que si l'utilisateur clique normalement sans glisser, il peut désélectionner (checkbox change)
  assert.match(appleCode, /delete state\[id\];/);
});

test('Harmonisation visuelle : Pastille au coin gauche, dropdown visible, icônes cohérentes sans vagues', () => {
  const cssCode = readFileSync(resolve('src/styles/apple-premium.css'), 'utf-8');
  // Pastille ancrée dans le coin à gauche
  assert.match(cssCode, /align-self:\s*flex-start\s*!important/);
  // Menu déroulant positionné à gauche (left: 0) avec overflow visible
  assert.match(cssCode, /\.apple-liquid-dropdown\s*\{[^}]*left:\s*0\s*!important/);
  assert.match(cssCode, /overflow:\s*visible\s*!important/);
  // Q2 : Harmonisé sans bulles d'eau ni vagues
  assert.match(appleCode, /label:\s*['"]🌱 Partiellement['"]/);
  assert.match(appleCode, /label:\s*['"]🌿 Suffisamment['"]/);
  assert.match(appleCode, /label:\s*['"]✨ Totalement['"]/);
  // Q4 : Harmonisé sans bulles d'eau ni vagues
  assert.match(appleCode, /label:\s*['"]⚪ Aucun effet['"]/);
  assert.match(appleCode, /label:\s*['"]💡 Partiel['"]/);
  assert.match(appleCode, /label:\s*['"]✨ Positif['"]/);
});
