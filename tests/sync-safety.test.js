import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationIntent, reconcileIndex, assertUniqueIndex, publicationDiff } from '../lib/syncSafety.js';

const p = (id, slug, updatedAtMs = 1) => ({ id, slug, updatedAtMs });

test('upsert conserva el resto del índice y actualiza solo el ID indicado', () => {
  const intent = publicationIntent({ operation: 'upsert', targetId: 'plan-1', plans: [p('plan-1', 'nuevo', 2)] }, 'plans');
  assert.deepEqual(reconcileIndex([p('plan-1', 'antiguo'), p('plan-2', 'no-tocar')], [p('plan-1', 'nuevo', 2)], intent),
    [p('plan-1', 'nuevo', 2), p('plan-2', 'no-tocar')]);
});

test('delete elimina solamente el ID explícito', () => {
  const intent = publicationIntent({ operation: 'delete', targetId: 'story-1', stories: [] }, 'stories');
  assert.deepEqual(reconcileIndex([p('story-1', 'primera'), p('story-2', 'segunda')], [], intent), [p('story-2', 'segunda')]);
});

test('un borrador retira solo la publicación de su propio ID', () => {
  const intent = publicationIntent({ operation: 'upsert', targetId: 'plan-1', plans: [{ id: 'plan-1', status: 'draft' }] }, 'plans');
  assert.deepEqual(reconcileIndex([p('plan-1', 'primero'), p('plan-2', 'segundo')], [], intent), [p('plan-2', 'segundo')]);
});

test('la sincronización completa requiere una vista previa vinculada al commit', () => {
  assert.throws(() => publicationIntent({ operation: 'sync', plans: [] }, 'plans'), /vista previa/);
  const preview = publicationIntent({ operation: 'sync', plans: [], dryRun: true }, 'plans');
  assert.equal(preview.dryRun, true);
  const applied = publicationIntent({ operation: 'sync', plans: [], expectedHead: 'a'.repeat(40) }, 'plans');
  assert.equal(applied.operation, 'sync');
});

test('no acepta borrados implícitos ni ID inconsistentes', () => {
  assert.throws(() => publicationIntent({ operation: 'sync', plans: [], deletedIds: ['plan-1'], dryRun: true }, 'plans'));
  assert.throws(() => publicationIntent({ operation: 'upsert', plans: [p('plan-2', 'dos')], targetId: 'plan-1' }, 'plans'));
  assert.throws(() => publicationIntent({ operation: 'delete', plans: [] }, 'plans'));
});

test('detecta duplicados y slugs peligrosos', () => {
  assert.throws(() => assertUniqueIndex([p('a', 'igual'), p('b', 'igual')], 'planes.json'));
  assert.throws(() => assertUniqueIndex([p('a', '../salir')], 'planes.json'));
  assert.throws(() => assertUniqueIndex([p('a', 'uno'), p('a', 'dos')], 'planes.json'));
});

test('resume diferencias sin perder contenido ajeno', () => {
  assert.deepEqual(publicationDiff([p('a', 'uno'), p('b', 'dos')], [p('a', 'nuevo'), p('c', 'tres')]),
    { added: 1, updated: 1, removed: 1, total: 2 });
});
