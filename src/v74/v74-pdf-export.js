/* =========================================================
   JOURNALIER V74 — PDF EXPORT ENGINE
   Module extrait de v74-runtime.js (Lot 3.3)
   Architecture local-first / 100% navigateur (RGPD)
   Générateur autonome PDF 1.4 multi-pages avec WinAnsi,
   tableaux, bannières, pagination et mise en page A4.
   ========================================================= */

var WIN_ANSI_BYTE_MAP = Object.freeze({
  "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84, "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02C6": 0x88, "\u2030": 0x89,
  "\u0160": 0x8A, "\u2039": 0x8B, "\u0152": 0x8C, "\u017D": 0x8E, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93, "\u201D": 0x94, "\u2022": 0x95,
  "\u2013": 0x96, "\u2014": 0x97, "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9A, "\u203A": 0x9B, "\u0153": 0x9C, "\u017E": 0x9E, "\u0178": 0x9F
});

function safeArray(x) {
  return Array.isArray(x) ? x : [];
}

/**
 * Convertit une chaîne JavaScript UTF-16 en tableau d'octets compatibles WinAnsi (Windows-1252).
 * Préserve les caractères accentués, tirets cadratins, puces et guillemets.
 * @param {string} text
 * @returns {number[]}
 */
function encodePdfWinAnsiBytes(text) {
  const str = String(text || "")
    .replace(/\u202F/g, "\u00A0")
    .replace(/[\u2007\u2009\u200A\u200B]/g, " ")
    .replace(/[\u2010\u2011]/g, "-");
  const out = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const cp = str.charCodeAt(i);
    if (cp < 128) out.push(cp);
    else if (WIN_ANSI_BYTE_MAP[ch] != null) out.push(WIN_ANSI_BYTE_MAP[ch]);
    else if (cp <= 255) out.push(cp);
    else out.push(63); // '?' pour caractères non représentables
  }
  return out;
}

/**
 * Échappe une chaîne littérale pour syntaxe de flux PDF: (chaîne échappée)
 * @param {string} text
 * @returns {string}
 */
function formatPdfLiteral(text) {
  return "(" + String.fromCharCode(...encodePdfWinAnsiBytes(text).flatMap(b => (b === 40 || b === 41 || b === 92 ? [92, b] : [b]))) + ")";
}

/**
 * Découpe un texte en lignes ne dépassant pas maxChars sans couper les mots.
 * @param {string} text
 * @param {number} maxChars
 * @param {string} continuationIndent
 * @returns {string[]}
 */
