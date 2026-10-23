/**
 * =========================================================
 * JOURNALIER ÉLECTRONIQUE — ÉCHAPPEMENT HTML & XML UNIFIÉ (LOT 3 & 4)
 * Architecture local-first / RGPD
 * Neutralisation systématique des injections XSS (& < > " ')
 * et sanitisation OpenXML / Word (& < > " ' + caractères de contrôle illégaux)
 * =========================================================
 */

(function (global) {
  'use strict';

  /**
   * Table de correspondance des entités HTML canoniques.
   * Protège contre les injections dans le corps HTML et les attributs délimités par des guillemets ou apostrophes.
   */
  const HTML_ESCAPE_ENTITIES = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  });

  const HTML_ESCAPE_PATTERN = /[&<>"']/g;

  /**
   * Table de correspondance des entités XML canoniques.
   * Spécifique aux documents OpenXML / Word (.docx).
   */
  const XML_ESCAPE_ENTITIES = Object.freeze({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;'
  });

  const XML_ESCAPE_PATTERN = /[&<>"']/g;

  /**
   * Caractères de contrôle illégaux en XML 1.0 qui provoquent la corruption des fichiers DOCX.
   * Sont conservés uniquement : \t (0x09), \n (0x0A), \r (0x0D).
   */
  // eslint-disable-next-line no-control-regex -- Caractères de contrôle illégaux en XML 1.0 (OpenXML Word)
  const XML_ILLEGAL_CTRL_PATTERN = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

  /**
   * Échappe une valeur pour insertion sécurisée dans le DOM ou des attributs HTML.
   * - null ou undefined renvoient une chaîne vide ''.
   * - Les nombres et booléens sont convertis en chaîne puis échappés.
   * - Les 5 caractères dangereux (&, <, >, ", ') sont remplacés par leurs entités HTML.
   *
   * @param {*} value - Valeur à échapper
   * @returns {string} Chaîne sécurisée
   */
  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).replace(HTML_ESCAPE_PATTERN, function (ch) {
      return HTML_ESCAPE_ENTITIES[ch] || ch;
    });
  }

  /** Alias court pour les gabarits littéraux et les interpolations fréquentes. */
  const esc = escapeHtml;

  /**
   * Échappe et assainit une valeur pour insertion sécurisée dans un flux OpenXML (DOCX / Word).
   * - null ou undefined renvoient une chaîne vide ''.
   * - Les caractères de contrôle illégaux en XML 1.0 sont éliminés pour éviter toute corruption.
   * - Les 5 entités canoniques XML (&, <, >, ", ') sont remplacées par &amp;, &lt;, &gt;, &quot;, &apos;.
   *
   * @param {*} value - Valeur à formater pour XML
   * @returns {string} Chaîne XML sécurisée
   */
  function escapeXml(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(XML_ILLEGAL_CTRL_PATTERN, '')
      .replace(XML_ESCAPE_PATTERN, function (ch) {
        return XML_ESCAPE_ENTITIES[ch] || ch;
      });
  }

  /** Alias court pour la compatibilité avec les moteurs d'exportation DOCX / OpenXML existants. */
  const xmlEsc = escapeXml;

  /**
   * Échappe une valeur pour insertion sécurisée dans un attribut HTML (ex: data-text="...").
   * - null ou undefined renvoient une chaîne vide ''.
   * - Tous les caractères susceptibles de briser un délimiteur d'attribut (&, <, >, ", ') sont échappés.
   *
   * @param {*} value - Valeur à échapper
   * @returns {string} Attribut HTML sécurisé
   */
  function escapeAttr(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).replace(HTML_ESCAPE_PATTERN, function (ch) {
      return HTML_ESCAPE_ENTITIES[ch] || ch;
    });
  }

  /**
   * Assainit un nom de fichier pour les téléchargements locaux (DOCX, PDF, JSON).
   * - Neutralise les tentatives de traversée d'arborescence (path traversal .. / \).
   * - Remplace les caractères interdits sur les systèmes de fichiers (<>:"/\|?* et contrôles 0x00-0x1F) par '_'.
   * - Supprime les espaces et points superflus en début et fin de nom.
   * - Fournit un nom de repli sain si le résultat est vide.
   *
   * @param {string} name - Nom de fichier proposé
   * @param {string} [fallback='document'] - Nom de secours si vide
   * @returns {string} Nom de fichier sécurisé
   */
  function sanitizeFilename(name, fallback = 'document') {
    if (!name || typeof name !== 'string') {
      return fallback;
    }
    const safe = name
      .replace(/[/\\]/g, '_')
      .replace(/\.\.+/g, '.')
      // eslint-disable-next-line no-control-regex -- Caractères de contrôle interdits dans les noms de fichiers
      .replace(/[\x00-\x1F\x7F<>:"|?*]/g, '_')
      .trim()
      .replace(/^[.\s]+|[.\s]+$/g, '');

    return safe || fallback;
  }

  // Exposition globale uniforme pour tous les contextes d'exécution (navigateur / workers / node)
  if (typeof global !== 'undefined') {
    global.escapeHtml = escapeHtml;
    global.esc = esc;
    global.escapeXml = escapeXml;
    global.xmlEsc = xmlEsc;
    global.escapeAttr = escapeAttr;
    global.sanitizeFilename = sanitizeFilename;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.escapeHtml = escapeHtml;
    globalThis.esc = esc;
    globalThis.escapeXml = escapeXml;
    globalThis.xmlEsc = xmlEsc;
    globalThis.escapeAttr = escapeAttr;
    globalThis.sanitizeFilename = sanitizeFilename;
  }
  if (typeof window !== 'undefined') {
    window.escapeHtml = escapeHtml;
    window.esc = esc;
    window.escapeXml = escapeXml;
    window.xmlEsc = xmlEsc;
    window.escapeAttr = escapeAttr;
    window.sanitizeFilename = sanitizeFilename;
  }

  // Export optionnel pour Node.js / modules de test
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { escapeHtml, esc, escapeXml, xmlEsc, escapeAttr, sanitizeFilename };
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
