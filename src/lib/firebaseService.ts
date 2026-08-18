import { db, fallbackToDefaultDatabase, triggerAutoHeal, isAssertionError } from "./firebase";
import { compressImageBase64 } from "../utils/hrHelpers";
import { 
  collection, 
  getDocs as firestoreGetDocs, 
  getDocsFromServer,
  getDocsFromCache,
  doc, 
  setDoc as firestoreSetDoc, 
  getDoc as firestoreGetDoc, 
  getDocFromServer,
  getDocFromCache,
  deleteDoc as firestoreDeleteDoc,
  updateDoc as firestoreUpdateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  enableNetwork,
  writeBatch,
  arrayUnion,
  increment,
  serverTimestamp,
  Timestamp,
  FieldValue
} from "firebase/firestore";

let hasFallenBack = false;
export let isUsingOfflineCache = false;

export async function testConnection(): Promise<void> {
  try {
    await firestoreGetDoc(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("[Firebase] Please check your Firebase configuration.");
    }
  }
}
testConnection();

export function getIsUsingOfflineCache(): boolean {
  return isUsingOfflineCache;
}

// Utility functions for Monthly Sharding and Daily Audit
/**
 * Retorna o "dia de ponto" considerando corte às 5h da manhã.
 * Ex: agora é 03:00 do dia 12/08 → retorna "2026-08-11" (ainda é turno do dia 11)
 * Ex: agora é 06:00 do dia 12/08 → retorna "2026-08-12"
 */
export function getDiaPontoReferencia(dataHora?: Date | string, horaCorte: number = 5): string {
  const ref = dataHora ? new Date(dataHora) : new Date();
  // Conversão estrita para o fuso horário de Brasília (-3h em relação ao UTC)
  const brasiliaDate = new Date(ref.getTime() - (3 * 3600 * 1000));
  let ano = brasiliaDate.getUTCFullYear();
  let mes = brasiliaDate.getUTCMonth();
  let dia = brasiliaDate.getUTCDate();
  let hora = brasiliaDate.getUTCHours();

  // Se o horário for antes do corte (ex: 5h), ainda conta como "ontem"
  if (hora < horaCorte) {
    const ontem = new Date(Date.UTC(ano, mes, dia - 1));
    ano = ontem.getUTCFullYear();
    mes = ontem.getUTCMonth();
    dia = ontem.getUTCDate();
  }

  const mm = String(mes + 1).padStart(2, "0");
  const dd = String(dia).padStart(2, "0");
  return `${ano}-${mm}-${dd}`;
}

/**
 * Retorna o mês de ponto considerando o corte às 5h.
 */
export function getMesPontoReferencia(dataHora?: Date | string, horaCorte: number = 5): string {
  return getDiaPontoReferencia(dataHora, horaCorte).substring(0, 7);
}

export function getMesAtual(): string {
  return getMesPontoReferencia();
}

export function getDiaAtual(): string {
  return getDiaPontoReferencia();
}

export function gerarIdDoc(userId: string | number, mes: string): string {
  return `${userId}_${mes}`;
}

export function gerarIdAudit(userId: string | number, dia: string): string {
  return `${userId}_${dia}`;
}



