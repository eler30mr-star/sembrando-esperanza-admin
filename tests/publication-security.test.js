import test from 'node:test';
import assert from 'node:assert/strict';
import publishPlans from '../api/publish-plans.js';
import publishStories from '../api/publish-stories.js';
import publishVideos from '../api/publish-videos.js';

const cases = [
  ['plans', publishPlans, { id: 'plan-1', title: 'Plan de prueba', slug: 'plan-de-prueba', status: 'published', days: [{ title: 'Día 1', text: 'Reflexión' }] }],
  ['stories', publishStories, { id: 'story-1', title: 'Historia de prueba', slug: 'historia-de-prueba', status: 'published', chapters: [{ title: 'Capítulo 1', content: 'Contenido' }] }],
  ['videos', publishVideos, { id: 'video-1', title: 'Video de prueba', slug: 'video-de-prueba', status: 'published', url: 'https://www.youtube.com/watch?v=abcdefghijk' }]
];

function response() {
  return {
    code: 0,
    body: null,
    status(value) { this.code = value; return this; },
    json(value) { this.body = value; return this; }
  };
}

for (const [section, handler, item] of cases) {
  test(`${section}: exige sesión y no consulta GitHub sin autenticación`, async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('No debería consultar red'); };
    try {
      const res = response();
      await handler({ method: 'POST', headers: {}, body: { operation: 'delete', targetId: item.id, [section]: [] } }, res);
      assert.equal(res.code, 401);
      assert.equal(calls, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test(`${section}: vista previa sin escrituras y sin eliminación implícita`, async () => {
    const originalFetch = globalThis.fetch;
    const oldKey = process.env.FIREBASE_API_KEY;
    const oldToken = process.env.GITHUB_TOKEN;
    process.env.FIREBASE_API_KEY = 'dummy-api-key';
    process.env.GITHUB_TOKEN = 'dummy-github-token';
    let writes = 0;
    globalThis.fetch = async (input, options = {}) => {
      const url = String(input);
      if (url.includes('identitytoolkit.googleapis.com')) {
        return { ok: true, json: async () => ({ users: [{ email: process.env.VITE_ADMIN_EMAIL || 'ceo.developer.appsem@gmail.com' }] }) };
      }
      if ((options.method || 'GET') !== 'GET') writes++;
      if (url.includes('/git/ref/heads/')) {
        return { ok: true, json: async () => ({ object: { sha: 'a'.repeat(40) } }) };
      }
      if (url.includes('/contents/')) {
        return { ok: false, status: 404 };
      }
      throw new Error(`Solicitud inesperada: ${url}`);
    };
    try {
      const res = response();
      await handler({
        method: 'POST',
        headers: { authorization: 'Bearer fake-session' },
        body: { operation: 'sync', dryRun: true, [section]: [item] }
      }, res);
      assert.equal(res.code, 200, JSON.stringify(res.body));
      assert.equal(res.body.ok, true);
      assert.equal(res.body.dryRun, true);
      assert.equal(writes, 0);
      assert.equal(res.body.preview.es.added, 1);
      assert.equal(res.body.preview.es.removed, 0);
    } finally {
      globalThis.fetch = originalFetch;
      if (oldKey === undefined) delete process.env.FIREBASE_API_KEY;
      else process.env.FIREBASE_API_KEY = oldKey;
      if (oldToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = oldToken;
    }
  });
}
