import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const codespacesHost = process.env.CODESPACE_NAME
  ? `${process.env.CODESPACE_NAME}-8000.app.github.dev`
  : undefined;

export default defineConfig({
  base: '/journalier-electronique/',

  server: {
    port: 8000,
    strictPort: true,
    host: 'localhost',
    allowedHosts: codespacesHost ? [codespacesHost] : undefined
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        redirect: resolve(__dirname, 'msal-redirect.html')
      }
    }
  }
});
