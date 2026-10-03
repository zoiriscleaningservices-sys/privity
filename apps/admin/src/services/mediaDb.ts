// High-performance IndexedDB Media Storage for Large Videos & Images
// Prevents mobile Safari OOM crashes and bypasses localStorage 5MB limit completely

const DB_NAME = 'privity_media_store_v1';
const DB_VERSION = 1;
const STORE_NAME = 'media_blobs';

let dbPromise: Promise<IDBDatabase> | null = null;

function getDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

const objectUrlCache = new Map<string, string>();

export async function storeMediaBlob(id: string, media: Blob | string): Promise<string> {
  try {
    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(media, id);
      req.onsuccess = () => {
        if (media instanceof Blob) {
          const url = URL.createObjectURL(media);
          objectUrlCache.set(id, url);
          resolve(url);
        } else {
          resolve(media);
        }
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[MediaDB] Failed to store media blob in IndexedDB:', err);
    if (media instanceof Blob) {
      const url = URL.createObjectURL(media);
      objectUrlCache.set(id, url);
      return url;
    }
    return media;
  }
}

export async function getMediaUrl(id: string): Promise<string | null> {
  if (objectUrlCache.has(id)) {
    return objectUrlCache.get(id)!;
  }

  try {
    const db = await getDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);
      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
          return;
        }
        if (val instanceof Blob) {
          const url = URL.createObjectURL(val);
          objectUrlCache.set(id, url);
          resolve(url);
        } else if (typeof val === 'string') {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export function getCachedMediaUrl(id: string): string | null {
  return objectUrlCache.get(id) || null;
}