async function runWithFallback<T>(operation: (ref?: any) => Promise<T>, ref?: any, timeoutMs = 8000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Timeout de conexão com o banco de dados Firestore")), timeoutMs);
  });

  try {
    const result = await Promise.race([operation(ref), timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// Resilient server-first wrappers for imported Firestore operations
export function getDocs(colRefOrQuery: any): Promise<any> {
  return runWithFallback(async (r) => {
    const targetRef = r || colRefOrQuery;
    try {
      const snap = await firestoreGetDocs(targetRef);
      if (typeof navigator !== "undefined" && navigator.onLine) {
        isUsingOfflineCache = false;
      }
      return snap;
    } catch (serverErr: any) {
      console.warn("[Firebase] firestoreGetDocs failed, checking cache:", serverErr);
      const errMsg = serverErr?.message || String(serverErr);
      if (isAssertionError(errMsg)) {
        triggerAutoHeal(errMsg);
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        isUsingOfflineCache = true;
      }
      try {
        return await getDocsFromCache(targetRef);
      } catch {
        throw serverErr;
      }
    }
  }, colRefOrQuery, 8000);
}

export function getDoc(docRef: any): Promise<any> {
  return runWithFallback(async (r) => {
    const targetRef = r || docRef;
    try {
      const snap = await firestoreGetDoc(targetRef);
      if (typeof navigator !== "undefined" && navigator.onLine) {
        isUsingOfflineCache = false;
      }
      return snap;
    } catch (serverErr: any) {
      console.warn("[Firebase] firestoreGetDoc failed, checking cache:", serverErr);
      const errMsg = serverErr?.message || String(serverErr);
      if (isAssertionError(errMsg)) {
        triggerAutoHeal(errMsg);
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        isUsingOfflineCache = true;
      }
      try {
        return await getDocFromCache(targetRef);
      } catch {
        throw serverErr;
      }
    }
  }, docRef, 8000);
}

export async function forceServerFetch<T = any>(collectionName: string): Promise<T[]> {
  try {
    const colRef = collection(db, collectionName);
    const snap = await getDocs(colRef); // usa o wrapper resiliente com fallback para cache
    if (typeof navigator !== "undefined" && navigator.onLine) {
      isUsingOfflineCache = false;
    }
    const items: T[] = [];
    snap.forEach((docSnap: any) => {
      items.push({ id: docSnap.id, ...docSnap.data() } as T);
    });
    return items;
  } catch (err) {
    console.warn(`[Firebase] forceServerFetch failed for ${collectionName}:`, err);
    return [];
  }
}

function setDoc(docRef: any, data: any, options?: any): Promise<any> {
  return runWithFallback((r) => firestoreSetDoc(r || docRef, data, options), docRef, 30000);
}

function deleteDoc(docRef: any): Promise<any> {
  return runWithFallback((r) => firestoreDeleteDoc(r || docRef), docRef, 30000);
}

function updateDoc(docRef: any, data: any): Promise<any> {
  return runWithFallback((r) => firestoreUpdateDoc(r || docRef, data), docRef, 30000);
}

import { User, PontosGlobal, AuditLogEntry, EmpresaConfig, PrePonto, FolhaAceite, Alerta, Denuncia, SolicitacaoCorrecao, FolgaRemunerada } from "../types";
import { INITIAL_USERS, SEED_PONTOS } from "../data/mockData";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write"
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errMessage = error instanceof Error ? error.message : String(error);
  const isOffline = 
    errMessage.includes("offline") || 
    errMessage.includes("unavailable") || 
    errMessage.includes("Could not reach Cloud Firestore") ||
    errMessage.includes("Timeout") ||
    errMessage.includes("timeout") ||
    errMessage.includes("deadline") ||
    errMessage.includes("Network") ||
    errMessage.includes("network");
  const isAssertion = errMessage.includes("INTERNAL ASSERTION FAILED") || errMessage.includes("Unexpected state");
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  if (isOffline || isAssertion) {
    console.warn(`[Firestore ${isAssertion ? 'Assertion' : 'Offline/Timeout'}] ${operationType} on ${path}: ${errMessage}`);
  } else {
    console.error("Firestore Error: ", JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

// Helper to sanitize undefined values for Firestore to prevent errors
function cleanObject(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) {
    return obj.map(cleanObject);
  }
  if (typeof obj === "object") {
    if (obj instanceof FieldValue) {
      return obj;
    }
    if (obj.constructor && (
      obj.constructor.name === "FieldValueImpl" || 
      (obj.constructor.name && obj.constructor.name.includes("FieldValue")) || 
      (typeof obj.isEqual === "function" && typeof obj.toGeoPoint !== "function" && typeof obj.toDate !== "function")
    )) {
      return obj;
    }
    if (obj.toDate && typeof obj.toDate === "function") {
      try {
        return obj.toDate().toISOString();
      } catch {
        return new Date().toISOString();
      }
    }
    if (typeof obj.seconds === "number" && typeof obj.nanoseconds === "number" && Object.keys(obj).length === 2) {
      return new Date(obj.seconds * 1000).toISOString();
    }
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = cleanObject(val);
      }
    }
    return cleaned;
  }
  return obj;
}

// ==================== COST OPTIMIZATION: BUFFERS & CACHES ====================

// 1. Audit Buffer
let auditBuffer: AuditLogEntry[] = [];
let auditTimeout: ReturnType<typeof setTimeout> | null = null;
const AUDIT_BUFFER_MAX = 10;
const AUDIT_BUFFER_DELAY = 30000; // 30s

// 2. Points Buffer
let pontoBuffer = new Map<string, { userId: string | number; dayKey: string; dayData: any }>();
let pontoSyncTimeout: ReturnType<typeof setTimeout> | null = null;
const PONTO_BUFFER_DELAY = 300000; // 5 minutos (300.000 ms)
const PONTO_BUFFER_MAX_ITEMS = 5;

// 3. Users Cache (TTL 1 hour)
let usersCache: User[] | null = null;
let usersCacheTime = 0;
const USERS_CACHE_TTL = 3600000; // 1 hora

export function invalidateUsersCache(): void {
  usersCache = null;
  usersCacheTime = 0;
}

// 4. Connectivity Cooldown
let lastHealthCheckTime = 0;
const HEALTH_CHECK_COOLDOWN = 300000; // 5 minutos

// 5. Rate Limiter / Circuit Breaker for Sync
const MAX_SYNC_PER_MINUTE = 100;
let syncCount = 0;
let syncResetTime = Date.now();

export async function safeSync<T>(docData: T, syncFn: (data: T) => Promise<any>): Promise<boolean> {
  if (Date.now() - syncResetTime > 60000) {
    syncCount = 0;
    syncResetTime = Date.now();
  }
  if (syncCount >= MAX_SYNC_PER_MINUTE) {
    console.warn("[Sync Circuit Breaker] Limite de 5 sincronizações por minuto atingido. Aguardando próxima janela.");
    return false;
  }
  syncCount++;
  try {
    await syncFn(docData);
    return true;
  } catch (err) {
    console.warn("[Sync Circuit Breaker] Erro ao sincronizar item:", err);
    return false;
  }
}

// Unload Event Listener to flush remaining buffers
// Helper para persistir buffer no localStorage antes do unload
function persistBufferToLocalStorage(): void {
  if (typeof window === "undefined") return;
  if (auditBuffer.length > 0) {
    try {
      const existing = JSON.parse(localStorage.getItem("__pending_audit_buffer") || "[]");
      localStorage.setItem("__pending_audit_buffer", JSON.stringify([...existing, ...auditBuffer]));
    } catch {}
  }
  if (pontoBuffer.size > 0) {
    try {
      const existing = JSON.parse(localStorage.getItem("__pending_ponto_buffer") || "[]");
      const items = Array.from(pontoBuffer.values());
      localStorage.setItem("__pending_ponto_buffer", JSON.stringify([...existing, ...items]));
    } catch {}
  }
}

// Tentar flush sincrono via keepalive + backup no localStorage
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    persistBufferToLocalStorage();
    if (auditBuffer.length > 0) {
      try {
        const blob = new Blob([JSON.stringify({ auditLogs: auditBuffer })], { type: "application/json" });
        navigator.sendBeacon && navigator.sendBeacon("/api/flush-audit", blob);
      } catch {}
    }
    if (pontoBuffer.size > 0) {
      try {
        const blob = new Blob([JSON.stringify({ pontos: Array.from(pontoBuffer.values()) })], { type: "application/json" });
        navigator.sendBeacon && navigator.sendBeacon("/api/flush-pontos", blob);
      } catch {}
    }
  });
}

// Restaurar buffers pendentes do localStorage na inicialização
if (typeof window !== "undefined") {
  try {
    const pendingAudit = JSON.parse(localStorage.getItem("__pending_audit_buffer") || "[]");
    if (pendingAudit.length > 0) {
      auditBuffer.push(...pendingAudit);
      localStorage.removeItem("__pending_audit_buffer");
      flushAuditBuffer().catch(() => {});
    }
    const pendingPontos = JSON.parse(localStorage.getItem("__pending_ponto_buffer") || "[]");
    if (pendingPontos.length > 0) {
      for (const item of pendingPontos) {
        if (item && item.userId && item.dayKey) {
          pontoBuffer.set(`${item.userId}_${item.dayKey}`, item);
        }
      }
      localStorage.removeItem("__pending_ponto_buffer");
      syncPontosBuffer(true).catch(() => {});
    }
  } catch {}
}

// ==================== INITIALIZATION & SEEDING ====================

