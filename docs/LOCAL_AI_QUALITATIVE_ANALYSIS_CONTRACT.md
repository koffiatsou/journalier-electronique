> Note V75 : le texte du Journalier et la synthèse de réunion sont produits par `src/app/redaction-engine.js` (voir `MOTEUR_REDACTION_ET_EXPORT_V75.md`). Ce contrat décrit l'analyse qualitative des propositions V74, conservée.

# Contrat d'Architecture & d'Analyse Qualitative Assistée par IA Locale — Lot 1

> Référence technique pour l'intégration de la couche d'intelligence qualitative locale dans Journalier V74.
> Conforme à `AGENTS.md`, `ARCHITECTURE.md`, `SECURITY.md` et aux principes RGPD / Local-First.

---

## 1. Contexte & Philosophie

Le moteur déterministe de Journalier V74 est déjà riche et rigoureux :
- Il collecte et organise les données de séances (rubriques de séance `q2` à `q6`, indicateurs WBE, niveaux 0/1/2, curseurs d'aides Q4, transfert Q5, actions Q6).
- Il dégage des régularités statistiques fiables (seuils de représentativité sur 6 séances, récurrences thématiques, tendances de consolidation).
- Il génère les trois livrables cardinaux : la **Préparation de Réunion**, la **Synthèse longitudinale** et le **PIA annuel**.

**Problème constaté lors de l'audit :**
Les notes qualitatives et observations de terrain sont collectées mais sous-exploitées :
1. Dans `renderMeetingPrep()`, `q2Q3Notes` sont simplement listées et concaténées dans un `<textarea>`, sans croisement entre les contextes d'obstacles (Q2), les leviers d'aide (Q4) et le transfert (Q5).
2. Dans `buildChapterLongitudinalClusters()`, les notes de terrain sont simplement tronquées et concaténées entre parenthèses (`fieldNotes.slice(0, 2).join(' ; ')`).
3. L'outil IA actuel (`LocalAIAssistant.improve`) intervient ponctuellement comme une simple règle lexicale de reformulation de surface sans vision d'ensemble.

**Objectif :**
Faire collaborer le moteur déterministe et une IA locale d'analyse transversale sans remplacer ni fragiliser l'architecture existante.

---

## 2. Architecture en 4 Étapes

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Étape A — Préparation Déterministe (reports-core.js & sessions-core.js)│
│ Extraction du corpus structuré (evidence, units, relations, notes)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ QualitativeCorpus
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Étape B — Analyse Qualitative Assistée par IA Locale                   │
│ Identification des liens transversaux, conditions & régularités       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ QualitativeAnalysisResult (brut)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Étape C — Validation Déterministe Stricte                              │
│ Rejet des hallucinations, contrôle d'existence des sourceRefs,         │
│ vérification RGPD, repli déterministe immédiat si échec                │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ QualitativeAnalysisResult (validé)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Étape D — Rédaction Spécifique par Document                            │
│ ├── Réunion : points clés, questions d'équipe, contradictions ouvertes │
│ ├── Synthèse : récits de chapitres articulés, conditions de réussite   │
│ └── PIA : pistes d'objectifs reliées aux aides éprouvées (soumises à   │
│           la validation du professionnel, aucun objectif auto-validé)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Contrat d'Entrée : `QualitativeCorpus`

Le corpus est préparé de manière 100 % déterministe par le moteur existant :

```typescript
interface QualitativeCorpus {
  studentPseudo: string; // Ex: "Élève Alpha" (strictement fictif / sans nom réel)
  periodRange: { start: string; end: string; type: string };
  totalSessions: number;
  observedSessions: number;
  attendanceRate: number | null;
  subjects: string[];
  canonicalChapters: string[];
  
  // Observations structurées et notes textuelles
  sessions: {
    date: string;
    matiere: string;
    chapter: string;
    lessonObjective: string;
    professionalObjective: string;
    observations: {
      id: string;
      source: 'q2';
      text: string;
      level: 0 | 1 | 2 | null;
      category: string;
    }[];
    qualitativeNotes: {
      source: 'q2' | 'q3' | 'q4' | 'q5' | 'q6';
      text: string;
    }[];
    indicators: {
      id: string;
      text: string;
      appreciation: 0 | 1 | 2 | null;
    }[];
    testedAids: {
      name: string;
      effect: 0 | 1 | 2; // 0: inefficace, 1: partiel, 2: efficace
      situation: string;
      precision: string;
    }[];
    transferStatus: string;
    transferPrecision: string;
  }[];
}
```

