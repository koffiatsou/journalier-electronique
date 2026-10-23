import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();

test('Lot 5B-bis — Contrôle streaming de la taille dans inflatePdf et non-engloutissement de l\'erreur de dépassement', async () => {
  const runtimeCode = await fs.readFile(path.join(root, 'src/v74/v74-runtime.js'), 'utf8');

  // Vérification statique de la présence de PdfSizeExceededError et du streaming
  assert.ok(
    runtimeCode.includes('class PdfSizeExceededError extends Error'),
    'v74-runtime.js doit définir la classe d\'erreur PdfSizeExceededError'
  );
  assert.ok(
    runtimeCode.includes('if(err instanceof PdfSizeExceededError||err?.name==="PdfSizeExceededError")throw err;'),
    'Le catch ne doit pas avaler l\'erreur de taille maximale'
  );

  // Harnais dynamique pour tester inflatePdf
  const sandbox = {
    Blob,
    Response,
    DecompressionStream,
    Uint8Array,
    Error,
    MAX_PIA_TEXT_BYTES: 1024 * 1024 // 1 Mo dans le test pour tester rapidement le seuil
  };

  const fnMatch = runtimeCode.match(/class PdfSizeExceededError[\s\S]*?async function inflatePdf\(bytes\)\{[\s\S]*?\n\}/);
  assert.ok(fnMatch, 'inflatePdf et PdfSizeExceededError doivent être localisables dans v74-runtime.js');

  const script = new vm.Script(fnMatch[0] + '; globalThis.inflatePdf = inflatePdf; globalThis.PdfSizeExceededError = PdfSizeExceededError;');
  const context = vm.createContext(sandbox);
  script.runInContext(context);

  // 1. Génération d'une payload compressée (1,5 Mo de données compressées avec CompressionStream)
  const uncompressedSize = 1.5 * 1024 * 1024; // 1.5 Mo > 1 Mo seuil
  const rawData = new Uint8Array(uncompressedSize);
  rawData.fill(65); // 'A'

  const cs = new CompressionStream('deflate');
  const compressedBuffer = await new Response(new Blob([rawData]).stream().pipeThrough(cs)).arrayBuffer();
  const compressedBytes = new Uint8Array(compressedBuffer);

  // 2. Exécution : doit lever l'erreur spécifique de taille sans l'avaler
  await assert.rejects(
    async () => {
      await context.inflatePdf(compressedBytes);
    },
    (err) => {
      assert.strictEqual(err.name, 'PdfSizeExceededError');
      assert.strictEqual(err.message, 'Le PDF est trop volumineux après décompression.');
      return true;
    },
    'inflatePdf doit lever immédiatement PdfSizeExceededError sans la masquer derrière "Flux PDF compressé non exploitable"'
  );

  // 3. Cas valide sous le seuil (500 Ko)
  const validSize = 500 * 1024;
  const validData = new Uint8Array(validSize);
  validData.fill(66);
  const csValid = new CompressionStream('deflate');
  const validCompressed = new Uint8Array(await new Response(new Blob([validData]).stream().pipeThrough(csValid)).arrayBuffer());

  const out = await context.inflatePdf(validCompressed);
  assert.strictEqual(out.length, validSize, 'Les données décompressées valides doivent correspondre exactement');
  assert.strictEqual(out[0], 66);
});
