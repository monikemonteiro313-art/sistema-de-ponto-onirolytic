import { Preferences } from "@capacitor/preferences";
import { getHoraOficial } from "./horaHelper";

export interface OfflinePunchItem {
  userId: number;
  dayKey: string;
  slotIdx: number;
  hora: string;
  tipo: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  fotoComprovante?: string | null;
  registradoEm: string;
  dispositivoLocalHora: string;
  gravadoOffline: boolean;
  pendingSync?: boolean;
  consentimentoGeoloc: boolean;
  obs?: string;
  statusAprovacao?: "pendente" | "aprovado" | "rejeitado";
}

// Memory cache for sub-millisecond synchronous access
let memoryClockOffset = 0;
let memoryLastPunchTs = 0;
let memoryOfflineQueue: OfflinePunchItem[] = [];

const QUEUE_STORAGE_KEY = "offline_punches_queue";

// Initialize memory values synchronously from localStorage fallback on module load
try {
  const cachedOffset = localStorage.getItem("hr_clock_offset");
  if (cachedOffset) memoryClockOffset = Number(cachedOffset) || 0;

  const cachedLastTs = localStorage.getItem("last_punch_timestamp");
  if (cachedLastTs) memoryLastPunchTs = Number(cachedLastTs) || 0;

  const cachedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
  if (cachedQueue) memoryOfflineQueue = JSON.parse(cachedQueue) || [];
} catch (_) {
  memoryOfflineQueue = [];
}

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

// ==================== FILA OFFLINE DE ARMAZENAMENTO LOCAL (IMEDIATO) ====================

/**
 * Grava o ponto na fila local em memória e em disco (<10ms) antes de qualquer tentativa de rede.
 */
export async function saveOfflinePunch(item: OfflinePunchItem): Promise<void> {
  try {
    // Isolamento dos Buffers Offline: Garante que registros de ponto enviem apenas dados do ponto
    const cleanItem: OfflinePunchItem = {
      userId: Number(item.userId),
      dayKey: String(item.dayKey),
      slotIdx: Number(item.slotIdx),
      hora: String(item.hora),
      tipo: String(item.tipo || "Entrada"),
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      accuracy: item.accuracy ?? null,
      fotoComprovante: item.fotoComprovante || null,
      registradoEm: item.registradoEm || new Date().toISOString(),
      dispositivoLocalHora: item.dispositivoLocalHora || new Date().toISOString(),
      gravadoOffline: true,
      pendingSync: true,
      consentimentoGeoloc: Boolean(item.consentimentoGeoloc),
      obs: item.obs || undefined,
      statusAprovacao: item.statusAprovacao || undefined
    };

    // 1. Atualização instantânea em memória (< 1ms)
    const existingIdx = memoryOfflineQueue.findIndex(
      q => Number(q.userId) === Number(cleanItem.userId) && q.dayKey === cleanItem.dayKey && q.slotIdx === cleanItem.slotIdx
    );

    if (existingIdx >= 0) {
      memoryOfflineQueue[existingIdx] = cleanItem;
    } else {
      memoryOfflineQueue.push(cleanItem);
    }

    const json = JSON.stringify(memoryOfflineQueue);

    // 2. Gravação em disco síncrona via localStorage e assíncrona via Preferences (< 10ms)
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, json);
    } catch (_) {}

    await setPref(QUEUE_STORAGE_KEY, json);
    console.log(`[OfflineQueue] Ponto gravado no disco local com sucesso (${memoryOfflineQueue.length} na fila).`);
  } catch (err) {
    console.error("[OfflineQueue] Erro ao salvar ponto na fila offline local:", err);
  }
}

/**
 * Carrega a fila offline mantida no armazenamento do dispositivo.
 */
export async function loadOfflineQueue(): Promise<OfflinePunchItem[]> {
  try {
    const stored = await getPref(QUEUE_STORAGE_KEY);
    if (stored) {
      const parsed: OfflinePunchItem[] = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        memoryOfflineQueue = parsed;
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[OfflineQueue] Erro ao ler fila do armazenamento, utilizando cache em memória:", err);
  }
  return memoryOfflineQueue;
}

/**
 * Remove da fila os pontos que já foram confirmados e salvos no servidor.
 */
export async function clearSyncedPunches(confirmedPunches: Array<{ userId: number | string; dayKey: string; slotIdx: number } | OfflinePunchItem>): Promise<void> {
  if (!confirmedPunches || confirmedPunches.length === 0) return;

  try {
    const currentQueue = await loadOfflineQueue();
    const remaining = currentQueue.filter(item => {
      return !confirmedPunches.some(
        c => Number(c.userId) === Number(item.userId) && c.dayKey === item.dayKey && c.slotIdx === item.slotIdx
      );
    });

    memoryOfflineQueue = remaining;
    const json = JSON.stringify(remaining);
    
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, json);
    } catch (_) {}

    await setPref(QUEUE_STORAGE_KEY, json);
    console.log(`[OfflineQueue] Fila atualizada. Restantes: ${remaining.length} item(ns).`);
  } catch (err) {
    console.error("[OfflineQueue] Erro ao limpar pontos sincronizados:", err);
  }
}

