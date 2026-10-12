function requestError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export function publicationIntent(body, collectionKey) {
  const operation = body?.operation || 'sync';
  if (!['upsert', 'delete', 'sync'].includes(operation)) {
    throw requestError('Operación de publicación no permitida.');
  }
  const items = body?.[collectionKey];
  if (!Array.isArray(items) || items.length > 1000) {
    throw requestError('Se requiere una lista de contenido válida (máximo 1000 elementos).');
  }
  const targetId = String(body?.targetId || '').trim();
  const dryRun = body?.dryRun === true;
  const expectedHead = String(body?.expectedHead || '').trim();
  if (operation !== 'sync') {
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(targetId)) {
      throw requestError('Identificador de contenido inválido.');
    }
    if ((operation === 'upsert' && (items.length !== 1 || String(items[0]?.id || '') !== targetId))
      || (operation === 'delete' && items.length !== 0)) {
      throw requestError('La operación individual debe indicar un único elemento o su identificador para eliminar.');
    }
  }
  if (operation === 'sync' && !dryRun && !/^[a-f0-9]{40}$/i.test(expectedHead)) {
    throw requestError('Primero solicita la vista previa de sincronización.');
  }
  if (operation !== 'sync' && dryRun) {
    throw requestError('La vista previa está disponible para sincronización completa.');
  }
  if (body?.deletedIds?.length) {
    throw requestError('No se permiten borrados implícitos mediante listas. Usa la operación delete.');
  }
  return { operation, items, targetId, dryRun, expectedHead };
}

export function reconcileIndex(previousIndex, incoming, intent) {
  if (!Array.isArray(previousIndex)) {
    throw requestError('El índice público no es una lista. Operación cancelada.', 409);
  }
  if (intent.operation === 'sync') return incoming;
  const others = previousIndex.filter((entry) => String(entry?.id || '') !== intent.targetId);
  const replacements = intent.operation === 'upsert'
    ? incoming.filter((entry) => String(entry?.id || '') === intent.targetId)
    : [];
  return [...others, ...replacements]
    .sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

export function assertUniqueIndex(items, indexPath) {
  const ids = new Set();
  const slugs = new Set();
  for (const item of items) {
    const id = String(item?.id || '').trim();
    const slug = String(item?.slug || '').trim();
    if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw requestError(`ID o slug inválido en ${indexPath}.`, 409);
    }
    if (ids.has(id) || slugs.has(slug)) {
      throw requestError(`IDs o slugs duplicados en ${indexPath}.`, 409);
    }
    ids.add(id);
    slugs.add(slug);
  }
}

export function publicationDiff(previousIndex, nextIndex) {
  const before = new Map(previousIndex.map((item) => [String(item.id), item]));
  const after = new Map(nextIndex.map((item) => [String(item.id), item]));
  let added = 0;
  let updated = 0;
  let removed = 0;
  for (const [id, item] of after) {
    if (!before.has(id)) added += 1;
    else if (JSON.stringify(before.get(id)) !== JSON.stringify(item)) updated += 1;
  }
  for (const id of before.keys()) if (!after.has(id)) removed += 1;
  return { added, updated, removed, total: after.size };
}