export async function initializeDbIfEmpty(existingUsers?: User[]) {
  if (existingUsers && existingUsers.length > 0) {
    return;
  }
  const usersColl = collection(db, "users");
  let usersSnapshot;
  try {
    usersSnapshot = await getDocs(usersColl);
  } catch (error) {
    console.warn("[Firebase] Could not check users collection (offline or unreachable):", error);
    return;
  }
  
  if (usersSnapshot && usersSnapshot.empty) {
    console.log("Firestore is empty. Seeding initial database with monthly sharding...");
    
    // Seed Users
    for (const u of INITIAL_USERS) {
      try {
        await setDoc(doc(db, "users", String(u.id)), cleanObject(u));
      } catch (error) {
        console.warn(`[Firebase] Offline/error writing user ${u.id}:`, error);
      }
    }

    // Seed Pontos sharded by month
    const currentMes = getMesAtual();
    for (const userIdStr of Object.keys(SEED_PONTOS)) {
      const userId = Number(userIdStr);
      const userDays = SEED_PONTOS[userId];
      if (userDays) {
        for (const dayKey of Object.keys(userDays)) {
          try {
            await saveDiaPonto(userId, dayKey, userDays[dayKey]);
          } catch (error) {
            console.warn(`[Firebase] Offline/error writing seed ponto for ${userId} day ${dayKey}:`, error);
          }
        }
      }
    }

    // Seed Configs
    try {
      await setDoc(doc(db, "config", "empresa"), cleanObject({ nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" }));
      await setDoc(doc(db, "config", "minimoHoras"), { value: 7 });
      await setDoc(doc(db, "config", "feriados"), { list: [] });
      await setDoc(doc(db, "config", "wizard"), { done: false });
    } catch (error) {
      console.warn("[Firebase] Offline/error writing config:", error);
    }
    
    console.log("Database seeding completed successfully!");
  }
}

// ==================== USERS FUNCTIONS (WITH CACHE) ====================

export async function fetchAllUsers(forceRefresh = false): Promise<User[]> {
  if (!forceRefresh && usersCache && (Date.now() - usersCacheTime < USERS_CACHE_TTL)) {
    return usersCache;
  }
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const list: User[] = [];
    usersSnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as User);
    });
    const sorted = list.sort((a, b) => a.id - b.id);
    usersCache = sorted;
    usersCacheTime = Date.now();
    return sorted;
  } catch (error) {
    console.warn("[Firebase] Error fetching users (offline?):", error);
    return usersCache || [];
  }
}

export async function saveUserToDb(user: User): Promise<void> {
  invalidateUsersCache();
  if (!user) {
    throw new Error("saveUserToDb: objeto user é null/undefined");
  }
  if (user.id === undefined || user.id === null) {
    throw new Error(`saveUserToDb: user.id está ${user.id}. Verifique se o cadastro está gerando ID antes de chamar updateUsers.`);
  }

  const cleanUserId = String(user.id).trim();
  if (!cleanUserId) {
    throw new Error("saveUserToDb: user.id virou string vazia após trim");
  }

  const cleanMat = user.matricula ? String(user.matricula).trim() : "";
  const cleanSenha = user.senha ? String(user.senha).trim() : `Senha@${cleanMat}`;
  
  const userToSave = {
    ...user,
    id: typeof user.id === "number" ? user.id : Number(cleanUserId) || user.id,
    matricula: cleanMat,
    senha: cleanSenha,
  };

  const payload = cleanObject(userToSave);
  
  console.log("🔥 [saveUserToDb] Salvando:", cleanUserId, "campos:", Object.keys(payload));
  
  await setDoc(doc(db, "users", cleanUserId), payload, { merge: true });
  
  const confirm = await getDoc(doc(db, "users", cleanUserId));
  if (!confirm.exists()) {
    throw new Error("saveUserToDb: documento sumiu após salvar");
  }
  
  console.log("✅ [saveUserToDb] Confirmado no servidor:", cleanUserId);
}

export async function updateUserSenhaInDb(userId: number | string, novaSenha: string, matricula?: string): Promise<void> {
  invalidateUsersCache();
  try {
    if (userId === undefined || userId === null) return;
    const cleanUserId = String(userId).trim();
    if (!cleanUserId) return;

    const cleanSenha = String(novaSenha).trim();
    const docRef = doc(db, "users", cleanUserId);
    const payload: Record<string, any> = { senha: cleanSenha };

    if (matricula) {
      const cleanMat = String(matricula).trim();
      if (cleanMat) {
        payload.matricula = cleanMat;
      }
    }

    await updateDoc(docRef, payload);
  } catch (error) {
    console.warn(`[Firebase] Failed to update password for user ${userId} in Firestore (offline?):`, error);
  }
}

