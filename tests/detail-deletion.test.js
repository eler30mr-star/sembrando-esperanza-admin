import test from 'node:test';
import assert from 'node:assert/strict';
import { removedDetailPaths, publicationIntent, reconcileIndex, assertUniqueIndex } from '../lib/syncSafety.js';

const entry = (id, slug) => ({ id, slug, updatedAtMs: 1 });

test('cambiar slug retira únicamente el detalle anterior', () => {
  const before = [entry('uno', 'slug-antiguo'), entry('dos', 'conservar')];
  const intent = publicationIntent({ operation: 'upsert', targetId: 'uno', stories: [entry('uno', 'slug-nuevo')] }, 'stories');
  const after = reconcileIndex(before, [entry('uno', 'slug-nuevo')], intent);
  assertUniqueIndex(after, 'stories.json');
  assert.deepEqual(removedDetailPaths(before, after, 'public/data/es/stories'), ['public/data/es/stories/slug-antiguo.json']);
  assert.equal(after.some((item) => item.id === 'dos'), true);
});

test('eliminar un registro no borra detalles de otros registros', () => {
  const before = [entry('uno', 'retirar'), entry('dos', 'conservar')];
  const intent = publicationIntent({ operation: 'delete', targetId: 'uno', plans: [] }, 'plans');
  const after = reconcileIndex(before, [], intent);
  assert.deepEqual(removedDetailPaths(before, after, 'public/data/es/plans'), ['public/data/es/plans/retirar.json']);
});

test('rechaza rutas maliciosas procedentes de índices antiguos', () => {
  for (const slug of ['../fuera', 'carpeta/nombre', '..', 'X-Upper', '']) {
    assert.throws(() => removedDetailPaths([entry('uno', slug)], [], 'public/data/es/videos'), /slug inseguro/);
  }
});

test('no elimina detalles cuando no cambia el slug ni desaparece el registro', () => {
  const before = [entry('uno', 'igual')];
  assert.deepEqual(removedDetailPaths(before, [entry('uno', 'igual')], 'public/data/fr/stories'), []);
});
