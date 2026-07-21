import { useState, useEffect, lazy, Suspense } from "react";
import { T } from "./components/Theme";
import { User, ThemeColors, PontosGlobal, AuditLogEntry, EmpresaConfig, PrePonto, FolhaAceite } from "./types";
import { LoginScreen } from "./components/LoginScreen";
import { WizardScreen } from "./components/WizardScreen";
import { TermoCienciaScreen } from "./components/TermoCienciaScreen";

function lazyWithRetry(
  componentImport: () => Promise<any>,
  exportName: string
): any {
  return lazy(async () => {
    try {
      const module = await componentImport();
      return { default: module[exportName] };
    } catch (error) {
      console.error(`Error loading chunk for ${exportName}, attempting automatic page reload:`, error);
      const hasRefreshed = sessionStorage.getItem(`refreshed-chunk-${exportName}`);
      if (!hasRefreshed) {
        sessionStorage.setItem(`refreshed-chunk-${exportName}`, "true");
        window.location.reload();
      }
      throw error;
    }
  });
}

const EmployeePanel = lazyWithRetry(() => import("./components/EmployeePanel"), "EmployeePanel");
const AdmPanel = lazyWithRetry(() => import("./components/AdmPanel"), "AdmPanel");
const AdmOperadorPanel = lazyWithRetry(() => import("./components/AdmOperadorPanel"), "AdmOperadorPanel");

import {
  initializeDbIfEmpty,
  fetchAllUsers,
  saveUserToDb,
  deleteUserFromDb,
  fetchAllPontos,
  saveUserPontosToDb,
  fetchAuditLogs,
  saveAuditLogToDb,
  fetchEmpresaConfig,
  saveEmpresaConfigToDb,
  fetchMinimoHoras,
  saveMinimoHorasToDb,
  fetchFeriados,
  saveFeriadosToDb,
  fetchWizardDone,
  saveWizardDoneToDb,
  fetchAllPrePontos,
  savePrePontoToDb,
  fetchAllFolhasAceite,
  saveFolhaAceiteToDb,
  deleteFolhaAceiteFromDb,
  updateUserBloqueioAceite
} from "./lib/firebaseService";

function getSafeLocalStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const value = localStorage.getItem(key);
    if (!value || value === "undefined") return defaultValue;
    return JSON.parse(value);
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
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
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

function reconcilePontos(local: PontosGlobal | null, server: PontosGlobal | null): { merged: PontosGlobal; changedUserIds: number[] } {
  const merged: PontosGlobal = JSON.parse(JSON.stringify(server || {}));
  const changedUserIds: number[] = [];

  if (!local) return { merged, changedUserIds };

  for (const userIdStr of Object.keys(local)) {
    const userId = Number(userIdStr);
    const localUserDays = local[userId];
    if (!localUserDays) continue;

    if (!merged[userId]) {
      merged[userId] = {};
    }

    const mergedUserDays = merged[userId];
    let userChanged = false;

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
          const localRegTime = localPunch.registradoEm ? new Date(localPunch.registradoEm).getTime() : 0;
          const serverRegTime = serverPunch.registradoEm ? new Date(serverPunch.registradoEm).getTime() : 0;

          if (localRegTime > serverRegTime) {
            newDayArray.push(localPunch);
          } else {
            newDayArray.push(serverPunch);
          }
        } else {
          newDayArray.push(null);
        }
      }

      while (newDayArray.length < 4) {
        newDayArray.push(null);
      }
      const finalDayArray = newDayArray.slice(0, 4);

      // Pad merged array as well to compare correctly
      const paddedMergedDayArray = [...mergedDayArray];
      while (paddedMergedDayArray.length < 4) {
        paddedMergedDayArray.push(null);
      }
      const finalMergedDayArray = paddedMergedDayArray.slice(0, 4);

      const isDifferent = JSON.stringify(finalDayArray) !== JSON.stringify(finalMergedDayArray);

      if (isDifferent) {
        mergedUserDays[dayKey] = finalDayArray;
        userChanged = true;
      }
    }

    if (userChanged) {
      changedUserIds.push(userId);
    }
  }

  return { merged, changedUserIds };
}