export async function deleteUserFromDb(userId: number | string): Promise<void> {
  invalidateUsersCache();
  try {
    const cleanUserId = String(userId).trim();
    if (!cleanUserId) return;
    await deleteDoc(doc(db, "users", cleanUserId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
  }
}

// Helpers for punch formatting
async function prepareSingleDayPunches(dayArray: any): Promise<any> {
  if (!dayArray || !Array.isArray(dayArray)) return dayArray || [null, null, null, null];
  const mapped = await Promise.all(
    dayArray.map(async (punch: any) => {
      if (!punch) return null;
      const newPunch = { ...punch };

      // Preserva a hora local do dispositivo (momento exato do clique)
      if (!newPunch.dispositivoLocalHora) {
        newPunch.dispositivoLocalHora = newPunch.registradoEm || newPunch.hora || new Date().toISOString();
      }

      if (newPunch.serverTime === "pending" || !newPunch.serverTime) {
        newPunch.serverTime = new Date().toISOString();
      } else if (typeof newPunch.serverTime === "object") {
        if (typeof newPunch.serverTime.toDate === "function") {
          try {
            newPunch.serverTime = newPunch.serverTime.toDate().toISOString();
          } catch {
            newPunch.serverTime = new Date().toISOString();
          }
        } else if (typeof newPunch.serverTime.seconds === "number") {
          newPunch.serverTime = new Date(newPunch.serverTime.seconds * 1000).toISOString();
        }
      }
      if (newPunch.gravadoOffline) {
        delete newPunch.gravadoOffline;
      }
      if (newPunch.fotoAtestado && typeof newPunch.fotoAtestado === "string" && newPunch.fotoAtestado.startsWith("data:image")) {
        try {
          newPunch.fotoAtestado = await compressImageBase64(newPunch.fotoAtestado, 800, 800, 0.65);
        } catch (e) {
          console.warn("[FirebaseService] Could not compress fotoAtestado:", e);
        }
      }
      if (newPunch.fotoComprovante && typeof newPunch.fotoComprovante === "string" && newPunch.fotoComprovante.startsWith("data:image")) {
        try {
          newPunch.fotoComprovante = await compressImageBase64(newPunch.fotoComprovante, 800, 800, 0.65);
        } catch (e) {
          console.warn("[FirebaseService] Could not compress fotoComprovante:", e);
        }
      }
      return newPunch;
    })
  );
  while (mapped.length < 4) {
    mapped.push(null);
  }
  return mapped.slice(0, 4);
}

function resolveTimestamps(days: any): any {
  if (!days) return {};
  const result: any = {};
  for (const dayKey of Object.keys(days)) {
    const dayArray = days[dayKey];
    if (Array.isArray(dayArray)) {
      const mapped = dayArray.map((punch: any) => {
        if (!punch) return null;
        const newPunch = { ...punch };
        if (newPunch.serverTime && typeof newPunch.serverTime === "object" && typeof newPunch.serverTime.toDate === "function") {
          newPunch.serverTime = newPunch.serverTime.toDate().toISOString();
        }
        return newPunch;
      });
      while (mapped.length < 4) {
        mapped.push(null);
      }
      result[dayKey] = mapped.slice(0, 4);
    } else {
      result[dayKey] = dayArray;
    }
  }
  return result;
}

// ==================== PONTOS BUFFERING & SHARDING ====================

export async function saveDiaPontoBuffered(userId: number | string, dayKey: string, dayData: any): Promise<void> {
  pontoBuffer.set(`${userId}_${dayKey}`, { userId, dayKey, dayData });
  if (pontoBuffer.size >= PONTO_BUFFER_MAX_ITEMS) {
    await syncPontosBuffer(true);
    return;
  }
  if (!pontoSyncTimeout) {
    pontoSyncTimeout = setTimeout(() => syncPontosBuffer(true).catch(() => {}), PONTO_BUFFER_DELAY);
  }
}

export async function syncPontosBuffer(force = false): Promise<void> {
  if (pontoBuffer.size === 0) return;
  if (!force && pontoBuffer.size < PONTO_BUFFER_MAX_ITEMS) return;

  if (pontoSyncTimeout) {
    clearTimeout(pontoSyncTimeout);
    pontoSyncTimeout = null;
  }

  while (pontoBuffer.size > 0) {
    const items = Array.from(pontoBuffer.values()).slice(0, 3);
    for (const item of items) {
      pontoBuffer.delete(`${item.userId}_${item.dayKey}`);
    }
    try {
      await batchSaveDiasPonto(items);
    } catch (err) {
      // Re-adicionar ao buffer e salvar no localStorage como backup
      console.warn("[Sync] Falha ao sincronizar pontos, re-adicionando ao buffer:", err);
      for (const item of items) {
        pontoBuffer.set(`${item.userId}_${item.dayKey}`, item);
      }
      persistBufferToLocalStorage();
      break; // Parar para não loop infinito, tenta novamente no próximo ciclo
    }
  }
}

export async function forceSyncPontos(): Promise<void> {
  await syncPontosBuffer(true);
}

export async function fetchPontosMes(userId: number | string, mes: string = getMesAtual()): Promise<Record<string, any>> {
  await forceSyncPontos().catch(() => {});
  try {
    const docId = gerarIdDoc(userId, mes);
    const docRef = doc(db, "pontos", docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.dias) {
        return resolveTimestamps(data.dias);
      }
    }
    const legacySnap = await getDoc(doc(db, "pontos", String(userId)));
    if (legacySnap.exists() && legacySnap.data()?.days) {
      const allDays = resolveTimestamps(legacySnap.data().days);
      const filteredDays: Record<string, any> = {};
      for (const k of Object.keys(allDays)) {
        if (k.startsWith(mes)) {
          filteredDays[k] = allDays[k];
        }
      }
      return filteredDays;
    }
    return {};
  } catch (error) {
    console.warn(`[Firebase] Error fetching monthly points for user ${userId} mes ${mes}:`, error);
    return {};
  }
}

export async function fetchAllPontosMes(mes: string = getMesAtual()): Promise<PontosGlobal> {
  await forceSyncPontos().catch(() => {});
  try {
    const colRef = collection(db, "pontos");
    const q = query(colRef, where("mes", "==", mes));
    const snapshot = await getDocs(q);
    const pontos: PontosGlobal = {};

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.userId && data.dias) {
        const userId = !isNaN(Number(data.userId)) ? Number(data.userId) : data.userId;
        const resolved = resolveTimestamps(data.dias);
        pontos[userId] = { ...(pontos[userId] || {}), ...resolved };
      }
    });

    if (Object.keys(pontos).length === 0) {
      const legacySnap = await getDocs(colRef);
      legacySnap.forEach((docSnap) => {
        const id = docSnap.id;
        if (!id.includes("_")) {
          const userId = !isNaN(Number(id)) ? Number(id) : id;
          const data = docSnap.data();
          if (data && data.days) {
            const allDays = resolveTimestamps(data.days);
            const filteredDays: Record<string, any> = {};
            for (const k of Object.keys(allDays)) {
              if (k.startsWith(mes)) {
                filteredDays[k] = allDays[k];
              }
            }
            if (Object.keys(filteredDays).length > 0) {
              pontos[userId] = { ...(pontos[userId] || {}), ...filteredDays };
            }
          }
        }
      });
    }

    return pontos;
  } catch (error) {
    console.warn(`[Firebase] Error fetching all pontos for mes ${mes} (offline?):`, error);
    return {};
  }
}

export async function saveDiaPonto(userId: number | string, dayKey: string, dayData: any): Promise<void> {
  await saveSingleDayPonto(userId, dayKey, dayData);
}

export async function saveSingleDayPonto(userId: number | string, dayKey: string, dayData: any): Promise<void> {
  const mes = dayKey.length >= 7 ? dayKey.substring(0, 7) : getMesAtual();
  const docId = gerarIdDoc(userId, mes);
  const docRef = doc(db, "pontos", docId);
  
  const preparedPunch = await prepareSingleDayPunches(dayData);
  const payload = cleanObject({
    userId: String(userId),
    mes,
    dias: {
      [dayKey]: preparedPunch
    },
    dispositivoLocalHora: new Date().toISOString(),
    horaServidor: serverTimestamp(),
    atualizadoEm: new Date().toISOString()
  });

  await setDoc(docRef, payload, { merge: true });
}

/**
 * Escuta em tempo real o documento de pontos do usuário com detecção do estado da gravação no cache local (hasPendingWrites).
 * Permite exibir ícones como "Sincronizando..." enquanto o Firestore processa a gravação na nuvem.
 */
export function subscribePontosComStatus(
  userId: number | string,
  mes: string,
  onUpdate: (info: { data: any; hasPendingWrites: boolean; isFromCache: boolean }) => void
): () => void {
  const docId = gerarIdDoc(userId, mes);
  const docRef = doc(db, "pontos", docId);

  return onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    (snapshot) => {
      const data = snapshot.data() || null;
      const hasPendingWrites = snapshot.metadata.hasPendingWrites;
      const isFromCache = snapshot.metadata.fromCache;
      onUpdate({ data, hasPendingWrites, isFromCache });
    },
    (error) => {
      console.warn(`[subscribePontosComStatus] Erro ao escutar status do documento ${docId}:`, error);
    }
  );
}

