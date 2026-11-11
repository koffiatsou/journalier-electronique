# Modèle officiel du PIA : structure vérifiée du fichier .docx

Fichier : PIA_modele_officiel_2025-09-11.docx (copie du modèle « PED - PIA vierge - 2025-09-11.docx » ; seules les métadonnées auteur de docProps/core.xml ont été remplacées par « Pôle Territorial WBE BXL »).
Ce document a été produit en lisant le XML réel du .docx. **En cas de divergence avec le prompt, un OCR, un PDF ou une capture, ce fichier fait foi.** Les caractères invisibles sont notés {NBSP} (U+00A0, espace insécable) et {NNBSP} (U+202F, fine insécable). L'apostrophe des libellés est typographique (’, U+2019).

## 1. Ordre des blocs dans le corps du document

- Paragraphe : « Plan Individuel d’Apprentissage »
- **Tableau T1**
- **Tableau T2**
- (paragraphe vide portant la rupture de section 1)
- Paragraphe : « Procès-verbal 1{NNBSP} »
- Paragraphe : « Date{NBSP}:  »
- Paragraphe : « Personnes présentes :{NBSP} »
- **Tableau T3**
- **Tableau T4**
- Paragraphe : « Aménagements proposés pour l’élève{NNBSP}:{NBSP} »
- **Tableau T5**
- Paragraphe : « * P = pédagogique{NBSP}{NBSP}{NBSP}{NBSP} O = organisationnel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} M = matériel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} »
- Paragraphe : « Procès-verbal 2 (fin d’année){NNBSP} »
- Paragraphe : « Date{NBSP}: »
- Paragraphe : « Personnes présentes :{NBSP} »
- **Tableau T6**
- **Tableau T7**
- Paragraphe : « Mise à jour des aménagements proposés pour l’élève pour la rentrée scolaire suivante{NNBSP}:{NBSP}{NBSP} »
- **Tableau T8**
- Paragraphe : « * P = pédagogique{NBSP}{NBSP}{NBSP}{NBSP} O = organisationnel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} M = matériel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} »
- sectPr final (section 2)

## 2. Sections, en-têtes, pied de page
- Section 1 : paysage, pgSz 16838×11906 twips, marges 1417 (1417 twips = 2,5 cm), références [('headerReference', 'rId11'), ('footerReference', 'rId12')]
- Section 2 : portrait, pgSz 11906×16838 twips, marges 1417 (1417 twips = 2,5 cm), références [('headerReference', 'rId13')]
- La section 2 n'a **pas** de footerReference : elle hérite du pied de la section 1. Ne pas en créer.

**Où est l'image (logo) : dans le PIED DE PAGE, pas dans les en-têtes.** Les en-têtes ne contiennent que du texte.

### word/header1.xml
```xml
<w:p><w:pPr><w:pStyle w:val="En-tte"/><w:jc w:val="right"/><w:rPr><w:lang w:val="fr-FR"/></w:rPr></w:pPr><w:r><w:rPr><w:lang w:val="fr-FR"/></w:rPr><w:t>2025-2025</w:t></w:r></w:p>
```

### word/header2.xml
```xml
<w:p><w:pPr><w:pStyle w:val="En-tte"/><w:rPr><w:lang w:val="fr-FR"/></w:rPr></w:pPr><w:r><w:rPr><w:lang w:val="fr-FR"/></w:rPr><w:t xml:space="preserve">Annexe 2 </w:t></w:r><w:r><w:tab/></w:r><w:r><w:tab/></w:r><w:r><w:rPr><w:lang w:val="fr-FR"/></w:rPr><w:t>2025-2026</w:t></w:r></w:p>
```

### word/footer1.xml
```xml
<w:p><w:pPr><w:pStyle w:val="Pieddepage"/><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:noProof/></w:rPr><w:drawing>[logo ancré, 714375×428625 EMU, position horizontale relative à la colonne, offset -5080]</w:drawing></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText>PAGE   \* MERGEFORMAT</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:rPr><w:lang w:val="fr-FR"/></w:rPr><w:t>2</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
```
```xml
<w:p><w:pPr><w:pStyle w:val="Pieddepage"/></w:pPr></w:p>
```
Le premier paragraphe du pied est dans un contrôle de contenu (sdt) de numéro de page ; champ PAGE. À ne pas toucher.