/**
 * Limpa completamente a fila de pontos offline.
 */
export async function clearOfflineQueue(): Promise<void> {
  memoryOfflineQueue = [];
  try {
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  } catch (_) {}
  await removePref(QUEUE_STORAGE_KEY);
  console.log("[OfflineQueue] Fila offline zerada com sucesso.");
}

/**
 * Aplica os pontos pendentes da fila local sobre a estrutura de pontos do usuário no React state.
 */
export async function applyOfflineQueueToPontos(
  pontosGlobal: Record<number | string, Record<string, any[]>>,
  targetUserId?: number | string
): Promise<Record<number | string, Record<string, any[]>>> {
  const queue = await loadOfflineQueue();
  if (!queue || queue.length === 0) return pontosGlobal;

  const merged = JSON.parse(JSON.stringify(pontosGlobal || {}));

  for (const item of queue) {
    const itemUserId = Number(item.userId);
    if (targetUserId !== undefined && targetUserId !== null && Number(targetUserId) !== itemUserId) continue;

    if (!merged[itemUserId]) merged[itemUserId] = {};
    if (!merged[itemUserId][item.dayKey]) merged[itemUserId][item.dayKey] = [null, null, null, null];

    const dayArr = merged[itemUserId][item.dayKey];
    while (dayArr.length < 4) dayArr.push(null);

    dayArr[item.slotIdx] = {
      hora: item.hora,
      tipo: item.tipo,
      registradoEm: item.registradoEm,
      serverTime: item.dispositivoLocalHora || item.hora,
      latitude: item.latitude,
      longitude: item.longitude,
      accuracy: item.accuracy,
      fotoComprovante: item.fotoComprovante || undefined,
      consentimentoGeoloc: item.consentimentoGeoloc,
      dispositivoLocalHora: item.dispositivoLocalHora || item.hora,
      gravadoOffline: true,
      pendingSync: true,
      obs: item.obs || undefined,
      statusAprovacao: item.statusAprovacao
    };
  }

  return merged;
}

/**
 * Descarrega com segurança a fila local (offline_punches_queue) enviando para o Firebase.
 * REGRA RIGOROSA: O ponto SÓ é removido da fila local DEPOIS que o Firebase confirma o recebimento (sem erro).
 * EXCEÇÃO DE SEGURANÇA (48H): Se a gravação direta falhar repetidamente e o ponto tiver mais de 48h, ele é convertido em Pré-Ponto com localização e foto completas.
 */
