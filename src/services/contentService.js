import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { db, firebaseReady } from './firebase.js';

function cleanForFirestore(value) {
  if (Array.isArray(value)) {
    return value.map(cleanForFirestore);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, cleanForFirestore(item)])
    );
  }

  return value;
}

function requireFirebase() {
  if (!firebaseReady || !db) {
    throw new Error('Firebase no está configurado. Revisa variables de entorno en Vercel y vuelve a desplegar.');
  }
}

function getCollectionRef(section) {
  requireFirebase();
  return collection(db, section);
}

export async function loadSectionItems(section) {
  requireFirebase();

  // Una consulta con orderBy omite documentos antiguos sin updatedAtMs.
  const snapshot = await getDocs(getCollectionRef(section));
  return snapshot.docs
    .map((item) => ({ ...item.data(), id: item.id }))
    .sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
}

function staleError() {
  const error = new Error('Otro administrador o pestaña modificó este contenido. Actualiza la sección antes de continuar.');
  error.status = 409;
  return error;
}

export async function saveSectionItem(section, item, expectedUpdatedAtMs = null) {
  requireFirebase();
  const now = Date.now();
  const nextItem = cleanForFirestore({
    ...item,
    updatedAtMs: now,
    updatedAt: new Date(now).toISOString()
  });

  const reference = doc(db, section, nextItem.id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (expectedUpdatedAtMs === null) {
      if (snapshot.exists()) throw staleError();
    } else if (!snapshot.exists() || Number(snapshot.data().updatedAtMs || 0) !== Number(expectedUpdatedAtMs)) {
      throw staleError();
    }

    transaction.set(reference, { ...nextItem, updatedAtServer: serverTimestamp() }, { merge: true });
  });

  return nextItem;
}

export async function deleteSectionItem(section, id, expectedUpdatedAtMs = 0) {
  requireFirebase();
  const reference = doc(db, section, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return;
    if (Number(snapshot.data().updatedAtMs || 0) !== Number(expectedUpdatedAtMs)) throw staleError();
    transaction.delete(reference);
  });
}