export async function batchSaveDiasPonto(updates: Array<{ userId: number | string; dayKey: string; dayData: any }>): Promise<void> {
  if (!updates || updates.length === 0) return;

  for (let i = 0; i < updates.length; i += 10) {
    const chunk = updates.slice(i, i + 10);
    try {
      const batch = writeBatch(db);
      for (const item of chunk) {
        const mes = item.dayKey.length >= 7 ? item.dayKey.substring(0, 7) : getMesAtual();
        const docId = gerarIdDoc(item.userId, mes);
        const docRef = doc(db, "pontos", docId);
        const preparedPunch = await prepareSingleDayPunches(item.dayData);
        
        const updatePayload = cleanObject({
          userId: String(item.userId),
          mes,
          dias: {
            [item.dayKey]: preparedPunch
          },
          atualizadoEm: new Date().toISOString()
        });
        batch.set(docRef, updatePayload, { merge: true });
      }
      await batch.commit();
      console.log(`[Firebase] Batch de ${chunk.length} dia(s) salvo com sucesso via writeBatch.`);
    } catch (error) {
      console.warn("[Firebase] Erro no batchSaveDiasPonto, tentando salvar item por item:", error);
      const failedItems: typeof chunk = [];
      for (const item of chunk) {
        try {
          await saveSingleDayPonto(item.userId, item.dayKey, item.dayData);
        } catch (itemErr) {
          console.error(`[Firebase] Falha ao salvar ponto ${item.userId} dia ${item.dayKey}:`, itemErr);
          failedItems.push(item);
        }
      }
      if (failedItems.length > 0) {
        console.warn(`[Firebase] ${failedItems.length} item(s) não puderam ser salvos e serão reprocessados.`);
        for (const item of failedItems) {
          pontoBuffer.set(`${item.userId}_${item.dayKey}`, item);
        }
        persistBufferToLocalStorage();
      }
    }
  }
}

export async function saveUserPontosToDb(userId: number | string, days: any): Promise<any> {
  if (!days) return {};
  const dayKeys = Object.keys(days);
  if (dayKeys.length === 0) return {};

  for (const dayKey of dayKeys) {
    await saveDiaPontoBuffered(userId, dayKey, days[dayKey]);
  }
  // Forçar sincronização imediata para garantir persistência
  await forceSyncPontos().catch(() => {});
  return days;
}

export async function fetchAllPontos(limitRecentDays: number = 0): Promise<PontosGlobal> {
  const mesAtual = getMesAtual();
  const allPontos = await fetchAllPontosMes(mesAtual);

  if (limitRecentDays <= 0) return allPontos;

  // Filtrar apenas os N dias mais recentes do mês atual
  const sortedDays = Object.keys(allPontos).sort((a, b) => b.localeCompare(a));
  const recentDays = sortedDays.slice(0, limitRecentDays);
  const filtered: PontosGlobal = {};

  for (const userId of Object.keys(allPontos)) {
    const userDays = allPontos[userId];
    if (!userDays) continue;
    const userFiltered: Record<string, any> = {};
    for (const dayKey of recentDays) {
      if (userDays[dayKey]) {
        userFiltered[dayKey] = userDays[dayKey];
      }
    }
    if (Object.keys(userFiltered).length > 0) {
      filtered[userId] = userFiltered;
    }
  }
  return filtered;
}

export async function fetchUserFullPontos(userId: number): Promise<Record<string, any>> {
  const mesAtual = getMesAtual();
  return await fetchPontosMes(userId, mesAtual);
}

export async function checkFirebaseConnectivity(): Promise<boolean> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return false;
  }
  const now = Date.now();
  if (now - lastHealthCheckTime < HEALTH_CHECK_COOLDOWN) {
    return true;
  }
  try {
    await enableNetwork(db);
    // Ping real: tentar ler um doc leve para confirmar conectividade
    await firestoreGetDoc(doc(db, "config", "empresa"));
    lastHealthCheckTime = now;
    isUsingOfflineCache = false;
    return true;
  } catch (err) {
    console.warn("[Firebase Health Check] Connectivity check failed:", err);
    return typeof navigator !== "undefined" ? navigator.onLine : false;
  }
}

// ==================== AUDITORIA BUFFERING & PAGINATION ====================

export async function addAuditLog(log: AuditLogEntry): Promise<void> {
  if (!log) return;
  auditBuffer.push(log);

  if (auditBuffer.length >= AUDIT_BUFFER_MAX) {
    await flushAuditBuffer();
    return;
  }
  if (!auditTimeout) {
    auditTimeout = setTimeout(() => flushAuditBuffer().catch(() => {}), AUDIT_BUFFER_DELAY);
  }
}

export async function flushAuditBuffer(): Promise<void> {
  if (auditBuffer.length === 0) return;
  const logsToSend = [...auditBuffer];
  auditBuffer = [];
  if (auditTimeout) {
    clearTimeout(auditTimeout);
    auditTimeout = null;
  }
  await batchSaveAuditLogs(logsToSend);
}

export async function batchSaveAuditLogs(logs: AuditLogEntry[]): Promise<void> {
  if (!logs || logs.length === 0) return;

  try {
    for (let i = 0; i < logs.length; i += 10) {
      const chunk = logs.slice(i, i + 10);
      const batch = writeBatch(db);
      const grouped = new Map<string, { targetUserId: string; dia: string; cleanLogs: any[] }>();

      for (const log of chunk) {
        if (!log) continue;
        const targetUserId = String(log.userId || log.quemMat || "sys");
        const dia = log.quando ? log.quando.substring(0, 10) : getDiaAtual();
        const docId = gerarIdAudit(targetUserId, dia);
        const cleanLog = cleanObject(log);

        if (!grouped.has(docId)) {
          grouped.set(docId, { targetUserId, dia, cleanLogs: [cleanLog] });
        } else {
          grouped.get(docId)!.cleanLogs.push(cleanLog);
        }
      }

      for (const [docId, group] of grouped.entries()) {
        const docRef = doc(db, "auditLogs", docId);
        const payload = {
          userId: group.targetUserId,
          dia: group.dia,
          logs: arrayUnion(...group.cleanLogs),
          totalEdicoes: increment(group.cleanLogs.length),
          atualizadoEm: new Date().toISOString()
        };
        batch.set(docRef, payload, { merge: true });
      }

      await batch.commit();
    }
    console.log(`[Firebase Audit Batch] ${logs.length} log(s) de auditoria sincronizado(s) via writeBatch.`);
  } catch (error) {
    console.warn("[Firebase Audit Batch] Falha não-bloqueante no envio em lote de auditoria:", error);
  }
}

