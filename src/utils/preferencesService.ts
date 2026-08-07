import { Preferences } from "@capacitor/preferences";

export interface OfflinePunchItem {
  userId: number;
  dayKey: string;
  slotIdx: number;
  hora: string;
  tipo: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  registradoEm: string;
  dispositivoLocalHora: string;
  gravadoOffline: boolean;
  consentimentoGeoloc: boolean;
  obs?: string;
  statusAprovacao?: "pendente" | "aprovado" | "rejeitado";
}

// Memory cache for immediate synchronous access when needed
let memoryClockOffset = 0;
let memoryLastPunchTs = 0;

// Initialize memory offset from localStorage fallback synchronously on module load
try {
  const cachedOffset = localStorage.getItem("hr_clock_offset");
  if (cachedOffset) memoryClockOffset = Number(cachedOffset) || 0;
  const cachedLastTs = localStorage.getItem("last_punch_timestamp");
  if (cachedLastTs) memoryLastPunchTs = Number(cachedLastTs) || 0;
} catch (_) {}

/**
 * Helper to get item from Preferences with localStorage fallback
 */
export async function getPref(key: string, defaultValue: string | null = null): Promise<string | null> {
  try {
    const { value } = await Preferences.get({ key });
    if (value !== null && value !== undefined) {
      return value;
    }
  } catch (err) {
    console.warn(`[Preferences] Error reading key ${key}:`, err);
  }
  try {
    return localStorage.getItem(key) ?? defaultValue;
  } catch (_) {
    return defaultValue;
  }
}

/**
 * Helper to set item in Preferences with localStorage fallback mirror
 */
export async function setPref(key: string, value: string): Promise<void> {
  try {
    await Preferences.set({ key, value });
  } catch (err) {
    console.warn(`[Preferences] Error writing key ${key}:`, err);
  }
  try {
    localStorage.setItem(key, value);
  } catch (_) {}
}

/**
 * Helper to remove item from Preferences
 */
export async function removePref(key: string): Promise<void> {
  try {
    await Preferences.remove({ key });
  } catch (err) {
    console.warn(`[Preferences] Error removing key ${key}:`, err);
  }
  try {
    localStorage.removeItem(key);
  } catch (_) {}
}

/**
 * Save an offline punch to the offline_punches_queue array in Preferences
 */
export async function saveOfflinePunch(item: OfflinePunchItem): Promise<void> {
  try {
    const currentQueue = await loadOfflineQueue();
    // Filter out duplicate punch for same user, dayKey, slotIdx if already present
    const filtered = currentQueue.filter(
      p => !(p.userId === item.userId && p.dayKey === item.dayKey && p.slotIdx === item.slotIdx)
    );
    filtered.push(item);
    await setPref("offline_punches_queue", JSON.stringify(filtered));
    console.log(`[Preferences] Saved offline punch to native disk for user ${item.userId}, day ${item.dayKey}, slot ${item.slotIdx}`);
  } catch (err) {
    console.error("[Preferences] Error saving offline punch:", err);
  }
}

/**
 * Load the offline punches queue from Preferences
 */
export async function loadOfflineQueue(): Promise<OfflinePunchItem[]> {
  try {
    const raw = await getPref("offline_punches_queue", "[]");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[Preferences] Error loading offline queue:", err);
    return [];
  }
}

/**
 * Remove confirmed/synced punches from offline queue
 */
export async function clearSyncedPunches(confirmedPunches: OfflinePunchItem[]): Promise<void> {
  if (!confirmedPunches || confirmedPunches.length === 0) return;
  try {
    const currentQueue = await loadOfflineQueue();
    const remaining = currentQueue.filter(item => {
      const isConfirmed = confirmedPunches.some(
        c => c.userId === item.userId && c.dayKey === item.dayKey && c.slotIdx === item.slotIdx
      );
      return !isConfirmed;
    });
    if (remaining.length === 0) {
      await clearOfflineQueue();
    } else {
      await setPref("offline_punches_queue", JSON.stringify(remaining));
    }
    console.log(`[Preferences] Cleared ${confirmedPunches.length} synced punches. Remaining in queue: ${remaining.length}`);
  } catch (err) {
    console.error("[Preferences] Error clearing synced punches:", err);
  }
}

/**
 * Remove ENTIRE offline queue from native disk.
 * Call after syncNow() returns success or when all punches are synced.
 */
export async function clearOfflineQueue(): Promise<void> {
  try {
    await Preferences.remove({ key: "offline_punches_queue" });
    await setPref("offline_punches_queue", "[]");
    console.log("[Preferences] Fila offline completa removida do disco.");
  } catch (err) {
    console.error("[Preferences] Erro ao limpar fila offline:", err);
  }
}

/**
 * Synchronize clock with server (when online) and store offset in Preferences
 */