Texte à modifier pour l'année scolaire (uniquement ces runs) :
- header1 : un seul run, « 2025-2025 » (paragraphe aligné à droite).
- header2 : run « Annexe 2 » (avec une espace finale), deux tabulations (w:tab, w:tab), puis un run « 2025-2026 ». Seul le dernier run change.

## 3. Tableaux : dimensions, largeurs, contenu des cellules
Notation d'une cellule : [texte] w=largeur tcW, span=gridSpan, vMerge, ¶=nombre de paragraphes (dont vides).

### T1 : Identité (section 1, paysage) — grille ['5665', '8329']
- L0 : [Nom et prénom de l’élève{NBSP}:] w=2024/pct ¶=1(vides=0) | [] w=2976/pct ¶=1(vides=1)
- L1 : [Date de naissance{NBSP}:] w=2024/pct ¶=1(vides=0) | [] w=2976/pct ¶=1(vides=1)
- L2 : [Coordonnées de l’école{NBSP}:] w=2024/pct ¶=1(vides=0) | [] w=2976/pct ¶=1(vides=1)
- L3 : [Classe et option{NBSP}:] w=2024/pct ¶=1(vides=0) | [] w=2976/pct ¶=1(vides=1)
- L4 : [Titulaire{NBSP}:] w=2024/pct ¶=1(vides=0) | [] w=2976/pct ¶=1(vides=1)
- L5 : [Coordonnées du CPMS coopérant{NBSP}:] w=2024/pct ¶=1(vides=0) | [] w=2976/pct ¶=1(vides=1)
- L6 : [Représentant du Pôle Territorial{NBSP}:] w=2024/pct ¶=1(vides=0) | [] w=2976/pct ¶=1(vides=1)
- L7 : [Coordonnées du responsable de l’élève{NBSP}:] w=2024/pct ¶=1(vides=0) | [] w=2976/pct ¶=1(vides=1)

### T2 : Les 5 aspects (section 1, paysage) — grille ['4728', '3224', '2930', '3112']
- L0 : [Aspect] w=1689/pct ¶=1(vides=0) | [Ressources] w=1152/pct ¶=1(vides=0) | [Difficultés] w=1047/pct ¶=1(vides=0) | [Objectifs à poursuivre] w=1112/pct ¶=1(vides=0)
- L1 : [Physique et psychomoteur{NBSP}:] w=1689/pct ¶=1(vides=0) | [] w=1152/pct ¶=1(vides=1) | [] w=1047/pct ¶=1(vides=1) | [] w=1112/pct ¶=1(vides=1)
- L2 : [Lié à l’autonomie{NBSP}:] w=1689/pct ¶=1(vides=0) | [] w=1152/pct ¶=1(vides=1) | [] w=1047/pct ¶=1(vides=1) | [] w=1112/pct ¶=1(vides=1)
- L3 : [Comportemental et affectif{NBSP}:] w=1689/pct ¶=1(vides=0) | [] w=1152/pct ¶=2(vides=2) | [] w=1047/pct ¶=1(vides=1) | [] w=1112/pct ¶=1(vides=1)
- L4 : [Communication{NBSP}:] w=1689/pct ¶=1(vides=0) | [] w=1152/pct ¶=1(vides=1) | [] w=1047/pct ¶=1(vides=1) | [] w=1112/pct ¶=1(vides=1)
- L5 : [Cognitif (pédagogique){NBSP}:] w=1689/pct ¶=1(vides=0) | [] w=1152/pct ¶=1(vides=1) | [] w=1047/pct ¶=1(vides=1) | [] w=1112/pct ¶=1(vides=1)

### T3 : Personnes présentes PV1 — grille ['3020', '3021', '3021']
- L0 : [] w=3020 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1)
- L1 : [] w=3020 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1)
- L2 : [] w=3020 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1)

