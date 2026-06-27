import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc
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

  const q = query(getCollectionRef(section), orderBy('updatedAtMs', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveSectionItem(section, item) {
  requireFirebase();

  const now = Date.now();
  const nextItem = cleanForFirestore({
    ...item,
    updatedAtMs: now,
    updatedAt: new Date(now).toISOString()
  });

  await setDoc(doc(db, section, nextItem.id), {
    ...nextItem,
    updatedAtServer: serverTimestamp()
  }, { merge: true });

  return nextItem;
}

export async function deleteSectionItem(section, id) {
  requireFirebase();
  await deleteDoc(doc(db, section, id));
}