export async function syncClockWithServer(): Promise<number> {
  if (!navigator.onLine) {
    const cached = await getPref("hr_clock_offset", "0");
    const offset = Number(cached) || 0;
    memoryClockOffset = offset;
    return offset;
  }

  try {
    const startTime = Date.now();
    const response = await fetch("/api/health", { method: "HEAD", cache: "no-store" }).catch(() => null);

    if (response) {
      const dateHeader = response.headers.get("date");
      if (dateHeader) {
        const serverTime = new Date(dateHeader).getTime();
        const endTime = Date.now();
        const latency = (endTime - startTime) / 2;
        const offset = Math.round((serverTime + latency) - endTime);

        memoryClockOffset = offset;
        await setPref("hr_clock_offset", String(offset));
        await setPref("last_clock_sync", String(Date.now()));
        console.log(`[ClockSync] Server clock offset synced: ${offset}ms`);
        return offset;
      }
    }
  } catch (err) {
    console.warn("[ClockSync] Server clock fetch error, using cached offset:", err);
  }

  const cached = await getPref("hr_clock_offset", "0");
  const offset = Number(cached) || 0;
  memoryClockOffset = offset;
  return offset;
}

/**
 * Get secure Brasilia Date (online or offline with saved offset)
 */
export async function getSecureTime(): Promise<{ date: Date; timestamp: number; formatted: string }> {
  const cachedOffsetStr = await getPref("hr_clock_offset", "0");
  const offset = Number(cachedOffsetStr) || 0;
  memoryClockOffset = offset;

  const realTs = Date.now() + offset;
  const date = new Date(realTs);

  const formatted = date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });

  return { date, timestamp: realTs, formatted };
}

/**
 * Synchronous version of secure time using memory/cached offset
 */
export function getSecureTimeSync(): Date {
  return new Date(Date.now() + memoryClockOffset);
}

/**
 * Save timestamp of last punch into Preferences under last_punch_timestamp
 */
export async function saveLastPunchTimestamp(timestamp: number): Promise<void> {
  memoryLastPunchTs = timestamp;
  await setPref("last_punch_timestamp", String(timestamp));
}

/**
 * Check for anti-tampering (clock wound back)
 * Compare Date.now() against last_punch_timestamp
 */
export async function checkClockTampering(): Promise<{ isTampered: boolean; message?: string }> {
  try {
    const rawLastTs = await getPref("last_punch_timestamp", "0");
    const lastPunchTs = Number(rawLastTs) || memoryLastPunchTs || 0;

    if (lastPunchTs > 0) {
      const currentNow = Date.now();
      // Allow a small 3-second tolerance buffer for minor system clock precision variance
      if (currentNow < lastPunchTs - 3000) {
        console.warn(`[Anti-Tampering] Clock tampering detected! Current Date.now() (${currentNow}) < last_punch_timestamp (${lastPunchTs})`);
        return {
          isTampered: true,
          message: "Relógio do dispositivo foi alterado. Conecte-se à internet para sincronizar o horário antes de bater o ponto."
        };
      }
    }
  } catch (err) {
    console.error("[Anti-Tampering] Error checking clock tampering:", err);
  }

  return { isTampered: false };
}

/**
 * Migrate legacy localStorage values to @capacitor/preferences
 */
export async function migrateLocalStorageToPreferences(): Promise<void> {
  const keysToMigrate = [
    "hr_clock_offset",
    "hr_cached_minimo_horas_dia",
    "hr_cached_empresa_config",
    "modo_leve",
    "last_punch_timestamp",
    "offline_punches_queue"
  ];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("tour_visto_") && !keysToMigrate.includes(k)) {
        keysToMigrate.push(k);
      }
    }

    for (const key of keysToMigrate) {
      const prefVal = await getPref(key);
      const localVal = localStorage.getItem(key);
      if (!prefVal && localVal) {
        await setPref(key, localVal);
      }
    }
  } catch (err) {
    console.warn("[Preferences] Migration warning:", err);
  }
}

/**
 * Apply offline queue to pontosGlobal state
 */
export async function applyOfflineQueueToPontos(
  pontosGlobal: Record<number, Record<string, any[]>>,
  userId: number
): Promise<Record<number, Record<string, any[]>>> {
  const queue = await loadOfflineQueue();
  if (!queue || queue.length === 0) return pontosGlobal;

  const merged = JSON.parse(JSON.stringify(pontosGlobal));

  for (const item of queue) {
    if (item.userId !== userId) continue;

    if (!merged[userId]) merged[userId] = {};
    if (!merged[userId][item.dayKey]) merged[userId][item.dayKey] = [null, null, null, null];

    const dayArr = merged[userId][item.dayKey];
    while (dayArr.length < 4) dayArr.push(null);

    dayArr[item.slotIdx] = {
      hora: item.hora,
      tipo: item.tipo,
      registradoEm: item.registradoEm,
      serverTime: "pending",
      latitude: item.latitude,
      longitude: item.longitude,
      accuracy: item.accuracy,
      consentimentoGeoloc: item.consentimentoGeoloc,
      dispositivoLocalHora: item.dispositivoLocalHora,
      gravadoOffline: true,
      obs: item.obs || undefined,
    };
  }

  return merged;
}