### T4 : Procès-verbal 1 — grille ['4528', '4528']
- L0 : [Difficulté majeure se situe au niveau de l’axe{NNBSP}:{NBSP}] w=9056 span=2 ¶=1(vides=0)
- L1 : [] w=9056 span=2 ¶=1(vides=1)
- L2 : [Objectifs visés pour la période{NNBSP}et critères d’évaluation{NNBSP}:{NBSP}] w=9056 span=2 ¶=1(vides=0)
- L3 : [] w=9056 span=2 ¶=8(vides=8)
- L4 : [Ressources et moyens complémentaires{NNBSP}:{NBSP}] w=9056 span=2 ¶=1(vides=0)
- L5 : [] w=9056 span=2 ¶=7(vides=7)
- L6 : [Retours des parents{NNBSP}:{NBSP}] w=4528 ¶=1(vides=0) | [Retours de la direction et de l’équipe pédagogique{NNBSP}:{NBSP}] w=4528 ¶=1(vides=0)
- L7 : [] w=4528 ¶=5(vides=5) | [] w=4528 ¶=1(vides=1)
- L8 : [Retours de l’élève{NNBSP}:{NBSP}] w=4528 ¶=1(vides=0) | [Retours du centre PMS{NNBSP}:{NBSP}{NBSP}] w=4528 ¶=1(vides=0)
- L9 : [] w=4528 ¶=3(vides=3) | [] w=4528 ¶=6(vides=6)
- L10 : [Retours de l’agent d’intégration{NNBSP}:{NBSP}] w=4528 ¶=1(vides=0) | [Retours des autres intervenants{NNBSP}:{NBSP}] w=4528 ¶=1(vides=0)
- L11 : [] w=4528 ¶=6(vides=6) | [] w=4528 ¶=1(vides=1)

