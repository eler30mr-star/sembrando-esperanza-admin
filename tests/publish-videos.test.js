import test from 'node:test';
import assert from 'node:assert/strict';
import publishVideos from '../api/publish-videos.js';

test('vista previa de videos funciona sin escribir en GitHub', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.FIREBASE_API_KEY;
  const originalGitHubToken = process.env.GITHUB_TOKEN;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.FIREBASE_API_KEY;
    else process.env.FIREBASE_API_KEY = originalKey;
    if (originalGitHubToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalGitHubToken;
  });

  process.env.FIREBASE_API_KEY = 'test-only-api-key';
  process.env.GITHUB_TOKEN = 'test-only-github-token';
  const writes = [];
  globalThis.fetch = async (input, options = {}) => {
    const url = String(input);
    const method = options.method || 'GET';
    if (method !== 'GET' && !url.includes('identitytoolkit.googleapis.com')) writes.push(url);
    if (url.includes('identitytoolkit.googleapis.com')) {
      return { ok: true, status: 200, json: async () => ({ users: [{ email: process.env.VITE_ADMIN_EMAIL || 'ceo.developer.appsem@gmail.com' }] }) };
    }
    if (url.includes('/git/ref/heads/')) {
      return { ok: true, status: 200, json: async () => ({ object: { sha: 'a'.repeat(40) } }) };
    }
    if (url.includes('/contents/')) {
      return { ok: false, status: 404, json: async () => ({ message: 'Not Found' }) };
    }
    throw new Error('Unexpected request: ' + method + ' ' + url);
  };

  const req = {
    method: 'POST',
    headers: { authorization: 'Bearer fake-test-token' },
    body: {
      operation: 'sync',
      dryRun: true,
      videos: [{
        id: 'video-1', slug: 'video-uno', title: 'Video de prueba',
        url: 'https://www.youtube.com/watch?v=abcdefghijk',
        status: 'published', updatedAtMs: 1
      }]
    }
  };
  let status = 0;
  let payload;
  const res = {
    status(code) { status = code; return this; },
    json(body) { payload = body; return this; }
  };
  await publishVideos(req, res);
  assert.equal(status, 200, JSON.stringify(payload));
  assert.equal(payload.ok, true);
  assert.equal(payload.dryRun, true);
  assert.deepEqual(payload.preview.es, { added: 1, updated: 0, removed: 0, total: 1 });
  assert.deepEqual(writes, []);
});
