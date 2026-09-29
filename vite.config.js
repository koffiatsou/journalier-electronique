import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const codespacesHost = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-8000.app.github.dev`
  : undefined;

function copyClassicAppScripts() {
  const files = [
    'src/app/indicators.js',
    'src/app/journalier-core.js'
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
    strictPort: true,
    host: 'localhost',
    allowedHosts: codespacesHost ? [codespacesHost] : undefined
  },

  plugins: [
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