export async function saveAuditLogToDb(log: AuditLogEntry): Promise<void> {
  await addAuditLog(log);
}

export async function fetchAuditDia(userId: number | string, dia: string = getDiaAtual()): Promise<AuditLogEntry[]> {
  await flushAuditBuffer().catch(() => {});
  try {
    const docId = gerarIdAudit(userId, dia);
    const docSnap = await getDoc(doc(db, "auditLogs", docId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      return Array.isArray(data.logs) ? data.logs : [];
    }
    return [];
  } catch (error) {
    console.warn(`[Firebase] Error fetching audit for user ${userId} dia ${dia}:`, error);
    return [];
  }
}

export async function fetchAuditLogs(mes: string = getMesAtual()): Promise<AuditLogEntry[]> {
  await flushAuditBuffer().catch(() => {});
  try {
    const colRef = collection(db, "auditLogs");
    let snapshot;
    if (mes) {
      try {
        // ⚠️ Requer índice composto no Firestore: collection=auditLogs, fields=dia(asc|desc)
        // Se falhar por falta de índice, cairá no fallback abaixo
        const q = query(
          colRef,
          where("dia", ">=", `${mes}-01`),
          where("dia", "<=", `${mes}-31`),
          orderBy("dia", "desc"),
          limit(200)
        );
        snapshot = await getDocs(q);
      } catch (idxErr: any) {
        console.warn("[Firebase] Query de auditLogs falhou (falta índice composto?). Usando fallback:", idxErr?.message || idxErr);
        const fallbackQ = query(colRef, limit(200));
        snapshot = await getDocs(fallbackQ);
      }
    } else {
      const q = query(colRef, limit(200));
      snapshot = await getDocs(q);
    }

    const list: AuditLogEntry[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (Array.isArray(data.logs)) {
        for (const l of data.logs) {
          if (!mes || (l.quando && l.quando.startsWith(mes)) || (data.dia && data.dia.startsWith(mes))) {
            list.push(l as AuditLogEntry);
          }
        }
      } else if (data.quando) {
        if (!mes || (data.quando && data.quando.startsWith(mes))) {
          list.push(data as AuditLogEntry);
        }
      }
    });

    return list.sort((a, b) => {
      const timeA = new Date(a.quando).getTime();
      const timeB = new Date(b.quando).getTime();
      return timeB - timeA;
    });
  } catch (error) {
    console.warn("[Firebase] Error fetching auditLogs (offline?):", error);
    return [];
  }
}

// ==================== RESUMO MENSAL ON-DEMAND (PURE FUNCTION) ====================

export function calcularResumoMensal(
  pontos: Record<string, any>,
  feriados?: string[],
  minimoHoras: number = 7
): {
  diasTrabalhados: number;
  totalHorasNormais: string;
  totalHorasExtras: string;
  totalAtrasos: string;
  faltas: number;
} {
  let diasTrabalhados = 0;
  let totalMinutosNormais = 0;
  let totalMinutosExtras = 0;
  let totalMinutosAtrasos = 0;
  let faltas = 0;

  if (!pontos || typeof pontos !== "object") {
    return {
      diasTrabalhados: 0,
      totalHorasNormais: "00:00",
      totalHorasExtras: "00:00",
      totalAtrasos: "00:00",
      faltas: 0
    };
  }

  for (const dayKey of Object.keys(pontos)) {
    const dayPunches = pontos[dayKey];
    if (!Array.isArray(dayPunches)) continue;

    const validPunches = dayPunches.filter(p => p && p.hora);
    if (validPunches.length > 0) {
      diasTrabalhados++;
      let minutesWorked = 0;
      if (validPunches.length >= 2) {
        const p1 = validPunches[0]?.hora;
        const p2 = validPunches[1]?.hora;
        if (p1 && p2) {
          const [h1, m1] = p1.split(":").map(Number);
          const [h2, m2] = p2.split(":").map(Number);
          const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
          if (diff > 0) minutesWorked += diff;
        }
      }
      if (validPunches.length >= 4) {
        const p3 = validPunches[2]?.hora;
        const p4 = validPunches[3]?.hora;
        if (p3 && p4) {
          const [h3, m3] = p3.split(":").map(Number);
          const [h4, m4] = p4.split(":").map(Number);
          const diff = (h4 * 60 + m4) - (h3 * 60 + m3);
          if (diff > 0) minutesWorked += diff;
        }
      }

      const metaMinutes = minimoHoras * 60;
      if (minutesWorked >= metaMinutes) {
        totalMinutosNormais += metaMinutes;
        totalMinutosExtras += (minutesWorked - metaMinutes);
      } else {
        totalMinutosNormais += minutesWorked;
        totalMinutosAtrasos += (metaMinutes - minutesWorked);
      }
    } else {
      const isFeriado = Array.isArray(feriados) && feriados.includes(dayKey);
      if (!isFeriado) {
        faltas++;
      }
    }
  }

  const formatHHMM = (totalMin: number) => {
    const hrs = Math.floor(totalMin / 60);
    const mins = Math.round(totalMin % 60);
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  };

  return {
    diasTrabalhados,
    totalHorasNormais: formatHHMM(totalMinutosNormais),
    totalHorasExtras: formatHHMM(totalMinutosExtras),
    totalAtrasos: formatHHMM(totalMinutosAtrasos),
    faltas
  };
}

// Deprecated stubs to avoid breaking legacy code
export async function saveResumoMensal(): Promise<void> {}
export async function fetchResumoMensal(): Promise<any | null> { return null; }
export async function fetchAllResumosMes(): Promise<Record<string, any>> { return {}; }

