import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { T } from "./components/Theme";
import { User, ThemeColors, PontosGlobal, AuditLogEntry, EmpresaConfig, PrePonto, FolhaAceite, Alerta, Batida, Denuncia, SolicitacaoCorrecao, FolgaRemunerada } from "./types";
import { LoginScreen } from "./components/LoginScreen";
import { WizardScreen } from "./components/WizardScreen";
import { TermoCienciaScreen } from "./components/TermoCienciaScreen";
import { GerenciarMarcacoesView } from "./components/GerenciarMarcacoesView";
import { watchBestPosition } from "./utils/geolocationHelper";
import { requestAllNativePermissions } from "./utils/nativePermissions";
import { useAutoHeal } from "./utils/autoHealService";

import { EmployeePanel } from "./components/EmployeePanel";
import { AdmPanel } from "./components/AdmPanel";
import { AdmOperadorPanel } from "./components/AdmOperadorPanel";

import {
  initializeDbIfEmpty,
  fetchAllUsers,
  saveUserToDb,
  deleteUserFromDb,
  fetchAllPontos,
  fetchAllPontosMes,
  fetchPontosMes,
  saveDiaPonto,
  saveSingleDayPonto,
  batchSaveDiasPonto,
  saveUserPontosToDb,
  fetchAuditLogs,
  saveAuditLogToDb,
  batchSaveAuditLogs,
  addAuditLog,
  fetchAuditDia,
  getMesAtual,
  getDiaAtual,
  getMesPontoReferencia,
  getDiaPontoReferencia,
  fetchEmpresaConfig,
  saveEmpresaConfigToDb,
  fetchMinimoHoras,
  saveMinimoHorasToDb,
  fetchFeriados,
  saveFeriadosToDb,
  fetchFolgasRemuneradas,
  saveFolgasRemuneradasToDb,
  fetchWizardDone,
  saveWizardDoneToDb,
  fetchAllPrePontos,
  savePrePontoToDb,
  fetchAllFolhasAceite,
  saveFolhaAceiteToDb,
  deleteFolhaAceiteFromDb,
  updateUserBloqueioAceite,
  fetchAllAlertas,
  saveAlertaToDb,
  deleteAlertaFromDb,
  markAlertaAsReadInDb,
  getIsUsingOfflineCache,
  forceServerFetch,
  fetchAllDenuncias,
  saveDenunciaToDb,
  updateDenunciaInDb,
  deleteDenunciaFromDb,
  fetchAllSolicitacoesCorrecao,
  saveSolicitacaoCorrecaoToDb,
  updateSolicitacaoCorrecaoInDb,
  deleteSolicitacaoCorrecaoFromDb,
  checkFirebaseConnectivity,
  safeSync
} from "./lib/firebaseService";
import { savePontosToIndexedDB, getPontosFromIndexedDB, saveUsersToIndexedDB, getUsersFromIndexedDB, saveAuthSessionToIndexedDB, getAuthSessionFromIndexedDB, addToSyncQueue, getSyncQueue, removeFromSyncQueue, removeUserFromSyncQueue } from "./lib/indexedDbService";
import { clearOfflineQueue } from "./utils/preferencesService";
import { sanitizeAndDeduplicateUsers, reconcileUsers, isMatriculaMatch } from "./utils/hrHelpers";
import { PwaInstallPrompt } from "./components/PwaInstallPrompt";
import { AlertTriangle } from "lucide-react";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos sem interação para auto-logout


function getSafeLocalStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const value = localStorage.getItem(key);
    if (!value || value === "undefined") return defaultValue;
    try {
      return JSON.parse(value);
    } catch (e) {
      if (typeof defaultValue === "string") {
        return value as unknown as T;
      }
      throw e;
    }
  } catch (e) {
    console.warn(`Error parsing localStorage key "${key}":`, e);
    try {
      localStorage.removeItem(key);
    } catch (_) {}
    return defaultValue;
  }
}

