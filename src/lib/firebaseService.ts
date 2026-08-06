import { db, fallbackToDefaultDatabase } from "./firebase";
import { compressImageBase64 } from "../utils/hrHelpers";
import { 
  collection, 
  getDocs as firestoreGetDocs, 
  doc, 
  setDoc as firestoreSetDoc, 
  getDoc as firestoreGetDoc, 
  deleteDoc as firestoreDeleteDoc,
  updateDoc as firestoreUpdateDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";

let hasFallenBack = false;

function recreateRef(ref: any) {
  if (!ref) return ref;
  if (ref.type === "document" && ref.path) {
    return doc(db, ref.path);
  }
  if (ref.type === "collection" && ref.path) {
    return collection(db, ref.path);
  }
  return ref;
}

async function runWithFallback<T>(operation: (ref?: any) => Promise<T>, ref?: any, timeoutMs = 10000): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Timeout de conexão com o banco de dados Firestore")), timeoutMs);
  });

  try {
    return await Promise.race([operation(ref), timeoutPromise]);
  } catch (error: any) {
    const errStr = String(error?.message || error);
    const isDbError = 
      errStr.includes("not found") || 
      errStr.includes("database") || 
      errStr.includes("Database") ||
      errStr.includes("NOT_FOUND") ||
      errStr.includes("invalid") ||
      errStr.includes("Invalid") ||
      errStr.includes("permission") ||
      errStr.includes("Permission") ||
      errStr.includes("denied") ||
      errStr.includes("Denied");
      
    if (isDbError && !hasFallenBack) {
      hasFallenBack = true;
      console.warn("[Firebase Service] Detected Firestore access error. Switching to (default) database and retrying...", error);
      try {
        fallbackToDefaultDatabase();
      } catch (fallbackErr) {
        console.error("[Firebase Service] Fallback failed:", fallbackErr);
      }
      const newRef = recreateRef(ref);
      return await Promise.race([operation(newRef), timeoutPromise]);
    }
    throw error;
  }
}

// Resilient wrappers for imported Firestore operations
function getDocs(colRef: any): Promise<any> {
  return runWithFallback((r) => firestoreGetDocs(r || colRef), colRef);
}

function getDoc(docRef: any): Promise<any> {
  return runWithFallback((r) => firestoreGetDoc(r || docRef), docRef);
}

function setDoc(docRef: any, data: any, options?: any): Promise<any> {
  return runWithFallback((r) => firestoreSetDoc(r || docRef, data, options), docRef);
}

function deleteDoc(docRef: any): Promise<any> {
  return runWithFallback((r) => firestoreDeleteDoc(r || docRef), docRef);
}

function updateDoc(docRef: any, data: any): Promise<any> {
  return runWithFallback((r) => firestoreUpdateDoc(r || docRef, data), docRef);
}

