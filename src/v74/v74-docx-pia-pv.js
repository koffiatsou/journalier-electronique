/**
 * Module v74-docx-pia-pv.js — Remplissage des Procès-Verbaux 1 & 2 et des Tableaux d'Aménagements
 * Conforme au modèle officiel PIA 2025-09-11 et aux règles AGENTS.md.
 * Script classique pour navigateur (globalThis) et Node.js.
 */

(function (global) {
  "use strict";

  function xmlEsc(str) {
    if (typeof globalThis !== "undefined" && typeof globalThis.escapeXml === "function") {
      return globalThis.escapeXml(str);
    }
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function formatDocxDate(dateStr) {
    if (!dateStr || typeof dateStr !== "string") return "";
    const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      return `${m[3]}/${m[2]}/${m[1]}`;
    }
    return dateStr.trim();
  }

  function safeArray(val) {
    return Array.isArray(val) ? val : [];
  }

  /**
   * Remplit une cellule Word en copiant les propriétés pPr/rPr des paragraphes vides existants.
   * Conserve les paragraphes vides restants et clone le dernier si le texte a plus de lignes.
   */
  function fillCellWithText(cellXml, text) {
    const rawText = String(text ?? "").trim();
    if (!rawText) return cellXml;

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return cellXml;

    const pRegex = /<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g;
    const existingParas = [];
    let pMatch;
    while ((pMatch = pRegex.exec(cellXml))) {
      existingParas.push(pMatch[0]);
    }

    if (!existingParas.length) return cellXml;

    const newParas = [];
    const count = Math.max(lines.length, existingParas.length);

    for (let i = 0; i < count; i++) {
      if (i < lines.length) {
        const line = lines[i];
        const templateP = i < existingParas.length ? existingParas[i] : existingParas[existingParas.length - 1];

        const pPrMatch = templateP.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/);
        const pPr = pPrMatch ? pPrMatch[0] : "<w:pPr/>";

        let rPr = "";
        const rPrInPPr = pPr.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/);
        if (rPrInPPr) {
          rPr = rPrInPPr[0];
        } else {
          const rPrInRun = templateP.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/);
          if (rPrInRun) rPr = rPrInRun[0];
        }

        newParas.push(`<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r></w:p>`);
      } else {
        newParas.push(existingParas[i]);
      }
    }

    const firstPIndex = cellXml.indexOf(existingParas[0]);
    const lastP = existingParas[existingParas.length - 1];
    const lastPEndIndex = cellXml.lastIndexOf(lastP) + lastP.length;

    const prefix = cellXml.slice(0, firstPIndex);
    const suffix = cellXml.slice(lastPEndIndex);

    return `${prefix}${newParas.join("")}${suffix}`;
  }

  /**
   * Remplit le tableau des personnes présentes (T3 ou T6, 3x3 initialement).
   * Si plus de 9 personnes : clone la ligne 2 par blocs de 3 cellules.
   */
  function fillPersonnesPresentesTable(tblXml, personnesList) {
    const list = safeArray(personnesList);
    const trRegex = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
    const rows = [];
    let trMatch;
    while ((trMatch = trRegex.exec(tblXml))) {
      rows.push(trMatch[0]);
    }

    if (rows.length < 3) return tblXml;

    const parseCells = (rowXml) => {
      const tcRegex = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
      const cells = [];
      let m;
      while ((m = tcRegex.exec(rowXml))) {
        cells.push(m[0]);
      }
      return cells;
    };

    const row2Template = rows[2];
    const row2Cells = parseCells(row2Template);
    const totalPeople = list.length;
    const neededRows = Math.max(3, Math.ceil(totalPeople / 3));

    const filledRows = [];

    for (let r = 0; r < neededRows; r++) {
      let baseRowXml;
      let baseCells;
      if (r < rows.length) {
        baseRowXml = rows[r];
        baseCells = parseCells(baseRowXml);
      } else {
        baseRowXml = row2Template;
        baseCells = [...row2Cells];
      }

      const trOpenMatch = baseRowXml.match(/^<w:tr(?:\s[^>]*)?>/);
      const trOpen = trOpenMatch ? trOpenMatch[0] : "<w:tr>";
      const trPrMatch = baseRowXml.match(/<w:trPr(?:\s[^>]*)?>[\s\S]*?<\/w:trPr>/);
      const trPr = trPrMatch ? trPrMatch[0] : "";

      const updatedCells = baseCells.map((cellXml, colIdx) => {
        const personIndex = r * 3 + colIdx;
        const personName = String(list[personIndex] ?? "").trim();

        const tcPrMatch = cellXml.match(/<w:tcPr(?:\s[^>]*)?>[\s\S]*?<\/w:tcPr>/);
        const tcPr = tcPrMatch ? tcPrMatch[0] : "";

        const pPrMatch = cellXml.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/);
        const pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:jc w:val="center"/><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="fr-FR"/></w:rPr></w:pPr>';

        const rPrMatch = pPr.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/);
        const rPr = rPrMatch ? rPrMatch[0] : '<w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="fr-FR"/></w:rPr>';

        if (personName) {
          return `<w:tc>${tcPr}<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${xmlEsc(personName)}</w:t></w:r></w:p></w:tc>`;
        }
        return `<w:tc>${tcPr}<w:p>${pPr}</w:p></w:tc>`;
      });

      filledRows.push(`${trOpen}${trPr}${updatedCells.join("")}</w:tr>`);
    }

    const tblOpenMatch = tblXml.match(/^<w:tbl(?:\s[^>]*)?>/);
    const tblOpen = tblOpenMatch ? tblOpenMatch[0] : "<w:tbl>";
    const tblPrMatch = tblXml.match(/<w:tblPr(?:\s[^>]*)?>[\s\S]*?<\/w:tblPr>/);
    const tblPr = tblPrMatch ? tblPrMatch[0] : "";
    const tblGridMatch = tblXml.match(/<w:tblGrid(?:\s[^>]*)?>[\s\S]*?<\/w:tblGrid>/);
    const tblGrid = tblGridMatch ? tblGridMatch[0] : "";

    return `${tblOpen}${tblPr}${tblGrid}${filledRows.join("")}</w:tbl>`;
  }

  /**
   * Remplit le tableau du Procès-verbal 1 (T4, 12 lignes).
   */
  function fillT4PV1Table(tblXml, pv1Data) {
    if (!pv1Data) return tblXml;

    const trRegex = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
    const rows = [];
    let trMatch;
    while ((trMatch = trRegex.exec(tblXml))) {
      rows.push(trMatch[0]);
    }

    if (rows.length < 12) return tblXml;

    const parseCells = (rowXml) => {
      const tcRegex = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
      const cells = [];
      let m;
      while ((m = tcRegex.exec(rowXml))) {
        cells.push(m[0]);
      }
      return cells;
    };

    const replaceRowCells = (rowXml, replacer) => {
      const trOpenMatch = rowXml.match(/^<w:tr(?:\s[^>]*)?>/);
      const trOpen = trOpenMatch ? trOpenMatch[0] : "<w:tr>";
      const trPrMatch = rowXml.match(/<w:trPr(?:\s[^>]*)?>[\s\S]*?<\/w:trPr>/);
      const trPr = trPrMatch ? trPrMatch[0] : "";
      const cells = parseCells(rowXml);
      const newCells = replacer(cells);
      return `${trOpen}${trPr}${newCells.join("")}</w:tr>`;
    };

    const ret = pv1Data.retours || {};

    // L1: difficulteAxe
    rows[1] = replaceRowCells(rows[1], (cells) => {
      return cells.map(c => fillCellWithText(c, pv1Data.difficulteAxe));
    });

    // L3: objectifsCriteres
    rows[3] = replaceRowCells(rows[3], (cells) => {
      return cells.map(c => fillCellWithText(c, pv1Data.objectifsCriteres));
    });

    // L5: ressourcesMoyens
    rows[5] = replaceRowCells(rows[5], (cells) => {
      return cells.map(c => fillCellWithText(c, pv1Data.ressourcesMoyens));
    });

    // L7: retours parents (C0) & directionEtEquipe (C1)
    rows[7] = replaceRowCells(rows[7], (cells) => {
      const c0 = fillCellWithText(cells[0], ret.parents);
      const c1 = cells[1] ? fillCellWithText(cells[1], ret.directionEtEquipe) : "";
      return [c0, c1].filter(Boolean);
    });

    // L9: retours eleve (C0) & pms (C1)
    rows[9] = replaceRowCells(rows[9], (cells) => {
      const c0 = fillCellWithText(cells[0], ret.eleve);
      const c1 = cells[1] ? fillCellWithText(cells[1], ret.pms) : "";
      return [c0, c1].filter(Boolean);
    });

    // L11: retours integration (C0) & autres (C1)
    rows[11] = replaceRowCells(rows[11], (cells) => {
      const c0 = fillCellWithText(cells[0], ret.integration);
      const c1 = cells[1] ? fillCellWithText(cells[1], ret.autres) : "";
      return [c0, c1].filter(Boolean);
    });

    const tblOpenMatch = tblXml.match(/^<w:tbl(?:\s[^>]*)?>/);
    const tblOpen = tblOpenMatch ? tblOpenMatch[0] : "<w:tbl>";
    const tblPrMatch = tblXml.match(/<w:tblPr(?:\s[^>]*)?>[\s\S]*?<\/w:tblPr>/);
    const tblPr = tblPrMatch ? tblPrMatch[0] : "";
    const tblGridMatch = tblXml.match(/<w:tblGrid(?:\s[^>]*)?>[\s\S]*?<\/w:tblGrid>/);
    const tblGrid = tblGridMatch ? tblGridMatch[0] : "";

    return `${tblOpen}${tblPr}${tblGrid}${rows.join("")}</w:tbl>`;
  }

  /**
   * Remplit le tableau du Procès-verbal 2 (T7, 8 lignes).
   */
  function fillT7PV2Table(tblXml, pv2Data, isFinAnnee) {
    if (!isFinAnnee || !pv2Data) return tblXml;

    const trRegex = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
    const rows = [];
    let trMatch;
    while ((trMatch = trRegex.exec(tblXml))) {
      rows.push(trMatch[0]);
    }

    if (rows.length < 8) return tblXml;

    const parseCells = (rowXml) => {
      const tcRegex = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
      const cells = [];
      let m;
      while ((m = tcRegex.exec(rowXml))) {
        cells.push(m[0]);
      }
      return cells;
    };

    const replaceRowCells = (rowXml, replacer) => {
      const trOpenMatch = rowXml.match(/^<w:tr(?:\s[^>]*)?>/);
      const trOpen = trOpenMatch ? trOpenMatch[0] : "<w:tr>";
      const trPrMatch = rowXml.match(/<w:trPr(?:\s[^>]*)?>[\s\S]*?<\/w:trPr>/);
      const trPr = trPrMatch ? trPrMatch[0] : "";
      const cells = parseCells(rowXml);
      const newCells = replacer(cells);
      return `${trOpen}${trPr}${newCells.join("")}</w:tr>`;
    };

    const ret = pv2Data.retours || {};

    // L1: objectifsEvaluation
    rows[1] = replaceRowCells(rows[1], (cells) => {
      return cells.map(c => fillCellWithText(c, pv2Data.objectifsEvaluation));
    });

    // L3: retours parents (C0) & directionEtEquipe (C1)
    rows[3] = replaceRowCells(rows[3], (cells) => {
      const c0 = fillCellWithText(cells[0], ret.parents);
      const c1 = cells[1] ? fillCellWithText(cells[1], ret.directionEtEquipe) : "";
      return [c0, c1].filter(Boolean);
    });

    // L5: retours eleve (C0) & pms (C1)
    rows[5] = replaceRowCells(rows[5], (cells) => {
      const c0 = fillCellWithText(cells[0], ret.eleve);
      const c1 = cells[1] ? fillCellWithText(cells[1], ret.pms) : "";
      return [c0, c1].filter(Boolean);
    });

    // L7: retours integration (C0) & autres (C1)
    rows[7] = replaceRowCells(rows[7], (cells) => {
      const c0 = fillCellWithText(cells[0], ret.integration);
      const c1 = cells[1] ? fillCellWithText(cells[1], ret.autres) : "";
      return [c0, c1].filter(Boolean);
    });

    const tblOpenMatch = tblXml.match(/^<w:tbl(?:\s[^>]*)?>/);
    const tblOpen = tblOpenMatch ? tblOpenMatch[0] : "<w:tbl>";
    const tblPrMatch = tblXml.match(/<w:tblPr(?:\s[^>]*)?>[\s\S]*?<\/w:tblPr>/);
    const tblPr = tblPrMatch ? tblPrMatch[0] : "";
    const tblGridMatch = tblXml.match(/<w:tblGrid(?:\s[^>]*)?>[\s\S]*?<\/w:tblGrid>/);
    const tblGrid = tblGridMatch ? tblGridMatch[0] : "";

    return `${tblOpen}${tblPr}${tblGrid}${rows.join("")}</w:tbl>`;
  }

  /**
   * Remplit un tableau d'aménagements (T5 ou T8).
   * Lignes 0 et 1 : en-têtes (intactes).
   * Lignes 2 à 11 : 10 lignes de données [N° | P | O | M | Description].
   * Si plus de 10 aménagements : clone la ligne 11 et renumérote.
   */
  function fillAmenagementsTable(tblXml, amenagementsList, isT8, isFinAnnee) {
    if (isT8 && !isFinAnnee) return tblXml;

    const list = safeArray(amenagementsList);
    const trRegex = /<w:tr(?:\s[^>]*)?>[\s\S]*?<\/w:tr>/g;
    const rows = [];
    let trMatch;
    while ((trMatch = trRegex.exec(tblXml))) {
      rows.push(trMatch[0]);
    }

    if (rows.length < 12) return tblXml;

    const parseCells = (rowXml) => {
      const tcRegex = /<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g;
      const cells = [];
      let m;
      while ((m = tcRegex.exec(rowXml))) {
        cells.push(m[0]);
      }
      return cells;
    };

    const row10Template = rows[11];
    const totalItems = Math.max(10, list.length);
    const headerRows = [rows[0], rows[1]];
    const dataRows = [];

    const formatCheckCell = (cellXml, isChecked) => {
      if (!isChecked) return cellXml;

      const tcPrMatch = cellXml.match(/<w:tcPr(?:\s[^>]*)?>[\s\S]*?<\/w:tcPr>/);
      const tcPr = tcPrMatch ? tcPrMatch[0] : "";

      const pPrMatch = cellXml.match(/<w:pPr(?:\s[^>]*)?>[\s\S]*?<\/w:pPr>/);
      let pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr></w:pPr>';

      if (!pPr.includes("w:jc")) {
        if (pPr.includes("<w:rPr")) {
          pPr = pPr.replace(/<w:rPr/, '<w:jc w:val="center"/><w:rPr');
        } else {
          pPr = pPr.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>');
        }
      } else {
        pPr = pPr.replace(/<w:jc[^>]*\/>/, '<w:jc w:val="center"/>');
      }

      const rPrMatch = pPr.match(/<w:rPr(?:\s[^>]*)?>[\s\S]*?<\/w:rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : '<w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>';

      return `<w:tc>${tcPr}<w:p>${pPr}<w:r>${rPr}<w:t>X</w:t></w:r></w:p></w:tc>`;
    };

    for (let i = 0; i < totalItems; i++) {
      const item = list[i] || null;
      const isCloned = i >= 10;
      const baseRowXml = isCloned ? row10Template : rows[i + 2];
      const cells = parseCells(baseRowXml);

      if (cells.length < 5) {
        dataRows.push(baseRowXml);
        continue;
      }

      const trOpenMatch = baseRowXml.match(/^<w:tr(?:\s[^>]*)?>/);
      const trOpen = trOpenMatch ? trOpenMatch[0] : "<w:tr>";
      const trPrMatch = baseRowXml.match(/<w:trPr(?:\s[^>]*)?>[\s\S]*?<\/w:trPr>/);
      const trPr = trPrMatch ? trPrMatch[0] : "";

      // Cellule 0 : Numéro
      let c0 = cells[0];
      if (isCloned) {
        c0 = c0.replace(/<w:t>\d+<\/w:t>/, `<w:t>${i + 1}</w:t>`);
      }

      // Cellules 1 à 3 : P, O, M
      const typeCode = String(item?.type || item?.category || "").toUpperCase();
      const typeParts = typeCode.split(/[^A-Z]+/).filter(Boolean);
      const isP = Boolean(item && (item.p || typeCode === "P" || typeParts.includes("P") || typeCode.includes("PEDAGOGIQUE")));
      const isO = Boolean(item && (item.o || typeCode === "O" || typeParts.includes("O") || typeCode.includes("ORGANISATIONNEL")));
      const isM = Boolean(item && (item.m || typeCode === "M" || typeParts.includes("M") || typeCode.includes("MATERIEL")));

      const c1 = formatCheckCell(cells[1], isP);
      const c2 = formatCheckCell(cells[2], isO);
      const c3 = formatCheckCell(cells[3], isM);

      // Cellule 4 : Description
      const desc = item ? (item.description || item.texte || "") : "";
      const c4 = fillCellWithText(cells[4], desc);

      dataRows.push(`${trOpen}${trPr}${c0}${c1}${c2}${c3}${c4}</w:tr>`);
    }

    const tblOpenMatch = tblXml.match(/^<w:tbl(?:\s[^>]*)?>/);
    const tblOpen = tblOpenMatch ? tblOpenMatch[0] : "<w:tbl>";
    const tblPrMatch = tblXml.match(/<w:tblPr(?:\s[^>]*)?>[\s\S]*?<\/w:tblPr>/);
    const tblPr = tblPrMatch ? tblPrMatch[0] : "";
    const tblGridMatch = tblXml.match(/<w:tblGrid(?:\s[^>]*)?>[\s\S]*?<\/w:tblGrid>/);
    const tblGrid = tblGridMatch ? tblGridMatch[0] : "";

    return `${tblOpen}${tblPr}${tblGrid}${headerRows.join("")}${dataRows.join("")}</w:tbl>`;
  }

  /**
   * Remplit les paragraphes hors tableau "Date :" pour PV1 et PV2.
   */
  function fillPVDateParagraphs(docXml, docModel) {
    let updated = docXml;
    const isFinAnnee = docModel.moment === "FIN_ANNEE";

    // 1. PV1 Date paragraph
    const pv1Date = formatDocxDate(docModel.pv1?.date);
    if (pv1Date) {
      const pv1DateRegex = /(<w:p(?:\s[^>]*)?>[\s\S]*?<w:t>Date\s*[\u00A0:]*<\/w:t>[\s\S]*?<w:t[^>]*>\s*<\/w:t><\/w:r>)(<\/w:p>)/;
      const m1 = updated.match(pv1DateRegex);
      if (m1) {
        const dateRun = `<w:r><w:rPr><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="fr-FR"/></w:rPr><w:t>${xmlEsc(pv1Date)}</w:t></w:r>`;
        updated = updated.replace(pv1DateRegex, `$1${dateRun}$2`);
      }
    }

    // 2. PV2 Date paragraph (paraId="201538B4" ou paragraphe "Date :" situé après T5)
    if (isFinAnnee) {
      const pv2Date = formatDocxDate(docModel.pv2?.date);
      if (pv2Date) {
        const pv2DateRegex = /(<w:p[^>]*?(?:paraId="201538B4"[^>]*>[\s\S]*?|<w:pPr>[\s\S]*?)<w:t>Date\s*[\u00A0:]*<\/w:t><\/w:r>)(<\/w:p>)/;
        const m2 = updated.match(pv2DateRegex);
        if (m2) {
          const dateRun = `<w:r><w:rPr><w:rFonts w:cstheme="minorHAnsi"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="fr-FR"/></w:rPr><w:t xml:space="preserve"> ${xmlEsc(pv2Date)}</w:t></w:r>`;
          updated = updated.replace(pv2DateRegex, `$1${dateRun}$2`);
        }
      }
    }

    return updated;
  }

  /**
   * Fonction principale orchestrant le remplissage de PV1, PV2 et des deux tableaux d'aménagements.
   */
  function fillOfficialPIADocxPvAndAmenagements(docXml, docModel) {
    if (!docModel) return docXml;

    const tblRegex = /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>/g;
    const tables = [];
    let match;
    while ((match = tblRegex.exec(docXml))) {
      tables.push(match[0]);
    }

    if (tables.length < 8) {
      return docXml;
    }

    const isFinAnnee = docModel.moment === "FIN_ANNEE";

    // Tableaux 0 à 7 correspondent exactement à T1 à T8
    const t3Original = tables[2];
    const t4Original = tables[3];
    const t5Original = tables[4];
    const t6Original = tables[5];
    const t7Original = tables[6];
    const t8Original = tables[7];

    const newT3 = fillPersonnesPresentesTable(t3Original, docModel.pv1?.personnesPresentes);
    const newT4 = fillT4PV1Table(t4Original, docModel.pv1);
    const newT5 = fillAmenagementsTable(t5Original, docModel.t5_amenagements, false, isFinAnnee);

    let newT6 = t6Original;
    let newT7 = t7Original;
    let newT8 = t8Original;

    if (isFinAnnee) {
      newT6 = fillPersonnesPresentesTable(t6Original, docModel.pv2?.personnesPresentes);
      newT7 = fillT7PV2Table(t7Original, docModel.pv2, true);
      newT8 = fillAmenagementsTable(t8Original, docModel.t8_amenagements, true, true);
    }

    let updatedXml = docXml;
    updatedXml = updatedXml.replace(t3Original, newT3);
    updatedXml = updatedXml.replace(t4Original, newT4);
    updatedXml = updatedXml.replace(t5Original, newT5);
    updatedXml = updatedXml.replace(t6Original, newT6);
    updatedXml = updatedXml.replace(t7Original, newT7);
    updatedXml = updatedXml.replace(t8Original, newT8);

    updatedXml = fillPVDateParagraphs(updatedXml, docModel);

    return updatedXml;
  }

  const exportsObj = {
    fillCellWithText,
    fillPersonnesPresentesTable,
    fillT4PV1Table,
    fillT7PV2Table,
    fillAmenagementsTable,
    fillPVDateParagraphs,
    fillOfficialPIADocxPvAndAmenagements,
    formatDocxDate
  };

  if (typeof globalThis !== "undefined") {
    globalThis.JournalierDocxPv = exportsObj;
  }
  if (global) {
    global.JournalierDocxPv = exportsObj;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