function splitPdfTextLine(text, maxChars = 88, continuationIndent = "") {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [""];
  if (clean.length <= maxChars) return [clean];
  const words = clean.split(" ");
  const out = [];
  let current = "";
  for (const word of words) {
    const prefix = out.length > 0 ? continuationIndent : "";
    const limit = Math.max(28, maxChars - prefix.length);
    if (word.length > limit) {
      if (current) {
        out.push((out.length > 0 ? continuationIndent : "") + current);
        current = "";
      }
      for (let i = 0; i < word.length; i += limit) {
        out.push((out.length > 0 ? continuationIndent : "") + word.slice(i, i + limit));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= limit) {
      current = candidate;
    } else {
      if (current) out.push((out.length > 0 ? continuationIndent : "") + current);
      current = word;
    }
  }
  if (current) out.push((out.length > 0 ? continuationIndent : "") + current);
  return out;
}

/**
 * Assemble un fichier PDF binaire valide (PDF 1.4) à partir de flux de commandes de pages.
 * @param {Array<string|{content:string,width?:number,height?:number}>} pageStreams
 * @param {object} [options]
 * @returns {Uint8Array}
 */
function assemblePdfFromPageContents(pageStreams, options = {}) {
  const objs = [];
  const add = x => { objs.push(x); return objs.length; };
  const fontRegularId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const fontBoldId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  
  const pageSpecs = safeArray(pageStreams).map(item => {
    if (typeof item === "string") {
      return { content: item, width: 595, height: 842 };
    }
    return {
      content: item?.content || "",
      width: Number(item?.width || 595),
      height: Number(item?.height || 842)
    };
  });

  const contentIds = pageSpecs.map(p => add(`<< /Length ${p.content.length} >>\nstream\n${p.content}\nendstream`));
  const pagesId = add("");
  const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
  const pageObjects = contentIds.map((contentId, idx) => {
    const p = pageSpecs[idx];
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${p.width} ${p.height}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`);
  });
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${pageObjects.map(id => `${id} 0 R`).join(" ")}] /Count ${pageObjects.length} >>`;

  const safeTitle = options.title ? formatPdfLiteral(options.title) : "(Plan Individuel d\\’Apprentissage)";
  const safeAuthor = options.author ? formatPdfLiteral(options.author) : "(P\\xF4le Territorial WBE BXL)";
  const safeCreator = options.creator ? formatPdfLiteral(options.creator) : "(Journalier V74)";
  const safeProducer = options.producer ? formatPdfLiteral(options.producer) : "(Journalier V74)";
  const infoId = add(`<< /Title ${safeTitle} /Author ${safeAuthor} /Creator ${safeCreator} /Producer ${safeProducer} >>`);

  let out = "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n", offsets = [0];
  for (let i = 0; i < objs.length; i++) {
    offsets[i + 1] = out.length;
    out += `${i + 1} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) out += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Uint8Array.from([...out].map(c => c.charCodeAt(0) & 255));
}

/**
 * Construit un document PDF multi-pages à partir d'un modèle documentaire structuré (PIA).
 * @param {object} model
 * @returns {Uint8Array}
 */
function buildPdfModelDocument(model) {
  const marginX = 42;
  const contentW = 511; // 595 - 84
  const yTopFirst = 798;
  const yTopNext = 768;
  const yBottom = 56;
  const pages = [];
  let cur = { graphics: [], texts: [] };
  let y = yTopFirst;

  // Injection invisible en début de document des marqueurs canoniques pour extractPIAStructure(extractPdfText)
  const canonicalLines = safeArray(model.lines);
  if (canonicalLines.length) {
    canonicalLines.forEach(line => {
      const clean = String(line || "").trim();
      if (!clean) return;
      cur.texts.push({ x: marginX, y: 8, text: clean, font: "F1", size: 0.5, colorRgb: "1 1 1" });
    });
  }

  const pushPage = () => {
    pages.push(cur);
    cur = { graphics: [], texts: [] };
    y = yTopNext;
  };
  const ensureSpace = h => {
    if (y - h < yBottom && (cur.graphics.length > 0 || cur.texts.length > 0)) {
      pushPage();
      return true;
    }
    return false;
  };
  const addRect = (x, ry, w, h, fillRgb, strokeRgb, lineWidth = 0.6) => {
    const ops = ["q"];
    if (lineWidth) ops.push(`${lineWidth} w`);
    if (fillRgb) ops.push(`${fillRgb} rg`);
    if (strokeRgb) ops.push(`${strokeRgb} RG`);
    const cmd = fillRgb && strokeRgb ? "B" : (fillRgb ? "f" : "S");
    ops.push(`${Number(x.toFixed(2))} ${Number(ry.toFixed(2))} ${Number(w.toFixed(2))} ${Number(h.toFixed(2))} re ${cmd}`);
    ops.push("Q");
    cur.graphics.push(ops.join(" "));
  };
  const addText = (x, ty, text, font = "F1", size = 9.5, colorRgb = "0.12 0.16 0.22") => {
    const str = String(text ?? "").trim();
    if (!str) return;
    cur.texts.push({ x: Number(x.toFixed(2)), y: Number(ty.toFixed(2)), text: str, font, size, colorRgb });
  };

  const renderTableToPdf = tableSpec => {
    if (tableSpec.title) {
      ensureSpace(32);
      y -= 6;
      addText(marginX, y - 10, tableSpec.title, "F2", 10.5, "0.12 0.23 0.54");
      y -= 18;
    }
    const headers = safeArray(tableSpec.headers);
    const rows = safeArray(tableSpec.rows);
    const colCount = Math.max(1, (headers.length || rows[0]?.length || 1));
    const colWidthsPct = safeArray(tableSpec.colWidths);
    const colW = Array.from({ length: colCount }, (_, i) => {
      const pct = colWidthsPct[i] || (100 / colCount);
      return Number(((pct / 100) * contentW).toFixed(2));
    });
    const colX = [];
    let accX = marginX;
    for (let i = 0; i < colCount; i++) { colX.push(accX); accX += colW[i]; }

    const drawHeaderRow = () => {
      if (!headers.length) return;
      const cellLines = headers.map((h, i) => {
        const maxCh = Math.max(6, Math.floor((colW[i] - 10) / 4.8));
        return splitPdfTextLine(String(h || ""), maxCh, "");
      });
      const maxLines = Math.max(1, ...cellLines.map(l => l.length));
      const rowH = maxLines * 11.5 + 10;
      ensureSpace(rowH + 18);
      for (let i = 0; i < colCount; i++) {
        addRect(colX[i], y - rowH, colW[i], rowH, "0.12 0.23 0.54", "0.78 0.83 0.89", 0.5);
        cellLines[i].forEach((ln, lIdx) => {
          addText(colX[i] + 5, y - 11 - (lIdx * 11.5), ln, "F2", 8.8, "1 1 1");
        });
      }
      y -= rowH;
    };

    drawHeaderRow();

    rows.forEach((row, rowIdx) => {
      const cellWrapped = Array.from({ length: colCount }, (_, colIdx) => {
        const cell = row[colIdx];
        const isShortCol = colWidthsPct[colIdx] && colWidthsPct[colIdx] <= 10;
        const isFirstCol = colIdx === 0;
        const maxCh = isShortCol ? Math.max(4, Math.floor((colW[colIdx] - 8) / 5.0)) : Math.max(28, Math.floor((colW[colIdx] - 8) / 3.9));
        const isArrayCell = cell && typeof cell === "object" && typeof cell.length === "number";
        const rawItems = isArrayCell ? safeArray(cell).filter(Boolean) : [String(cell ?? "")];
        const linesOut = [];
        rawItems.forEach(item => {
          const str = String(item ?? "").trim();
          if (!str) return;
          const prefixed = (rawItems.length > 1 && !isFirstCol && !isShortCol && !/^[•●▪-]/.test(str)) ? `• ${str}` : str;
          const wrapped = splitPdfTextLine(prefixed, maxCh, prefixed.startsWith("• ") ? "  " : "");
          linesOut.push(...wrapped);
        });
        return linesOut.length ? linesOut : [""];
      });
      const maxLines = Math.max(1, ...cellWrapped.map(l => l.length));
      const rowH = maxLines * 11.2 + 9;
      if (y - rowH < yBottom && (cur.graphics.length > 0 || cur.texts.length > 0)) {
        pushPage();
        drawHeaderRow();
      }
      const fillRgb = rowIdx % 2 === 1 ? "0.97 0.98 0.99" : "1 1 1";
      for (let colIdx = 0; colIdx < colCount; colIdx++) {
        const isFirstCol = colIdx === 0;
        const isShortCol = colWidthsPct[colIdx] && colWidthsPct[colIdx] <= 10;
        const cellFill = isFirstCol ? (tableSpec.firstColFillRgb || "0.95 0.97 1") : fillRgb;
        addRect(colX[colIdx], y - rowH, colW[colIdx], rowH, cellFill, "0.82 0.86 0.91", 0.45);
        cellWrapped[colIdx].forEach((ln, lIdx) => {
          const xOffset = isShortCol ? Math.max(4, (colW[colIdx] - ln.length * 4.8) / 2) : 5;
          addText(
            colX[colIdx] + xOffset,
            y - 10.5 - (lIdx * 11.2),
            ln,
            isFirstCol || isShortCol ? "F2" : "F1",
            8.6,
            isFirstCol ? "0.11 0.18 0.32" : "0.14 0.18 0.24"
          );
        });
      }
      y -= rowH;
    });
    y -= 8;
  };

  for (const block of safeArray(model.blocks)) {
    if (block.type === "header_banner") {
      ensureSpace(95);
      const bannerH = 54;
      addRect(marginX, y - bannerH, contentW, bannerH, "0.94 0.97 1", "0.15 0.39 0.92", 0.9);
      addRect(marginX, y - bannerH, 4.5, bannerH, "0.15 0.39 0.92", null, 0);
      addText(marginX + 12, y - 13, block.kicker || "PLAN INDIVIDUEL D’APPRENTISSAGE", "F2", 7.8, "0.15 0.39 0.92");
      addText(marginX + 12, y - 29, block.title || "PIA annuel — document professionnel", "F2", 12.5, "0.06 0.09 0.16");
      addText(marginX + 12, y - 43, `${block.subtitle || ""} · Statut : ${block.statusBadge || ""}`, "F1", 8.8, "0.25 0.32 0.42");
      y -= bannerH + 6;
      if (safeArray(block.metaRows).length) {
        renderTableToPdf({
          colWidths: [18, 32, 20, 30],
          firstColFillRgb: "0.94 0.97 1",
          rows: block.metaRows
        });
      }
      continue;
    }
    if (block.type === "callout") {
      const linesOut = [];
      safeArray(block.lines).forEach(line => {
        linesOut.push(...splitPdfTextLine(line, 96, ""));
      });
      const boxH = (block.title ? 14 : 0) + linesOut.length * 11.5 + 10;
      ensureSpace(boxH + 8);
      const fill = block.tone === "warning" ? "1 0.98 0.92" : (block.tone === "info" ? "0.95 0.97 1" : "0.97 0.98 0.99");
      const border = block.tone === "warning" ? "0.96 0.62 0.04" : (block.tone === "info" ? "0.15 0.39 0.92" : "0.75 0.80 0.86");
      addRect(marginX, y - boxH, contentW, boxH, fill, border, 0.6);
      let ty = y - 11;
      if (block.title) {
        addText(marginX + 8, ty, block.title, "F2", 9, "0.12 0.23 0.54");
        ty -= 12.5;
      }
      linesOut.forEach(ln => {
        addText(marginX + 8, ty, ln, "F1", 8.5, "0.18 0.23 0.30");
        ty -= 11.5;
      });
      y -= boxH + 8;
      continue;
    }
    if (block.type === "kpi_grid") {
      const items = safeArray(block.items);
      if (!items.length) continue;
      const boxH = 38;
      ensureSpace(boxH + 8);
      const gap = 6;
      const cardW = (contentW - (gap * (items.length - 1))) / items.length;
      items.forEach((it, idx) => {
        const cx = marginX + idx * (cardW + gap);
        addRect(cx, y - boxH, cardW, boxH, "0.96 0.98 1", "0.80 0.86 0.94", 0.5);
        addText(cx + 7, y - 12, it.label || "","F2", 7.6, "0.35 0.43 0.54");
        addText(cx + 7, y - 25, String(it.value ?? ""), "F2", 11.5, "0.10 0.22 0.52");
        if (it.sub) addText(cx + 32, y - 25, it.sub, "F1", 7.4, "0.38 0.45 0.55");
      });
      y -= boxH + 8;
      continue;
    }
    if (block.type === "section_title") {
      ensureSpace(34);
      y -= 4;
      const barH = 19;
      addRect(marginX, y - barH, contentW, barH, "0.93 0.96 1", "0.75 0.83 0.95", 0.5);
      addRect(marginX, y - barH, 3.5, barH, "0.12 0.23 0.54", null, 0);
      const label = block.number ? `${block.number}. ${block.title}` : block.title;
      addText(marginX + 9, y - 13, label, "F2", 10.2, "0.10 0.20 0.48");
      y -= barH + 5;
      continue;
    }
    if (block.type === "table") {
      renderTableToPdf(block);
      continue;
    }
  }

  if (cur.graphics.length > 0 || cur.texts.length > 0 || pages.length === 0) {
    pages.push(cur);
  }

  const totalPages = pages.length;
  const pageStreams = pages.map((p, idx) => {
    const streamParts = [];
    if (idx > 0) {
      // En-tête courant à partir de la page 2
      streamParts.push(`q 0.82 0.86 0.91 RG 0.5 w ${marginX} 782 m ${marginX + contentW} 782 l S Q`);
    }
    streamParts.push(...p.graphics);
    // Pied de page : ligne de séparation
    streamParts.push(`q 0.85 0.88 0.92 RG 0.4 w ${marginX} 44 m ${marginX + contentW} 44 l S Q`);

    const btOps = ["BT"];
    let lastX = 0, lastY = 0;
    const moveTo = (tx, ty) => {
      const dx = Number((tx - lastX).toFixed(2));
      const dy = Number((ty - lastY).toFixed(2));
      btOps.push(`${dx} ${dy} Td`);
      lastX = tx;
      lastY = ty;
    };
    if (idx > 0) {
      moveTo(marginX, 787);
      btOps.push("/F2 7.8 Tf 0.38 0.45 0.55 rg");
      const headerRight = model.deidentified ? "Modèle dé-identifié" : [model.studentName, model.schoolYear].filter(Boolean).join(" · ");
      btOps.push(`${formatPdfLiteral(`${model.title}${headerRight ? ` — ${headerRight}` : ""}`)} Tj`);
    }
    for (const item of p.texts) {
      moveTo(item.x, item.y);
      btOps.push(`/${item.font} ${item.size} Tf`);
      if (item.colorRgb) btOps.push(`${item.colorRgb} rg`);
      btOps.push(`${formatPdfLiteral(item.text)} Tj`);
    }
    // Pied de page numéroté
    moveTo(marginX, 33);
    btOps.push("/F1 8 Tf 0.40 0.47 0.56 rg");
    btOps.push(`${formatPdfLiteral(`Document généré par Journalier · ${model.statusLabel || "PIA annuel"}`)} Tj`);
    moveTo(marginX + contentW - 56, 33);
    btOps.push("/F2 8.2 Tf 0.25 0.32 0.42 rg");
    btOps.push(`${formatPdfLiteral(`Page ${idx + 1} / ${totalPages}`)} Tj`);
    btOps.push("ET");
    streamParts.push(btOps.join("\n"));
    return streamParts.join("\n");
  });

  return assemblePdfFromPageContents(pageStreams);
}

/**
 * Fonction principale de génération PDF : accepte soit un modèle documentaire, soit un tableau de lignes.
 * @param {object|string[]} linesOrModel
 * @param {function} [buildModelFallback]
 * @returns {Uint8Array}
 */
function generatePdfDocument(linesOrModel, buildModelFallback) {
  if (linesOrModel && typeof linesOrModel === "object" && typeof linesOrModel.length !== "number") {
    const model = linesOrModel.isPIADocumentModel
      ? linesOrModel
      : (typeof buildModelFallback === "function" ? buildModelFallback(linesOrModel, linesOrModel.type === "PIA_MODELE_DEIDENTIFIE") : linesOrModel);
    return buildPdfModelDocument(model);
  }
  const lines = safeArray(linesOrModel);
  const physicalItems = [];
  let firstNonEmptySeen = false;

  const classifier = (typeof globalThis.JournalierDocx !== "undefined" && typeof globalThis.JournalierDocx.classifyDocumentLine === "function")
    ? globalThis.JournalierDocx.classifyDocumentLine
    : (typeof classifyDocumentLine === "function" ? classifyDocumentLine : (line, idx) => (idx === 0 ? "title" : "body"));

  for (const rawLine of lines) {
    const trimmed = String(rawLine ?? "").trim();
    if (!trimmed) {
      physicalItems.push({ kind: "empty", text: "", font: "F1", size: 10, leading: 8, before: 0 });
      continue;
    }
    const logicalIdx = firstNonEmptySeen ? 1 : 0;
    firstNonEmptySeen = true;
    const kind = classifier(trimmed, logicalIdx);
    if (kind === "title") {
      const wrapped = splitPdfTextLine(trimmed, 70, "");
      wrapped.forEach((seg, idx) => physicalItems.push({ kind: "title", text: seg, font: "F2", size: 13, leading: 18, before: idx === 0 ? 4 : 0 }));
      physicalItems.push({ kind: "empty", text: "", font: "F1", size: 10, leading: 6, before: 0 });
    } else if (kind === "h1") {
      const wrapped = splitPdfTextLine(trimmed, 76, "");
      wrapped.forEach((seg, idx) => physicalItems.push({ kind: "h1", text: seg, font: "F2", size: 11.5, leading: 16, before: idx === 0 ? 8 : 0 }));
    } else if (kind === "h2") {
      const wrapped = splitPdfTextLine(trimmed, 82, "");
      wrapped.forEach((seg, idx) => physicalItems.push({ kind: "h2", text: seg, font: "F2", size: 10.5, leading: 14.5, before: idx === 0 ? 5 : 0 }));
    } else if (kind === "bullet") {
      const wrapped = splitPdfTextLine(trimmed, 86, "  ");
      wrapped.forEach(seg => physicalItems.push({ kind: "bullet", text: seg, font: "F1", size: 10, leading: 13.5, before: 0 }));
    } else if (kind === "kv") {
      const wrapped = splitPdfTextLine(trimmed, 86, "  ");
      wrapped.forEach(seg => physicalItems.push({ kind: "kv", text: seg, font: "F1", size: 10, leading: 13.5, before: 0 }));
    } else {
      const wrapped = splitPdfTextLine(trimmed, 88, "");
      wrapped.forEach(seg => physicalItems.push({ kind: "body", text: seg, font: "F1", size: 10, leading: 13.5, before: 0 }));
    }
  }
  const pages = [];
  let currentPage = [];
  let y = 785;
  const yMin = 85;
  for (const item of physicalItems) {
    if (item.kind === "empty" && currentPage.length === 0) continue;
    const needed = (item.before || 0) + (item.leading || 14);
    if (y - needed < yMin && currentPage.length > 0) {
      pages.push(currentPage);
      currentPage = [];
      y = 785;
      if (item.kind === "empty") continue;
    }
    y -= (item.before || 0);
    currentPage.push({ ...item, y });
    y -= (item.leading || 14);
  }
  if (currentPage.length > 0 || pages.length === 0) pages.push(currentPage);

  const totalPages = pages.length;
  const pageStreams = pages.map((pageItems, pageIdx) => {
    const ops = ["BT"];
    let lastY = 785;
    ops.push(`50 ${lastY} Td`);
    for (const item of pageItems) {
      const dy = Number((item.y - lastY).toFixed(2));
      if (dy !== 0) ops.push(`0 ${dy} Td`);
      lastY = item.y;
      if (item.text) {
        ops.push(`/${item.font} ${item.size} Tf`);
        ops.push(`${formatPdfLiteral(item.text)} Tj`);
      }
    }
    const footerY = 36;
    const dyFooter = Number((footerY - lastY).toFixed(2));
    ops.push(`0 ${dyFooter} Td`);
    ops.push(`/F1 8.5 Tf`);
    ops.push(`${formatPdfLiteral(`Page ${pageIdx + 1} / ${totalPages}`)} Tj`);
    ops.push("ET");
    return ops.join("\n");
  });
  return assemblePdfFromPageContents(pageStreams);
}

/**
 * Génère le tracé vectoriel PDF natif du logo officiel des Pôles territoriaux.
 * @param {number} x
 * @param {number} y
 * @param {number} targetWidth
 * @returns {string}
 */
function drawOfficialLogoOps(x, y, targetWidth = 40) {
  const scale = targetWidth / 240;
  const targetHeight = 165 * scale;
  return [
    "q",
    `${scale.toFixed(4)} 0 0 -${scale.toFixed(4)} ${x.toFixed(2)} ${(y + targetHeight).toFixed(2)} cm`,
    "0.784 0.125 0.153 rg",
    "52 44.5 m 60 44.5 66.5 51 66.5 59 c 66.5 67 60 73.5 52 73.5 c 44 73.5 37.5 67 37.5 59 c 37.5 51 44 44.5 52 44.5 c f",
    "22 120 m 27 98 40 79 51 79 c 61 79 71 95 76 112 c 62 103 47 104 22 120 c h f",
    "0.961 0.659 0 rg",
    "99 23 m 107 23 113.5 30 113.5 39 c 113.5 48 107 55 99 55 c 91 55 84.5 48 84.5 39 c 84.5 30 91 23 99 23 c f",
    "72 106 m 73 82 81 59 93 59 c 104 59 118 78 132 98 c 134 101 131 103 128 101 c 113 91 95 92 77 107 c 74 109 72 108 72 106 c h f",
    "0 0.118 0.384 rg",
    "148 11.5 m 156 11.5 162.5 18.5 162.5 27 c 162.5 35.5 156 42.5 148 42.5 c 140 42.5 133.5 35.5 133.5 27 c 133.5 18.5 140 11.5 148 11.5 c f",
    "128 89 m 128 65 136 47 152 47 c 168 47 189 58 202 70 c 205 73 203 75 198 75 c 175 73 153 77 135 95 c 131 99 128 95 128 89 c h f",
    "0.784 0.125 0.153 rg",
    "17 123 m 78 134 156 108 228 54 c 235 49 240 53 236 61 c 188 120 102 146 17 123 c h f",
    "Q"
  ].join("\n");
}

function formatPdfDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return "";
  const m = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return dateStr.trim();
}

/**
 * Construit le document officiel PIA conforme au modèle officiel WBE en PDF 1.4 autonome.
 * Page 1 en Paysage (A4 842x595), Pages 2+ en Portrait (A4 595x842).
 * Source unique : lit le modèle intermédiaire issu de buildOfficialPIADocumentModel.
 * @param {object} docModel
 * @returns {Uint8Array}
 */
function buildOfficialPdfDocument(docModel) {
  if (!docModel) throw new Error("Modèle documentaire PIA absent.");
  if (!docModel.isPIADocumentModel) throw new Error("Modèle documentaire PIA invalide.");

  const aspectsList = [
    "Physique et psychomoteur",
    "Lié à l’autonomie",
    "Comportemental et affectif",
    "Communication",
    "Cognitif (pédagogique)"
  ];
  const t2Aspects = safeArray(docModel.t2_aspects);
  for (const aspName of aspectsList) {
    const found = t2Aspects.find(a => String(a.aspect || "").toLowerCase().includes(aspName.slice(0, 8).toLowerCase()));
    if (!found) {
      throw new Error("Libellé introuvable dans le modèle officiel : " + aspName);
    }
  }

  const isFinAnnee = String(docModel.moment || "").toUpperCase() === "FIN_ANNEE";

  const addRect = (page, x, ry, w, h, fillRgb, strokeRgb, lineWidth = 0.5) => {
    const ops = ["q"];
    if (lineWidth) ops.push(`${lineWidth} w`);
    if (fillRgb) ops.push(`${fillRgb} rg`);
    if (strokeRgb) ops.push(`${strokeRgb} RG`);
    const cmd = fillRgb && strokeRgb ? "B" : (fillRgb ? "f" : "S");
    ops.push(`${Number(x.toFixed(2))} ${Number(ry.toFixed(2))} ${Number(w.toFixed(2))} ${Number(h.toFixed(2))} re ${cmd}`);
    ops.push("Q");
    page.graphics.push(ops.join(" "));
  };

  const addText = (page, x, ty, text, font = "F1", size = 8.5, colorRgb = "0.12 0.16 0.22") => {
    const str = String(text ?? "").trim();
    if (!str) return;
    page.texts.push({ x: Number(x.toFixed(2)), y: Number(ty.toFixed(2)), text: str, font, size, colorRgb });
  };

  // --- PAGE 1 : PAYSAGE (842 x 595) ---
  const p1 = { width: 842, height: 595, graphics: [], texts: [] };
  const mX1 = 42;
  const cW1 = 758;

  // En-tête Année scolaire
  addText(p1, mX1 + cW1 - 65, 566, docModel.headerYear || (() => { const d = new Date(), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${y + 1}`; })(), "F2", 9, "0.3 0.35 0.45");

  // Titre officiel
  addText(p1, mX1, 552, "Plan Individuel d’Apprentissage", "F2", 14, "0.08 0.12 0.22");

  // Tableau T1 : Identité
  let y1 = 534;
  const colW1 = [148, 231, 148, 231];
  const colX1 = [42, 190, 421, 569];

  const t1Data = [
    ["Nom et prénom de l’élève :", docModel.t1_identite?.nom || docModel.t1_identite?.eleve || "", "Classe et option :", docModel.t1_identite?.classeEtOption || docModel.t1_identite?.classeOption || ""],
    ["Date de naissance :", formatPdfDate(docModel.t1_identite?.dateNaissance), "Titulaire :", docModel.t1_identite?.titulaire || ""],
    ["Coordonnées de l’école :", docModel.t1_identite?.coordonneesEcole || "", "Coordonnées du CPMS coopérant :", docModel.t1_identite?.coordonneesCpms || ""],
    ["Représentant du Pôle Territorial :", docModel.t1_identite?.representantPole || "Pôle Territorial WBE BXL", "Coordonnées du responsable de l’élève :", docModel.t1_identite?.coordonneesResponsable || ""]
  ];

  t1Data.forEach(row => {
    const v1Lines = splitPdfTextLine(row[1], 46, "");
    const v2Lines = splitPdfTextLine(row[3], 46, "");
    const maxL = Math.max(1, v1Lines.length, v2Lines.length);
    const rowH = Math.max(19, maxL * 10 + 6);

    // Cellules libellés (0 et 2)
    addRect(p1, colX1[0], y1 - rowH, colW1[0], rowH, "0.95 0.96 0.98", "0.78 0.82 0.88", 0.5);
    addText(p1, colX1[0] + 5, y1 - 12, row[0], "F2", 8.2, "0.15 0.20 0.32");

    addRect(p1, colX1[2], y1 - rowH, colW1[2], rowH, "0.95 0.96 0.98", "0.78 0.82 0.88", 0.5);
    addText(p1, colX1[2] + 5, y1 - 12, row[2], "F2", 8.2, "0.15 0.20 0.32");

    // Cellules valeurs (1 et 3)
    addRect(p1, colX1[1], y1 - rowH, colW1[1], rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
    v1Lines.forEach((ln, lIdx) => {
      addText(p1, colX1[1] + 5, y1 - 12 - (lIdx * 9.8), ln, "F1", 8.2, "0.12 0.16 0.22");
    });

    addRect(p1, colX1[3], y1 - rowH, colW1[3], rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
    v2Lines.forEach((ln, lIdx) => {
      addText(p1, colX1[3] + 5, y1 - 12 - (lIdx * 9.8), ln, "F1", 8.2, "0.12 0.16 0.22");
    });

    y1 -= rowH;
  });

  // Tableau T2 : 5 Aspects
  y1 -= 10;
  const colW2 = [142, 205, 205, 206];
  const colX2 = [42, 184, 389, 594];
  const t2Headers = ["Aspect", "Ressources", "Difficultés", "Objectifs à poursuivre"];

  // En-têtes T2
  const hH2 = 18;
  for (let c = 0; c < 4; c++) {
    addRect(p1, colX2[c], y1 - hH2, colW2[c], hH2, "0.12 0.23 0.54", "0.78 0.82 0.88", 0.5);
    addText(p1, colX2[c] + 6, y1 - 12.5, t2Headers[c], "F2", 8.5, "1 1 1");
  }
  y1 -= hH2;

  // Lignes des 5 aspects
  t2Aspects.forEach((asp, rowIdx) => {
    const aspLabel = String(asp.aspect || "").trim();
    const cleanAsp = aspLabel.endsWith(":") || aspLabel.endsWith("\u00A0:") ? aspLabel : `${aspLabel}\u00A0:`;
    const resLines = safeArray(String(asp.ressources || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 40, ""))).filter(Boolean);
    const diffLines = safeArray(String(asp.difficultes || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 40, ""))).filter(Boolean);
    const objLines = safeArray(String(asp.objectifs || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 40, ""))).filter(Boolean);

    const maxL = Math.max(1, resLines.length, diffLines.length, objLines.length);
    const rowH = Math.max(26, maxL * 10.2 + 8);
    const fillRgb = rowIdx % 2 === 1 ? "0.98 0.99 1" : "1 1 1";

    // Col 0: Aspect
    addRect(p1, colX2[0], y1 - rowH, colW2[0], rowH, "0.95 0.97 1", "0.78 0.82 0.88", 0.5);
    addText(p1, colX2[0] + 6, y1 - 13, cleanAsp, "F2", 8.2, "0.11 0.18 0.32");

    // Col 1: Ressources
    addRect(p1, colX2[1], y1 - rowH, colW2[1], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    (resLines.length ? resLines : [""]).forEach((ln, lIdx) => {
      addText(p1, colX2[1] + 6, y1 - 13 - (lIdx * 10), ln, "F1", 8.2, "0.14 0.18 0.24");
    });

    // Col 2: Difficultés
    addRect(p1, colX2[2], y1 - rowH, colW2[2], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    (diffLines.length ? diffLines : [""]).forEach((ln, lIdx) => {
      addText(p1, colX2[2] + 6, y1 - 13 - (lIdx * 10), ln, "F1", 8.2, "0.14 0.18 0.24");
    });

    // Col 3: Objectifs
    addRect(p1, colX2[3], y1 - rowH, colW2[3], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    (objLines.length ? objLines : [""]).forEach((ln, lIdx) => {
      addText(p1, colX2[3] + 6, y1 - 13 - (lIdx * 10), ln, "F1", 8.2, "0.14 0.18 0.24");
    });

    y1 -= rowH;
  });

  // --- PAGES PORTRAIT (595 x 842) ---
  const portraitPages = [];
  const mXP = 42;
  const cWP = 511;
  const yTopP = 786;
  const yBottomP = 52;

  let curP = { width: 595, height: 842, graphics: [], texts: [] };
  let yP = yTopP;

  const pushPortraitPage = () => {
    portraitPages.push(curP);
    curP = { width: 595, height: 842, graphics: [], texts: [] };
    yP = yTopP;
    drawPortraitHeader();
  };

  const drawPortraitHeader = () => {
    addText(curP, mXP, 808, "Annexe 2", "F2", 9, "0.30 0.35 0.45");
    addText(curP, mXP + cWP - 50, 808, docModel.headerYear || (() => { const d = new Date(), y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${y + 1}`; })(), "F2", 9, "0.30 0.35 0.45");
    curP.graphics.push(`q 0.80 0.84 0.90 RG 0.5 w ${mXP} 800 m ${mXP + cWP} 800 l S Q`);
  };

  const ensurePortraitSpace = neededH => {
    if (yP - neededH < yBottomP) {
      pushPortraitPage();
      return true;
    }
    return false;
  };

  // En-tête de la première page portrait
  drawPortraitHeader();

  // 1. Procès-verbal 1
  ensurePortraitSpace(40);
  addText(curP, mXP, yP - 12, "Procès-verbal 1", "F2", 12.5, "0.10 0.15 0.30");
  yP -= 22;

  const pv1Date = formatPdfDate(docModel.pv1?.date);
  addText(curP, mXP, yP - 10, pv1Date ? `Date\u00A0: ${pv1Date}` : "Date\u00A0:", "F2", 9, "0.15 0.20 0.30");
  yP -= 18;

  addText(curP, mXP, yP - 10, "Personnes présentes :", "F2", 9, "0.15 0.20 0.30");
  yP -= 14;

  // Tableau des présents PV1 (3 colonnes)
  const pv1Present = safeArray(docModel.pv1?.personnesPresentes);
  const pv1PCount = Math.max(9, Math.ceil(pv1Present.length / 3) * 3);
  const pCols = [mXP, mXP + 170.3, mXP + 340.6];
  const pColW = 170.3;

  for (let i = 0; i < pv1PCount; i += 3) {
    ensurePortraitSpace(18);
    const rowH = 17;
    for (let c = 0; c < 3; c++) {
      const idx = i + c;
      const val = String(pv1Present[idx] || "");
      addRect(curP, pCols[c], yP - rowH, pColW, rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
      if (val) addText(curP, pCols[c] + 6, yP - 12, val, "F1", 8.2, "0.12 0.16 0.22");
    }
    yP -= rowH;
  }
  yP -= 8;

  // Tableau PV1 (Axe, Objectifs, Ressources, Retours)
  const drawPVBlock = (label, value) => {
    const valLines = safeArray(String(value || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 86, ""))).filter(Boolean);
    const rowH = Math.max(22, (valLines.length + 1) * 10 + 6);
    ensurePortraitSpace(rowH + 4);
    addRect(curP, mXP, yP - rowH, cWP, rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
    addText(curP, mXP + 6, yP - 11, label, "F2", 8.2, "0.15 0.20 0.32");
    valLines.forEach((ln, lIdx) => {
      addText(curP, mXP + 6, yP - 21 - (lIdx * 9.8), ln, "F1", 8.2, "0.12 0.16 0.22");
    });
    yP -= rowH;
  };

  drawPVBlock("Difficulté majeure se situe au niveau de l’axe :", docModel.pv1?.difficulteAxe);
  drawPVBlock("Objectifs visés pour la période et critères d’évaluation :", docModel.pv1?.objectifsCriteres);
  drawPVBlock("Ressources et moyens complémentaires :", docModel.pv1?.ressourcesMoyens);

  // Retours PV1 (3 lignes de 2 colonnes)
  const ret1 = docModel.pv1?.retours || {};
  const ret1Pairs = [
    [["Retours des parents :", ret1.parents], ["Retours de la direction et de l’équipe pédagogique :", ret1.directionEtEquipe]],
    [["Retours de l’élève :", ret1.eleve], ["Retours du centre PMS :", ret1.pms]],
    [["Retours de l’agent d’intégration :", ret1.integration], ["Retours des autres intervenants :", ret1.autres]]
  ];

  const halfW = cWP / 2;
  ret1Pairs.forEach(pair => {
    const lLines = safeArray(String(pair[0][1] || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 40, ""))).filter(Boolean);
    const rLines = safeArray(String(pair[1][1] || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 40, ""))).filter(Boolean);
    const rowH = Math.max(22, (Math.max(lLines.length, rLines.length) + 1) * 10 + 6);
    ensurePortraitSpace(rowH + 4);

    // Gauche
    addRect(curP, mXP, yP - rowH, halfW, rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
    addText(curP, mXP + 6, yP - 11, pair[0][0], "F2", 8.2, "0.15 0.20 0.32");
    lLines.forEach((ln, lIdx) => {
      addText(curP, mXP + 6, yP - 21 - (lIdx * 9.8), ln, "F1", 8.2, "0.12 0.16 0.22");
    });

    // Droite
    addRect(curP, mXP + halfW, yP - rowH, halfW, rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
    addText(curP, mXP + halfW + 6, yP - 11, pair[1][0], "F2", 8.2, "0.15 0.20 0.32");
    rLines.forEach((ln, lIdx) => {
      addText(curP, mXP + halfW + 6, yP - 21 - (lIdx * 9.8), ln, "F1", 8.2, "0.12 0.16 0.22");
    });

    yP -= rowH;
  });
  yP -= 10;

  // 2. Aménagements T5
  ensurePortraitSpace(40);
  addText(curP, mXP, yP - 12, "Aménagements proposés pour l’élève :", "F2", 10.5, "0.10 0.15 0.30");
  yP -= 20;

  const colWA = [26, 383, 34, 34, 34];
  const colXA = [mXP, mXP + 26, mXP + 409, mXP + 443, mXP + 477];
  const t5Headers = ["N°", "Description/modalité", "P", "O", "M"];

  // En-têtes T5
  ensurePortraitSpace(20);
  const hHA = 17;
  for (let c = 0; c < 5; c++) {
    addRect(curP, colXA[c], yP - hHA, colWA[c], hHA, "0.12 0.23 0.54", "0.78 0.82 0.88", 0.5);
    const isCheckHeader = c >= 2;
    const xOff = isCheckHeader ? (colWA[c] - 8) / 2 : 6;
    addText(curP, colXA[c] + xOff, yP - 12, t5Headers[c], "F2", 8.2, "1 1 1");
  }
  yP -= hHA;

  const t5List = safeArray(docModel.t5_amenagements);
  const t5Count = Math.max(10, t5List.length);

  for (let i = 0; i < t5Count; i++) {
    const item = t5List[i] || null;
    const descLines = safeArray(String(item?.description || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 64, ""))).filter(Boolean);
    const rowH = Math.max(16, descLines.length * 9.8 + 6);
    ensurePortraitSpace(rowH + 4);

    const fillRgb = i % 2 === 1 ? "0.98 0.99 1" : "1 1 1";

    // N°
    addRect(curP, colXA[0], yP - rowH, colWA[0], rowH, "0.95 0.96 0.98", "0.78 0.82 0.88", 0.5);
    addText(curP, colXA[0] + 7, yP - 11, String(i + 1), "F2", 8, "0.15 0.20 0.32");

    // Description
    addRect(curP, colXA[1], yP - rowH, colWA[1], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    (descLines.length ? descLines : [""]).forEach((ln, lIdx) => {
      addText(curP, colXA[1] + 6, yP - 11 - (lIdx * 9.8), ln, "F1", 8, "0.12 0.16 0.22");
    });

    // P, O, M
    const isP = Boolean(item && item.p);
    const isO = Boolean(item && item.o);
    const isM = Boolean(item && item.m);

    addRect(curP, colXA[2], yP - rowH, colWA[2], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    if (isP) addText(curP, colXA[2] + 13, yP - 11, "X", "F2", 8.5, "0.10 0.15 0.30");

    addRect(curP, colXA[3], yP - rowH, colWA[3], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    if (isO) addText(curP, colXA[3] + 13, yP - 11, "X", "F2", 8.5, "0.10 0.15 0.30");

    addRect(curP, colXA[4], yP - rowH, colWA[4], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    if (isM) addText(curP, colXA[4] + 13, yP - 11, "X", "F2", 8.5, "0.10 0.15 0.30");

    yP -= rowH;
  }

  ensurePortraitSpace(18);
  addText(curP, mXP, yP - 10, "* P = pédagogique     O = organisationnel      M = matériel", "F1", 7.6, "0.35 0.42 0.52");
  yP -= 18;

  // 3. Procès-verbal 2 (fin d'année)
  ensurePortraitSpace(40);
  addText(curP, mXP, yP - 12, "Procès-verbal 2 (fin d’année)", "F2", 12.5, "0.10 0.15 0.30");
  yP -= 22;

  const pv2Date = isFinAnnee ? formatPdfDate(docModel.pv2?.date) : "";
  addText(curP, mXP, yP - 10, pv2Date ? `Date\u00A0: ${pv2Date}` : "Date\u00A0:", "F2", 9, "0.15 0.20 0.30");
  yP -= 18;

  addText(curP, mXP, yP - 10, "Personnes présentes :", "F2", 9, "0.15 0.20 0.30");
  yP -= 14;

  const pv2Present = isFinAnnee ? safeArray(docModel.pv2?.personnesPresentes) : [];
  const pv2PCount = Math.max(9, Math.ceil(pv2Present.length / 3) * 3);

  for (let i = 0; i < pv2PCount; i += 3) {
    ensurePortraitSpace(18);
    const rowH = 17;
    for (let c = 0; c < 3; c++) {
      const idx = i + c;
      const val = isFinAnnee ? String(pv2Present[idx] || "") : "";
      addRect(curP, pCols[c], yP - rowH, pColW, rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
      if (val) addText(curP, pCols[c] + 6, yP - 12, val, "F1", 8.2, "0.12 0.16 0.22");
    }
    yP -= rowH;
  }
  yP -= 8;

  drawPVBlock("Objectifs visés pour la période 2 : évaluation", isFinAnnee ? docModel.pv2?.objectifsEvaluation : "");

  // Retours PV2
  const ret2 = isFinAnnee ? (docModel.pv2?.retours || {}) : {};
  const ret2Pairs = [
    [["Retours des parents :", isFinAnnee ? ret2.parents : ""], ["Retours de la direction et de l’équipe pédagogique :", isFinAnnee ? ret2.directionEtEquipe : ""]],
    [["Retours de l’élève :", isFinAnnee ? ret2.eleve : ""], ["Retours du centre PMS :", isFinAnnee ? ret2.pms : ""]],
    [["Retours de l’agent d’intégration :", isFinAnnee ? ret2.integration : ""], ["Retours des autres intervenants :", isFinAnnee ? ret2.autres : ""]]
  ];

  ret2Pairs.forEach(pair => {
    const lLines = safeArray(String(pair[0][1] || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 40, ""))).filter(Boolean);
    const rLines = safeArray(String(pair[1][1] || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 40, ""))).filter(Boolean);
    const rowH = Math.max(22, (Math.max(lLines.length, rLines.length) + 1) * 10 + 6);
    ensurePortraitSpace(rowH + 4);

    addRect(curP, mXP, yP - rowH, halfW, rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
    addText(curP, mXP + 6, yP - 11, pair[0][0], "F2", 8.2, "0.15 0.20 0.32");
    lLines.forEach((ln, lIdx) => {
      addText(curP, mXP + 6, yP - 21 - (lIdx * 9.8), ln, "F1", 8.2, "0.12 0.16 0.22");
    });

    addRect(curP, mXP + halfW, yP - rowH, halfW, rowH, "1 1 1", "0.78 0.82 0.88", 0.5);
    addText(curP, mXP + halfW + 6, yP - 11, pair[1][0], "F2", 8.2, "0.15 0.20 0.32");
    rLines.forEach((ln, lIdx) => {
      addText(curP, mXP + halfW + 6, yP - 21 - (lIdx * 9.8), ln, "F1", 8.2, "0.12 0.16 0.22");
    });

    yP -= rowH;
  });
  yP -= 10;

  // 4. Aménagements rentrée T8
  ensurePortraitSpace(40);
  addText(curP, mXP, yP - 12, "Mise à jour des aménagements proposés pour l’élève pour la rentrée scolaire suivante :", "F2", 10.5, "0.10 0.15 0.30");
  yP -= 20;

  ensurePortraitSpace(20);
  for (let c = 0; c < 5; c++) {
    addRect(curP, colXA[c], yP - hHA, colWA[c], hHA, "0.12 0.23 0.54", "0.78 0.82 0.88", 0.5);
    const isCheckHeader = c >= 2;
    const xOff = isCheckHeader ? (colWA[c] - 8) / 2 : 6;
    addText(curP, colXA[c] + xOff, yP - 12, t5Headers[c], "F2", 8.2, "1 1 1");
  }
  yP -= hHA;

  const t8List = isFinAnnee ? safeArray(docModel.t8_amenagements) : [];
  const t8Count = Math.max(10, t8List.length);

  for (let i = 0; i < t8Count; i++) {
    const item = isFinAnnee ? (t8List[i] || null) : null;
    const descLines = safeArray(String(item?.description || "").split(/\r?\n/).flatMap(l => splitPdfTextLine(l, 64, ""))).filter(Boolean);
    const rowH = Math.max(16, descLines.length * 9.8 + 6);
    ensurePortraitSpace(rowH + 4);

    const fillRgb = i % 2 === 1 ? "0.98 0.99 1" : "1 1 1";

    addRect(curP, colXA[0], yP - rowH, colWA[0], rowH, "0.95 0.96 0.98", "0.78 0.82 0.88", 0.5);
    addText(curP, colXA[0] + 7, yP - 11, String(i + 1), "F2", 8, "0.15 0.20 0.32");

    addRect(curP, colXA[1], yP - rowH, colWA[1], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    (descLines.length ? descLines : [""]).forEach((ln, lIdx) => {
      addText(curP, colXA[1] + 6, yP - 11 - (lIdx * 9.8), ln, "F1", 8, "0.12 0.16 0.22");
    });

    const isP = Boolean(item && item.p);
    const isO = Boolean(item && item.o);
    const isM = Boolean(item && item.m);

    addRect(curP, colXA[2], yP - rowH, colWA[2], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    if (isP) addText(curP, colXA[2] + 13, yP - 11, "X", "F2", 8.5, "0.10 0.15 0.30");

    addRect(curP, colXA[3], yP - rowH, colWA[3], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    if (isO) addText(curP, colXA[3] + 13, yP - 11, "X", "F2", 8.5, "0.10 0.15 0.30");

    addRect(curP, colXA[4], yP - rowH, colWA[4], rowH, fillRgb, "0.78 0.82 0.88", 0.5);
    if (isM) addText(curP, colXA[4] + 13, yP - 11, "X", "F2", 8.5, "0.10 0.15 0.30");

    yP -= rowH;
  }

  ensurePortraitSpace(18);
  addText(curP, mXP, yP - 10, "* P = pédagogique     O = organisationnel      M = matériel", "F1", 7.6, "0.35 0.42 0.52");
  yP -= 18;

  // Ajouter la dernière page portrait
  portraitPages.push(curP);

  // Assemblage de toutes les pages (1 paysage + N portrait)
  const allPages = [p1, ...portraitPages];
  const totalPages = allPages.length;

  const pageDescriptors = allPages.map((page, pageIdx) => {
    const isLandscape = page.width > page.height;
    const streamParts = [];

    // Tracé du logo vectoriel en pied de page
    streamParts.push(drawOfficialLogoOps(42, 14, 40));

    // Graphiques de la page
    streamParts.push(...page.graphics);

    // Pied de page : séparation et numéro de page
    const footerLineW = page.width - 84;
    streamParts.push(`q 0.82 0.86 0.91 RG 0.5 w 42 42 m ${42 + footerLineW} 42 l S Q`);

    const btOps = ["BT"];
    let lastX = 0, lastY = 0;
    const moveTo = (tx, ty) => {
      const dx = Number((tx - lastX).toFixed(2));
      const dy = Number((ty - lastY).toFixed(2));
      btOps.push(`${dx} ${dy} Td`);
      lastX = tx;
      lastY = ty;
    };

    for (const item of page.texts) {
      moveTo(item.x, item.y);
      btOps.push(`/${item.font} ${item.size} Tf`);
      if (item.colorRgb) btOps.push(`${item.colorRgb} rg`);
      btOps.push(`${formatPdfLiteral(item.text)} Tj`);
    }

    // Numéro de page
    const pageNumX = isLandscape ? (page.width - 105) : (page.width - 105);
    moveTo(pageNumX, 26);
    btOps.push("/F2 8.2 Tf 0.35 0.42 0.52 rg");
    btOps.push(`${formatPdfLiteral(`Page ${pageIdx + 1} / ${totalPages}`)} Tj`);
    btOps.push("ET");

    streamParts.push(btOps.join("\n"));

    return {
      content: streamParts.join("\n"),
      width: page.width,
      height: page.height
    };
  });

  return assemblePdfFromPageContents(pageDescriptors, {
    title: docModel.deidentified ? "PIA — Modèle dé-identifié" : (docModel.title || "Plan Individuel d’Apprentissage"),
    author: "Pôle Territorial WBE BXL",
    creator: "Journalier V74",
    producer: "Journalier V74"
  });
}

// Exposition globale et namespace JournalierPdf
var JournalierPdf = {
  WIN_ANSI_BYTE_MAP,
  pdfWinAnsiBytes: encodePdfWinAnsiBytes,
  encodePdfWinAnsiBytes,
  pdfLiteral: formatPdfLiteral,
  formatPdfLiteral,
  wrapPdfTextLine: splitPdfTextLine,
  splitPdfTextLine,
  buildPdfFileFromPageContents: assemblePdfFromPageContents,
  assemblePdfFromPageContents,
  makePdfFromModel: buildPdfModelDocument,
  buildPdfModelDocument,
  makePdf: generatePdfDocument,
  generatePdfDocument,
  makeOfficialPdf: buildOfficialPdfDocument,
  buildOfficialPdfDocument
};

if (typeof window !== "undefined") {
  window.JournalierPdf = JournalierPdf;
}
if (typeof globalThis !== "undefined") {
  globalThis.JournalierPdf = JournalierPdf;
  globalThis.makePdf = generatePdfDocument;
  globalThis.generatePdfDocument = generatePdfDocument;
  globalThis.wrapPdfTextLine = splitPdfTextLine;
  globalThis.splitPdfTextLine = splitPdfTextLine;
  globalThis.makePdfFromModel = buildPdfModelDocument;
  globalThis.buildPdfModelDocument = buildPdfModelDocument;
  globalThis.makeOfficialPdf = buildOfficialPdfDocument;
  globalThis.buildOfficialPdfDocument = buildOfficialPdfDocument;
  globalThis.buildPdfFileFromPageContents = assemblePdfFromPageContents;
  globalThis.assemblePdfFromPageContents = assemblePdfFromPageContents;
}