// Config functions
export async function fetchEmpresaConfig(): Promise<EmpresaConfig> {
  try {
    const docSnap = await getDoc(doc(db, "config", "empresa"));
    if (docSnap && docSnap.exists()) {
      return docSnap.data() as EmpresaConfig;
    }
  } catch (error) {
    console.warn("[Firebase] Error fetching empresa config (offline?):", error);
  }
  return { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" };
}

export async function saveEmpresaConfigToDb(config: EmpresaConfig): Promise<void> {
  try {
    await setDoc(doc(db, "config", "empresa"), cleanObject(config));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/empresa");
  }
}

export async function fetchMinimoHoras(): Promise<number> {
  try {
    const docSnap = await getDoc(doc(db, "config", "minimoHoras"));
    if (docSnap && docSnap.exists()) {
      return docSnap.data().value;
    }
  } catch (error) {
    console.warn("[Firebase] Error fetching minimoHoras (offline?):", error);
  }
  return 7;
}

export async function saveMinimoHorasToDb(val: number): Promise<void> {
  try {
    await setDoc(doc(db, "config", "minimoHoras"), { value: val });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/minimoHoras");
  }
}

export async function fetchFeriados(): Promise<string[]> {
  try {
    const docSnap = await getDoc(doc(db, "config", "feriados"));
    if (docSnap && docSnap.exists()) {
      return docSnap.data().list || [];
    }
  } catch (error) {
    console.warn("[Firebase] Error fetching feriados (offline?):", error);
  }
  return [];
}

export async function saveFeriadosToDb(list: string[]): Promise<void> {
  try {
    await setDoc(doc(db, "config", "feriados"), { list });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/feriados");
  }
}

export async function fetchWizardDone(): Promise<boolean> {
  try {
    const docSnap = await getDoc(doc(db, "config", "wizard"));
    if (docSnap && docSnap.exists()) {
      return !!docSnap.data().done;
    }
    const usersSnap = await getDocs(collection(db, "users"));
    if (usersSnap && !usersSnap.empty) {
      saveWizardDoneToDb(true).catch(() => {});
      return true;
    }
  } catch (error) {
    console.warn("[Firebase] Error fetching wizard (offline?):", error);
  }
  return true;
}

export async function saveWizardDoneToDb(done: boolean): Promise<void> {
  try {
    await setDoc(doc(db, "config", "wizard"), { done });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/wizard");
  }
}

// Pre-Ponto functions (PAGINATED limit 100)
export async function fetchAllPrePontos(): Promise<PrePonto[]> {
  try {
    const colRef = collection(db, "prePontos");
    let snapshot;
    try {
      const q = query(colRef, orderBy("quando", "desc"), limit(100));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(colRef);
    }
    const list: PrePonto[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as PrePonto);
    });
    return list; // já ordenado pelo Firestore via orderBy
  } catch (error) {
    console.warn("[Firebase] Error fetching prePontos (offline?):", error);
    return [];
  }
}

export async function savePrePontoToDb(prePonto: PrePonto): Promise<void> {
  try {
    await setDoc(doc(db, "prePontos", prePonto.id), cleanObject(prePonto), { merge: true });
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.includes("Timeout de conexão") || msg.includes("offline") || msg.includes("unavailable")) {
      console.warn(`[Firebase] Timeout de conexão/offline ao salvar prePonto ${prePonto.id}, mantido em cache local.`);
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, `prePontos/${prePonto.id}`);
  }
}

// Folha de Ponto Aceite/Recusa functions (PAGINATED limit 50)
export async function fetchAllFolhasAceite(): Promise<FolhaAceite[]> {
  try {
    const colRef = collection(db, "folhasAceite");
    let snapshot;
    try {
      const q = query(colRef, orderBy("enviadoEm", "desc"), limit(50));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(colRef);
    }
    const list: FolhaAceite[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as FolhaAceite);
    });
    return list; // já ordenado pelo Firestore via orderBy
  } catch (error) {
    console.warn("[Firebase] Error fetching folhasAceite (offline?):", error);
    return [];
  }
}

export async function saveFolhaAceiteToDb(folha: FolhaAceite): Promise<void> {
  try {
    await setDoc(doc(db, "folhasAceite", folha.id), cleanObject(folha), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `folhasAceite/${folha.id}`);
  }
}

export async function deleteFolhaAceiteFromDb(folhaId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "folhasAceite", folhaId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `folhasAceite/${folhaId}`);
  }
}

export async function updateUserBloqueioAceite(userId: number, bloqueadoAceite: boolean): Promise<void> {
  try {
    const userDocRef = doc(db, "users", String(userId));
    await updateDoc(userDocRef, { bloqueadoAceite });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
  }
}

// Alertas / Mensagens Popup functions (PAGINATED limit 50)
export async function fetchAllAlertas(): Promise<Alerta[]> {
  try {
    const colRef = collection(db, "alertas");
    let snapshot;
    try {
      const q = query(colRef, orderBy("criadoEm", "desc"), limit(50));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(colRef);
    }
    const list: Alerta[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        destinatarioMatricula: data.destinatarioMatricula || "TODOS",
        mensagem: data.mensagem || "",
        criadoEm: data.criadoEm || new Date().toISOString(),
        criadoPor: data.criadoPor || "ADM",
        lidoPorMatriculas: Array.isArray(data.lidoPorMatriculas) ? data.lidoPorMatriculas : [],
        ativo: data.ativo !== false
      });
    });
    return list; // já ordenado pelo Firestore via orderBy
  } catch (error) {
    console.warn("[Firebase] Error fetching alertas (offline?):", error);
    return [];
  }
}

export async function saveAlertaToDb(alerta: Alerta): Promise<void> {
  try {
    await setDoc(doc(db, "alertas", alerta.id), cleanObject(alerta));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `alertas/${alerta.id}`);
  }
}

export async function deleteAlertaFromDb(alertaId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "alertas", alertaId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `alertas/${alertaId}`);
  }
}

export async function markAlertaAsReadInDb(alertaId: string, matricula: string): Promise<void> {
  try {
    const alertaRef = doc(db, "alertas", alertaId);
    // arrayUnion é atômico e evita race conditions
    await updateDoc(alertaRef, {
      lidoPorMatriculas: arrayUnion(matricula)
    });
  } catch (error) {
    console.warn(`[Firebase] Não foi possível atualizar leitura do alerta ${alertaId}:`, error);
  }
}

// ==================== DENÚNCIAS ANÔNIMAS (PAGINATED limit 50) ====================

export async function fetchAllDenuncias(): Promise<Denuncia[]> {
  try {
    const colRef = collection(db, "denuncias");
    let snapshot;
    try {
      const q = query(colRef, orderBy("criadoEm", "desc"), limit(50));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(colRef);
    }
    const list: Denuncia[] = [];
    snapshot.forEach((docSnap: any) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        texto: data.texto || "",
        fotoUrl: data.fotoUrl || null,
        criadoEm: data.criadoEm || new Date().toISOString(),
        status: data.status || "pendente",
        respostaAdm: data.respostaAdm || null,
        atualizadoEm: data.atualizadoEm || null
      });
    });
    return list; // já ordenado pelo Firestore via orderBy
  } catch (error) {
    console.warn("[Firebase] Error fetching denuncias (offline?):", error);
    return [];
  }
}