export async function flushOfflinePunchesQueueToFirebase(
  saveUserPontosFn: (userId: number | string, days: any) => Promise<any>,
  convertOldPunchToPrePontoFn?: (item: OfflinePunchItem) => Promise<void>
): Promise<number> {
  const queue = await loadOfflineQueue();
  if (!queue || queue.length === 0) return 0;

  console.log(`[OfflineQueue Flush] Processando ${queue.length} ponto(s) retido(s) na fila local (Preferences/LocalStorage)...`);

  const itemsByUser: Record<number, OfflinePunchItem[]> = {};
  for (const item of queue) {
    const uId = Number(item.userId);
    if (!itemsByUser[uId]) itemsByUser[uId] = [];
    itemsByUser[uId].push(item);
  }

  let syncedTotal = 0;

  for (const userIdStr of Object.keys(itemsByUser)) {
    const userId = Number(userIdStr);
    const userItems = itemsByUser[userId];
    if (!userItems || userItems.length === 0) continue;

    const daysToSave: Record<string, any[]> = {};
    for (const item of userItems) {
      if (!daysToSave[item.dayKey]) {
        daysToSave[item.dayKey] = [null, null, null, null];
      }
      const dayArr = daysToSave[item.dayKey];
      while (dayArr.length < 4) dayArr.push(null);

      dayArr[item.slotIdx] = {
        hora: item.hora,
        tipo: item.tipo,
        registradoEm: item.registradoEm,
        serverTime: item.dispositivoLocalHora || item.hora,
        latitude: item.latitude,
        longitude: item.longitude,
        accuracy: item.accuracy,
        fotoComprovante: item.fotoComprovante || undefined,
        consentimentoGeoloc: item.consentimentoGeoloc,
        dispositivoLocalHora: item.dispositivoLocalHora || item.hora,
        obs: item.obs || undefined,
        statusAprovacao: item.statusAprovacao
      };
    }

    try {
      // 1. Tenta enviar para o Firebase como ponto normal
      await saveUserPontosFn(userId, daysToSave);
      
      // 2. SOMENTE APÓS O FIREBASE CONFIRMAR (resoluçao da Promise sem erro), remove da fila local!
      await clearSyncedPunches(userItems);
      syncedTotal += userItems.length;
      console.log(`✅ [OfflineQueue Flush] ${userItems.length} ponto(s) do usuário ${userId} salvos no Firebase e REMOVIDOS da fila com sucesso!`);
    } catch (err) {
      console.warn(`❌ [OfflineQueue Flush] Falha ao enviar ${userItems.length} ponto(s) do usuário ${userId} para o Firebase. Analisando retenção de 48h:`, err);
      
      // REGRA DE SEGURANÇA (48 HORAS): Se a gravação direta falhar e o ponto tiver mais de 48h retido localmente,
      // ele é convertido em pré-ponto MANTENDO a localização, foto e horário exato.
      const nowTs = Date.now();
      const itemsToClear: OfflinePunchItem[] = [];

      for (const item of userItems) {
        const itemTs = item.registradoEm ? new Date(item.registradoEm).getTime() : 0;
        const hoursOld = itemTs > 0 ? (nowTs - itemTs) / (1000 * 60 * 60) : 0;

        if (hoursOld >= 48 && convertOldPunchToPrePontoFn) {
          console.warn(`⚠️ [OfflineQueue] Ponto retido há mais de 48h (${Math.round(hoursOld)}h) para usuário ${userId}. Convertendo para Pré-Ponto com localização e foto completas...`);
          try {
            await convertOldPunchToPrePontoFn(item);
            itemsToClear.push(item);
          } catch (preErr) {
            console.error(`[OfflineQueue] Falha ao converter ponto de 48h em Pré-Ponto:`, preErr);
          }
        }
      }

      if (itemsToClear.length > 0) {
        await clearSyncedPunches(itemsToClear);
        syncedTotal += itemsToClear.length;
      }
    }

    await new Promise(r => setTimeout(r, 200));
  }

  return syncedTotal;
}

// ==================== SINCRONIZAÇÃO DE RELÓGIO ULTRA-RESILIENTE ====================

/**
 * Sincroniza o relógio do aplicativo com o horário de Brasília / servidor.
 * Possui AbortController com timeout rígido de 2.5s para evitar travamento em conexões ruins.
 */
export async function syncClockWithServer(): Promise<number> {
  const getCachedOffset = (): number => {
    try {
      const cached = localStorage.getItem("hr_clock_offset");
      if (cached) {
        const num = Number(cached) || 0;
        memoryClockOffset = num;
        return num;
      }
    } catch (_) {}
    return memoryClockOffset;
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return getCachedOffset();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 2500);

  try {
    const fetchOfficialTime = async (): Promise<number> => {
      // 1. Tenta API de Brasília
      const oficial = await getHoraOficial().catch(() => null);
      if (oficial && oficial.fonte === "brasilia-api") {
        const offset = oficial.timestamp - Date.now();
        memoryClockOffset = offset;
        await setPref("hr_clock_offset", String(offset));
        await setPref("last_clock_sync", String(Date.now()));
        return offset;
      }

      // 2. Backup com endpoint do servidor (com AbortController)
      const startTime = Date.now();
      const response = await fetch("/api/health", { 
        method: "HEAD", 
        cache: "no-store",
        signal: controller.signal 
      }).catch(() => null);

      if (response && response.headers) {
        const dateHeader = response.headers.get("date");
        if (dateHeader) {
          const serverTime = new Date(dateHeader).getTime();
          const endTime = Date.now();
          const latency = (endTime - startTime) / 2;
          const offset = Math.round((serverTime + latency) - endTime);
          memoryClockOffset = offset;
          await setPref("hr_clock_offset", String(offset));
          await setPref("last_clock_sync", String(Date.now()));
          return offset;
        }
      }

      return getCachedOffset();
    };

    const offsetResult = await fetchOfficialTime();
    clearTimeout(timeoutId);
    return offsetResult;
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("[ClockSync] Timeout (2.5s) ou falha de conexão na sincronização do relógio. Utilizando offset em cache.");
    return getCachedOffset();
  }
}

