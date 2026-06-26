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
import { loadCollections, saveCollections } from './localStore.js';

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

function getCollectionRef(section) {
  if (!firebaseReady || !db) return null;
  return collection(db, section);
}

export async function loadSectionItems(section) {
  if (!firebaseReady || !db) {
    const localCollections = loadCollections();
    return localCollections[section] || [];
  }

  try {
    const q = query(getCollectionRef(section), orderBy('updatedAtMs', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
  } catch (error) {
    console.error(`No se pudo cargar ${section} desde Firebase.`, error);
    const localCollections = loadCollections();
    return localCollections[section] || [];
  }
}

export async function saveSectionItem(section, item) {
  const now = Date.now();
  const nextItem = cleanForFirestore({
    ...item,
    updatedAtMs: now,
    updatedAt: new Date(now).toISOString()
  });

  if (!firebaseReady || !db) {
    const localCollections = loadCollections();
    const currentItems = localCollections[section] || [];
    const exists = currentItems.some((entry) => entry.id === nextItem.id);
    const nextItems = exists
      ? currentItems.map((entry) => entry.id === nextItem.id ? nextItem : entry)
      : [nextItem, ...currentItems];
    saveCollections({ ...localCollections, [section]: nextItems });
    return nextItem;
  }

  await setDoc(doc(db, section, nextItem.id), {
    ...nextItem,
    updatedAtServer: serverTimestamp()
  }, { merge: true });

  return nextItem;
}

export async function deleteSectionItem(section, id) {
  if (!firebaseReady || !db) {
    const localCollections = loadCollections();
    const currentItems = localCollections[section] || [];
    saveCollections({ ...localCollections, [section]: currentItems.filter((item) => item.id !== id) });
    return;
  }

  await deleteDoc(doc(db, section, id));
}
