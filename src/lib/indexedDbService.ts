// IndexedDB Service for instant local punch persistence and offline cache

const DB_NAME = "PontoDigitalDB";
const DB_VERSION = 2;

let dbInstance: IDBDatabase | null = null;

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof window !== "undefined" && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        const granted = await navigator.storage.persist();
        console.log(`[PWA Storage] Persistent storage request granted: ${granted}`);
        return granted;
      }
      return true;
    } catch (err) {
      console.warn("[PWA Storage] Persistent storage error:", err);
      return false;
    }
  }
  return false;
}

export function initIndexedDB(): Promise<IDBDatabase> {
  requestPersistentStorage().catch(() => {});
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      return resolve(dbInstance);
    }
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not supported in this environment"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for individual instant punches
      if (!db.objectStoreNames.contains("punches")) {
        const punchStore = db.createObjectStore("punches", { keyPath: "id", autoIncrement: true });
        punchStore.createIndex("userId", "userId", { unique: false });
        punchStore.createIndex("dayKey", "dayKey", { unique: false });
        punchStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // Store for complete PontosGlobal map
      if (!db.objectStoreNames.contains("pontosGlobal")) {
        db.createObjectStore("pontosGlobal", { keyPath: "userId" });
      }

      // Store for offline action queue
      if (!db.objectStoreNames.contains("offlineQueue")) {
        db.createObjectStore("offlineQueue", { keyPath: "id", autoIncrement: true });
      }

      // Store for users list (offline authentication support)
      if (!db.objectStoreNames.contains("users")) {
        db.createObjectStore("users", { keyPath: "id" });
      }

      // Store for auth session
      if (!db.objectStoreNames.contains("authSession")) {
        db.createObjectStore("authSession", { keyPath: "key" });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.warn("[IndexedDB] Error initializing database:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
  Instantly saves a punch entry into IndexedDB before network response.
 */
export async function savePunchToIndexedDB(userId: number, dayKey: string, punch: any): Promise<boolean> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("punches", "readwrite");
      const store = tx.objectStore("punches");
      const record = {
        userId,
        dayKey,
        punch,
        timestamp: Date.now(),
        synced: false
      };
      const req = store.add(record);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => {
        console.warn("[IndexedDB] Failed to save instant punch record:", e);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] savePunchToIndexedDB error:", err);
    return false;
  }
}

/**
  Saves the full or partial PontosGlobal state to IndexedDB.
 */
export async function savePontosToIndexedDB(pontos: Record<number, any>): Promise<boolean> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("pontosGlobal", "readwrite");
      const store = tx.objectStore("pontosGlobal");
      for (const userIdStr of Object.keys(pontos)) {
        const userId = Number(userIdStr);
        store.put({
          userId,
          days: pontos[userId],
          updatedAt: Date.now()
        });
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn("[IndexedDB] Failed to save pontosGlobal:", e);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] savePontosToIndexedDB error:", err);
    return false;
  }
}

/**
  Retrieves PontosGlobal stored in IndexedDB.
 */
export async function getPontosFromIndexedDB(): Promise<Record<number, any>> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("pontosGlobal", "readonly");
      const store = tx.objectStore("pontosGlobal");
      const req = store.getAll();
      req.onsuccess = () => {
        const result: Record<number, any> = {};
        const rows = req.result || [];
        for (const row of rows) {
          if (row && row.userId) {
            result[row.userId] = row.days || {};
          }
        }
        resolve(result);
      };
      req.onerror = () => resolve({});
    });
  } catch (err) {
    console.warn("[IndexedDB] getPontosFromIndexedDB error:", err);
    return {};
  }
}

/**
  Retrieves the latest 5 day records for a specific user from IndexedDB.
 */
export async function getRecentPunchesFromIndexedDB(userId: number, limit: number = 5): Promise<Record<string, any[]>> {
  try {
    const allPontos = await getPontosFromIndexedDB();
    const userDays = allPontos[userId] || {};
    const sortedKeys = Object.keys(userDays).sort().reverse().slice(0, limit);
    const result: Record<string, any[]> = {};
    for (const key of sortedKeys) {
      result[key] = userDays[key];
    }
    return result;
  } catch (err) {
    console.warn("[IndexedDB] getRecentPunchesFromIndexedDB error:", err);
    return {};
  }
}

/**
  Saves user records into IndexedDB for offline login matching.
 */