/**
 * Retorna o horário seguro de Brasília utilizando o offset calculado.
 */
export async function getSecureTime(): Promise<{ date: Date; timestamp: number; formatted: string }> {
  const cachedOffsetStr = await getPref("hr_clock_offset", "0");
  const offset = Number(cachedOffsetStr) || memoryClockOffset || 0;
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
 * Versão síncrona do horário seguro utilizando offset em memória
 */
export function getSecureTimeSync(): Date {
  const rawLocal = new Date();
  return new Date(rawLocal.getTime() + memoryClockOffset);
}

/**
 * Salva carimbo de data/hora do último ponto para prevenção contra alteração de relógio
 */
export async function saveLastPunchTimestamp(timestamp: number): Promise<void> {
  memoryLastPunchTs = timestamp;
  await setPref("last_punch_timestamp", String(timestamp));
}

/**
 * Verifica se o relógio do celular foi atrasado intencionalmente
 */
export async function checkClockTampering(): Promise<{ isTampered: boolean; message?: string }> {
  try {
    const rawLastTs = await getPref("last_punch_timestamp", "0");
    const lastPunchTs = Number(rawLastTs) || memoryLastPunchTs || 0;

    if (lastPunchTs > 0) {
      const currentNow = Date.now() + memoryClockOffset;
      if (currentNow < lastPunchTs - 10000) {
        console.warn(`[Anti-Tampering] Relógio alterado! Hora atual (${currentNow}) < Último ponto (${lastPunchTs})`);
        return {
          isTampered: true,
          message: "Relógio do dispositivo foi alterado. Conecte-se à internet para sincronizar o horário antes de bater o ponto."
        };
      }
    }
  } catch (err) {
    console.error("[Anti-Tampering] Erro ao checar alteração do relógio:", err);
  }

  return { isTampered: false };
}

/**
 * Migra dados legados de localStorage para @capacitor/preferences
 */
export async function migrateLocalStorageToPreferences(): Promise<void> {
  const keysToMigrate = [
    "hr_clock_offset",
    "hr_cached_minimo_horas_dia",
    "hr_cached_empresa_config",
    "modo_leve",
    "last_punch_timestamp",
    QUEUE_STORAGE_KEY
  ];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith("tour_visto_") || k.startsWith("termos_aceitos_") || k.startsWith("termo_aceito_")) && !keysToMigrate.includes(k)) {
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

// ==================== PERSISTÊNCIA DE USUÁRIO LOGADO (OFFLINE-FIRST) ====================

const USER_CACHE_KEY = "__cached_current_user";
const USERS_LIST_CACHE_KEY = "__cached_users_list";

export async function saveCurrentUserToDisk(user: any): Promise<void> {
  try {
    await Preferences.set({ key: USER_CACHE_KEY, value: JSON.stringify(user) });
  } catch (e) {
    console.warn("[Preferences] Falha ao salvar currentUser:", e);
  }
}

export async function loadCurrentUserFromDisk(): Promise<any | null> {
  try {
    const { value } = await Preferences.get({ key: USER_CACHE_KEY });
    if (value) {
      return JSON.parse(value);
    }
  } catch (e) {
    console.warn("[Preferences] Falha ao carregar currentUser:", e);
  }
  return null;
}

export async function clearCurrentUserFromDisk(): Promise<void> {
  try {
    await Preferences.remove({ key: USER_CACHE_KEY });
  } catch (e) {
    console.warn("[Preferences] Falha ao limpar currentUser:", e);
  }
}

export async function saveUsersListToDisk(users: any[]): Promise<void> {
  try {
    await Preferences.set({ key: USERS_LIST_CACHE_KEY, value: JSON.stringify(users) });
  } catch (e) {
    console.warn("[Preferences] Falha ao salvar users list:", e);
  }
}

export async function loadUsersListFromDisk(): Promise<any[] | null> {
  try {
    const { value } = await Preferences.get({ key: USERS_LIST_CACHE_KEY });
    if (value) {
      return JSON.parse(value);
    }
  } catch (e) {
    console.warn("[Preferences] Falha ao carregar users list:", e);
  }
  return null;
}

export async function clearUsersListFromDisk(): Promise<void> {
  try {
    await Preferences.remove({ key: USERS_LIST_CACHE_KEY });
  } catch (e) {
    console.warn("[Preferences] Falha ao limpar users list:", e);
  }
}