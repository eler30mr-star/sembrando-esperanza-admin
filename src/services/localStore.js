import { initialCollections } from '../data/initialData.js';

const STORAGE_KEY = 'sembrando-esperanza-admin-data';

export function loadCollections() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialCollections));
    return initialCollections;
  }

  try {
    return JSON.parse(stored);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialCollections));
    return initialCollections;
  }
}

export function saveCollections(collections) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
}

export function createId(prefix) {
  return `${prefix}-${Date.now()}`;
}
