// Lecture du contenu d'un fichier Word (.docx) exporté, pour les parcours navigateur.
// Python 3 est utilisé parce qu'il est présent partout (poste, serveur de CI, image officielle de Playwright),
// contrairement à la commande `unzip` ou à l'alias `python`, absents de l'image de Playwright.
import { execFileSync } from 'node:child_process';

const OCTETS_MAX = 50_000_000;
const LIRE_DOCUMENT = 'import zipfile,sys;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("word/document.xml"))';

/**
 * Renvoie le XML du corps (`word/document.xml`) d'un fichier .docx.
 * @param {string} chemin Chemin du fichier .docx.
 * @returns {string} Le XML, en texte UTF-8.
 */
export function lireXmlDocx(chemin) {
  return execFileSync('python3', ['-c', LIRE_DOCUMENT, chemin], { maxBuffer: OCTETS_MAX }).toString('utf8');
}