function reconcileAuditLogs(local: AuditLogEntry[] | null, server: AuditLogEntry[] | null): { merged: AuditLogEntry[]; pending: AuditLogEntry[] } {
  const serverLogs = server || [];
  const localLogs = local || [];
  const serverMap = new Map(serverLogs.map(l => [l.id, l]));
  const pending: AuditLogEntry[] = [];
  const merged = [...serverLogs];

  for (const log of localLogs) {
    if (log && log.id && !serverMap.has(log.id)) {
      pending.push(log);
    }
  }

  if (pending.length > 0) {
    merged.unshift(...pending);
    merged.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime());
  }

  return { merged, pending };
}

export default function App() {
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  const t: ThemeColors = T[themeMode];
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [isDbLoading, setIsDbLoading] = useState<boolean>(true);

  // Core Global States
  const [users, setUsers] = useState<User[]>([]);
  const [pontos, setPontos] = useState<PontosGlobal>({});
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [minimoHorasDia, setMinimoHorasDia] = useState<number>(7);
  const [empresaConfig, setEmpresaConfig] = useState<EmpresaConfig>({ nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" });
  const [feriados, setFeriados] = useState<string[]>([]);
  const [prePontos, setPrePontos] = useState<PrePonto[]>([]);
  const [folhasAceite, setFolhasAceite] = useState<FolhaAceite[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [screen, setScreen] = useState<"login" | "wizard" | "termo" | "main">("wizard");
  const [syncError, setSyncError] = useState<string | null>(null);

  // Load initial data from Firestore
  useEffect(() => {
    async function loadData() {
      try {
        setIsDbLoading(true);
        // Seed if first time
        await initializeDbIfEmpty();
        
        // Fetch all database records safely to prevent any single collection error from crashing the entire initial load
        const safeFetch = async <T,>(promise: Promise<T>, fallback: T, name: string): Promise<T> => {
          try {
            return await promise;
          } catch (error) {
            console.warn(`[Firestore Load] Failed to fetch ${name}, using safe fallback value. Error:`, error);
            return fallback;
          }
        };

        const [rawDbUsers, dbPontos, dbLogs, dbMin, dbEmpresa, dbFeriados, wizardDone, dbPrePontos, dbFolhas] = await Promise.all([
          safeFetch(fetchAllUsers(), [] as User[], "users"),
          safeFetch(fetchAllPontos(), {} as PontosGlobal, "pontos"),
          safeFetch(fetchAuditLogs(), [] as AuditLogEntry[], "auditLogs"),
          safeFetch(fetchMinimoHoras(), 7, "minimoHoras"),
          safeFetch(fetchEmpresaConfig(), { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" } as EmpresaConfig, "empresaConfig"),
          safeFetch(fetchFeriados(), [] as string[], "feriados"),
          safeFetch(fetchWizardDone(), false, "wizardDone"),
          safeFetch(fetchAllPrePontos(), [] as PrePonto[], "prePontos"),
          safeFetch(fetchAllFolhasAceite(), [] as FolhaAceite[], "folhasAceite")
        ]);

        const dbUsers = rawDbUsers;
        
        // Reconcile Pontos (Offline -> Online)
        const cachedPontos = getSafeLocalStorageItem<PontosGlobal | null>("hr_cached_pontos", null);
        const { merged: reconciledPontos, changedUserIds } = reconcilePontos(cachedPontos, dbPontos);

        // Reconcile Audit Logs (Offline -> Online)
        const cachedLogs = getSafeLocalStorageItem<AuditLogEntry[]>("hr_cached_audit_logs", []);
        const { merged: reconciledLogs, pending: pendingLogs } = reconcileAuditLogs(cachedLogs, dbLogs);

        setUsers(dbUsers);
        setPontos(reconciledPontos);
        setAuditLogs(reconciledLogs);
        setMinimoHorasDia(dbMin);
        setEmpresaConfig(dbEmpresa);
        setFeriados(dbFeriados);
        setPrePontos(dbPrePontos || []);
        setFolhasAceite(dbFolhas || []);

        // Cache locally for offline survival
        setSafeLocalStorageItem("hr_cached_users", dbUsers);
        setSafeLocalStorageItem("hr_cached_pontos", reconciledPontos);
        setSafeLocalStorageItem("hr_cached_audit_logs", reconciledLogs);
        setSafeLocalStorageItem("hr_cached_minimo_horas_dia", dbMin);
        setSafeLocalStorageItem("hr_cached_empresa_config", dbEmpresa);
        setSafeLocalStorageItem("hr_cached_feriados", dbFeriados);
        setSafeLocalStorageItem("hr_cached_wizard_done", wizardDone);
        setSafeLocalStorageItem("hr_cached_pre_pontos", dbPrePontos || []);
        setSafeLocalStorageItem("hr_cached_folhas_aceite", dbFolhas || []);
        setSafeLocalStorageItem("hr_cached_wizard_done", wizardDone);
        setSafeLocalStorageItem("hr_cached_pre_pontos", dbPrePontos || []);

        // Push reconciled punches to Firestore asynchronously
        for (const userId of changedUserIds) {
          console.log(`[Sync] Uploading reconciled offline punches for user ID ${userId} to Firestore...`);
          saveUserPontosToDb(userId, reconciledPontos[userId]).catch(err => {
            console.error(`[Sync] Failed to sync reconciled points for user ${userId}:`, err);
          });
        }

        // Push pending logs to Firestore asynchronously
        for (const log of pendingLogs) {
          console.log(`[Sync] Uploading pending offline audit log: ${log.acao}`);
          saveAuditLogToDb(log).catch(err => {
            console.error("[Sync] Failed to sync offline audit log:", err);
          });
        }
        
        // Determine starting screen based on session and wizard completion
        const u = getSafeLocalStorageItem<User | null>("hr_current_user", null);
        if (u) {
          const freshUser = dbUsers.find(x => x.id === u.id);
          if (freshUser && !freshUser.desativado) {
            setCurrentUser(freshUser);
            setScreen(freshUser.termoAceito ? "main" : "termo");
          } else {
            setCurrentUser(null);
            setScreen("login");
          }
        } else {
          setScreen(wizardDone ? "login" : "wizard");
        }
      } catch (error) {
        console.error("Failed to load database from Firestore, falling back to local storage cache:", error);
        try {
          const finalUsers = getSafeLocalStorageItem<User[]>("hr_cached_users", []);
          if (finalUsers.length > 0) {
            setUsers(finalUsers);
          } else {
            const { INITIAL_USERS } = await import("./data/mockData");
            setUsers(INITIAL_USERS);
          }
          
          const cachedPontos = getSafeLocalStorageItem<PontosGlobal | null>("hr_cached_pontos", null);
          if (cachedPontos) {
            setPontos(cachedPontos);
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
          setPrePontos(cachedPre);
          
          const isWizardDone = getSafeLocalStorageItem<boolean>("hr_cached_wizard_done", false);
          const u = getSafeLocalStorageItem<User | null>("hr_current_user", null);
          if (u) {
            const freshUser = (finalUsers.length > 0 ? finalUsers : []).find(x => x.id === u.id);
            if (freshUser && !freshUser.desativado) {
              setCurrentUser(freshUser);
              setScreen(freshUser.termoAceito ? "main" : "termo");
            } else {
              setCurrentUser(null);
              setScreen("login");
            }
          } else {
            setScreen(isWizardDone ? "login" : "wizard");
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
  const [adminRoleMode, setAdminRoleMode] = useState<"dev" | "operador">("operador");

  // Wrapper functions to keep local state and Firestore in perfect sync
  const updateUsers = (newUsersOrFn: User[] | ((prev: User[]) => User[])) => {
    setUsers((prev) => {
      const next = typeof newUsersOrFn === "function" ? newUsersOrFn(prev) : newUsersOrFn;
      
      // Cache locally immediately for offline-first resilience
      setSafeLocalStorageItem("hr_cached_users", next);

      // Determine differences and sync asynchronously to Firestore
      const prevMap = new Map(prev.map(u => [u.id, u]));
      const nextMap = new Map(next.map(u => [u.id, u]));
      
      // Save added/updated
      for (const u of next) {
        const p = prevMap.get(u.id);
        if (!p || JSON.stringify(p) !== JSON.stringify(u)) {
          saveUserToDb(u).catch(err => console.warn("Failed to save user to Firestore (offline?):", err));
        }
      }
      // Delete removed
      for (const p of prev) {
        if (!nextMap.has(p.id)) {
          deleteUserFromDb(p.id).catch(err => console.warn("Failed to delete user from Firestore (offline?):", err));
        }
      }
      return next;
    });
  };

  const updatePontos = (newPontosOrFn: PontosGlobal | ((prev: PontosGlobal) => PontosGlobal)) => {
    setPontos((prev) => {
      const next = typeof newPontosOrFn === "function" ? newPontosOrFn(prev) : newPontosOrFn;
      
      // Cache locally immediately for offline-first resilience
      setSafeLocalStorageItem("hr_cached_pontos", next);

      // Determine updated user points and sync to Firestore
      for (const userIdStr of Object.keys(next)) {
        const userId = Number(userIdStr);
        const nextDays = next[userId];
        const prevDays = prev[userId];
        if (!prevDays || JSON.stringify(nextDays) !== JSON.stringify(prevDays)) {
          saveUserPontosToDb(userId, nextDays).then((preparedDays) => {
            if (preparedDays) {
              setPontos((current) => {
                const updated = {
                  ...current,
                  [userId]: preparedDays
                };
                setSafeLocalStorageItem("hr_cached_pontos", updated);
                return updated;
              });
            }
          }).catch(err => {
            console.warn("Failed to save pontos to Firestore (offline?):", err);
            const errStr = String(err);
            let errMsg = "Instabilidade de conexão detectada.";
            if (errStr.includes("quota") || errStr.includes("Quota") || errStr.includes("QUOTA")) {
              errMsg = "Limite temporário de requisições excedido. Seus dados continuam 100% seguros de forma local no seu aparelho.";
            } else if (errStr.includes("offline") || errStr.includes("network") || errStr.includes("Network")) {
              errMsg = "Seu dispositivo parece estar sem internet ou com sinal fraco. O ponto foi gravado de forma segura no aparelho.";
            }
            setSyncError(errMsg);
          });
        }
      }
      return next;
    });
  };

  const updateAuditLogs = (newLogsOrFn: AuditLogEntry[] | ((prev: AuditLogEntry[]) => AuditLogEntry[])) => {
    setAuditLogs((prev) => {
      const next = typeof newLogsOrFn === "function" ? newLogsOrFn(prev) : newLogsOrFn;
      
      // Cache locally immediately for offline-first resilience
      setSafeLocalStorageItem("hr_cached_audit_logs", next);

      // Push new or updated logs to Firestore
      const prevMap = new Map(prev.map(l => [l.id, l]));
      for (const log of next) {
        const p = prevMap.get(log.id);
        if (!p || JSON.stringify(p) !== JSON.stringify(log)) {
          saveAuditLogToDb(log).catch(err => console.warn("Failed to save audit log to Firestore (offline?):", err));
        }
      }
      return next;
    });
  };

  const updateMinimoHorasDia = (newValOrFn: number | ((prev: number) => number)) => {
    setMinimoHorasDia((prev) => {
      const next = typeof newValOrFn === "function" ? newValOrFn(prev) : newValOrFn;
      
      // Cache locally immediately for offline-first resilience
      setSafeLocalStorageItem("hr_cached_minimo_horas_dia", next);

      if (next !== prev) {
        saveMinimoHorasToDb(next).catch(err => console.warn("Failed to save minimum hours to Firestore (offline?):", err));
      }
      return next;
    });
  };

  const updateEmpresaConfig = (newConfigOrFn: EmpresaConfig | ((prev: EmpresaConfig) => EmpresaConfig)) => {
    setEmpresaConfig((prev) => {
      const next = typeof newConfigOrFn === "function" ? newConfigOrFn(prev) : newConfigOrFn;
      
      // Cache locally immediately for offline-first resilience
      setSafeLocalStorageItem("hr_cached_empresa_config", next);

      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        saveEmpresaConfigToDb(next).catch(err => console.warn("Failed to save company config to Firestore (offline?):", err));
      }
      return next;
    });
  };

  const updateFeriados = (newFeriadosOrFn: string[] | ((prev: string[]) => string[])) => {
    setFeriados((prev) => {
      const next = typeof newFeriadosOrFn === "function" ? newFeriadosOrFn(prev) : newFeriadosOrFn;
      
      // Cache locally immediately for offline-first resilience
      setSafeLocalStorageItem("hr_cached_feriados", next);

      if (JSON.stringify(next) !== JSON.stringify(prev)) {
        saveFeriadosToDb(next).catch(err => console.warn("Failed to save feriados to Firestore (offline?):", err));
      }
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

    setPrePontos((prev) => {
      const next = [newPre, ...prev];
      setSafeLocalStorageItem("hr_cached_pre_pontos", next);
      return next;
    });

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
      setSafeLocalStorageItem("hr_cached_pre_pontos", next);
      
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
      setSafeLocalStorageItem("hr_cached_pre_pontos", next);
      
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
      
      setSafeLocalStorageItem("hr_cached_folhas_aceite", next);

      const prevMap = new Map(prev.map(f => [f.id, f]));
      const nextMap = new Map(next.map(f => [f.id, f]));

      for (const folha of next) {
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

      return next;
    });
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const syncNow = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);
    try {
      console.log("[Sync] Manual sync triggered...");
      const dbPontos = await fetchAllPontos();
      if (dbPontos) {
        const cached = getSafeLocalStorageItem<PontosGlobal | null>("hr_cached_pontos", null);
        const { merged: reconciled, changedUserIds } = reconcilePontos(cached, dbPontos);
        
        for (const userId of changedUserIds) {
          const prepared = await saveUserPontosToDb(userId, reconciled[userId]).catch(err => {
            console.error(`[Sync] Points sync failed for user ${userId}:`, err);
            throw err;
          });
          if (prepared) {
            reconciled[userId] = prepared;
          }
        }
        
        setPontos(reconciled);
        setSafeLocalStorageItem("hr_cached_pontos", reconciled);
      }

      const dbLogs = await fetchAuditLogs();
      if (dbLogs) {
        const cached = getSafeLocalStorageItem<AuditLogEntry[]>("hr_cached_audit_logs", []);
        const { merged: reconciled, pending } = reconcileAuditLogs(cached, dbLogs);
        
        setAuditLogs(reconciled);
        setSafeLocalStorageItem("hr_cached_audit_logs", reconciled);
        
        for (const log of pending) {
          await saveAuditLogToDb(log).catch(err => {
            console.error("[Sync] Log sync failed:", err);
            throw err;
          });
        }
      }
      console.log("[Sync] Manual sync completed successfully!");
      setSyncError(null);
    } catch (err) {
      console.error("[Sync] Manual sync error:", err);
      const errStr = String(err);
      let errMsg = "Não foi possível conectar ao servidor de registro de ponto.";
      if (errStr.includes("quota") || errStr.includes("Quota") || errStr.includes("QUOTA")) {
        errMsg = "O limite diário de requisições do sistema em nuvem foi temporariamente atingido. Suas batidas continuam totalmente salvas localmente no aparelho com segurança e o sistema tentará enviá-las de forma automática.";
      } else if (errStr.includes("offline") || errStr.includes("network") || errStr.includes("Network")) {
        errMsg = "Identificamos ausência de sinal de internet. Suas batidas estão asseguradas localmente neste dispositivo e prontas para envio.";
      } else {
        errMsg = "Houve uma instabilidade temporária no sinal de rede ou no servidor. Por favor, tente enviar novamente mais tarde. Seus pontos estão protegidos.";
      }
      setSyncError(errMsg);
    } finally {
      setIsSyncing(false);
    }
  };

  // Automatic online synchronization when network is restored
  useEffect(() => {
    function handleOnline() {
      console.log("[Network] Connection restored. Triggering automatic background sync...");
      
      fetchAllPontos().then(async (dbPontos) => {
        if (!dbPontos) return;
        const cached = getSafeLocalStorageItem<PontosGlobal | null>("hr_cached_pontos", null);
        const { merged: reconciled, changedUserIds } = reconcilePontos(cached, dbPontos);
        
        if (changedUserIds.length > 0) {
          for (const userId of changedUserIds) {
            try {
              const prepared = await saveUserPontosToDb(userId, reconciled[userId]);
              if (prepared) {
                reconciled[userId] = prepared;
              }
            } catch (err) {
              console.error(`[Sync] Background sync failed for user ${userId}:`, err);
            }
          }
          setPontos(reconciled);
          setSafeLocalStorageItem("hr_cached_pontos", reconciled);
        }
      }).catch(err => console.warn("[Sync] Network online trigger failed to fetch points:", err));

      fetchAuditLogs().then(dbLogs => {
        if (!dbLogs) return;
        const cached = getSafeLocalStorageItem<AuditLogEntry[]>("hr_cached_audit_logs", []);
        const { merged: reconciled, pending } = reconcileAuditLogs(cached, dbLogs);
        
        if (pending.length > 0) {
          setAuditLogs(reconciled);
          setSafeLocalStorageItem("hr_cached_audit_logs", reconciled);
          pending.forEach(log => {
            saveAuditLogToDb(log).catch(err => {
              console.error("[Sync] Background sync failed for log:", err);
            });
          });
        }
      }).catch(err => console.warn("[Sync] Network online trigger failed to fetch logs:", err));
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
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
    if (typeof window !== "undefined" && navigator.geolocation) {
      let watchId: number | null = null;
      let timeoutId: any = null;

      const clearGeoWatch = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      let bestCoords: { latitude: number; longitude: number; accuracy?: number } | null = null;

      watchId = navigator.geolocation.watchPosition(
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
            clearGeoWatch();
          }
        },
        (err) => {
          console.warn("Erro ao obter localização:", err);
          if (bestCoords) {
            setUserCoords(bestCoords);
          }
          clearGeoWatch();
        },
        options
      );

      timeoutId = setTimeout(() => {
        if (bestCoords) {
          setUserCoords(bestCoords);
        }
        clearGeoWatch();
      }, 10000);

      return () => {
        clearGeoWatch();
      };
    }
  }, [currentUser]);

  function handleAddLog(acao: string, alvo: string, detalhe = "") {
    const entryId = Date.now() + Math.random();
    const newEntry: AuditLogEntry = {
      id: entryId,
      quando: new Date().toISOString(),
      quem: currentUser ? currentUser.nome : "Sistema",
      quemMat: currentUser ? currentUser.matricula : "000000",
      acao,
      alvo,
      detalhe,
      latitude: userCoords?.latitude,
      longitude: userCoords?.longitude,
      accuracy: userCoords?.accuracy
    };
    
    updateAuditLogs(prev => [newEntry, ...prev]);

    // Asynchronously update coordinates if available
    if (typeof window !== "undefined" && navigator.geolocation) {
      let watchId: number | null = null;
      let timeoutId: any = null;

      const clearGeoWatch = () => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
          watchId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      };

      let bestCoords: { latitude: number; longitude: number; accuracy?: number } | null = null;

      const updateLogWithCoords = (coords: { latitude: number; longitude: number; accuracy?: number }) => {
        setUserCoords(coords);
        updateAuditLogs(prev =>
          prev.map(item =>
            item.id === entryId
              ? { ...item, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }
              : item
          )
        );
      };

      watchId = navigator.geolocation.watchPosition(
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
            updateLogWithCoords(newCoords);
            clearGeoWatch();
          }
        },
        (err) => {
          console.warn("Erro ao obter localização:", err);
          if (bestCoords) {
            updateLogWithCoords(bestCoords);
          }
          clearGeoWatch();
        },
        options
      );

      timeoutId = setTimeout(() => {
        if (bestCoords) {
          updateLogWithCoords(bestCoords);
        }
        clearGeoWatch();
      }, 10000);
    }
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

  function handleLogin(matricula: string) {
    const user = users.find(u => u.matricula === matricula && !u.desativado);
    if (!user) return;

    setCurrentUser(user);
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
    setScreen("login");
  }

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
      {/* Floating Theme Button (Corner Top-Right) */}
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

      {screen === "wizard" && (
        <WizardScreen t={t} onComplete={(nome, pw) => handleWizardDone({ nomeAdm: nome, senha: pw })} />
      )}

      {screen === "login" && (
        <LoginScreen
          mode={themeMode}
          t={t}
          users={users}
          onLogin={handleLogin}
          isAdminMode={isAdminMode}
          setIsAdminMode={setIsAdminMode}
          onToggleTheme={() => setThemeMode(v => (v === "light" ? "dark" : "light"))}
          onAddLog={handleAddLog}
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
                <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: t.textSub, fontFamily: "sans-serif" }}>Carregando Painel Administrativo...</div>}>
                  <AdmPanel
                    t={t}
                    users={users}
                    setUsers={updateUsers}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    auditLogExterno={auditLogs}
                    onAddLog={handleAddLog}
                    feriados={feriados}
                    setFeriados={updateFeriados}
                    pontosGlobal={pontos}
                    setPontosGlobal={updatePontos}
                    folhasAceite={folhasAceite}
                    setFolhasAceite={updateFolhasAceite}
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
                </Suspense>
              ) : (
                <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: t.textSub, fontFamily: "sans-serif" }}>Carregando Painel do Operador...</div>}>
                  <AdmOperadorPanel
                    t={t}
                    users={users}
                    setUsers={updateUsers}
                    currentUser={currentUser}
                    onLogout={handleLogout}
                    onGoAdm={() => setAdminRoleMode("dev")}
                    pontosGlobal={pontos}
                    setPontosGlobal={updatePontos}
                    onAddLog={handleAddLog}
                    minimoHorasDia={minimoHorasDia}
                    setMinimoHorasDia={updateMinimoHorasDia}
                    empresaConfig={empresaConfig}
                    setEmpresaConfig={updateEmpresaConfig}
                    feriados={feriados}
                    prePontos={prePontos}
                  />
                </Suspense>
              )}
            </>
          ) : (
            <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: t.textSub, fontFamily: "sans-serif" }}>Carregando Painel do Funcionário...</div>}>
              <EmployeePanel
                t={t}
                currentUser={currentUser}
                onLogout={handleLogout}
                pontosGlobal={pontos}
                setPontosGlobal={updatePontos}
                onAddLog={handleAddLog}
                feriados={feriados}
                syncNow={syncNow}
                isSyncing={isSyncing}
                syncError={syncError}
                setSyncError={setSyncError}
                registerPrePonto={registerPrePonto}
                markPrePontoSuccess={markPrePontoSuccess}
                cancelPrePonto={cancelPrePonto}
                folhasAceite={folhasAceite}
                setFolhasAceite={updateFolhasAceite}
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
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}