export async function saveDenunciaToDb(denunciaInput: { id?: string; texto: string; fotoUrl?: string | null; criadoEm?: string }): Promise<Denuncia> {
  const id = denunciaInput.id || `denuncia_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const criadoEm = denunciaInput.criadoEm || new Date().toISOString();
  
  const newDenuncia: Denuncia = {
    id,
    texto: denunciaInput.texto.trim(),
    fotoUrl: denunciaInput.fotoUrl || null,
    criadoEm,
    status: "pendente",
    respostaAdm: null,
    atualizadoEm: null
  };

  try {
    await setDoc(doc(db, "denuncias", id), cleanObject(newDenuncia));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `denuncias/${id}`);
  }

  return newDenuncia;
}

export async function updateDenunciaInDb(id: string, updates: Partial<Denuncia>): Promise<void> {
  try {
    const payload = cleanObject({
      ...updates,
      atualizadoEm: new Date().toISOString()
    });
    await updateDoc(doc(db, "denuncias", id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `denuncias/${id}`);
  }
}

export async function deleteDenunciaFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "denuncias", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `denuncias/${id}`);
  }
}

// ==================== SOLICITAÇÕES DE CORREÇÃO DE PONTO (PAGINATED limit 50) ====================

export async function fetchAllSolicitacoesCorrecao(): Promise<SolicitacaoCorrecao[]> {
  try {
    const colRef = collection(db, "solicitacoesCorrecao");
    let snapshot;
    try {
      const q = query(colRef, orderBy("criadoEm", "desc"), limit(50));
      snapshot = await getDocs(q);
    } catch {
      snapshot = await getDocs(colRef);
    }
    const list: SolicitacaoCorrecao[] = [];
    snapshot.forEach((docSnap: any) => {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        userId: data.userId,
        userName: data.userName || "",
        matricula: data.matricula || "",
        data: data.data || "",
        hora: data.hora || "",
        slotIdx: typeof data.slotIdx === "number" ? data.slotIdx : 0,
        motivo: data.motivo || "",
        latitude: data.latitude !== undefined ? data.latitude : null,
        longitude: data.longitude !== undefined ? data.longitude : null,
        accuracy: data.accuracy !== undefined ? data.accuracy : null,
        status: data.status || "pendente",
        motivoRejeicao: data.motivoRejeicao || null,
        criadoEm: data.criadoEm || new Date().toISOString(),
        revisadoEm: data.revisadoEm || null,
        revisadoPor: data.revisadoPor || null
      });
    });
    return list; // já ordenado pelo Firestore via orderBy
  } catch (error) {
    console.warn("[Firebase] Error fetching solicitacoesCorrecao (offline?):", error);
    return [];
  }
}

export async function saveSolicitacaoCorrecaoToDb(solicitationInput: Partial<SolicitacaoCorrecao>): Promise<SolicitacaoCorrecao> {
  const id = solicitationInput.id || `correcao_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const criadoEm = solicitationInput.criadoEm || new Date().toISOString();

  const newSolicitation: SolicitacaoCorrecao = {
    id,
    userId: solicitationInput.userId || 0,
    userName: solicitationInput.userName || "",
    matricula: solicitationInput.matricula || "",
    data: solicitationInput.data || "",
    hora: solicitationInput.hora || "",
    slotIdx: solicitationInput.slotIdx !== undefined ? solicitationInput.slotIdx : 0,
    motivo: solicitationInput.motivo ? solicitationInput.motivo.trim() : "",
    latitude: solicitationInput.latitude !== undefined ? solicitationInput.latitude : null,
    longitude: solicitationInput.longitude !== undefined ? solicitationInput.longitude : null,
    accuracy: solicitationInput.accuracy !== undefined ? solicitationInput.accuracy : null,
    status: solicitationInput.status || "pendente",
    motivoRejeicao: solicitationInput.motivoRejeicao || null,
    criadoEm,
    revisadoEm: solicitationInput.revisadoEm || null,
    revisadoPor: solicitationInput.revisadoPor || null
  };

  try {
    await setDoc(doc(db, "solicitacoesCorrecao", id), cleanObject(newSolicitation));
  } catch (error: any) {
    const msg = error?.message || String(error);
    if (msg.includes("Timeout de conexão") || msg.includes("offline") || msg.includes("unavailable")) {
      console.warn(`[Firebase] Timeout de conexão/offline ao salvar solicitação de correção ${id}, mantido em cache local.`);
      // Salvar no localStorage para sync posterior
      if (typeof window !== "undefined") {
        try {
          const pending = JSON.parse(localStorage.getItem("__pending_solicitacoes") || "[]");
          pending.push(newSolicitation);
          localStorage.setItem("__pending_solicitacoes", JSON.stringify(pending));
        } catch {}
      }
      return newSolicitation;
    }
    handleFirestoreError(error, OperationType.WRITE, `solicitacoesCorrecao/${id}`);
  }

  return newSolicitation;
}

export async function updateSolicitacaoCorrecaoInDb(id: string, updates: Partial<SolicitacaoCorrecao>): Promise<void> {
  try {
    const payload = cleanObject({
      ...updates,
      revisadoEm: updates.revisadoEm || new Date().toISOString()
    });
    await updateDoc(doc(db, "solicitacoesCorrecao", id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `solicitacoesCorrecao/${id}`);
  }
}

export async function deleteSolicitacaoCorrecaoFromDb(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "solicitacoesCorrecao", id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `solicitacoesCorrecao/${id}`);
  }
}

export async function fetchBlocoNotas(): Promise<{ texto: string; atualizadoEm: string } | null> {
  try {
    const docSnap = await getDoc(doc(db, "config", "bloco_notas_gestor"));
    if (docSnap && docSnap.exists()) {
      return docSnap.data() as { texto: string; atualizadoEm: string };
    }
  } catch (error) {
    console.warn("[Firebase] Error fetching bloco_notas_gestor (offline?):", error);
  }
  return null;
}

export async function saveBlocoNotasToDb(texto: string): Promise<void> {
  try {
    await setDoc(doc(db, "config", "bloco_notas_gestor"), {
      texto,
      atualizadoEm: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/bloco_notas_gestor");
  }
}

export async function fetchFolgasRemuneradas(): Promise<FolgaRemunerada[]> {
  try {
    const docSnap = await getDoc(doc(db, "config", "folgasRemuneradas"));
    if (docSnap && docSnap.exists()) {
      return (docSnap.data().list || []) as FolgaRemunerada[];
    }
  } catch (error) {
    console.warn("[Firebase] Error fetching folgasRemuneradas (offline?):", error);
  }
  return [];
}

export async function saveFolgasRemuneradasToDb(list: FolgaRemunerada[]): Promise<void> {
  try {
    await setDoc(doc(db, "config", "folgasRemuneradas"), cleanObject({ list }));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/folgasRemuneradas");
  }
}