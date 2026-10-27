const { test } = require('node:test');
const assert = require('node:assert');
const { unlink } = require('node:fs/promises');
const path = require('node:path');
const app = require('../src/app');

// Teste de fumaça do seed: garante que o app Express foi exportado.
// Novos testes serão adicionados durante os Steps 2, 6 e 7 com auxílio do Copilot.
test('o app backend é exportado', () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');
});

test('gerencia documentos com armazenamento local', async (context) => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let document;

  try {
    await context.test('preserva a rota de saúde', async () => {
      const response = await fetch(`${baseUrl}/health`);
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(await response.json(), { status: 'ok' });
    });

    await context.test('lista inicialmente sem documentos', async () => {
      const response = await fetch(`${baseUrl}/documents`);
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(await response.json(), []);
    });

    await context.test('rejeita upload sem arquivo', async () => {
      const response = await fetch(`${baseUrl}/upload`, { method: 'POST' });
      assert.strictEqual(response.status, 400);
      assert.strictEqual(typeof (await response.json()).error, 'string');
    });

    await context.test('rejeita campo de arquivo inesperado', async () => {
      const form = new FormData();
      form.append('unexpected', new Blob(['teste']), 'document.txt');
      const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
      assert.strictEqual(response.status, 400);
      assert.strictEqual(typeof (await response.json()).error, 'string');
    });

    await context.test('envia arquivo e retorna metadados', async () => {
      const form = new FormData();
      form.append('file', new Blob(['conteudo do documento'], { type: 'text/plain' }), 'document.txt');
      form.append('owner', 'marcos');
      const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
      assert.strictEqual(response.status, 201);
      document = await response.json();
      assert.match(document.id, /^[0-9a-f-]{36}$/);
      assert.strictEqual(document.originalName, 'document.txt');
      assert.strictEqual(document.size, Buffer.byteLength('conteudo do documento'));
      assert.strictEqual(document.owner, 'marcos');
      assert.ok(Number.isFinite(Date.parse(document.createdAt)));
      assert.strictEqual(document.path, undefined);
    });

    await context.test('lista os metadados enviados', async () => {
      const response = await fetch(`${baseUrl}/documents`);
      assert.strictEqual(response.status, 200);
      assert.deepStrictEqual(await response.json(), [document]);
    });

    await context.test('baixa o arquivo com nome original', async () => {
      const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
      assert.strictEqual(response.status, 200);
      assert.match(response.headers.get('content-disposition'), /attachment; filename="document.txt"/);
      assert.strictEqual(await response.text(), 'conteudo do documento');
    });

    await context.test('retorna 404 para documento inexistente', async () => {
      const response = await fetch(`${baseUrl}/documents/unknown/download`);
      assert.strictEqual(response.status, 404);
      assert.strictEqual(typeof (await response.json()).error, 'string');
    });

    await context.test('retorna 404 quando o arquivo não existe mais no disco', async () => {
      await unlink(path.resolve(__dirname, '../storage', document.id));
      const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
      assert.strictEqual(response.status, 404);
      assert.strictEqual(typeof (await response.json()).error, 'string');
    });
  } finally {
    if (document) {
      await unlink(path.resolve(__dirname, '../storage', document.id)).catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
});