import { User, PontosGlobal, AuditLogEntry, EmpresaConfig, PrePonto, FolhaAceite, Alerta, Denuncia, SolicitacaoCorrecao } from "../types";
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
  const isOffline = errMessage.includes("offline") || errMessage.includes("unavailable") || errMessage.includes("Could not reach Cloud Firestore");
  
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
  if (isOffline) {
    console.warn(`[Firestore Offline] ${operationType} on ${path}: ${errMessage}`);
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
    // If it's a Firestore FieldValue (e.g. serverTimestamp)
    if (obj.constructor && (
      obj.constructor.name === "FieldValue" || 
      obj.constructor.name === "FieldValueImpl" || 
      obj.constructor.name.includes("FieldValue") || 
      (typeof obj.isEqual === "function" && typeof obj.toGeoPoint !== "function" && typeof obj.toDate !== "function")
    )) {
      return obj;
    }
    // Convert Firestore Timestamp or serialized Timestamp object to ISO string
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
    console.log("Firestore is empty. Seeding initial database...");
    
    // Seed Users
    for (const u of INITIAL_USERS) {
      try {
        await setDoc(doc(db, "users", String(u.id)), cleanObject(u));
      } catch (error) {
        console.warn(`[Firebase] Offline/error writing user ${u.id}:`, error);
      }
    }

    // Seed Pontos for existing seed users
    for (const userIdStr of Object.keys(SEED_PONTOS)) {
      const userId = Number(userIdStr);
      const userDays = SEED_PONTOS[userId];
      if (userDays) {
        try {
          await setDoc(doc(db, "pontos", String(userId)), cleanObject({ days: userDays }));
        } catch (error) {
          console.warn(`[Firebase] Offline/error writing pontos for ${userId}:`, error);
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

// Users functions
export async function fetchAllUsers(): Promise<User[]> {
  try {
    const usersSnapshot = await getDocs(collection(db, "users"));
    const list: User[] = [];
    usersSnapshot.forEach((docSnap) => {
      list.push(docSnap.data() as User);
    });
    return list.sort((a, b) => a.id - b.id);
  } catch (error) {
    console.warn("[Firebase] Error fetching users (offline?):", error);
    return [];
  }
}

export async function saveUserToDb(user: User): Promise<void> {
  try {
    await setDoc(doc(db, "users", String(user.id)), cleanObject(user));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
  }
}

export async function deleteUserFromDb(userId: number): Promise<void> {
  try {
    await deleteDoc(doc(db, "users", String(userId)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
  }
}

// Helper to prepare points for Firestore, compressing large attachments and injecting timestamps
async function prepareDaysForFirestore(days: any): Promise<any> {
  if (!days) return days;
  const result: any = {};
  for (const dayKey of Object.keys(days)) {
    const dayArray = days[dayKey];
    if (Array.isArray(dayArray)) {
      const mapped = await Promise.all(
        dayArray.map(async (punch: any) => {
          if (!punch) return null;
          const newPunch = { ...punch };
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
          // Quando vai para o Firestore, o ponto deixa de ser considerado offline/local pendente
          if (newPunch.gravadoOffline) {
            delete newPunch.gravadoOffline;
          }
          // Compress fotoAtestado if present to guarantee document stays under 1MB limit
          if (newPunch.fotoAtestado && typeof newPunch.fotoAtestado === "string") {
            if (newPunch.fotoAtestado.startsWith("data:image")) {
              try {
                newPunch.fotoAtestado = await compressImageBase64(newPunch.fotoAtestado, 800, 800, 0.65);
              } catch (e) {
                console.warn("[FirebaseService] Could not compress fotoAtestado:", e);
              }
            }
          }
          return newPunch;
        })
      );
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

// Helper to resolve Firestore Timestamp objects back to string ISO dates on fetch
function resolveTimestamps(days: any): any {
  if (!days) return days;
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

// Pontos functions
export async function fetchAllPontos(limitRecentDays: number = 0): Promise<PontosGlobal> {
  try {
    const snapshot = await getDocs(collection(db, "pontos"));
    const pontos: PontosGlobal = {};
    snapshot.forEach((docSnap) => {
      const userId = Number(docSnap.id);
      const data = docSnap.data();
      if (data && data.days) {
        const resolved = resolveTimestamps(data.days);
        if (limitRecentDays && limitRecentDays > 0) {
          const sortedKeys = Object.keys(resolved).sort().reverse().slice(0, limitRecentDays);
          const limitedDays: Record<string, any> = {};
          for (const k of sortedKeys) {
            limitedDays[k] = resolved[k];
          }
          pontos[userId] = limitedDays;
        } else {
          pontos[userId] = resolved;
        }
      }
    });
    return pontos;
  } catch (error) {
    console.warn("[Firebase] Error fetching pontos (offline?):", error);
    return {};
  }
}

export async function fetchUserFullPontos(userId: number): Promise<Record<string, any>> {
  try {
    const docRef = doc(db, "pontos", String(userId));
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && data.days) {
        return resolveTimestamps(data.days);
      }
    }
    return {};
  } catch (error) {
    console.warn(`[Firebase] Error fetching full points for user ${userId}:`, error);
    return {};
  }
}

export async function saveUserPontosToDb(userId: number, days: any): Promise<any> {
  try {
    const preparedDays = await prepareDaysForFirestore(days);

    // Fetch existing document from Firestore to merge days so no historical days are overwritten or lost
    let existingDays: Record<string, any> = {};
    try {
      const docRef = doc(db, "pontos", String(userId));
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data()?.days) {
        existingDays = resolveTimestamps(docSnap.data().days);
      }
    } catch (fetchErr) {
      console.warn(`[FirebaseService] Pre-fetch of points for user ${userId} skipped (offline?):`, fetchErr);
    }

    const mergedDays = { ...existingDays, ...preparedDays };
    const payload = cleanObject({ days: mergedDays });

    // Safety guard for Firestore 1MB document limit (1,048,576 bytes)
    const jsonStr = JSON.stringify(payload);
    if (jsonStr.length > 850000) {
      console.warn(`[FirebaseService] Payload size for user ${userId} is large (${jsonStr.length} bytes). Applying extra compression...`);
      for (const dayKey of Object.keys(mergedDays)) {
        const dayArr = mergedDays[dayKey];
        if (Array.isArray(dayArr)) {
          for (const punch of dayArr) {
            if (punch && punch.fotoAtestado && typeof punch.fotoAtestado === "string") {
              if (punch.fotoAtestado.startsWith("data:image")) {
                try {
                  punch.fotoAtestado = await compressImageBase64(punch.fotoAtestado, 500, 500, 0.50);
                } catch (e) {
                  console.warn("Extra compression failed:", e);
                }
              } else if (punch.fotoAtestado.length > 100000) {
                // Non-image string (like huge PDF base64) exceeding size
                console.warn(`[FirebaseService] Oversized attachment in ${dayKey} removed to keep document within 1MB Firestore limit.`);
                delete punch.fotoAtestado;
              }
            }
          }
        }
      }
    }

    await setDoc(doc(db, "pontos", String(userId)), cleanObject({ days: mergedDays }));
    return mergedDays;
  } catch (error) {
    console.warn(`[Firebase] Error saving pontos for user ${userId} to Firestore (offline?):`, error);
    throw error;
  }
}

export async function checkFirebaseConnectivity(): Promise<boolean> {
  try {
    const docRef = doc(db, "config", "empresa");
    const timeout = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error("Firebase ping timeout")), 4000)
    );
    await Promise.race([getDoc(docRef), timeout]);
    return true;
  } catch (err) {
    console.warn("[Firebase Health Check] Connectivity failed:", err);
    return false;
  }
}

// Audit logs functions
export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const snapshot = await getDocs(collection(db, "auditLogs"));
    const list: AuditLogEntry[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as AuditLogEntry);
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

export async function saveAuditLogToDb(log: AuditLogEntry): Promise<void> {
  try {
    await setDoc(doc(db, "auditLogs", String(log.id)), cleanObject(log));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `auditLogs/${log.id}`);
  }
}

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
  } catch (error) {
    console.warn("[Firebase] Error fetching wizard (offline?):", error);
  }
  return false;
}

export async function saveWizardDoneToDb(done: boolean): Promise<void> {
  try {
    await setDoc(doc(db, "config", "wizard"), { done });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "config/wizard");
  }
}