export async function saveUsersToIndexedDB(users: any[]): Promise<boolean> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("users", "readwrite");
      const store = tx.objectStore("users");
      for (const u of users) {
        if (u && u.id) {
          store.put(u);
        }
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn("[IndexedDB] saveUsersToIndexedDB error:", e);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] saveUsersToIndexedDB catch error:", err);
    return false;
  }
}

/**
  Retrieves saved users list from IndexedDB.
 */
export async function getUsersFromIndexedDB(): Promise<any[]> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("users", "readonly");
      const store = tx.objectStore("users");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("[IndexedDB] getUsersFromIndexedDB error:", err);
    return [];
  }
}

/**
  Saves active user auth session to IndexedDB.
 */
export async function saveAuthSessionToIndexedDB(user: any | null): Promise<boolean> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("authSession", "readwrite");
      const store = tx.objectStore("authSession");
      if (user) {
        store.put({ key: "currentUser", user, savedAt: Date.now() });
      } else {
        store.delete("currentUser");
      }
      tx.oncomplete = () => resolve(true);
      tx.onerror = (e) => {
        console.warn("[IndexedDB] saveAuthSessionToIndexedDB error:", e);
        resolve(false);
      };
    });
  } catch (err) {
    console.warn("[IndexedDB] saveAuthSessionToIndexedDB catch error:", err);
    return false;
  }
}

export interface QueueItem {
  id?: number;
  type: "saveUserPontos" | "saveAuditLog";
  payload: any;
  createdAt: number;
}

export async function addToSyncQueue(type: "saveUserPontos" | "saveAuditLog", payload: any): Promise<boolean> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("offlineQueue", "readwrite");
      const store = tx.objectStore("offlineQueue");
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const items: QueueItem[] = getAllReq.result || [];
        let existingItem: QueueItem | undefined;
        if (type === "saveUserPontos" && payload?.userId) {
          existingItem = items.find(i => i.type === "saveUserPontos" && i.payload?.userId === payload.userId);
        }
        if (existingItem) {
          existingItem.payload = payload;
          existingItem.createdAt = Date.now();
          const putReq = store.put(existingItem);
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => resolve(false);
        } else {
          const item: QueueItem = { type, payload, createdAt: Date.now() };
          const addReq = store.add(item);
          addReq.onsuccess = () => resolve(true);
          addReq.onerror = () => resolve(false);
        }
      };
      getAllReq.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn("[IndexedDB] addToSyncQueue error:", err);
    return false;
  }
}

export async function getSyncQueue(): Promise<QueueItem[]> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("offlineQueue", "readonly");
      const store = tx.objectStore("offlineQueue");
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    console.warn("[IndexedDB] getSyncQueue error:", err);
    return [];
  }
}

export async function removeFromSyncQueue(id: number): Promise<boolean> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("offlineQueue", "readwrite");
      const store = tx.objectStore("offlineQueue");
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn("[IndexedDB] removeFromSyncQueue error:", err);
    return false;
  }
}

export async function wipeAllLocalData(): Promise<void> {
  try {
    localStorage.clear();
  } catch (_) {}
  try {
    sessionStorage.clear();
  } catch (_) {}

  try {
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (_) {}
      dbInstance = null;
    }
    if (typeof indexedDB !== "undefined") {
      // Directly delete known databases for cross-browser reliability (Safari iOS safe)
      const knownDbs = [DB_NAME, "pontos_offline_db", "hr_registro_ponto_db"];
      for (const name of knownDbs) {
        try {
          indexedDB.deleteDatabase(name);
        } catch (_) {}
      }
      
      // Secondary optional check if indexedDB.databases is available without throwing
      if (typeof indexedDB.databases === "function") {
        try {
          const dbs = await indexedDB.databases();
          if (Array.isArray(dbs)) {
            for (const dbInfo of dbs) {
              if (dbInfo && dbInfo.name) {
                try {
                  indexedDB.deleteDatabase(dbInfo.name);
                } catch (_) {}
              }
            }
          }
        } catch (_) {
          // Ignore unsupported browser API failures silently
        }
      }
    }
  } catch (err) {
    console.warn("[IndexedDB] wipeAllLocalData error:", err);
  }
}

/**
  Retrieves active auth session from IndexedDB.
 */
export async function getAuthSessionFromIndexedDB(): Promise<any | null> {
  try {
    const db = await initIndexedDB();
    return new Promise((resolve) => {
      const tx = db.transaction("authSession", "readonly");
      const store = tx.objectStore("authSession");
      const req = store.get("currentUser");
      req.onsuccess = () => {
        const res = req.result;
        resolve(res ? res.user : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("[IndexedDB] getAuthSessionFromIndexedDB error:", err);
    return null;
  }
}