function setSafeLocalStorageItem(key: string, value: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Error writing to localStorage for key "${key}":`, e);
  }
}

function removeSafeLocalStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`Error removing localStorage key "${key}":`, e);
  }
}

function areBatidasEqual(b1: any, b2: any): boolean {
  if (b1 === b2) return true;
  if (!b1 || !b2) return false;
  if (b1.hora !== b2.hora) return false;
  if ((b1.tipo || "auto") !== (b2.tipo || "auto")) return false;
  if (b1.registradoEm !== b2.registradoEm) return false;
  if ((b1.statusAprovacao || "aprovado") !== (b2.statusAprovacao || "aprovado")) return false;
  if ((b1.vistoPeloColaborador || false) !== (b2.vistoPeloColaborador || false)) return false;
  if ((b1.duplicadoOculto || false) !== (b2.duplicadoOculto || false)) return false;
  if ((b1.obs || "") !== (b2.obs || "")) return false;
  if ((b1.motivoAjuste || "") !== (b2.motivoAjuste || "")) return false;
  if ((b1.revisadoPor || "") !== (b2.revisadoPor || "")) return false;
  if ((b1.revisadoEm || "") !== (b2.revisadoEm || "")) return false;
  return true;
}

function areDayArraysEqual(arr1: (any | null)[], arr2: (any | null)[]): boolean {
  if (arr1.length !== arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (!areBatidasEqual(arr1[i], arr2[i])) return false;
  }
  return true;
}

function areUserDaysEqual(days1?: Record<string, (any | null)[]>, days2?: Record<string, (any | null)[]>): boolean {
  if (days1 === days2) return true;
  if (!days1 || !days2) return false;
  const keys1 = Object.keys(days1);
  const keys2 = Object.keys(days2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!days2[key]) return false;
    if (!areDayArraysEqual(days1[key], days2[key])) return false;
  }
  return true;
}

function reconcilePontos(local: PontosGlobal | null, server: PontosGlobal | null): { 
  merged: PontosGlobal; 
  changedUserIds: number[];
  changedDaysByUser: Record<number, Record<string, any>>;
} {
  const merged: PontosGlobal = JSON.parse(JSON.stringify(server || {}));
  const changedUserIds: number[] = [];
  const changedDaysByUser: Record<number, Record<string, any>> = {};

  if (!local) return { merged, changedUserIds, changedDaysByUser };

  for (const userIdStr of Object.keys(local)) {
    const userId = Number(userIdStr);
    const localUserDays = local[userId];
    if (!localUserDays) continue;

    if (!merged[userId]) {
      merged[userId] = {};
    }

    const mergedUserDays = merged[userId];
    let userChanged = false;
    const userDiffDays: Record<string, any> = {};

    for (const dayKey of Object.keys(localUserDays)) {
      const localDayArray = localUserDays[dayKey];
      if (!localDayArray) continue;

      const mergedDayArray = mergedUserDays[dayKey] || [null, null, null, null];
      const maxLength = Math.max(localDayArray.length, mergedDayArray.length);
      const newDayArray: (any | null)[] = [];

      for (let i = 0; i < maxLength; i++) {
        const localPunch = localDayArray[i] || null;
        const serverPunch = mergedDayArray[i] || null;

        if (localPunch && !serverPunch) {
          newDayArray.push(localPunch);
        } else if (!localPunch && serverPunch) {
          newDayArray.push(serverPunch);
        } else if (localPunch && serverPunch) {
          let chosenPunch: any = null;
          // Check revision/approval/edit timestamps
          const localRevTime = Math.max(
            localPunch.revisadoEm ? new Date(localPunch.revisadoEm).getTime() : 0,
            localPunch.editadoEm ? new Date(localPunch.editadoEm).getTime() : 0,
            localPunch.alteradoEm ? new Date(localPunch.alteradoEm).getTime() : 0,
            localPunch.registradoEm ? new Date(localPunch.registradoEm).getTime() : 0
          );
          const serverRevTime = Math.max(
            serverPunch.revisadoEm ? new Date(serverPunch.revisadoEm).getTime() : 0,
            serverPunch.editadoEm ? new Date(serverPunch.editadoEm).getTime() : 0,
            serverPunch.alteradoEm ? new Date(serverPunch.alteradoEm).getTime() : 0,
            serverPunch.registradoEm ? new Date(serverPunch.registradoEm).getTime() : 0
          );

          if (localRevTime > serverRevTime) {
            chosenPunch = localPunch;
          } else if (serverRevTime > localRevTime) {
            chosenPunch = serverPunch;
          } else if (localPunch.modificadoPorGestor && !serverPunch.modificadoPorGestor) {
            chosenPunch = localPunch;
          } else if (serverPunch.modificadoPorGestor && !localPunch.modificadoPorGestor) {
            chosenPunch = serverPunch;
          } else if (localPunch.statusAprovacao && localPunch.statusAprovacao !== "pendente" && (!serverPunch.statusAprovacao || serverPunch.statusAprovacao === "pendente")) {
            chosenPunch = localPunch;
          } else if (serverPunch.statusAprovacao && serverPunch.statusAprovacao !== "pendente" && (!localPunch.statusAprovacao || localPunch.statusAprovacao === "pendente")) {
            chosenPunch = serverPunch;
          } else {
            // Default to localPunch so local modifications aren't wiped out by equal or zero timestamps
            chosenPunch = localPunch || serverPunch;
          }

          if (chosenPunch) {
            const isVisto = Boolean(localPunch.vistoPeloColaborador || serverPunch.vistoPeloColaborador);
            newDayArray.push({
              ...chosenPunch,
              vistoPeloColaborador: isVisto
            });
          }
        } else {
          newDayArray.push(null);
        }
      }

      while (newDayArray.length < 4) {
        newDayArray.push(null);
      }
      const finalDayArray = newDayArray.slice(0, 4);

      const paddedMergedDayArray = [...mergedDayArray];
      while (paddedMergedDayArray.length < 4) {
        paddedMergedDayArray.push(null);
      }
      const finalMergedDayArray = paddedMergedDayArray.slice(0, 4);

      // ERRO 4 FIX: Deep equality comparison instead of JSON.stringify string matching
      const isDifferent = !areDayArraysEqual(finalDayArray, finalMergedDayArray);

      if (isDifferent) {
        mergedUserDays[dayKey] = finalDayArray;
        userDiffDays[dayKey] = finalDayArray;
        userChanged = true;
      }
    }

    if (userChanged) {
      changedUserIds.push(userId);
      changedDaysByUser[userId] = userDiffDays;
    }
  }

  return { merged, changedUserIds, changedDaysByUser };
}

function reconcileAuditLogs(local: AuditLogEntry[] | null, server: AuditLogEntry[] | null): { merged: AuditLogEntry[]; pending: AuditLogEntry[] } {
  const serverLogs = server || [];
  const localLogs = local || [];
  const serverMap = new Map(serverLogs.map(l => [l.id, l]));
  const pending: AuditLogEntry[] = [];
  const merged = [...serverLogs];

  const now = Date.now();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  for (const log of localLogs) {
    if (log && log.id && !serverMap.has(log.id)) {
      const logTime = log.quando ? new Date(log.quando).getTime() : (typeof log.id === 'number' ? log.id : 0);
      // Descartar logs de auditoria offline com mais de 7 dias ou inválidos para evitar acúmulos e timeouts
      if (logTime && (now - logTime) < SEVEN_DAYS_MS) {
        pending.push(log);
      } else {
        console.warn(`[Sync Log] Descartando log de auditoria offline antigo/expirado (id: ${log.id})`);
      }
    }
  }

  // Limitar o envio em lote a no máximo 5 itens por execução
  const limitedPending = pending.slice(0, 5);

  if (limitedPending.length > 0) {
    merged.unshift(...limitedPending);
    merged.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());
  }

  return { merged, pending: limitedPending };
}

function reconcileSolicitacoesCorrecao(
  local: SolicitacaoCorrecao[] | null,
  server: SolicitacaoCorrecao[] | null
): { merged: SolicitacaoCorrecao[]; pending: SolicitacaoCorrecao[] } {
  const serverList = server || [];
  const localList = local || [];
  const serverMap = new Map(serverList.map(s => [s.id, s]));
  const pending: SolicitacaoCorrecao[] = [];
  const merged = [...serverList];

  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  for (const sol of localList) {
    if (!sol || !sol.id) continue;
    const solTime = sol.criadoEm ? new Date(sol.criadoEm).getTime() : 0;
    if (solTime && (now - solTime) > THIRTY_DAYS_MS) continue;

    if (!serverMap.has(sol.id)) {
      pending.push(sol);
      merged.push(sol);
    } else {
      const serverSol = serverMap.get(sol.id)!;
      const localTime = sol.revisadoEm ? new Date(sol.revisadoEm).getTime() : new Date(sol.criadoEm).getTime();
      const serverTime = serverSol.revisadoEm ? new Date(serverSol.revisadoEm).getTime() : new Date(serverSol.criadoEm).getTime();
      if (localTime > serverTime && sol.status !== serverSol.status) {
        pending.push(sol);
        const idx = merged.findIndex(m => m.id === sol.id);
        if (idx >= 0) merged[idx] = sol;
      }
    }
  }

  merged.sort((a, b) => new Date(b.criadoEm || 0).getTime() - new Date(a.criadoEm || 0).getTime());
  return { merged, pending: pending.slice(0, 5) };
}

function reconcilePrePontos(
  local: PrePonto[] | null,
  server: PrePonto[] | null
): { merged: PrePonto[]; pending: PrePonto[] } {
  const serverList = server || [];
  const localList = local || [];
  const serverMap = new Map(serverList.map(p => [p.id, p]));
  const pending: PrePonto[] = [];

  const now = Date.now();
  const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;

  const validLocal: PrePonto[] = [];

  for (const pre of localList) {
    if (!pre || !pre.id) continue;
    const preTime = pre.quando ? new Date(pre.quando).getTime() : 0;
    const isOld = preTime && (now - preTime) > FORTY_EIGHT_HOURS_MS;

    if (isOld) continue; // Descartar pre-pontos com mais de 48h do cache local

    validLocal.push(pre);

    if (!serverMap.has(pre.id)) {
      pending.push(pre);
    } else {
      const serverPre = serverMap.get(pre.id)!;
      const localTime = pre.atualizadoEm ? new Date(pre.atualizadoEm).getTime() : new Date(pre.quando).getTime();
      const serverTime = serverPre.atualizadoEm ? new Date(serverPre.atualizadoEm).getTime() : new Date(serverPre.quando).getTime();
      if (localTime > serverTime && pre.status !== serverPre.status) {
        pending.push(pre);
      }
    }
  }

  const mergedMap = new Map<string, PrePonto>();
  for (const s of serverList) mergedMap.set(s.id, s);
  for (const p of validLocal) {
    if (!mergedMap.has(p.id)) {
      mergedMap.set(p.id, p);
    } else {
      const existing = mergedMap.get(p.id)!;
      const pTime = p.atualizadoEm ? new Date(p.atualizadoEm).getTime() : new Date(p.quando).getTime();
      const exTime = existing.atualizadoEm ? new Date(existing.atualizadoEm).getTime() : new Date(existing.quando).getTime();
      if (pTime > exTime) {
        mergedMap.set(p.id, p);
      }
    }
  }

  const merged = Array.from(mergedMap.values());
  merged.sort((a, b) => new Date(b.quando || 0).getTime() - new Date(a.quando || 0).getTime());

  return { merged, pending: pending.slice(0, 5) };
}

function sanitizeDaysForFirebase(days: Record<string, (any | null)[]>): Record<string, (any | null)[]> {
  if (!days) return days;
  const clean = JSON.parse(JSON.stringify(days));
  for (const dayKey of Object.keys(clean)) {
    const day = clean[dayKey];
    if (!Array.isArray(day)) continue;
    for (let i = 0; i < day.length; i++) {
      const b = day[i];
      if (b && typeof b === "object") {
        delete b.serverTime;
        delete b.gravadoOffline;
      }
    }
  }
  return clean;
}

function sanitizePontosGlobal(pontos: PontosGlobal): PontosGlobal {
  if (!pontos) return pontos;
  const clean: PontosGlobal = JSON.parse(JSON.stringify(pontos));
  for (const userIdStr of Object.keys(clean)) {
    const userId = Number(userIdStr);
    clean[userId] = sanitizeDaysForFirebase(clean[userId]);
  }
  return clean;
}

function clearUserSyncFlags(prev: PontosGlobal, userId: number): PontosGlobal {
  if (!prev[userId]) return prev;
  const updated: PontosGlobal = { ...prev };
  const userDays = { ...updated[userId] };
  for (const dayKey of Object.keys(userDays)) {
    const day = [...(userDays[dayKey] || [])];
    for (let i = 0; i < day.length; i++) {
      const b = day[i];
      if (b && typeof b === "object") {
        const { serverTime, gravadoOffline, ...rest } = b;
        day[i] = {
          ...rest,
          serverTime: (serverTime && serverTime !== "pending") ? serverTime : (b.registradoEm || b.hora || new Date().toISOString())
        };
      }
    }
    userDays[dayKey] = day;
  }
  updated[userId] = userDays;
  return updated;
}

function trimPontosForLocalStorage(pontos: PontosGlobal, monthsToKeep = 2): PontosGlobal {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const allowedPrefixes: string[] = [];
  for (let i = 0; i < monthsToKeep; i++) {
    let m = currentMonth - i;
    let y = currentYear;
    while (m <= 0) { m += 12; y -= 1; }
    allowedPrefixes.push(`${y}-${String(m).padStart(2, '0')}`);
  }
  const trimmed: PontosGlobal = {};
  for (const userIdStr of Object.keys(pontos)) {
    const userId = Number(userIdStr);
    const userDays = pontos[userId];
    if (!userDays) continue;
    const filteredDays: Record<string, (any | null)[]> = {};
    for (const dayKey of Object.keys(userDays)) {
      const prefix = dayKey.length >= 7 ? dayKey.substring(0, 7) : '';
      if (allowedPrefixes.includes(prefix)) {
        filteredDays[dayKey] = userDays[dayKey];
      }
    }
    if (Object.keys(filteredDays).length > 0) {
      trimmed[userId] = filteredDays;
    }
  }
  return trimmed;
}

function limitDiffDays(diffDays: Record<string, any>, maxDays = 5): Record<string, any> {
  const keys = Object.keys(diffDays);
  if (keys.length <= maxDays) return diffDays;
  const limited: Record<string, any> = {};
  // Sort by dayKey (newest first) and take the first maxDays
  const sortedKeys = keys.sort().reverse();
  for (let i = 0; i < maxDays; i++) {
    limited[sortedKeys[i]] = diffDays[sortedKeys[i]];
  }
  return limited;
}

export default function App() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">(() => {
    return getSafeLocalStorageItem<"light" | "dark">("hr_theme_mode", "light");
  });
  const t: ThemeColors = T[themeMode];

  useEffect(() => {
    setSafeLocalStorageItem("hr_theme_mode", themeMode);
  }, [themeMode]);

  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);

  // Load cached values synchronously for instant initial rendering (Stale-While-Revalidate pattern)
  const rawCachedUsers = getSafeLocalStorageItem<User[]>("hr_cached_users", []);
  const { cleanUsers: initialCachedUsers } = sanitizeAndDeduplicateUsers(rawCachedUsers);
  const initialCachedPontos = getSafeLocalStorageItem<PontosGlobal>("hr_cached_pontos", {});
  const initialCachedLogs = getSafeLocalStorageItem<AuditLogEntry[]>("hr_cached_audit_logs", []);
  const initialCachedMin = getSafeLocalStorageItem<number>("hr_cached_minimo_horas_dia", 7);
  const initialCachedEmpresa = getSafeLocalStorageItem<EmpresaConfig>("hr_cached_empresa_config", { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" });
  const initialCachedFeriados = getSafeLocalStorageItem<string[]>("hr_cached_feriados", []);
  const initialCachedFolgasRemuneradas = getSafeLocalStorageItem<FolgaRemunerada[]>("hr_cached_folgas_remuneradas", []);
  const initialCachedPrePontos = getSafeLocalStorageItem<PrePonto[]>("hr_cached_pre_pontos", []);
  const initialCachedFolhas = getSafeLocalStorageItem<FolhaAceite[]>("hr_cached_folhas_aceite", []);
  const initialCachedAlertas = getSafeLocalStorageItem<Alerta[]>("hr_cached_alertas", []);
  const initialCachedDenuncias = getSafeLocalStorageItem<Denuncia[]>("hr_cached_denuncias", []);
  const initialCachedSolicitacoes = getSafeLocalStorageItem<SolicitacaoCorrecao[]>("hr_cached_solicitacoes_correcao", []);
  const initialCachedWizardDone = getSafeLocalStorageItem<boolean>("hr_cached_wizard_done", true);
  const initialSavedUser = getSafeLocalStorageItem<User | null>("hr_current_user", null);

  const hasCache = initialCachedUsers.length > 0;

  const [isDbLoading, setIsDbLoading] = useState<boolean>(!hasCache);

  // Core Global States initialized with cache
  const [users, setUsers] = useState<User[]>(initialCachedUsers);
  const [pontos, setPontos] = useState<PontosGlobal>(initialCachedPontos);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(initialCachedLogs);
  const [minimoHorasDia, setMinimoHorasDia] = useState<number>(initialCachedMin);
  const [empresaConfig, setEmpresaConfig] = useState<EmpresaConfig>(initialCachedEmpresa);
  const [feriados, setFeriados] = useState<string[]>(initialCachedFeriados);
  const [folgasRemuneradas, setFolgasRemuneradas] = useState<FolgaRemunerada[]>(initialCachedFolgasRemuneradas);
  const [prePontos, setPrePontos] = useState<PrePonto[]>(initialCachedPrePontos);
  const [folhasAceite, setFolhasAceite] = useState<FolhaAceite[]>(initialCachedFolhas);
  const [alertas, setAlertas] = useState<Alerta[]>(initialCachedAlertas);
  const [denuncias, setDenuncias] = useState<Denuncia[]>(initialCachedDenuncias);
  const [solicitacoesCorrecao, setSolicitacoesCorrecao] = useState<SolicitacaoCorrecao[]>(initialCachedSolicitacoes);

  const initialFreshUser = initialSavedUser ? (initialCachedUsers.find(x => x.id === initialSavedUser.id) || initialSavedUser) : null;
  const [currentUser, setCurrentUser] = useState<User | null>(initialFreshUser);

  const initialScreen = initialSavedUser
    ? (initialFreshUser && !initialFreshUser.desativado ? (initialFreshUser.termoAceito ? "main" : "termo") : "login")
    : "login";

  const [screen, setScreen] = useState<"login" | "wizard" | "termo" | "main">(initialScreen);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isFirebaseBlocked, setIsFirebaseBlocked] = useState<boolean>(false);
  const [isOfflineData, setIsOfflineData] = useState<boolean>(false);
  const [isSyncingData, setIsSyncingData] = useState<boolean>(false);
  const isSyncingRef = useRef<boolean>(false);

  const refreshDataFromServer = async (showNotification = true) => {
    setIsSyncingData(true);
    try {
      const safeFetch = async <T,>(fn: () => Promise<T>, fallback: T, name: string): Promise<T> => {
        try {
          return await fn();
        } catch (error) {
          console.warn(`[Refresh Server] Failed to fetch ${name}:`, error);
          return fallback;
        }
      };

      const currentMes = getMesAtual();
      const [rawDbUsers, rawDbPontos, dbLogs, dbMin, dbEmpresa, dbFeriados, dbFolgas, dbPrePontos, dbFolhas, dbAlertas, dbDenuncias, dbSolicitacoes] = await Promise.all([
        safeFetch(() => fetchAllUsers(), [] as User[], "users"),
        safeFetch(() => fetchAllPontosMes(currentMes), {} as PontosGlobal, "pontos"),
        safeFetch(() => fetchAuditLogs(currentMes), [] as AuditLogEntry[], "auditLogs"),
        safeFetch(() => fetchMinimoHoras(), 7, "minimoHoras"),
        safeFetch(() => fetchEmpresaConfig(), { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" } as EmpresaConfig, "empresaConfig"),
        safeFetch(() => fetchFeriados(), [] as string[], "feriados"),
        safeFetch(() => fetchFolgasRemuneradas(), [] as FolgaRemunerada[], "folgasRemuneradas"),
        safeFetch(() => fetchAllPrePontos(), [] as PrePonto[], "prePontos"),
        safeFetch(() => fetchAllFolhasAceite(), [] as FolhaAceite[], "folhasAceite"),
        safeFetch(() => fetchAllAlertas(), [] as Alerta[], "alertas"),
        safeFetch(() => fetchAllDenuncias(), [] as Denuncia[], "denuncias"),
        safeFetch(() => fetchAllSolicitacoesCorrecao(), [] as SolicitacaoCorrecao[], "solicitacoesCorrecao")
      ]);

      const dbPontos = sanitizePontosGlobal(rawDbPontos);
      if (rawDbUsers.length > 0) {
        const cachedUsers = getSafeLocalStorageItem<User[]>("hr_cached_users", []);
        const combinedLocalUsers = [...users, ...cachedUsers];
        const { merged: reconciledUserList } = reconcileUsers(combinedLocalUsers, rawDbUsers);
        updateUsers(reconciledUserList);
      }
      const cachedPontos = getSafeLocalStorageItem<PontosGlobal>("hr_cached_pontos", {});
      const idbPontos = await getPontosFromIndexedDB().catch(() => ({}));
      const combinedLocalPontos = { ...(pontos || {}), ...(cachedPontos || {}), ...idbPontos };
      const { merged: reconciledPontos } = reconcilePontos(combinedLocalPontos, dbPontos);
      updatePontos(reconciledPontos);
      setAuditLogs(dbLogs);
      setMinimoHorasDia(dbMin);
      setEmpresaConfig(dbEmpresa);
      setFeriados(dbFeriados);
      setFolgasRemuneradas(dbFolgas || []);
      setSafeLocalStorageItem("hr_cached_folgas_remuneradas", dbFolgas || []);
      updateFolhasAceite(dbFolhas || []);
      updateAlertas(dbAlertas || []);
      setDenuncias(dbDenuncias || []);

      // Reconcile solicitacoesCorrecao & prePontos
      const cachedSolicitacoes = getSafeLocalStorageItem<SolicitacaoCorrecao[]>("hr_cached_solicitacoes_correcao", []);
      const { merged: reconciledSolicitacoes, pending: pendingSolicitacoes } = reconcileSolicitacoesCorrecao(cachedSolicitacoes, dbSolicitacoes);

      const cachedPrePontos = getSafeLocalStorageItem<PrePonto[]>("hr_cached_pre_pontos", []);
      const { merged: reconciledPrePontos, pending: pendingPrePontos } = reconcilePrePontos(cachedPrePontos, dbPrePontos);

      setSolicitacoesCorrecao(reconciledSolicitacoes);
      setPrePontos(reconciledPrePontos);

      setSafeLocalStorageItem("hr_cached_pontos", trimPontosForLocalStorage(reconciledPontos));
      setSafeLocalStorageItem("hr_cached_audit_logs", dbLogs.slice(0, 200));
      setSafeLocalStorageItem("hr_cached_alertas", dbAlertas || []);
      setSafeLocalStorageItem("hr_cached_solicitacoes_correcao", reconciledSolicitacoes.slice(0, 300));
      setSafeLocalStorageItem("hr_cached_pre_pontos", reconciledPrePontos.slice(0, 500));

      // Async push pending offline items
      for (const sol of pendingSolicitacoes) {
        saveSolicitacaoCorrecaoToDb(sol).catch(e => console.warn("Failed sync solicitacao:", e));
      }
      for (const pre of pendingPrePontos) {
        savePrePontoToDb(pre).catch(e => console.warn("Failed sync prePonto:", e));
      }

      const offlineUsed = getIsUsingOfflineCache();
      setIsOfflineData(offlineUsed);

      if (showNotification) {
        if (offlineUsed) {
          alert("Aviso: Servidor indisponível no momento. Exibindo dados locais.");
        } else {
          alert("✅ Dados sincronizados do servidor com sucesso!");
        }
      }
    } catch (err) {
      console.error("Error refreshing data from server:", err);
      setIsOfflineData(true);
    } finally {
      setIsSyncingData(false);
    }
  };

  // Load initial data from Firestore in background
  useEffect(() => {
    async function loadData() {
      try {
        const isConnected = await checkFirebaseConnectivity();
        if (!isConnected) {
          console.warn("[App Boot] Connectivity check failed. Entering local offline mode with notification banner.");
          setIsFirebaseBlocked(true);
        }

        // Fetch all database records safely to prevent any single collection error from crashing the entire initial load
        const safeFetch = async <T,>(fn: () => Promise<T>, fallback: T, name: string): Promise<T> => {
          try {
            return await fn();
          } catch (error) {
            console.warn(`[Firestore Load] Failed to fetch ${name}, using safe fallback value. Error:`, error);
            return fallback;
          }
        };

        const currentMes = getMesAtual();
        const [rawDbUsers, rawDbPontos, dbLogs, dbMin, dbEmpresa, dbFeriados, dbFolgas, wizardDone, dbPrePontos, dbFolhas, dbAlertas, dbDenuncias, dbSolicitacoes] = await Promise.all([
          safeFetch(() => fetchAllUsers(), [] as User[], "users"),
          safeFetch(() => fetchAllPontosMes(currentMes), {} as PontosGlobal, "pontosMes"),
          safeFetch(() => fetchAuditLogs(currentMes), [] as AuditLogEntry[], "auditLogs"),
          safeFetch(() => fetchMinimoHoras(), 7, "minimoHoras"),
          safeFetch(() => fetchEmpresaConfig(), { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" } as EmpresaConfig, "empresaConfig"),
          safeFetch(() => fetchFeriados(), [] as string[], "feriados"),
          safeFetch(() => fetchFolgasRemuneradas(), [] as FolgaRemunerada[], "folgasRemuneradas"),
          safeFetch(() => fetchWizardDone(), false, "wizardDone"),
          safeFetch(() => fetchAllPrePontos(), [] as PrePonto[], "prePontos"),
          safeFetch(() => fetchAllFolhasAceite(), [] as FolhaAceite[], "folhasAceite"),
          safeFetch(() => fetchAllAlertas(), [] as Alerta[], "alertas"),
          safeFetch(() => fetchAllDenuncias(), [] as Denuncia[], "denuncias"),
          safeFetch(() => fetchAllSolicitacoesCorrecao(), [] as SolicitacaoCorrecao[], "solicitacoesCorrecao")
        ]);

        const dbPontos = sanitizePontosGlobal(rawDbPontos);

        let dbUsers = rawDbUsers;
        if (dbUsers.length === 0) {
          // If Firestore is completely empty on first initialization, seed initial database
          await initializeDbIfEmpty();
          dbUsers = await safeFetch(() => fetchAllUsers(), [] as User[], "users");
        }

        // Load local offline users (LocalStorage + IndexedDB) to avoid losing any offline-added users
        const idbUsers = await getUsersFromIndexedDB().catch(() => []);
        const cachedUsers = getSafeLocalStorageItem<User[]>("hr_cached_users", []);
        const combinedLocalUsers = [...cachedUsers, ...idbUsers];

        // Reconcile users across local storage, IndexedDB and Firestore, enforcing superadmin rules
        const { merged: reconciledUserList } = reconcileUsers(combinedLocalUsers, dbUsers);
        dbUsers = reconciledUserList;

        // Persist reconciled users back to Firestore to ensure full synchronization
        const rawUserMap = new Map(rawDbUsers.map(u => [u.id, u]));
        for (const u of dbUsers) {
          const prev = rawUserMap.get(u.id);
          if (!prev || prev.nome !== u.nome || prev.matricula !== u.matricula || prev.senha !== u.senha || prev.desativado !== u.desativado || prev.primeiroAcesso !== u.primeiroAcesso) {
            saveUserToDb(u).catch(e => console.warn("Failed to persist reconciled user to Firestore:", e));
          }
        }
        
        // Reconcile Pontos (IndexedDB + LocalStorage Offline Cache -> Online)
        const idbPontos = await getPontosFromIndexedDB().catch(() => ({}));
        const cachedPontos = getSafeLocalStorageItem<PontosGlobal | null>("hr_cached_pontos", null);
        const combinedLocalPontos = { ...(cachedPontos || {}), ...idbPontos };
        const { merged: reconciledPontos, changedUserIds, changedDaysByUser } = reconcilePontos(combinedLocalPontos, dbPontos);

        // Reconcile Audit Logs (Offline -> Online)
        const cachedLogs = getSafeLocalStorageItem<AuditLogEntry[]>("hr_cached_audit_logs", []);
        const { merged: reconciledLogs, pending: pendingLogs } = reconcileAuditLogs(cachedLogs, dbLogs);

        // Reconcile Solicitacoes de Correcao (Offline -> Online)
        const cachedSolicitacoes = getSafeLocalStorageItem<SolicitacaoCorrecao[]>("hr_cached_solicitacoes_correcao", []);
        const { merged: reconciledSolicitacoes, pending: pendingSolicitacoes } = reconcileSolicitacoesCorrecao(cachedSolicitacoes, dbSolicitacoes);

        // Reconcile PrePontos (Offline -> Online)
        const cachedPrePontos = getSafeLocalStorageItem<PrePonto[]>("hr_cached_pre_pontos", []);
        const { merged: reconciledPrePontos, pending: pendingPrePontos } = reconcilePrePontos(cachedPrePontos, dbPrePontos);

        if (dbUsers.length > 0) setUsers(dbUsers);
        setPontos(reconciledPontos);
        setAuditLogs(reconciledLogs);
        setMinimoHorasDia(dbMin);
        setEmpresaConfig(dbEmpresa);
        setFeriados(dbFeriados);
        setFolgasRemuneradas(dbFolgas || []);
        setPrePontos(reconciledPrePontos);
        setFolhasAceite(dbFolhas || []);
        setAlertas(dbAlertas || []);
        setDenuncias(dbDenuncias || []);
        setSolicitacoesCorrecao(reconciledSolicitacoes);

        // Cache locally for offline survival
        if (dbUsers.length > 0) {
          setSafeLocalStorageItem("hr_cached_users", dbUsers);
          saveUsersToIndexedDB(dbUsers).catch(e => console.warn("[IndexedDB] saveUsersToIndexedDB error:", e));
        }
        setSafeLocalStorageItem("hr_cached_pontos", trimPontosForLocalStorage(reconciledPontos));
       const trimmedLogs = reconciledLogs.slice(0, 200);
        setSafeLocalStorageItem("hr_cached_audit_logs", trimmedLogs);
        setSafeLocalStorageItem("hr_cached_minimo_horas_dia", dbMin);
        setSafeLocalStorageItem("hr_cached_empresa_config", dbEmpresa);
        setSafeLocalStorageItem("hr_cached_feriados", dbFeriados);
        setSafeLocalStorageItem("hr_cached_folgas_remuneradas", dbFolgas || []);
        setSafeLocalStorageItem("hr_cached_wizard_done", wizardDone);
        setSafeLocalStorageItem("hr_cached_pre_pontos", reconciledPrePontos.slice(0, 500));
        setSafeLocalStorageItem("hr_cached_folhas_aceite", dbFolhas || []);
        setSafeLocalStorageItem("hr_cached_alertas", dbAlertas || []);
        setSafeLocalStorageItem("hr_cached_denuncias", dbDenuncias || []);
        setSafeLocalStorageItem("hr_cached_solicitacoes_correcao", reconciledSolicitacoes.slice(0, 300));

        setIsOfflineData(getIsUsingOfflineCache());

        // Push reconciled punches to Firestore asynchronously (max 5 dias por usuário no boot)
        for (const userId of changedUserIds) {
          const diffDays = changedDaysByUser[userId];
          if (diffDays && Object.keys(diffDays).length > 0) {
            const limitedDiffDays = limitDiffDays(diffDays, 5);
            const remainingCount = Object.keys(diffDays).length - Object.keys(limitedDiffDays).length;
            console.log(`[Sync] Uploading ${Object.keys(limitedDiffDays).length} reconciled offline day(s) for user ID ${userId} to Firestore...` + (remainingCount > 0 ? ` (${remainingCount} dia(s) restante(s) para próximo ciclo)` : ''));
            saveUserPontosToDb(userId, limitedDiffDays).catch(err => {
              console.warn(`[Sync] Non-blocking offline sync retry for user ${userId}:`, err);
            });
          }
        }

        // Push pending logs to Firestore asynchronously in batch (max 5)
        if (pendingLogs.length > 0) {
          console.log(`[Sync] Uploading ${pendingLogs.length} pending offline audit log(s) in batch...`);
          batchSaveAuditLogs(pendingLogs).catch(err => {
            console.warn("[Sync] Non-blocking batch error for offline audit logs:", err);
          });
        }

        // Push pending solicitacoes to Firestore asynchronously
        for (const sol of pendingSolicitacoes) {
          console.log(`[Sync] Uploading pending offline solicitacao correcao: ${sol.id}`);
          saveSolicitacaoCorrecaoToDb(sol).catch(err => {
            console.warn("[Sync] Non-blocking offline sync retry for solicitacao correcao:", err);
          });
        }

        // Push pending prePontos to Firestore asynchronously
        for (const pre of pendingPrePontos) {
          console.log(`[Sync] Uploading pending offline prePonto: ${pre.id}`);
          savePrePontoToDb(pre).catch(err => {
            console.warn("[Sync] Non-blocking offline sync retry for prePonto:", err);
          });
        }
        
        // Determine starting screen based on session and wizard completion
        const lsSavedUser = getSafeLocalStorageItem<User | null>("hr_current_user", null);
        const idbSavedUser = await getAuthSessionFromIndexedDB().catch(() => null);
        const u = lsSavedUser || idbSavedUser;

        const lastActivityTime = getSafeLocalStorageItem<number | null>("hr_last_activity_time", null);
        const isExpired = lastActivityTime ? (Date.now() - lastActivityTime >= INACTIVITY_TIMEOUT_MS) : false;

        if (u && !isExpired) {
          const freshUser = dbUsers.find(x => x.id === u.id) || u;
          if (freshUser && !freshUser.desativado) {
            setCurrentUser(freshUser);
            setSafeLocalStorageItem("hr_current_user", freshUser);
            setSafeLocalStorageItem("hr_last_activity_time", Date.now());
            saveAuthSessionToIndexedDB(freshUser).catch(() => {});
            setScreen(freshUser.termoAceito ? "main" : "termo");
          } else if (freshUser && freshUser.desativado) {
            setCurrentUser(null);
            setSafeLocalStorageItem("hr_current_user", null);
            saveAuthSessionToIndexedDB(null).catch(() => {});
            setScreen("login");
          }
        } else {
          if (u && isExpired) {
            setSafeLocalStorageItem("hr_auto_logout_msg", "Sua sessão foi encerrada por inatividade (30 minutos sem interação).");
          }
          setCurrentUser(null);
          setSafeLocalStorageItem("hr_current_user", null);
          saveAuthSessionToIndexedDB(null).catch(() => {});
          setScreen("login");
        }
      } catch (error) {
        console.error("Failed to load database from Firestore, falling back to local storage and IndexedDB cache:", error);
        try {
          const lsUsers = getSafeLocalStorageItem<User[]>("hr_cached_users", []);
          const idbUsers = await getUsersFromIndexedDB().catch(() => []);
          const usersMap = new Map<number, User>();
          for (const user of lsUsers) usersMap.set(user.id, user);
          for (const user of idbUsers) usersMap.set(user.id, user);
          const finalUsers = Array.from(usersMap.values());

          if (finalUsers.length > 0) {
            setUsers(finalUsers);
            saveUsersToIndexedDB(finalUsers).catch(() => {});
          } else {
            const { INITIAL_USERS } = await import("./data/mockData");
            setUsers(INITIAL_USERS);
          }
          
          const cachedPontos = getSafeLocalStorageItem<PontosGlobal | null>("hr_cached_pontos", null);
          const idbPontos = await getPontosFromIndexedDB().catch(() => ({}));
          const combinedPontos = { ...(cachedPontos || {}), ...idbPontos };
          if (Object.keys(combinedPontos).length > 0) {
            setPontos(combinedPontos);
          } else {
            const { SEED_PONTOS } = await import("./data/mockData");
            setPontos(SEED_PONTOS);
          }
          
          const cachedLogs = getSafeLocalStorageItem<AuditLogEntry[]>("hr_cached_audit_logs", []);
          setAuditLogs(cachedLogs);

          const cachedMin = getSafeLocalStorageItem<number>("hr_cached_minimo_horas_dia", 7);
          setMinimoHorasDia(cachedMin);

          const cachedEmpresa = getSafeLocalStorageItem<EmpresaConfig>("hr_cached_empresa_config", { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" });
          setEmpresaConfig(cachedEmpresa);

          const cachedFeriados = getSafeLocalStorageItem<string[]>("hr_cached_feriados", []);
          setFeriados(cachedFeriados);

          const cachedPre = getSafeLocalStorageItem<PrePonto[]>("hr_cached_pre_pontos", []);
          const nowMs = Date.now();
          const freshPre = cachedPre.filter(p => p && p.quando && (nowMs - new Date(p.quando).getTime()) < 48 * 60 * 60 * 1000);
          setPrePontos(freshPre);
          setSafeLocalStorageItem("hr_cached_pre_pontos", freshPre);

          const cachedFolhas = getSafeLocalStorageItem<FolhaAceite[]>("hr_cached_folhas_aceite", []);
          setFolhasAceite(cachedFolhas);

          const cachedAlertas = getSafeLocalStorageItem<Alerta[]>("hr_cached_alertas", []);
          setAlertas(cachedAlertas);
          
          const isWizardDone = getSafeLocalStorageItem<boolean>("hr_cached_wizard_done", false);
          const lsSavedUser = getSafeLocalStorageItem<User | null>("hr_current_user", null);
          const idbSavedUser = await getAuthSessionFromIndexedDB().catch(() => null);
          const u = lsSavedUser || idbSavedUser;

          const lastActivityTime = getSafeLocalStorageItem<number | null>("hr_last_activity_time", null);
          const isExpired = lastActivityTime ? (Date.now() - lastActivityTime >= INACTIVITY_TIMEOUT_MS) : false;

          if (u && !isExpired) {
            const freshUser = (finalUsers.length > 0 ? finalUsers : []).find(x => x.id === u.id) || u;
            if (freshUser && !freshUser.desativado) {
              setCurrentUser(freshUser);
              setSafeLocalStorageItem("hr_current_user", freshUser);
              setSafeLocalStorageItem("hr_last_activity_time", Date.now());
              saveAuthSessionToIndexedDB(freshUser).catch(() => {});
              setScreen(freshUser.termoAceito ? "main" : "termo");
            } else {
              setCurrentUser(null);
              setSafeLocalStorageItem("hr_current_user", null);
              saveAuthSessionToIndexedDB(null).catch(() => {});
              setScreen("login");
            }
          } else {
            if (u && isExpired) {
              setSafeLocalStorageItem("hr_auto_logout_msg", "Sua sessão foi encerrada por inatividade (30 minutos sem interação).");
            }
            setCurrentUser(null);
            setSafeLocalStorageItem("hr_current_user", null);
            saveAuthSessionToIndexedDB(null).catch(() => {});
            setScreen("login");
          }
        } catch (innerErr) {
          console.error("Critical: Failed to load local cache backup:", innerErr);
        }
      } finally {
        setIsDbLoading(false);
      }
    }
    loadData();
  }, []);

  // For Admin views which can toggle between "adm-dev" config and "adm-operator" points
  // Refs para acessar estados mais recentes em callbacks e auto-heal sem recriar efeitos
  const pontosRef = useRef<PontosGlobal>(pontos);
  const usersRef = useRef<User[]>(users);
  const prePontosRef = useRef<PrePonto[]>(prePontos);
  const auditLogsRef = useRef<AuditLogEntry[]>(auditLogs);
  const solicitacoesRef = useRef<SolicitacaoCorrecao[]>(solicitacoesCorrecao);
  const folhasAceiteRef = useRef<FolhaAceite[]>(folhasAceite);
  const denunciasRef = useRef<Denuncia[]>(denuncias);
  const processOfflineQueueRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => { pontosRef.current = pontos; }, [pontos]);
  useEffect(() => { usersRef.current = users; }, [users]);
  useEffect(() => { prePontosRef.current = prePontos; }, [prePontos]);
  useEffect(() => { auditLogsRef.current = auditLogs; }, [auditLogs]);
  useEffect(() => { solicitacoesRef.current = solicitacoesCorrecao; }, [solicitacoesCorrecao]);
  useEffect(() => { folhasAceiteRef.current = folhasAceite; }, [folhasAceite]);
  useEffect(() => { denunciasRef.current = denuncias; }, [denuncias]);
  // ========== USEEFFECTS DE SINCRONIZAÇÃO (fora dos callbacks de setState) ==========

  const prevUsersRef = useRef<User[]>(users);
  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_users", users);
    saveUsersToIndexedDB(users).catch(err => console.warn("[IndexedDB] saveUsersToIndexedDB error:", err));

    const prev = prevUsersRef.current;
    const prevMap = new Map(prev.map(u => [u.id, u]));
    const nextMap = new Map(users.map(u => [u.id, u]));

    for (const u of users) {
      const p = prevMap.get(u.id);
      const mudou = !p || JSON.stringify(p) !== JSON.stringify(u);
      if (mudou) {
        console.log(`[Sync] Detectada mudança em ${u.matricula} (id:${u.id}). Salvando...`);
        saveUserToDb(u)
          .then(() => console.log("✅ [Sync] Salvo no Firestore:", u.matricula))
          .catch((err: any) => {
            console.error("❌ [Sync] FALHA ao salvar:", u.matricula, err?.message || err);
          });
      }
    }
    for (const p of prev) {
      if (!nextMap.has(p.id)) {
        deleteUserFromDb(p.id).catch(err => console.warn("Failed to delete user from Firestore (offline?):", err));
      }
    }
    prevUsersRef.current = users;
  }, [users]);

  const prevPontosRef = useRef<PontosGlobal>(pontos);
  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_pontos", trimPontosForLocalStorage(pontos));
    savePontosToIndexedDB(pontos).catch(err => console.warn("[IndexedDB] savePontosToIndexedDB error:", err));

    const prev = prevPontosRef.current;
    for (const userIdStr of Object.keys(pontos)) {
      const userId = !isNaN(Number(userIdStr)) ? Number(userIdStr) : userIdStr;
      const nextDays = pontos[userId] || pontos[userIdStr] || {};
      const prevDays = prev[userId] || prev[userIdStr] || {};

      const allDayKeys = new Set([...Object.keys(nextDays), ...Object.keys(prevDays)]);
      for (const dayKey of allDayKeys) {
        const nextPunchArr = nextDays[dayKey] || [null, null, null, null];
        const prevPunchArr = prevDays[dayKey] || [null, null, null, null];

        if (!areDayArraysEqual(nextPunchArr, prevPunchArr)) {
          saveDiaPonto(userId, dayKey, nextPunchArr).then(async () => {
            await clearOfflineQueue().catch(() => {});
            await removeUserFromSyncQueue(userId).catch(() => {});
          }).catch(err => {
            console.warn(`[Sync] Falha ao salvar dia ${dayKey} no Firebase para usuário ${userId}, adicionando à fila do IndexedDB:`, err);
            addToSyncQueue("saveUserPontos", { userId, days: { [dayKey]: nextPunchArr } }).catch(e => console.error("Error adding to sync queue:", e));
          });
        }
      }
    }
    prevPontosRef.current = pontos;
  }, [pontos]);

  const prevAuditLogsRef = useRef<AuditLogEntry[]>(auditLogs);
  useEffect(() => {
    // Limitar cache local a 500 entradas para não estourar quota do localStorage
    const trimmedLogs = auditLogs.slice(0, 500);
    setSafeLocalStorageItem("hr_cached_audit_logs", trimmedLogs);

    // NOTA: Não salvamos logs individualmente no Firestore aqui para evitar loop infinito.
    // O reconcileAuditLogs + batchSaveAuditLogs no autoHeal/backgroundSync/manualSync
    // já cuida do envio em batch. Salvar um por um causa duplicação porque o Firestore
    // gera IDs diferentes (addDoc) e o reconcile considera o log local como "pendente" eternamente.
    prevAuditLogsRef.current = auditLogs;
  }, [auditLogs]);

  const prevMinimoHorasRef = useRef<number>(minimoHorasDia);
  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_minimo_horas_dia", minimoHorasDia);
    if (minimoHorasDia !== prevMinimoHorasRef.current) {
      saveMinimoHorasToDb(minimoHorasDia).catch(err => console.warn("Failed to save minimum hours to Firestore (offline?):", err));
    }
    prevMinimoHorasRef.current = minimoHorasDia;
  }, [minimoHorasDia]);

  const prevEmpresaConfigRef = useRef<EmpresaConfig>(empresaConfig);
  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_empresa_config", empresaConfig);
    if (JSON.stringify(empresaConfig) !== JSON.stringify(prevEmpresaConfigRef.current)) {
      saveEmpresaConfigToDb(empresaConfig).catch(err => console.warn("Failed to save company config to Firestore (offline?):", err));
    }
    prevEmpresaConfigRef.current = empresaConfig;
  }, [empresaConfig]);

  const prevFeriadosRef = useRef<string[]>(feriados);
  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_feriados", feriados);
    if (JSON.stringify(feriados) !== JSON.stringify(prevFeriadosRef.current)) {
      saveFeriadosToDb(feriados).catch(err => console.warn("Failed to save feriados to Firestore (offline?):", err));
    }
    prevFeriadosRef.current = feriados;
  }, [feriados]);

  const prevFolgasRef = useRef<FolgaRemunerada[]>(folgasRemuneradas);
  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_folgas_remuneradas", folgasRemuneradas);
    if (JSON.stringify(folgasRemuneradas) !== JSON.stringify(prevFolgasRef.current)) {
      saveFolgasRemuneradasToDb(folgasRemuneradas).catch(err => console.warn("Failed to save folgasRemuneradas to Firestore (offline?):", err));
    }
    prevFolgasRef.current = folgasRemuneradas;
  }, [folgasRemuneradas]);

  const prevFolhasAceiteRef = useRef<FolhaAceite[]>(folhasAceite);
  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_folhas_aceite", folhasAceite);

    const prev = prevFolhasAceiteRef.current;
    const prevMap = new Map(prev.map(f => [f.id, f]));
    const nextMap = new Map(folhasAceite.map(f => [f.id, f]));

    for (const folha of folhasAceite) {
      const p = prevMap.get(folha.id);
      if (!p || JSON.stringify(p) !== JSON.stringify(folha)) {
        saveFolhaAceiteToDb(folha).catch(err => console.warn("Failed to save folha to Firestore (offline?):", err));
      }
    }
    for (const [id] of prevMap) {
      if (!nextMap.has(id)) {
        deleteFolhaAceiteFromDb(id).catch(err => console.warn("Failed to delete folha from Firestore (offline?):", err));
      }
    }
    prevFolhasAceiteRef.current = folhasAceite;
  }, [folhasAceite]);

  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_alertas", alertas);
  }, [alertas]);

  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_pre_pontos", prePontos);
  }, [prePontos]);

  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_denuncias", denuncias);
  }, [denuncias]);

  useEffect(() => {
    setSafeLocalStorageItem("hr_cached_solicitacoes_correcao", solicitacoesCorrecao);
  }, [solicitacoesCorrecao]);



  const [adminRoleMode, setAdminRoleMode] = useState<"dev" | "operador" | "gerenciar_marcacoes">("operador");

  const handleSalvarPontoGerenciado = async (
    userId: number,
    dayKey: string,
    batidaIdx: number,
    novaHora: string,
    justificativa: string
  ) => {
    const [hh, mm] = novaHora.split(":").map(Number);
    const dateObj = new Date(`${dayKey}T12:00:00-03:00`);
    dateObj.setHours(hh, mm, 0, 0);

    const targetUser = users.find((u) => u.id === userId);
    const userDays = { ...(pontos[userId] || {}) };
    const dayPunches = [...(userDays[dayKey] || [null, null, null, null])];
    while (dayPunches.length < 4) dayPunches.push(null);

    const existingPunch = dayPunches[batidaIdx];
    const horaAnteriorStr =
      existingPunch && existingPunch.hora
        ? new Date(existingPunch.hora).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "--:--";

    const nowIso = new Date().toISOString();
    const updatedPunch: Batida = {
      ...(existingPunch || {}),
      hora: dateObj.toISOString(),
      iso: dateObj.toISOString(),
      tipo: "manual",
      origemMarcacao: "MO",
      modificadoPorGestor: true,
      modificadoPor: currentUser?.nome || "Gestor",
      modificadoPorMatricula: currentUser?.matricula || "",
      registradoEm: existingPunch?.registradoEm || nowIso,
      alteradoEm: nowIso,
      editadoEm: nowIso,
      revisadoEm: nowIso,
      justificativaAlteracao: justificativa,
      lancadoPorAdm: true,
    };

    dayPunches[batidaIdx] = updatedPunch;
    userDays[dayKey] = dayPunches;

    updatePontos((prev) => ({
      ...prev,
      [userId]: userDays,
    }));

    await saveDiaPonto(userId, dayKey, dayPunches).catch((err) => {
      console.error("[App] Erro ao salvar ponto gerenciado no Firestore:", err);
    });

    const log: AuditLogEntry = {
      id: Date.now(),
      quando: nowIso,
      quem: currentUser?.nome || "Gestor",
      quemMat: currentUser?.matricula || "",
      acao: `GERENCIAR_MARCACAO_MO`,
      alvo: `Matrícula: ${targetUser?.matricula || userId} — ${targetUser?.nome || "Colaborador"}`,
      detalhe: `Ponto modificado/inserido [Slot ${batidaIdx + 1}] em ${dayKey}: de ${horaAnteriorStr} para ${novaHora}. Justificativa: "${justificativa}"`,
      userId,
      dayKey,
      slotIdx: batidaIdx,
      horaAnterior: horaAnteriorStr,
      horaNova: novaHora,
      tipoModificacao: "MO",
      justificativa,
    };

    handleAddLog(
      log.acao,
      log.quem,
      log.detalhe || "",
      { userId, dayKey, slotIdx: batidaIdx }
    );
  };

  // Wrapper functions to keep local state and Firestore in perfect sync
  const updateUsers = (newUsersOrFn: User[] | ((prev: User[]) => User[])) => {
    setUsers((prev) => {
      const rawNext = typeof newUsersOrFn === "function" ? newUsersOrFn(prev) : newUsersOrFn;
      const { cleanUsers: next } = sanitizeAndDeduplicateUsers(rawNext);
      return next;
    });
  };

const updatePontos = (newPontosOrFn: PontosGlobal | ((prev: PontosGlobal) => PontosGlobal)) => {
    setPontos((prev) => {
      const next = typeof newPontosOrFn === "function" ? newPontosOrFn(prev) : newPontosOrFn;
      return next;
    });
  };

const updateAuditLogs = (newLogsOrFn: AuditLogEntry[] | ((prev: AuditLogEntry[]) => AuditLogEntry[])) => {
    setAuditLogs((prev) => {
      const next = typeof newLogsOrFn === "function" ? newLogsOrFn(prev) : newLogsOrFn;
      return next;
    });
  };

const updateMinimoHorasDia = (newValOrFn: number | ((prev: number) => number)) => {
    setMinimoHorasDia((prev) => {
      const next = typeof newValOrFn === "function" ? newValOrFn(prev) : newValOrFn;
      return next;
    });
  };

const updateEmpresaConfig = (newConfigOrFn: EmpresaConfig | ((prev: EmpresaConfig) => EmpresaConfig)) => {
    setEmpresaConfig((prev) => {
      const next = typeof newConfigOrFn === "function" ? newConfigOrFn(prev) : newConfigOrFn;
      return next;
    });
  };

const updateFeriados = (newFeriadosOrFn: string[] | ((prev: string[]) => string[])) => {
    setFeriados((prev) => {
      const next = typeof newFeriadosOrFn === "function" ? newFeriadosOrFn(prev) : newFeriadosOrFn;
      return next;
    });
  };

const updateFolgasRemuneradas = (newFolgasOrFn: FolgaRemunerada[] | ((prev: FolgaRemunerada[]) => FolgaRemunerada[])) => {
    setFolgasRemuneradas((prev) => {
      const next = typeof newFolgasOrFn === "function" ? newFolgasOrFn(prev) : newFolgasOrFn;
      return next;
    });
  };

const registerPrePonto = async (userId: number, userName: string, matricula: string, dayKey: string, idx: number, tipo: "auto" | "manual") => {
    const id = `pre_${userId}_${dayKey}_${idx}_${Date.now()}`;
    const newPre: PrePonto = {
      id,
      userId,
      userName,
      matricula,
      dayKey,
      idx,
      tipo,
      quando: new Date().toISOString(),
      status: "pendente"
    };

    setPrePontos((prev) => [newPre, ...prev]);

    try {
      await savePrePontoToDb(newPre);
    } catch (err) {
      console.warn("Failed to save pre-ponto to Firestore (offline?):", err);
    }
    return id;
  };

const markPrePontoSuccess = async (prePontoId: string) => {
    setPrePontos((prev) => {
      const next = prev.map(p => p.id === prePontoId ? { ...p, status: "sucesso" as const, atualizadoEm: new Date().toISOString() } : p);
      const found = next.find(p => p.id === prePontoId);
      if (found) {
        savePrePontoToDb(found).catch(err => console.warn("Failed to update pre-ponto to Firestore:", err));
      }
      return next;
    });
  };

const cancelPrePonto = async (prePontoId: string) => {
    setPrePontos((prev) => {
      const next = prev.map(p => p.id === prePontoId ? { ...p, status: "cancelado" as const, atualizadoEm: new Date().toISOString() } : p);
      const found = next.find(p => p.id === prePontoId);
      if (found) {
        savePrePontoToDb(found).catch(err => console.warn("Failed to update pre-ponto to Firestore:", err));
      }
      return next;
    });
  };

const updateFolhasAceite = (newFolhasOrFn: FolhaAceite[] | ((prev: FolhaAceite[]) => FolhaAceite[])) => {
    setFolhasAceite((prev) => {
      const next = typeof newFolhasOrFn === "function" ? newFolhasOrFn(prev) : newFolhasOrFn;
      return next;
    });
  };

const updateAlertas = (newAlertasOrFn: Alerta[] | ((prev: Alerta[]) => Alerta[])) => {
    setAlertas((prev) => {
      const next = typeof newAlertasOrFn === "function" ? newAlertasOrFn(prev) : newAlertasOrFn;
      return next;
    });
  };

const handleSendDenuncia = async (data: { texto: string; fotoUrl?: string | null }) => {
    const id = `denuncia_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const criadoEm = new Date().toISOString();
    const created: Denuncia = {
      id,
      texto: data.texto.trim(),
      fotoUrl: data.fotoUrl || null,
      criadoEm,
      status: "pendente",
      respostaAdm: null,
      atualizadoEm: null
    };

    setDenuncias(prev => [created, ...prev]);

    saveDenunciaToDb({ id, texto: data.texto, fotoUrl: data.fotoUrl, criadoEm }).catch(err => {
      console.warn("Error saving denuncia to Firestore in background:", err);
    });
  };

