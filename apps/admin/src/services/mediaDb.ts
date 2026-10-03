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
    let payloadToStore: any = media;
    let mimeType = 'video/mp4';

    if (media instanceof Blob) {
      mimeType = media.type || 'video/mp4';
      if (typeof media.arrayBuffer === 'function') {
        const buffer = await media.arrayBuffer();
        payloadToStore = {
          buffer,
          type: mimeType,
          size: media.size,
          timestamp: Date.now(),
        };
      }
    }

    const db = await getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(payloadToStore, id);
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
    const blob = await getMediaBlob(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      objectUrlCache.set(id, url);
      return url;
    }

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
        if (typeof val === 'string') {
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

export async function getMediaBlob(id: string): Promise<Blob | null> {
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
          resolve(val);
        } else if (val && val.buffer && (val.buffer instanceof ArrayBuffer || val.buffer instanceof Uint8Array)) {
          const blob = new Blob([val.buffer], { type: val.type || 'video/mp4' });
          resolve(blob);
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

export async function getFreshMediaUrl(id: string): Promise<string | null> {
  try {
    const blob = await getMediaBlob(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      objectUrlCache.set(id, url);
      return url;
    }
  } catch {}
  return getMediaUrl(id);
}

export async function storePostMedia(postId: string, media: Blob | string, optionalMediaId?: string): Promise<string> {
  const url = await storeMediaBlob(postId, media);
  if (optionalMediaId && optionalMediaId !== postId) {
    await storeMediaBlob(optionalMediaId, media);
  }
  return url;
}

export function getCachedMediaUrl(id: string): string | null {
  return objectUrlCache.get(id) || null;
}

