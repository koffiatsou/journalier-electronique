import { defineConfig } from 'vite';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const codespacesHost = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-8000.app.github.dev`
  : undefined;

function serveZipArchive() {
  return {
    name: 'serve-zip-archive',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0];
        if (cleanUrl.endsWith('.zip')) {
          const zipName = cleanUrl.split('/').pop();
          const zipPath = resolve(__dirname, 'public', zipName);
          if (existsSync(zipPath)) {
            const stat = statSync(zipPath);
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
            return createReadStream(zipPath).pipe(res);
          }
        }
        if (cleanUrl.endsWith('.docx')) {
          const docxName = cleanUrl.split('/').pop();
          let docxPath = resolve(__dirname, 'public', docxName);
          if (!existsSync(docxPath)) {
            docxPath = resolve(__dirname, 'public', 'modeles', docxName);
          }
          if (existsSync(docxPath)) {
            const stat = statSync(docxPath);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `attachment; filename="${docxName}"`);
            return createReadStream(docxPath).pipe(res);
          }
        }
        next();
      });
    }
  };
}

function copyClassicAppScripts() {
  const files = [
    'src/app/html-escape.js',
    'src/app/indicators.js',
    'src/app/storage-vault.js',
    'src/v74/v74-docx-pia-pv.js',
    'src/v74/v74-docx-export.js',
    'src/v74/v74-pdf-export.js',
    'src/app/students-core.js',
    'src/app/agenda-core.js',
    'src/app/redaction-engine.js',
    'src/app/journalier-seances-docx.js',
    'src/app/session-levels.js',
    'src/app/sessions-core.js',
    'src/app/reports-core.js',
    'src/app/journalier-core.js',
    'src/app/reunion-view.js'
  ];

  return {
    name: 'copy-classic-app-scripts',
    apply: 'build',
    generateBundle() {
      for (const relativePath of files) {
        this.emitFile({
          type: 'asset',
          fileName: relativePath,
          source: readFileSync(resolve(__dirname, relativePath), 'utf8')
        });
      }
    }
  };
}

export default defineConfig({
  base: '/journalier-electronique/',

  server: {
    port: 8000,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: codespacesHost ? [codespacesHost, 'localhost'] : true,
  },

  plugins: [
    serveZipArchive(),
    copyClassicAppScripts()
  ],

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        redirect: resolve(__dirname, 'msal-redirect.html')
      }
    }
  }
});