const handleUpdateDenunciaStatus = async (id: string, status: Denuncia["status"], respostaAdm?: string) => {
    const atualizadoEm = new Date().toISOString();

    setDenuncias(prev => prev.map(d => d.id === id ? { 
      ...d, 
      status, 
      respostaAdm: respostaAdm !== undefined ? respostaAdm : d.respostaAdm, 
      atualizadoEm 
    } : d));

    updateDenunciaInDb(id, { status, respostaAdm }).catch(err => {
      console.warn("Error updating denuncia in Firestore in background:", err);
    });
  };

const handleDeleteDenuncia = async (id: string) => {
    setDenuncias(prev => prev.filter(d => d.id !== id));

    deleteDenunciaFromDb(id).catch(err => {
      console.warn("Error deleting denuncia in Firestore in background:", err);
    });
  };

const handleSendSolicitacaoCorrecao = async (data: {
    data: string;
    hora: string;
    slotIdx: number;
    motivo: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
  }) => {
    if (!currentUser) return;
    const id = `solic_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const criadoEm = new Date().toISOString();

    const created: SolicitacaoCorrecao = {
      id,
      userId: currentUser.id,
      userName: currentUser.nome,
      matricula: currentUser.matricula,
      data: data.data,
      hora: data.hora,
      slotIdx: data.slotIdx,
      motivo: data.motivo,
      latitude: data.latitude || null,
      longitude: data.longitude || null,
      accuracy: data.accuracy || null,
      status: "pendente",
      criadoEm
    };

    setSolicitacoesCorrecao(prev => [created, ...prev]);

    // 1. Insere a marcação solicitada imediatamente no cartão de ponto como VÁLIDA
    // para que a pessoa não fique bloqueada e possa registrar batidas normalmente.
    let isoString = "";
    if (data.hora && data.hora.includes("T")) {
      isoString = data.hora;
    } else if (data.hora) {
      const parts = data.hora.split(":");
      const hh = String(parts[0] || "0").padStart(2, "0");
      const mm = String(parts[1] || "0").padStart(2, "0");
      const ss = String(parts[2] || "0").padStart(2, "0");
      const isoDateObj = new Date(`${data.data}T${hh}:${mm}:${ss}-03:00`);
      isoString = isoDateObj.toISOString();
    } else {
      isoString = new Date().toISOString();
    }

    const pendingPunch: Batida = {
      hora: isoString,
      iso: isoString,
      registradoEm: criadoEm,
      tipo: "manual",
      statusAprovacao: "pendente",
      justificativa: `Solicitação de Correção Pendente: ${data.motivo}`,
      origemMarcacao: "NORMAL",
      solicitacaoId: id,
      latitude: data.latitude || undefined,
      longitude: data.longitude || undefined,
      accuracy: data.accuracy || undefined,
    };

    const nextGlobalSend = { ...pontos };
    const userPontosSend = { ...(nextGlobalSend[currentUser.id] || {}) };
    const dayPunchesSend = [...(userPontosSend[data.data] || [null, null, null, null])];
    while (dayPunchesSend.length < 4) dayPunchesSend.push(null);

    dayPunchesSend[data.slotIdx] = pendingPunch;
    userPontosSend[data.data] = dayPunchesSend;
    nextGlobalSend[currentUser.id] = userPontosSend;

    updatePontos(nextGlobalSend);

    handleAddLog("SOLICITACAO_CORRECAO", currentUser.nome, `Solicitou correção de ponto para ${data.data} às ${data.hora} (Motivo: ${data.motivo})`);

    saveSolicitacaoCorrecaoToDb(created).catch(err => {
      console.warn("Error saving solicitacao correcao to Firestore:", err);
    });
  };

  const handleAprovarSolicitacaoCorrecao = async (id: string, revisadoPor: string) => {
    const req = solicitacoesCorrecao.find(s => s.id === id);
    if (!req) return;

    const revisadoEm = new Date().toISOString();

    // 1. Update request status in state
    setSolicitacoesCorrecao(prev => prev.map(s => s.id === id ? { ...s, status: "aprovado" as const, revisadoPor, revisadoEm } : s));

    // 2. Ao aprovar, a marcação GANHA A TAG M.A (origemMarcacao = "MA") e statusAprovacao = "aprovado"
    const targetUserId = req.userId;
    const targetDayKey = req.data;
    const targetSlotIdx = req.slotIdx;
    const targetHora = req.hora;

    const nextGlobalAprovar = { ...pontos };
    const userPontosAprovar = { ...(nextGlobalAprovar[targetUserId] || {}) };
    const dayPunchesAprovar = [...(userPontosAprovar[targetDayKey] || [null, null, null, null])];
    while (dayPunchesAprovar.length < 4) dayPunchesAprovar.push(null);

    let isoString = "";
    if (targetHora && targetHora.includes("T")) {
      isoString = targetHora;
    } else if (targetHora) {
      const parts = targetHora.split(":");
      const hh = String(parts[0] || "0").padStart(2, "0");
      const mm = String(parts[1] || "0").padStart(2, "0");
      const ss = String(parts[2] || "0").padStart(2, "0");
      const isoDateObj = new Date(`${targetDayKey}T${hh}:${mm}:${ss}-03:00`);
      isoString = isoDateObj.toISOString();
    } else {
      isoString = new Date().toISOString();
    }

    const existingPunchAprovar = dayPunchesAprovar[targetSlotIdx];
    const approvedPunch: Batida = {
      ...(existingPunchAprovar || {}),
      hora: isoString,
      iso: isoString,
      registradoEm: existingPunchAprovar?.registradoEm || isoString,
      editadoEm: revisadoEm,
      editadoPor: revisadoPor,
      justificativa: `Correção Aprovada por ${revisadoPor}: ${req.motivo}`,
      tipo: "manual",
      origemMarcacao: "MA",
      statusAprovacao: "aprovado",
      solicitacaoId: id,
    };

    if (req.latitude && req.longitude) {
      approvedPunch.latitude = req.latitude;
      approvedPunch.longitude = req.longitude;
      if (req.accuracy) approvedPunch.accuracy = req.accuracy;
    }

    dayPunchesAprovar[targetSlotIdx] = approvedPunch;
    userPontosAprovar[targetDayKey] = dayPunchesAprovar;
    nextGlobalAprovar[targetUserId] = userPontosAprovar;

    updatePontos(nextGlobalAprovar);

    handleAddLog("APROVAR_CORRECAO", revisadoPor, `Aprovou correção de ponto de ${req.userName} para ${req.data} às ${req.hora}`);

    // 3. Update request in Firestore
    updateSolicitacaoCorrecaoInDb(id, { status: "aprovado", revisadoPor, revisadoEm }).catch(err => {
      console.warn("Error updating solicitacao correcao in Firestore:", err);
    });
  };

  const handleRejeitarSolicitacaoCorrecao = async (id: string, motivoRejeicao: string, revisadoPor: string) => {
    const req = solicitacoesCorrecao.find(s => s.id === id);
    if (!req) return;

    const revisadoEm = new Date().toISOString();

    setSolicitacoesCorrecao(prev => prev.map(s => s.id === id ? { ...s, status: "rejeitado" as const, motivoRejeicao, revisadoPor, revisadoEm } : s));

    // Ao recusar, a marcação aparece como MARCAÇÃO RECUSADA
    const targetUserId = req.userId;
    const targetDayKey = req.data;
    const targetSlotIdx = req.slotIdx;

    const nextGlobalRejeitar = { ...pontos };
    const userPontosRejeitar = { ...(nextGlobalRejeitar[targetUserId] || {}) };
    const dayPunchesRejeitar = [...(userPontosRejeitar[targetDayKey] || [null, null, null, null])];
    while (dayPunchesRejeitar.length < 4) dayPunchesRejeitar.push(null);

    const existingPunchRejeitar = dayPunchesRejeitar[targetSlotIdx];
    const rejectedPunch: Batida = {
      ...(existingPunchRejeitar || {}),
      statusAprovacao: "recusado",
      origemMarcacao: "RECUSADA",
      motivoRejeicaoAjuste: motivoRejeicao,
      justificativa: `Marcação Recusada por ${revisadoPor}: ${motivoRejeicao}`,
      editadoEm: revisadoEm,
      editadoPor: revisadoPor,
    };

    dayPunchesRejeitar[targetSlotIdx] = rejectedPunch;
    userPontosRejeitar[targetDayKey] = dayPunchesRejeitar;
    nextGlobalRejeitar[targetUserId] = userPontosRejeitar;

    updatePontos(nextGlobalRejeitar);

    handleAddLog("REJEITAR_CORRECAO", revisadoPor, `Recusou solicitação de correção de ${req.userName} (${motivoRejeicao})`);

    updateSolicitacaoCorrecaoInDb(id, { status: "rejeitado", motivoRejeicao, revisadoPor, revisadoEm }).catch(err => {
      console.warn("Error updating solicitacao correcao in Firestore:", err);
    });
  };

  const handleAddNewUser = async (novoUser: User): Promise<User> => {
    // 1. Validações
    if (!novoUser.matricula || !novoUser.nome) {
      throw new Error("Matrícula e nome são obrigatórios.");
    }
    if (!novoUser.senha) {
      throw new Error("Senha é obrigatória.");
    }

    // 2. Gera ID se não tiver
    if (!novoUser.id) {
      novoUser.id = Date.now();
    }

    // 3. Normaliza
    novoUser.matricula = String(novoUser.matricula).trim().toLowerCase();
    novoUser.nome = novoUser.nome.trim();
    novoUser.senha = String(novoUser.senha).trim();
    novoUser.desativado = false;
    novoUser.criadoEm = novoUser.criadoEm || new Date().toISOString();

    // 4. Verifica duplicado
    const existe = users.find(u => isMatriculaMatch(u.matricula, novoUser.matricula));
    if (existe) {
      throw new Error(`Matrícula ${novoUser.matricula} já cadastrada.`);
    }

    // 5. Tenta salvar no Firestore com fallback para a fila de autocura
    try {
      console.log("🔥 [handleAddNewUser] Salvando no Firestore:", novoUser.matricula, "ID:", novoUser.id);
      await saveUserToDb(novoUser);
      console.log("✅ [handleAddNewUser] Confirmado no Firestore");
    } catch (err: any) {
      const isTimeout = err?.message?.includes("Timeout") || err?.message?.includes("offline") || !navigator.onLine;
      if (isTimeout) {
        // Salva na fila de autocura
        const fila = getSafeLocalStorageItem<User[]>("fila_cadastro_offline", []);
        fila.push(novoUser);
        setSafeLocalStorageItem("fila_cadastro_offline", fila);
        console.warn("[handleAddNewUser] Timeout detectado. Cadastro salvo na fila de autocura.");
        alert("⚠️ Sem conexão com o servidor no momento. Cadastro salvo localmente e será enviado automaticamente em alguns minutos.");
      } else {
        throw err; // Outro erro, propaga
      }
    }

    // 6. Atualiza estado local independente do Firestore
    const newUsers = [...users, novoUser];
    updateUsers(newUsers);
    // localStorage e IndexedDB são atualizados automaticamente pelo useEffect de users

    return novoUser;
  };


  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const processOfflineQueue = async () => {
    // Atualiza a ref para que callbacks possam acessar esta função
    processOfflineQueueRef.current = processOfflineQueue;
    try {
      const queue = await getSyncQueue();
      if (!queue || queue.length === 0) return;
      console.log(`[Offline Sync Queue] Processando ${queue.length} item(ns) pendente(s)...`);
      for (const item of queue) {
        if (!item.id) continue;
        try {
          if ((item.type as string) === "saveUserPontos" || (item.type as string) === "saveDiaPonto") {
            const synced = await safeSync(item, async (it) => {
              const { userId, days } = it.payload;
              if (days && typeof days === "object") {
                const currentMes = getMesAtual();
                for (const dayKey of Object.keys(days)) {
                  const dayMes = dayKey.length >= 7 ? dayKey.substring(0, 7) : currentMes;
                  const failKey = `hr_fail_${userId}_${dayKey}`;
                  const prevFails = getSafeLocalStorageItem<number>(failKey, 0);
                  const dayDate = new Date(dayKey + "T12:00:00");
                  const daysOld = Math.floor((Date.now() - dayDate.getTime()) / (24 * 60 * 60 * 1000));

                  // Só descartar se: mês anterior AND falhou 20+ vezes AND tem mais de 90 dias
                  if (dayMes < currentMes && prevFails >= 20 && daysOld > 90) {
                    console.warn(`[Sync Queue] Descartando sincronização de dia offline MUITO antigo (${dayKey}, ${daysOld} dias, ${prevFails} falhas) para usuário ${userId}.`);
                    continue;
                  }

                  await saveSingleDayPonto(userId, dayKey, days[dayKey]);
                }
              }
              await removeFromSyncQueue(it.id);
              await removeUserFromSyncQueue(userId).catch(() => {});
              await clearOfflineQueue().catch(() => {});
              console.log(`[Sync Queue] Pontos do usuário ${userId} sincronizados via sharding mensal!`);
              
              updatePontos(current => {
                const updated = clearUserSyncFlags(current, userId);
                return updated;
              });
            });

            if (!synced) {
              console.warn("[Sync Queue] Pausando sincronização da fila (rate limit de 5/min atingido).");
              break;
            }
            
          } else if (item.type === "saveAuditLog") {
            const log = item.payload;
            const logTime = log?.quando ? new Date(log.quando).getTime() : (item.createdAt || 0);
            const isOld = logTime && (Date.now() - logTime > 7 * 24 * 60 * 60 * 1000);
            if (isOld) {
              console.warn(`[Sync Queue] Descartando log de auditoria antigo da fila de sincronização (id: ${item.id})`);
              await removeFromSyncQueue(item.id);
              continue;
            }

            const synced = await safeSync(item, async (it) => {
              try {
                await saveAuditLogToDb(it.payload);
                await removeFromSyncQueue(it.id);
                console.log(`[Sync Queue] Log de auditoria salvo no Firebase com sucesso!`);
              } catch (auditErr) {
                console.warn(`[Sync Queue] Log de auditoria falhou e foi descartado da fila:`, auditErr);
                await removeFromSyncQueue(it.id).catch(() => {});
              }
            });

            if (!synced) {
              console.warn("[Sync Queue] Pausando sincronização de logs da fila (rate limit de 5/min atingido).");
              break;
            }
          }
        } catch (itemErr) {
          console.warn(`[Sync Queue] Item ${item.id} falhou na sincronização, mantendo na fila:`, itemErr);
        }
      }
    } catch (err) {
      console.warn("[Sync Queue] Erro ao processar fila do IndexedDB:", err);
    }
  };

  

const syncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      console.log("[Sync] Manual sync triggered...");
      
      // 1. Flush any pending operations in the IndexedDB offline sync queue
      await processOfflineQueueRef.current?.();

      // 2. Scan current React state for offline-marked punches and upload them to Firestore
      let currentPontos = { ...pontos };
      let stateHasChanged = false;

      for (const userIdStr of Object.keys(currentPontos)) {
        const userId = Number(userIdStr);
        const userDays = currentPontos[userId];
        if (!userDays) continue;

        let hasPending = false;
        for (const dayKey of Object.keys(userDays)) {
          const day = userDays[dayKey];
          if (Array.isArray(day)) {
            for (const punch of day) {
              if (punch && (punch.gravadoOffline || punch.serverTime === "pending")) {
                hasPending = true;
                break;
              }
            }
          }
          if (hasPending) break;
        }

        if (hasPending) {
          console.log(`[Sync] Encontradas batidas pendentes no estado para o usuário ${userId}. Enviando para o Firebase...`);
          const cleanDays = sanitizeDaysForFirebase(userDays);
          await saveUserPontosToDb(userId, cleanDays);
          currentPontos = clearUserSyncFlags(currentPontos, userId);
          stateHasChanged = true;
        }
      }

      if (stateHasChanged) {
        updatePontos(currentPontos);
      }

      // 3. Fetch latest points from Firestore server and reconcile
      const currentMes = getMesAtual();
      const rawDbPontos = await fetchAllPontosMes(currentMes);
      const dbPontos = rawDbPontos ? sanitizePontosGlobal(rawDbPontos) : null;
      if (dbPontos) {
        const cached = getSafeLocalStorageItem<PontosGlobal | null>("hr_cached_pontos", null) || currentPontos;
        const { merged: reconciled, changedUserIds, changedDaysByUser } = reconcilePontos(cached, dbPontos);
        
        let finalReconciled = { ...reconciled };
        for (const userId of changedUserIds) {
          const diffDays = changedDaysByUser[userId];
          if (diffDays && Object.keys(diffDays).length > 0) {
            const limitedDiffDays = limitDiffDays(diffDays, 5);
            const cleanDays = sanitizeDaysForFirebase(limitedDiffDays);
            const prepared = await saveUserPontosToDb(userId, cleanDays).catch(err => {
              console.warn(`[Sync] Points sync non-blocking error for user ${userId}:`, err);
              return cleanDays;
            });
            if (prepared) {
              finalReconciled[userId] = { ...(finalReconciled[userId] || {}), ...sanitizeDaysForFirebase(prepared) };
            }
          }
        }

        // Always strip offline sync flags from all users in final state
        for (const uStr of Object.keys(finalReconciled)) {
          finalReconciled = clearUserSyncFlags(finalReconciled, Number(uStr));
        }

        updatePontos(finalReconciled);
      }

      // 4. Reconcile audit logs
      const dbLogs = await fetchAuditLogs(currentMes);
      if (dbLogs) {
        const cached = getSafeLocalStorageItem<AuditLogEntry[]>("hr_cached_audit_logs", []);
        const { merged: reconciled, pending } = reconcileAuditLogs(cached, dbLogs);
        
        setAuditLogs(reconciled);
        setSafeLocalStorageItem("hr_cached_audit_logs", reconciled.slice(0, 500));
        
        if (pending.length > 0) {
          await batchSaveAuditLogs(pending).catch(err => {
            console.warn("[Sync] Audit log batch sync non-blocking error:", err);
          });
        }
      }

      // 5. Reconcile solicitacoes de correcao
      const dbSolicitacoes = await fetchAllSolicitacoesCorrecao();
      if (dbSolicitacoes) {
        const cached = getSafeLocalStorageItem<SolicitacaoCorrecao[]>("hr_cached_solicitacoes_correcao", []);
        const { merged: reconciled, pending } = reconcileSolicitacoesCorrecao(cached, dbSolicitacoes);
        setSolicitacoesCorrecao(reconciled);
        setSafeLocalStorageItem("hr_cached_solicitacoes_correcao", reconciled);
        for (let i = 0; i < pending.length; i++) {
          const sol = pending[i];
          try {
            await saveSolicitacaoCorrecaoToDb(sol);
          } catch (err) {
            console.warn("[Sync] Solicitacao sync non-blocking error:", err);
            break;
          }
          if (i < pending.length - 1) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }

      // 6. Reconcile pre-pontos
      const dbPrePontos = await fetchAllPrePontos();
      if (dbPrePontos) {
        const cached = getSafeLocalStorageItem<PrePonto[]>("hr_cached_pre_pontos", []);
        const { merged: reconciled, pending } = reconcilePrePontos(cached, dbPrePontos);
        setPrePontos(reconciled);
        setSafeLocalStorageItem("hr_cached_pre_pontos", reconciled);
        for (let i = 0; i < pending.length; i++) {
          const pre = pending[i];
          try {
            await savePrePontoToDb(pre);
            console.log(`[Sync] PrePonto ${pre.id} sincronizado`);
          } catch (err) {
            console.warn("[Sync] BG sync prePonto error:", err);
            break;
          }
          // Delay de 500ms entre cada prePonto para não bombardear o Firestore
          if (i < pending.length - 1) {
            await new Promise(r => setTimeout(r, 500));
          }
        }
      }

      console.log("[Sync] Manual sync completed successfully!");
      setSyncError(null);
      setIsFirebaseBlocked(false);
    } catch (err) {
      console.warn("[Sync] Instabilidade ou timeout na sincronização capturado:", err);
      // Silenciar o popup/banner vermelho de erro em falhas de timeout, registrando apenas como console.warn
      setSyncError(null);
    } finally {
      setIsSyncing(false);
    }
  };

  // Automatic synchronization when network is restored or tab/screen becomes visible again
  useEffect(() => {
    const performBackgroundSync = async () => {
      if (isSyncingRef.current) {
        console.log("[Sync] Background sync dynamic execution prevented (already in progress).");
        return;
      }
      isSyncingRef.current = true;
      console.log("[Sync] Triggering protected background synchronization (online / visibilitychange)...");
      try {
        // First process pending offline items in IndexedDB queue
        await processOfflineQueueRef.current?.();

        const currentMes = getMesAtual();
        const rawDbPontos = await fetchAllPontosMes(currentMes);
        const dbPontos = rawDbPontos ? sanitizePontosGlobal(rawDbPontos) : null;
        if (dbPontos) {
          const idbPontos = await getPontosFromIndexedDB().catch(() => ({}));
          const cached = getSafeLocalStorageItem<PontosGlobal | null>("hr_cached_pontos", null);
          const combinedLocal = { ...(cached || {}), ...idbPontos };
          const { merged: reconciled, changedUserIds, changedDaysByUser } = reconcilePontos(combinedLocal, dbPontos);

          let finalReconciled = { ...reconciled };
          if (changedUserIds.length > 0) {
            for (const userId of changedUserIds) {
              try {
                const diffDays = changedDaysByUser[userId];
                if (diffDays && Object.keys(diffDays).length > 0) {
                  const limitedDiffDays = limitDiffDays(diffDays, 5);
                  const cleanDays = sanitizeDaysForFirebase(limitedDiffDays);
                  const prepared = await saveUserPontosToDb(userId, cleanDays);
                  if (prepared) {
                    finalReconciled[userId] = { ...(finalReconciled[userId] || {}), ...sanitizeDaysForFirebase(prepared) };
                  }
                }
              } catch (err) {
                console.error(`[Sync] Background sync failed for user ${userId}:`, err);
                addToSyncQueue("saveUserPontos", { userId, days: changedDaysByUser[userId] }).catch(() => {});
              }
            }
          }

          // Clear sync flags on all users in final reconciled state
          for (const uStr of Object.keys(finalReconciled)) {
            finalReconciled = clearUserSyncFlags(finalReconciled, Number(uStr));
          }

          updatePontos(finalReconciled);
        }
      } catch (err) {
        console.warn("[Sync] Network/Visibility trigger failed to fetch points:", err);
      }

      try {
        const currentMes = getMesAtual();
        const dbLogs = await fetchAuditLogs(currentMes);
        if (dbLogs) {
          const cached = getSafeLocalStorageItem<AuditLogEntry[]>("hr_cached_audit_logs", []);
          const { merged: reconciled, pending } = reconcileAuditLogs(cached, dbLogs);

          if (pending.length > 0) {
            setAuditLogs(reconciled);
            setSafeLocalStorageItem("hr_cached_audit_logs", reconciled.slice(0, 500));
            batchSaveAuditLogs(pending).catch(err => {
              console.warn("[Sync] Non-blocking background batch error for audit logs:", err);
            });
          }
        }
      } catch (err) {
        console.warn("[Sync] Network/Visibility trigger failed to fetch logs:", err);
      }

      try {
        const dbSolicitacoes = await fetchAllSolicitacoesCorrecao();
        if (dbSolicitacoes) {
          const cached = getSafeLocalStorageItem<SolicitacaoCorrecao[]>("hr_cached_solicitacoes_correcao", []);
          const { merged: reconciled, pending } = reconcileSolicitacoesCorrecao(cached, dbSolicitacoes);
          setSolicitacoesCorrecao(reconciled);
          setSafeLocalStorageItem("hr_cached_solicitacoes_correcao", reconciled);
          for (let i = 0; i < pending.length; i++) {
            const sol = pending[i];
            try {
              await saveSolicitacaoCorrecaoToDb(sol);
            } catch (err) {
              console.error("[Sync] BG sync solicitacao error:", err);
              break;
            }
            if (i < pending.length - 1) {
              await new Promise(r => setTimeout(r, 500));
            }
          }
        }
      } catch (err) {
        console.warn("[Sync] Network/Visibility trigger failed for solicitacoes:", err);
      }

      try {
        const dbPrePontos = await fetchAllPrePontos();
        if (dbPrePontos) {
          const cached = getSafeLocalStorageItem<PrePonto[]>("hr_cached_pre_pontos", []);
          const { merged: reconciled, pending } = reconcilePrePontos(cached, dbPrePontos);
          setPrePontos(reconciled);
          setSafeLocalStorageItem("hr_cached_pre_pontos", reconciled);
          for (let i = 0; i < pending.length; i++) {
            const pre = pending[i];
            try {
              await savePrePontoToDb(pre);
              console.log(`[Sync] PrePonto ${pre.id} sincronizado`);
            } catch (err) {
              console.warn("[Sync] BG sync prePonto offline/timeout:", err);
              break;
            }
            if (i < pending.length - 1) {
              await new Promise(r => setTimeout(r, 500));
            }
          }
        }
      } catch (err) {
        console.warn("[Sync] Network/Visibility trigger failed for prePontos:", err);
      }
      try {
        await processOfflineQueueRef.current?.();
      } catch (err) {
        console.warn("[Sync] Offline queue flush failed:", err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    const handleOnline = () => {
      performBackgroundSync();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("[App Visibility] App ficou visível. Sincronizando fila do IndexedDB e Firestore...");
        performBackgroundSync();
      }
    };

    window.addEventListener("online", handleOnline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Solicita permissões nativas se estiver rodando em APK/Capacitor
    requestAllNativePermissions().catch((err) => {
      console.warn("[App Mount] Erro ao solicitar permissões nativas:", err);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);



  useEffect(() => {
    if (currentUser) {
      setSafeLocalStorageItem("hr_current_user", currentUser);
    } else {
      removeSafeLocalStorageItem("hr_current_user");
    }
  }, [currentUser]);


  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);

  useEffect(() => {
    let stopFn: (() => void) | null = null;
    let timeoutId: any = null;

    let bestCoords: { latitude: number; longitude: number; accuracy?: number } | null = null;

    watchBestPosition(
      (pos) => {
        const curAcc = pos.coords.accuracy;
        const newCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: curAcc
        };

        if (!bestCoords || (curAcc !== undefined && (bestCoords.accuracy === undefined || curAcc < bestCoords.accuracy))) {
          bestCoords = newCoords;
        }

        if (curAcc !== undefined && curAcc <= 30) {
          setUserCoords(newCoords);
          if (stopFn) { try { stopFn(); } catch (_) {} }
          if (timeoutId) clearTimeout(timeoutId);
        }
      },
      (err) => {
        console.warn("Erro ao obter localização no App:", err);
        if (bestCoords) {
          setUserCoords(bestCoords);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    ).then((unwatch) => {
      stopFn = unwatch;
    });

    timeoutId = setTimeout(() => {
      if (bestCoords) {
        setUserCoords(bestCoords);
      }
      if (stopFn) { try { stopFn(); } catch (_) {} }
    }, 10000);

    return () => {
      if (stopFn) { try { stopFn(); } catch (_) {} }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentUser]);

    function handleAddLog(
    acao: string, 
    alvo: string, 
    detalhe = "", 
    meta?: { 
      latitude?: number; 
      longitude?: number; 
      accuracy?: number; 
      hasLocation?: boolean; 
      hasPhoto?: boolean; 
      fotoComprovante?: string; 
      userId?: number; 
      dayKey?: string; 
      slotIdx?: number; 
    }
  ) {
    const entryId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const lat = meta?.latitude ?? userCoords?.latitude;
    const lng = meta?.longitude ?? userCoords?.longitude;
    const acc = meta?.accuracy ?? userCoords?.accuracy;
    const foto = meta?.fotoComprovante;

    const locPresent = meta?.hasLocation ?? (
      typeof lat === "number" && typeof lng === "number" && (lat !== 0 || lng !== 0) ||
      /Geolocalização|Lat:|📍|GPS/i.test(detalhe)
    );
    const photoPresent = meta?.hasPhoto ?? (
      !!foto || /foto|selfie|comprovante/i.test(detalhe.toLowerCase())
    );

    const newEntry: AuditLogEntry = {
      id: entryId,
      quando: new Date().toISOString(),
      quem: currentUser ? currentUser.nome : "Sistema",
      quemMat: currentUser ? currentUser.matricula : "000000",
      acao,
      alvo,
      detalhe,
      latitude: lat,
      longitude: lng,
      accuracy: acc,
      hasLocation: locPresent,
      hasPhoto: photoPresent,
      fotoComprovante: foto,
      userId: meta?.userId,
      dayKey: meta?.dayKey,
      slotIdx: meta?.slotIdx
    };

    updateAuditLogs(prev => [newEntry, ...prev]);
  }

// Auth flow callbacks
  function handleWizardDone(wizardData: any) {
    updateUsers(p =>
      p.map(u =>
        u.matricula === "090909"
          ? {
              ...u,
              senha: wizardData.senha,
              nome: wizardData.nomeAdm || u.nome,
              criadoEm: new Date().toISOString()
            }
          : u
      )
    );
    saveWizardDoneToDb(true).catch(err => console.warn("Failed to save wizard completion state to Firestore:", err));
    setSafeLocalStorageItem("hr_cached_wizard_done", true);
    setScreen("login");
  }

  function handleLogin(matricula: string, userId?: number) {
    const user = users.find(u => (userId ? u.id === userId : isMatriculaMatch(u.matricula, matricula)) && !u.desativado)
      || users.find(u => isMatriculaMatch(u.matricula, matricula) && !u.desativado);
    if (!user) return;

    setCurrentUser(user);
    setSafeLocalStorageItem("hr_current_user", user);
    setSafeLocalStorageItem("hr_last_activity_time", Date.now());
    saveAuthSessionToIndexedDB(user).catch(err => console.warn("[IndexedDB] saveAuthSessionToIndexedDB error:", err));

    if (!user.termoAceito) {
      setScreen("termo");
    } else {
      setScreen("main");
    }
    handleAddLog("Efetuou Login", `${user.nome} (${user.matricula})`);
  }

  function handleAcceptTerm() {
    if (!currentUser) return;
    const updateTime = new Date().toISOString();
    const updated: User = {
      ...currentUser,
      termoAceito: true,
      termoAceitoEm: updateTime
    };
    updateUsers(prev => prev.map(u => (u.id === currentUser.id ? updated : u)));
    setCurrentUser(updated);
    setSafeLocalStorageItem("hr_current_user", updated);
    setSafeLocalStorageItem("hr_last_activity_time", Date.now());
    saveAuthSessionToIndexedDB(updated).catch(err => console.warn("[IndexedDB] saveAuthSessionToIndexedDB error:", err));

    setScreen("main");
    handleAddLog(
      "Aceitou Termo de Ciência",
      `${currentUser.nome} (${currentUser.matricula})`,
      "Conformidade LGPD / Portaria 671/2021"
    );
  }

  function handleLogout() {
    if (currentUser) {
      handleAddLog("Efetuou Logout", `${currentUser.nome} (${currentUser.matricula})`);
    }
    setCurrentUser(null);
    setSafeLocalStorageItem("hr_current_user", null);
    removeSafeLocalStorageItem("hr_last_activity_time");
    saveAuthSessionToIndexedDB(null).catch(err => console.warn("[IndexedDB] saveAuthSessionToIndexedDB error:", err));

    setScreen("login");
  }

  // Auto-logout por inatividade (30 minutos sem interação)
  useEffect(() => {
    if (!currentUser) return;

    const recordActivity = () => {
      setSafeLocalStorageItem("hr_last_activity_time", Date.now());
    };

    recordActivity();

    const intervalId = setInterval(() => {
      const lastActivity = getSafeLocalStorageItem<number>("hr_last_activity_time", Date.now());
      if (Date.now() - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        console.warn("[Auto-Logout] 30 minutos de inatividade detectados. Encerrando sessão automaticamente...");
        handleAddLog(
          "Logout Automático por Inatividade",
          `${currentUser.nome} (${currentUser.matricula}) - Sessão encerrada após 30 min sem resposta/interação.`
        );
        setSafeLocalStorageItem("hr_auto_logout_msg", "Sua sessão foi encerrada automaticamente após 30 minutos de inatividade.");
        handleLogout();
      }
    }, 10000);

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];
    let throttleTimeout: any = null;

    const handleUserInteraction = () => {
      if (!throttleTimeout) {
        recordActivity();
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 3000);
      }
    };

    events.forEach(evt => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    return () => {
      clearInterval(intervalId);
      if (throttleTimeout) clearTimeout(throttleTimeout);
      events.forEach(evt => window.removeEventListener(evt, handleUserInteraction));
    };
  }, [currentUser]);

  if (isDbLoading) {
    return (
      <div style={{
        background: "#0f172a",
        color: "#f8fafc",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, sans-serif"
      }}>
        <div style={{
          border: "4px solid rgba(255, 255, 255, 0.1)",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          borderLeftColor: "#3b82f6",
          animation: "spin 1s linear infinite"
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ marginTop: "16px", fontSize: "14px", color: "#94a3b8", fontWeight: 500 }}>
          Carregando banco de dados Firestore...
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: t.bg,
        color: t.text,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        transition: "background-color 0.25s, color 0.25s"
      }}
    >
      {isFirebaseBlocked && (
        <div style={{
          background: "#b45309",
          color: "#ffffff",
          padding: "10px 16px",
          fontSize: "13px",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          position: "sticky",
          top: 0,
          zIndex: 9999
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <AlertTriangle style={{ width: 18, height: 18, color: "#fef08a", flexShrink: 0 }} />
            <span>
              <strong>Modo 100% Offline Ativo (Filtro Corporativo/Rede Externa):</strong> Não foi possível conectar com o servidor do Firebase. Todas as suas marcações estão salvas com segurança no IndexedDB deste navegador e serão enviadas automaticamente quando a conexão for restabelecida.
            </span>
          </div>
          <button
            onClick={async () => {
              const ok = await checkFirebaseConnectivity();
              if (ok) {
                setIsFirebaseBlocked(false);
                alert("Conexão com o Firebase restabelecida!");
              } else {
                alert("Servidor Firebase continua inacessível na sua rede no momento.");
              }
            }}
            style={{
              background: "#78350f",
              color: "#ffffff",
              border: "1px solid #d97706",
              borderRadius: "6px",
              padding: "4px 10px",
              fontSize: "12px",
              cursor: "pointer",
              whiteSpace: "nowrap"
            }}
          >
            Testar Conexão
          </button>
        </div>
      )}
      {/* Floating Theme Button (Corner Top-Right) - Hidden on login screen as LoginScreen has its own header theme toggle */}
      {screen !== "login" && screen !== "main" && (
        <div style={{ position: "absolute", top: 12, right: 18, zIndex: 100 }}>
          <button
            onClick={() => setThemeMode(v => (v === "light" ? "dark" : "light"))}
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              color: t.text,
              padding: "8px 12px",
              borderRadius: 10,
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 700,
              transition: "all 0.2s"
            }}
          >
            {themeMode === "light" ? "🌙 Escuro" : "☀️ Claro"}
          </button>
        </div>
      )}

      {(screen === "login" || screen === "wizard") && (
        <LoginScreen
          mode={themeMode}
          t={t}
          users={users}
          onLogin={handleLogin}
          isAdminMode={isAdminMode}
          setIsAdminMode={setIsAdminMode}
          onToggleTheme={() => setThemeMode(v => (v === "light" ? "dark" : "light"))}
          onAddLog={handleAddLog}
          onSendDenuncia={handleSendDenuncia}
        />
      )}


      {screen === "termo" && currentUser && (
        <TermoCienciaScreen t={t} currentUser={currentUser} onAceitar={handleAcceptTerm} onRecusar={handleLogout} />
      )}

      {screen === "main" && currentUser && (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          {/* Decides which dashboards to render based on user type */}
          {currentUser.tipo === "adm-dev" ? (
            <>
              {/* Special Role Toggle Header for admins */}
              <div
                style={{
                  background: t.surface,
                  borderBottom: `2px solid ${t.border}`,
                  padding: "6px 28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}
              >
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setAdminRoleMode("operador")}
                    style={{
                      background: adminRoleMode === "operador" ? t.accentGlow : "none",
                      border: "none",
                      color: adminRoleMode === "operador" ? t.accent : t.textSub,
                      fontSize: "12.5px",
                      fontWeight: 700,
                      padding: "8px 14px",
                      borderRadius: 8,
                      cursor: "pointer"
                    }}
                  >
                    📊 Frequência & Operador
                  </button>
                  <button
                    onClick={() => setAdminRoleMode("gerenciar_marcacoes")}
                    style={{
                      background: adminRoleMode === "gerenciar_marcacoes" ? t.accentGlow : "none",
                      border: "none",
                      color: adminRoleMode === "gerenciar_marcacoes" ? t.accent : t.textSub,
                      fontSize: "12.5px",
                      fontWeight: 700,
                      padding: "8px 14px",
                      borderRadius: 8,
                      cursor: "pointer"
                    }}
                  >
                    ✍️ Gerenciar Marcações
                  </button>
                  <button
                    onClick={() => setAdminRoleMode("dev")}
                    style={{
                      background: adminRoleMode === "dev" ? t.accentGlow : "none",
                      border: "none",
                      color: adminRoleMode === "dev" ? t.accent : t.textSub,
                      fontSize: "12.5px",
                      fontWeight: 700,
                      padding: "8px 14px",
                      borderRadius: 8,
                      cursor: "pointer"
                    }}
                  >
                    🔑 Credenciais & ADMs
                  </button>
                </div>
                <span style={{ fontSize: "11px", color: t.textMuted }}>Modo Administrador</span>
              </div>

              {adminRoleMode === "dev" ? (
                  <AdmPanel
                    t={t}
                    users={users}
                    setUsers={updateUsers}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onAddNewUser={handleAddNewUser}
                    auditLogExterno={auditLogs}
                    onAddLog={handleAddLog}
                    feriados={feriados}
                    setFeriados={updateFeriados}
                    folgasRemuneradas={folgasRemuneradas}
                    setFolgasRemuneradas={updateFolgasRemuneradas}
                    pontosGlobal={pontos}
                    setPontosGlobal={updatePontos}
                    folhasAceite={folhasAceite}
                    setFolhasAceite={updateFolhasAceite}
                    alertas={alertas}
                    setAlertas={updateAlertas}
                    saveAlertaToDb={saveAlertaToDb}
                    deleteAlertaFromDb={deleteAlertaFromDb}
                    denuncias={denuncias}
                    onUpdateDenunciaStatus={handleUpdateDenunciaStatus}
                    onDeleteDenuncia={handleDeleteDenuncia}
                    solicitacoesCorrecao={solicitacoesCorrecao}
                    onAprovarSolicitacaoCorrecao={handleAprovarSolicitacaoCorrecao}
                    onRejeitarSolicitacaoCorrecao={handleRejeitarSolicitacaoCorrecao}
                    onSyncData={refreshDataFromServer}
                    isSyncingData={isSyncingData}
                    isOfflineData={isOfflineData}
                    updateUserBloqueioAceite={async (userId, blocked) => {

                      await updateUserBloqueioAceite(userId, blocked);
                      updateUsers(prev => prev.map(u => u.id === userId ? { ...u, bloqueadoAceite: blocked } : u));
                      if (currentUser && currentUser.id === userId) {
                        const updatedUser = { ...currentUser, bloqueadoAceite: blocked };
                        setCurrentUser(updatedUser);
                        setSafeLocalStorageItem("hr_current_user", updatedUser);
                      }
                    }}
                  />
              ) : adminRoleMode === "gerenciar_marcacoes" ? (
                <div style={{ background: t.bg, minHeight: "calc(100vh - 50px)" }}>
                  <GerenciarMarcacoesView
                    t={t}
                    users={users}
                    currentUser={currentUser}
                    pontosGlobal={pontos}
                    setPontosGlobal={updatePontos}
                    auditLogs={auditLogs}
                    onSalvarPonto={handleSalvarPontoGerenciado}
                    onAddLog={handleAddLog}
                    onDecisaoAtestado={async (userId, groupId, dias, decisao, justificativa) => {
                      const userDays = { ...(pontos[userId] || {}) };
                      for (const { dayKey, slotIdx } of dias) {
                        const dayArr = [...(userDays[dayKey] || [null, null, null, null])];
                        if (dayArr[slotIdx]) {
                          if (decisao === "excluir") {
                            dayArr[slotIdx] = null;
                          } else {
                            const decStr = decisao as string;
                            const isAceito = decStr === "aceito" || decStr === "aprovado";
                            const statusStr = isAceito ? "aceito" : "recusado";
                            dayArr[slotIdx] = {
                              ...dayArr[slotIdx],
                              statusAtestado: statusStr,
                              statusAprovacao: isAceito ? "aprovado" : "recusado",
                              motivoRecusaAtestado: isAceito ? undefined : (justificativa || "Atestado recusado pelo Gestor/RH"),
                              justificativaAtestado: justificativa,
                              revisadoPor: currentUser.nome,
                              revisadoEm: new Date().toISOString(),
                              vistoPeloColaborador: false
                            };
                          }
                          userDays[dayKey] = dayArr;
                        }
                      }
                      updatePontos({ ...pontos, [userId]: userDays });
                    }}
                    feriados={feriados}
                    folgasRemuneradas={folgasRemuneradas}
                    minimoHorasDia={minimoHorasDia}
                  />
                </div>
              ) : (
                  <AdmOperadorPanel
                    t={t}
                    users={users}
                    setUsers={updateUsers}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onGoAdm={() => setAdminRoleMode("dev")}
                    onOpenGerenciarMarcacoes={() => setAdminRoleMode("gerenciar_marcacoes")}
                    pontosGlobal={pontos}
                    setPontosGlobal={updatePontos}
                    onAddLog={handleAddLog}
                    minimoHorasDia={minimoHorasDia}
                    setMinimoHorasDia={updateMinimoHorasDia}
                    empresaConfig={empresaConfig}
                    setEmpresaConfig={updateEmpresaConfig}
                    feriados={feriados}
                    folgasRemuneradas={folgasRemuneradas}
                    setFolgasRemuneradas={updateFolgasRemuneradas}
                    prePontos={prePontos}
                    denuncias={denuncias}
                    onUpdateDenunciaStatus={handleUpdateDenunciaStatus}
                    onDeleteDenuncia={handleDeleteDenuncia}
                    solicitacoesCorrecao={solicitacoesCorrecao}
                    onAprovarSolicitacaoCorrecao={handleAprovarSolicitacaoCorrecao}
                    onRejeitarSolicitacaoCorrecao={handleRejeitarSolicitacaoCorrecao}
                    alertas={alertas}
                    setAlertas={updateAlertas}
                    saveAlertaToDb={saveAlertaToDb}
                    deleteAlertaFromDb={deleteAlertaFromDb}
                    auditLogs={auditLogs}
                    onSyncData={refreshDataFromServer}
                    isSyncingData={isSyncingData}
                    isOfflineData={isOfflineData}
                  />
              )}
            </>
          ) : (
              <EmployeePanel
                t={t}
                currentUser={currentUser}
                onLogout={handleLogout}
                onToggleTheme={() => setThemeMode(v => (v === "light" ? "dark" : "light"))}
                pontosGlobal={pontos}
                setPontosGlobal={updatePontos}
                onAddLog={handleAddLog}
                feriados={feriados}
                folgasRemuneradas={folgasRemuneradas}
                syncNow={() => refreshDataFromServer(true)}
                isSyncing={isSyncingData || isSyncing}
                isOfflineData={isOfflineData}
                syncError={syncError}
                setSyncError={setSyncError}
                registerPrePonto={registerPrePonto}
                markPrePontoSuccess={markPrePontoSuccess}
                cancelPrePonto={cancelPrePonto}
                folhasAceite={folhasAceite}
                setFolhasAceite={updateFolhasAceite}
                alertas={alertas}
                setAlertas={updateAlertas}
                markAlertaAsReadInDb={markAlertaAsReadInDb}
                solicitacoesCorrecao={solicitacoesCorrecao}
                onSendSolicitacaoCorrecao={handleSendSolicitacaoCorrecao}
                updateUserBloqueioAceite={async (userId, blocked) => {
                  await updateUserBloqueioAceite(userId, blocked);
                  updateUsers(prev => prev.map(u => u.id === userId ? { ...u, bloqueadoAceite: blocked } : u));
                  if (currentUser && currentUser.id === userId) {
                    const updatedUser = { ...currentUser, bloqueadoAceite: blocked };
                    setCurrentUser(updatedUser);
                    setSafeLocalStorageItem("hr_current_user", updatedUser);
                  }
                }}
              />
          )}
        </div>
      )}
      <PwaInstallPrompt t={t} />
    </div>
  );
}