// Pre-Ponto functions
export async function fetchAllPrePontos(): Promise<PrePonto[]> {
  try {
    const snapshot = await getDocs(collection(db, "prePontos"));
    const list: PrePonto[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as PrePonto);
    });
    return list.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());
  } catch (error) {
    console.warn("[Firebase] Error fetching prePontos (offline?):", error);
    return [];
  }
}

export async function savePrePontoToDb(prePonto: PrePonto): Promise<void> {
  try {
    await setDoc(doc(db, "prePontos", prePonto.id), cleanObject(prePonto), { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `prePontos/${prePonto.id}`);
  }
}

// Folha de Ponto Aceite/Recusa functions
export async function fetchAllFolhasAceite(): Promise<FolhaAceite[]> {
  try {
    const snapshot = await getDocs(collection(db, "folhasAceite"));
    const list: FolhaAceite[] = [];
    snapshot.forEach((docSnap) => {
      list.push(docSnap.data() as FolhaAceite);
    });
    return list.sort((a, b) => new Date(b.enviadoEm).getTime() - new Date(a.enviadoEm).getTime());
  } catch (error) {
    console.warn("[Firebase] Error fetching folhasAceite (offline?):", error);
    return [];
  }
}

export async function saveFolhaAceiteToDb(folha: FolhaAceite): Promise<void> {
  try {
    await setDoc(doc(db, "folhasAceite", folha.id), cleanObject(folha));
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

// Alertas / Mensagens Popup functions
export async function fetchAllAlertas(): Promise<Alerta[]> {
  try {
    const snapshot = await getDocs(collection(db, "alertas"));
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
    return list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
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
    const docSnap = await getDoc(alertaRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const currentReads: string[] = Array.isArray(data.lidoPorMatriculas) ? data.lidoPorMatriculas : [];
      if (!currentReads.includes(matricula)) {
        await updateDoc(alertaRef, {
          lidoPorMatriculas: [...currentReads, matricula]
        });
      }
    }
  } catch (error) {
    console.warn(`[Firebase] Não foi possível atualizar leitura do alerta ${alertaId}:`, error);
  }
}

// ==================== DENÚNCIAS ANÔNIMAS ====================

export async function fetchAllDenuncias(): Promise<Denuncia[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "denuncias"));
    const list: Denuncia[] = [];
    querySnapshot.forEach((docSnap: any) => {
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
    return list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
  } catch (error) {
    console.warn("[Firebase] Error fetching denuncias (offline?):", error);
    return [];
  }
}

export async function saveDenunciaToDb(denunciaInput: { id?: string; texto: string; fotoUrl?: string | null; criadoEm?: string }): Promise<Denuncia> {
  const id = denunciaInput.id || `denuncia_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const criadoEm = denunciaInput.criadoEm || new Date().toISOString();
  
  // Clean object ensuring NO identification metadata is present
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

// ==================== SOLICITAÇÕES DE CORREÇÃO DE PONTO ====================

export async function fetchAllSolicitacoesCorrecao(): Promise<SolicitacaoCorrecao[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "solicitacoesCorrecao"));
    const list: SolicitacaoCorrecao[] = [];
    querySnapshot.forEach((docSnap: any) => {
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
    return list.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime());
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
  } catch (error) {
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





