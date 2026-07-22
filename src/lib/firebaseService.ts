import { db, fallbackToDefaultDatabase } from "./firebase";
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

async function runWithFallback<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
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
      return await operation();
    }
    throw error;
  }
}

// Resilient wrappers for imported Firestore operations
function getDocs(colRef: any): Promise<any> {
  return runWithFallback(() => firestoreGetDocs(colRef));
}

function getDoc(docRef: any): Promise<any> {
  return runWithFallback(() => firestoreGetDoc(docRef));
}

function setDoc(docRef: any, data: any, options?: any): Promise<any> {
  return runWithFallback(() => firestoreSetDoc(docRef, data, options));
}

function deleteDoc(docRef: any): Promise<any> {
  return runWithFallback(() => firestoreDeleteDoc(docRef));
}

function updateDoc(docRef: any, data: any): Promise<any> {
  return runWithFallback(() => firestoreUpdateDoc(docRef, data));
}

import { User, PontosGlobal, AuditLogEntry, EmpresaConfig, PrePonto, FolhaAceite, Alerta } from "../types";
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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  console.error("Firestore Error: ", JSON.stringify(errInfo));
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
    // Also check if it's a Firestore Timestamp
    if (obj.toDate && typeof obj.toDate === "function") {
      return obj;
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

export async function initializeDbIfEmpty() {
  const usersColl = collection(db, "users");
  let usersSnapshot;
  try {
    usersSnapshot = await getDocs(usersColl);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "users");
  }
  
  if (usersSnapshot.empty) {
    console.log("Firestore is empty. Seeding initial database...");
    
    // Seed Users
    for (const u of INITIAL_USERS) {
      try {
        await setDoc(doc(db, "users", String(u.id)), cleanObject(u));
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${u.id}`);
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
          handleFirestoreError(error, OperationType.WRITE, `pontos/${userId}`);
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
      handleFirestoreError(error, OperationType.WRITE, "config");
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
    handleFirestoreError(error, OperationType.GET, "users");
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

// Helper to prepare points for Firestore, injecting a synced/local timestamp for pending ones
function prepareDaysForFirestore(days: any): any {
  if (!days) return days;
  const result: any = {};
  for (const dayKey of Object.keys(days)) {
    const dayArray = days[dayKey];
    if (Array.isArray(dayArray)) {
      const mapped = dayArray.map((punch: any) => {
        if (!punch) return null;
        const newPunch = { ...punch };
        if (newPunch.serverTime === "pending" || !newPunch.serverTime) {
          newPunch.serverTime = Timestamp.now();
        }
        // Quando vai para o Firestore, o ponto deixa de ser considerado offline/local pendente
        if (newPunch.gravadoOffline) {
          delete newPunch.gravadoOffline;
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
export async function fetchAllPontos(): Promise<PontosGlobal> {
  try {
    const snapshot = await getDocs(collection(db, "pontos"));
    const pontos: PontosGlobal = {};
    snapshot.forEach((docSnap) => {
      const userId = Number(docSnap.id);
      const data = docSnap.data();
      if (data && data.days) {
        pontos[userId] = resolveTimestamps(data.days);
      }
    });
    return pontos;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "pontos");
  }
}

export async function saveUserPontosToDb(userId: number, days: any): Promise<any> {
  try {
    const preparedDays = prepareDaysForFirestore(days);
    await setDoc(doc(db, "pontos", String(userId)), cleanObject({ days: preparedDays }));
    return preparedDays;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `pontos/${userId}`);
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
    handleFirestoreError(error, OperationType.GET, "auditLogs");
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
    if (docSnap.exists()) {
      return docSnap.data() as EmpresaConfig;
    }
    return { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "config/empresa");
  }
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
    if (docSnap.exists()) {
      return docSnap.data().value;
    }
    return 7;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "config/minimoHoras");
  }
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
    if (docSnap.exists()) {
      return docSnap.data().list || [];
    }
    return [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "config/feriados");
  }
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
    if (docSnap.exists()) {
      return !!docSnap.data().done;
    }
    return false;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, "config/wizard");
  }
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
    handleFirestoreError(error, OperationType.GET, "prePontos");
  }
}

export async function savePrePontoToDb(prePonto: PrePonto): Promise<void> {
  try {
    await setDoc(doc(db, "prePontos", prePonto.id), cleanObject(prePonto));
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
    handleFirestoreError(error, OperationType.GET, "folhasAceite");
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
    handleFirestoreError(error, OperationType.GET, "alertas");
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