---

## 4. Contrat de Sortie Validé : `QualitativeAnalysisResult`

```typescript
type FindingNature = 'observed_fact' | 'careful_interpretation' | 'hypothesis';
type FindingConfidence = 'high' | 'moderate' | 'exploratory';

interface QualitativeFinding {
  id: string; // Ex: "finding-math-multistep"
  category: 'learning' | 'methodology' | 'attention_engagement' | 'autonomy_organization' | 'socio_affective';
  formulation: string; // Formulation concise et professionnelle
  nature: FindingNature; // Fait observé direct vs hypothèse
  confidence: FindingConfidence; // Justifiable par le nombre d'occurrences
  
  // Traçabilité absolue : chaque constat pointe vers des observations vérifiables
  sourceRefs: {
    sessionDate: string;
    sourceField: 'q2' | 'q3' | 'q4' | 'q5' | 'q6';
    excerpt: string;
  }[];
  
  // Conditions identifiées
  conditions: {
    successConditions: string[]; // Ex: "Consigne fractionnée étape par étape"
    obstacles: string[];         // Ex: "Présentation simultanée de 3 tâches"
  };
  
  // Aides testées en lien avec ce constat
  testedAids: {
    aidName: string;
    observedEffect: 'positive' | 'partial' | 'ineffective';
    context: string;
  }[];
  
  // Éventuelles contradictions ou limites observées
  limitsAndContradictions: string[];
  
  // Documents alimentés par ce constat
  targets: ('meeting' | 'synthesis' | 'pia')[];
}

interface QualitativeAnalysisResult {
  version: '1.0';
  generatedAt: string;
  engineUsed: 'deterministic-fallback';
  findings: QualitativeFinding[];
  
  // Déclinaison Réunion
  meetingSection: {
    discussionPoints: string[];
    teamQuestions: string[];
    openIssuesToClarify: string[];
  };
  
  // Déclinaison Synthèse
  synthesisSection: {
    crossCuttingInsights: string[];
    chapterNarrativeHints: { [chapterKey: string]: string };
  };
  
  // Déclinaison PIA (pistes soumises à la décision humaine)
  piaSection: {
    suggestedObjectiveTracks: {
      domainAspect: string;
      proposalText: string;
      justification: string;
      linkedSourceIds: string[];
      recommendedTestedAids: string[];
    }[];
  };
}
```

---

## 5. Règles de Validation Déterministe (Étape C)

Une analyse produite par l'IA doit être rejetée ou filtrée selon les règles suivantes :
1. **Contrôle d'existence des sources (anti-hallucination)** : Chaque élément de `sourceRefs` doit correspondre exactement à une date et un texte existant dans le `QualitativeCorpus`. Si l'IA invente une citation ou une date inexistante, la référence est rejetée.
2. **Contrôle du niveau de confiance** : Une mention `confidence: 'high'` exige au minimum 3 séances distinctes concordantes dans les `sourceRefs`.
3. **Respect strict du RGPD** : Aucune mention de nom de famille réel, d'adresse ou de données médicales sensibles.
4. **Non-auto-validation du PIA** : Les pistes PIA sont systématiquement enregistrées comme des `propositions` non validées. Seul un clic explicite du professionnel (`Valider l'objectif`) peut modifier l'état officiel du PIA.
5. **Repli transparent** : En cas d'échec du modèle ou de sortie non conforme au schéma JSON, le moteur applique immédiatement la génération déterministe actuelle sans blocage de l'interface.

---

## 6. Points d'Insertion dans le Code Source

| Fichier | Fonction existante | Rôle du point d'insertion |
| :--- | :--- | :--- |
| `src/app/reports-core.js` | `generateReport()` | Prépare le `QualitativeCorpus` à partir de `logs`, `evidence` et `relations`. |
| `src/app/reports-core.js` | `renderMeetingPrep()` | Remplace la simple liste de `q2Q3Notes` par la section structurée de constats transversaux et les questions d'équipe. |
| `src/app/reports-core.js` | `buildChapterLongitudinalClusters()` | Enrichit la phrase 2 du récit de chapitre en articulant les notes qualitatives au lieu de les juxtaposer. |
| `src/app/reports-core.js` | `buildStructuredDomainSummaryForSynthesis()` | Intègre les conditions de réussite et aides efficaces éprouvées dans le portrait des 5 domaines. |
| `src/v74/pia-lifecycle-engine.js` | `buildPIA()` | Alimente les `propositions` avec une justification traçable issue des séances. |