### T5 : Aménagements proposés — grille ['563', '582', '598', '615', '6698']
- L0 : [N°{NBSP}] w=570 vMerge=restart ¶=1(vides=0) | [{NBSP}Description/modalité{NBSP}] w=8760 span=4 ¶=1(vides=0)
- L1 : [] w=0 vMerge=continue ¶=1(vides=1) | [P{NBSP}] w=585 ¶=1(vides=0) | [O{NBSP}] w=600 ¶=1(vides=0) | [M{NBSP}] w=615 ¶=1(vides=0) | [] w=6960 ¶=1(vides=1)
- L2 : [1{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L3 : [2{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L4 : [3{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L5 : [4{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L6 : [5{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L7 : [6{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L8 : [7{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L9 : [8{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L10 : [9{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L11 : [10{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)

### T6 : Personnes présentes PV2 — grille ['3020', '3021', '3021']
- L0 : [] w=3020 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1)
- L1 : [] w=3020 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1)
- L2 : [] w=3020 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1) | [] w=3021 ¶=1(vides=1)

### T7 : Procès-verbal 2 — grille ['4528', '4528']
- L0 : [Objectifs visés pour la période{NNBSP}2{NNBSP}: évaluation{NBSP}] w=9060 span=2 ¶=1(vides=0)
- L1 : [] w=9060 span=2 ¶=8(vides=8)
- L2 : [Retours des parents{NNBSP}:{NBSP}] w=4530 ¶=1(vides=0) | [Retours de la direction et de l’équipe pédagogique{NNBSP}:{NBSP}] w=4530 ¶=1(vides=0)
- L3 : [] w=4530 ¶=9(vides=9) | [] w=4530 ¶=1(vides=1)
- L4 : [Retours de l’élève{NNBSP}:{NBSP}] w=4530 ¶=1(vides=0) | [Retours du centre PMS{NNBSP}:{NBSP}{NBSP}] w=4530 ¶=1(vides=0)
- L5 : [] w=4530 ¶=11(vides=11) | [] w=4530 ¶=7(vides=7)
- L6 : [Retours de l’agent d’intégration{NNBSP}:{NBSP}] w=4530 ¶=1(vides=0) | [Retours des autres intervenants{NNBSP}:{NBSP}] w=4530 ¶=1(vides=0)
- L7 : [] w=4530 ¶=13(vides=13) | [] w=4530 ¶=1(vides=1)

### T8 : Mise à jour des aménagements pour la rentrée — grille ['562', '582', '598', '615', '6699']
- L0 : [N°{NBSP}] w=570 vMerge=restart ¶=1(vides=0) | [Description/modalité{NBSP}] w=8760 span=4 ¶=2(vides=1)
- L1 : [] w=0 vMerge=continue ¶=1(vides=1) | [P{NBSP}] w=585 ¶=1(vides=0) | [O{NBSP}] w=600 ¶=1(vides=0) | [M{NBSP}] w=615 ¶=1(vides=0) | [] w=6960 ¶=1(vides=1)
- L2 : [1{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L3 : [2{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L4 : [3{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L5 : [4{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L6 : [5{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L7 : [6{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L8 : [7{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L9 : [8{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L10 : [9{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)
- L11 : [10{NBSP}] w=570 ¶=1(vides=0) | [] w=585 ¶=1(vides=1) | [] w=600 ¶=1(vides=1) | [] w=615 ¶=1(vides=1) | [] w=6960 ¶=1(vides=1)

## 4. CORRECTIONS IMPORTANTES de la cartographie
- **Tableaux d'aménagements (T5, T8) : l'ordre des colonnes dans le XML est N° | P | O | M | Description**, et non N° | Description | P | O | M. Les lignes de données ont 5 cellules : cellule 0 = numéro (« 1{NBSP} »…), cellules 1, 2, 3 = P, O, M (étroites, une espace insécable dedans), cellule 4 = description (large, paragraphe vide). Ligne d'en-tête 0 : « N°{NBSP} » (fusion verticale) + « {NBSP}Description/modalité{NBSP} » sur 4 colonnes ; ligne d'en-tête 1 : cellule fusionnée, « P{NBSP} », « O{NBSP} », « M{NBSP} », cellule vide.
- Le logo est dans le pied de page (voir section 2).
- Les « personnes présentes » sont dans un tableau 3 × 3 (9 cases) ; « Date : » et « Personnes présentes : » sont des paragraphes hors tableau.

## 5. Libellés exacts des paragraphes hors tableau et des cellules-libellés
(à comparer après normalisation : {NBSP}, {NNBSP} et espaces multiples → espace simple ; ’ ↔ ' ; avec ou sans « : » final)

- « Plan Individuel d’Apprentissage » — runs : ['Plan Individuel d’Apprentissage']
- « Procès-verbal 1{NNBSP} » — runs : ['Procès-verbal 1{NNBSP}']
- « Date{NBSP}:  » — runs : ['Date{NBSP}:', ' ']
- « Personnes présentes :{NBSP} » — runs : ['Personnes présentes :', '{NBSP}']
- « Aménagements proposés pour l’élève{NNBSP}:{NBSP} » — runs : ['Aménagements proposés pour l’élève{NNBSP}:', '{NBSP}']
- « * P = pédagogique{NBSP}{NBSP}{NBSP}{NBSP} O = organisationnel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} M = matériel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} » — runs : ['* P = pédagogique{NBSP}{NBSP}{NBSP}{NBSP} O = organisationnel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} M = matériel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}', '{NBSP}']
- « Procès-verbal 2 (fin d’année){NNBSP} » — runs : ['Procès-verbal ', '2', ' (fin d’année){NNBSP}']
- « Date{NBSP}: » — runs : ['Date{NBSP}:']
- « Personnes présentes :{NBSP} » — runs : ['Personnes présentes :', '{NBSP}']
- « Mise à jour des aménagements proposés pour l’élève pour la rentrée scolaire suivante{NNBSP}:{NBSP}{NBSP} » — runs : ['Mise à jour des aménagements proposés pour l’élève pour la rentrée scolaire suivante{NNBSP}:{NBSP}', '{NBSP}']
- « * P = pédagogique{NBSP}{NBSP}{NBSP}{NBSP} O = organisationnel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} M = matériel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} » — runs : ['* P = pédagogique{NBSP}{NBSP}{NBSP}{NBSP} O = organisationnel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP} M = matériel{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}{NBSP}', '{NBSP}']

Cellules-libellés des tableaux (texte exact) :
- T1 L0 C0 : « Nom et prénom de l’élève{NBSP}: »
- T1 L1 C0 : « Date de naissance{NBSP}: »
- T1 L2 C0 : « Coordonnées de l’école{NBSP}: »
- T1 L3 C0 : « Classe et option{NBSP}: »
- T1 L4 C0 : « Titulaire{NBSP}: »
- T1 L5 C0 : « Coordonnées du CPMS coopérant{NBSP}: »
- T1 L6 C0 : « Représentant du Pôle Territorial{NBSP}: »
- T1 L7 C0 : « Coordonnées du responsable de l’élève{NBSP}: »
- T2 L0 C0 : « Aspect »
- T2 L0 C1 : « Ressources »
- T2 L0 C2 : « Difficultés »
- T2 L0 C3 : « Objectifs à poursuivre »
- T2 L1 C0 : « Physique et psychomoteur{NBSP}: »
- T2 L2 C0 : « Lié à l’autonomie{NBSP}: »
- T2 L3 C0 : « Comportemental et affectif{NBSP}: »
- T2 L4 C0 : « Communication{NBSP}: »
- T2 L5 C0 : « Cognitif (pédagogique){NBSP}: »
- T4 L0 C0 : « Difficulté majeure se situe au niveau de l’axe{NNBSP}:{NBSP} »
- T4 L2 C0 : « Objectifs visés pour la période{NNBSP}et critères d’évaluation{NNBSP}:{NBSP} »
- T4 L4 C0 : « Ressources et moyens complémentaires{NNBSP}:{NBSP} »
- T4 L6 C0 : « Retours des parents{NNBSP}:{NBSP} »
- T4 L6 C1 : « Retours de la direction et de l’équipe pédagogique{NNBSP}:{NBSP} »
- T4 L8 C0 : « Retours de l’élève{NNBSP}:{NBSP} »
- T4 L8 C1 : « Retours du centre PMS{NNBSP}:{NBSP}{NBSP} »
- T4 L10 C0 : « Retours de l’agent d’intégration{NNBSP}:{NBSP} »
- T4 L10 C1 : « Retours des autres intervenants{NNBSP}:{NBSP} »
- T5 L0 C0 : « N°{NBSP} »
- T5 L0 C1 : « {NBSP}Description/modalité{NBSP} »
- T5 L1 C1 : « P{NBSP} »
- T5 L1 C2 : « O{NBSP} »
- T5 L1 C3 : « M{NBSP} »
- T5 L2 C0 : « 1{NBSP} »
- T5 L3 C0 : « 2{NBSP} »
- T5 L4 C0 : « 3{NBSP} »
- T5 L5 C0 : « 4{NBSP} »
- T5 L6 C0 : « 5{NBSP} »
- T5 L7 C0 : « 6{NBSP} »
- T5 L8 C0 : « 7{NBSP} »
- T5 L9 C0 : « 8{NBSP} »
- T5 L10 C0 : « 9{NBSP} »
- T5 L11 C0 : « 10{NBSP} »
- T7 L0 C0 : « Objectifs visés pour la période{NNBSP}2{NNBSP}: évaluation{NBSP} »
- T7 L2 C0 : « Retours des parents{NNBSP}:{NBSP} »
- T7 L2 C1 : « Retours de la direction et de l’équipe pédagogique{NNBSP}:{NBSP} »
- T7 L4 C0 : « Retours de l’élève{NNBSP}:{NBSP} »
- T7 L4 C1 : « Retours du centre PMS{NNBSP}:{NBSP}{NBSP} »
- T7 L6 C0 : « Retours de l’agent d’intégration{NNBSP}:{NBSP} »
- T7 L6 C1 : « Retours des autres intervenants{NNBSP}:{NBSP} »
- T8 L0 C0 : « N°{NBSP} »
- T8 L0 C1 : « Description/modalité{NBSP} »
- T8 L1 C1 : « P{NBSP} »
- T8 L1 C2 : « O{NBSP} »
- T8 L1 C3 : « M{NBSP} »
- T8 L2 C0 : « 1{NBSP} »
- T8 L3 C0 : « 2{NBSP} »
- T8 L4 C0 : « 3{NBSP} »
- T8 L5 C0 : « 4{NBSP} »
- T8 L6 C0 : « 5{NBSP} »
- T8 L7 C0 : « 6{NBSP} »
- T8 L8 C0 : « 7{NBSP} »
- T8 L9 C0 : « 8{NBSP} »
- T8 L10 C0 : « 9{NBSP} »
- T8 L11 C0 : « 10{NBSP} »

## 6. Où écrire la valeur (règle par type de case)
- **T1 identité** : la valeur va dans la cellule C1 de la même ligne que le libellé (C0).
- **T2 aspects** : Ressources = C1, Difficultés = C2, Objectifs à poursuivre = C3, dans la ligne du libellé de l'aspect (C0).
- **« Date : » (PV1 et PV2)** : paragraphe hors tableau ; ajouter la date après le dernier run du paragraphe (le paragraphe contient « Date{NBSP}: » puis un run contenant une seule espace).
- **« Personnes présentes : »** : paragraphe suivi d'un tableau 3 × 3 (T3 pour PV1, T6 pour PV2) ; une personne par cellule, ordre de lecture ; au-delà de 9, cloner une ligne de 3 cellules.
- **T4 / T7, libellés sur une ligne pleine largeur** (« Difficulté majeure… », « Objectifs visés… », « Ressources et moyens… », « Objectifs visés pour la période 2 : évaluation ») : la case à remplir est la **ligne suivante** (cellule pleine largeur, gridSpan 2).
- **T4 / T7, retours** : les libellés sont par paires sur une ligne (C0, C1) ; les cases de réponse sont dans la **ligne suivante**, même colonne (C0 ou C1).
- **T5 / T8** : voir section 4 (N° | P | O | M | Description). Ligne 1 = L2 ; 10 lignes de données (L2 à L11).

## 7. Cases « vides » : ce qu'elles contiennent vraiment
Signatures des paragraphes vides par tableau (propriétés de paragraphe pPr/rPr à reproduire dans le run inséré ; un paragraphe vide n'a pas de run, donc la police du texte inséré se copie depuis w:pPr/w:rPr) :

### T1
- 5 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi" w:hAnsiTheme="majorHAnsi" w:cstheme="majorBidi"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>
  ```
- 3 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi" w:hAnsiTheme="majorHAnsi" w:cstheme="majorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>
  ```

### T2
- 14 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi" w:hAnsiTheme="majorHAnsi" w:cstheme="majorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>
  ```
- 2 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi" w:hAnsiTheme="majorHAnsi" w:cstheme="majorBidi"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>
  ```

### T3
- 5 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:jc w:val="center"/><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>
  ```
- 4 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>
  ```

### T4
- 16 paragraphe(s) vide(s), 1 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
  ```
- 15 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
  ```
- 5 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
  ```
- 1 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:asciiTheme="majorHAnsi" w:hAnsiTheme="majorHAnsi" w:cstheme="majorBidi"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>
  ```
- 1 paragraphe(s) vide(s), 1 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
  ```

### T5
- 39 paragraphe(s) vide(s), 1 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr>
  ```
- 1 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr>
  ```
- 1 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr>
  ```

### T6
- 9 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>
  ```

### T7
- 33 paragraphe(s) vide(s), 1 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
  ```
- 17 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr></w:pPr>
  ```

### T8
- 42 paragraphe(s) vide(s), 1 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr>
  ```
- 1 paragraphe(s) vide(s), 0 run(s) dedans :
  ```xml
  <w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr>
  ```

Exemple : une ligne de données complète de T5 (aménagement n° 1) :
```xml
<w:tr><w:trPr><w:trHeight w:val="300"/></w:trPr><w:tc><w:tcPr><w:tcW w:w="570" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/></w:tcBorders><w:vAlign w:val="center"/><w:hideMark/></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="fr-FR"/></w:rPr><w:t>1</w:t></w:r><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>{NBSP}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="585" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/></w:tcBorders><w:hideMark/></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>{NBSP}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="600" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/></w:tcBorders><w:hideMark/></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>{NBSP}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="615" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/></w:tcBorders><w:hideMark/></w:tcPr><w:p><w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr><w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr><w:t>{NBSP}</w:t></w:r></w:p></w:tc><w:tc><w:tcPr><w:tcW w:w="6960" w:type="dxa"/><w:tcBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:left w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/><w:right w:val="single" w:sz="6" w:space="0" w:color="000000" w:themeColor="text1"/></w:tcBorders><w:hideMark/></w:tcPr><w:p><w:pPr><w:rPr><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr></w:p></w:tc></w:tr>
```

Exemple : la cellule P de cette ligne (cellule 1) contient un run avec {NBSP} ; pour marquer P, remplacer le texte du run par « X » et ajouter w:jc center au pPr de ce paragraphe (le modèle n'a pas d'alignement dans ces cellules).

## 8. Points d'attention pour le moteur de remplissage
- Les libellés ont des espaces insécables, des fines insécables avant « : », des apostrophes typographiques, et certains sont répartis sur plusieurs runs : comparer sur le texte concaténé du paragraphe, normalisé.
- Police dans les cases : 16 pt (sz 32) dans T1, T2, T5 et T8 ; 14 pt (sz 28) dans T4, T7 et les paragraphes « Date : » (gras). Ne jamais réduire.
- Numéros d'aménagements : run « 1 » suivi d'un run {NBSP} ; pour les lignes ajoutées (11, 12…), cloner la ligne 10 et changer le texte du premier run uniquement.
- Pas de champs de formulaire, contrôles de contenu (hors numéro de page du pied), révisions, commentaires ou signets dans document.xml.
- Métadonnées : docProps/core.xml contient désormais « Pôle Territorial WBE BXL » comme créateur et dernier auteur ; à conserver ainsi dans chaque export. customXml, app.xml et custom.xml ne contiennent aucun nom de personne.