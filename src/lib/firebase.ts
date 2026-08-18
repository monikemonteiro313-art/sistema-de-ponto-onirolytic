/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  Firestore, 
  initializeFirestore, 
  getFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager, 
  memoryLocalCache, 
  setLogLevel,
  terminate
} from "firebase/firestore";
import firebaseAppletConfig from "../../firebase-applet-config.json";

// Configure Firestore SDK log level: verbose in dev, silent in production
setLogLevel(import.meta.env.DEV ? "warn" : "silent");

let isHealing = false;
let dbInstance: Firestore | null = null;

// Guarda para evitar listeners duplicados em hot reload
const LISTENER_GUARD_KEY = "__firebase_ts_listeners_registered";

/**
 * Códigos de erro do Firestore SDK que são NON-FATAL.
 * Estes NÃO devem disparar auto-heal/reload pois o dado no IndexedDB está intacto.
 * O erro é interno do SDK e geralmente se resolve no próximo retry.
 */
const NON_FATAL_ASSERTION_CODES = ["c050", "e5da", "b815", "da08"];

function isNonFatalAssertion(msg: string): boolean {
  if (!msg) return false;
  return NON_FATAL_ASSERTION_CODES.some(code => msg.includes(code));
}

/**
 * Recria a conexão com o Firestore SEM deletar o IndexedDB.
 * Útil para erros de estado interno do SDK (c050) onde os dados locais estão intactos
 * mas a conexão em memória ficou inconsistente.
 */
export async function recreateDbConnection(): Promise<Firestore> {
  console.warn("[Firebase] Recriando conexão do Firestore (dados preservados)...");
  try {
    if (dbInstance) {
      await terminate(dbInstance);
      console.log("[Firebase] Conexão anterior terminada.");
    }
  } catch (err) {
    console.warn("[Firebase] terminate() falhou (esperado se já estava quebrada):", err);
  }

  // Pequeno delay para o SDK liberar recursos
  await new Promise(r => setTimeout(r, 300));

  dbInstance = initDatabase();
  console.log("[Firebase] Nova conexão estabelecida.");
  return dbInstance;
}

/**
 * Autocura (Self-Healing) System:
 * Detects internal Firestore SDK state corruption or IndexedDB lock conflicts,
 * automatically purges corrupted local storage/IndexedDB databases,
 * and cleanly reloads the application state without requiring manual user action.
 * 
 * INCLUDES SAFETY: NUNCA deleta IndexedDB em produção. 
 * Para erros non-fatal (c050, etc.), apenas recria a conexão.
 * Para erros críticos, recarrega a página (último recurso).
 */
export async function triggerAutoHeal(reason?: string): Promise<void> {
  if (typeof window === "undefined" || isHealing) return;

  const msg = reason || "";

  // 🛡️ SAFETY: Erros non-fatal (c050) → recria conexão, NÃO reload
  if (isNonFatalAssertion(msg)) {
    console.warn(`[Autocura] Erro non-fatal detectado (${msg}). Recriando conexão sem perder dados...`);
    try {
      await recreateDbConnection();
      console.log("[Autocura] Conexão restabelecida. App continua normalmente.");
    } catch (err) {
      console.error("[Autocura] Falha ao recriar conexão:", err);
    }
    return;
  }

  const now = Date.now();
  const healCount = Number(localStorage.getItem("firestore_auto_heal_count") || "0");
  const lastHeal = Number(localStorage.getItem("firestore_auto_heal_time") || "0");
  const backoffMs = Math.min(12000 * Math.pow(2, healCount), 300000);

  if (healCount >= 5) {
    console.error("[Autocura] Limite máximo de 5 tentativas atingido. Recarga automática desativada.");
    isHealing = false;
    return;
  }

  if (now - lastHeal < backoffMs) {
    console.warn(`[Autocura] Executada recentemente. Próxima tentativa em ${Math.ceil((backoffMs - (now - lastHeal)) / 1000)}s.`);
    return;
  }

  isHealing = true;
  localStorage.setItem("firestore_auto_heal_time", String(now));
  localStorage.setItem("firestore_auto_heal_count", String(healCount + 1));

  console.warn(`[Autocura Firestore] 🚨 Iniciar autocura automática (tentativa ${healCount + 1}/5). Motivo: ${msg || "Erro de estado/Cache"}`);

  try {
    const toast = document.createElement("div");
    toast.id = "autocura-toast";
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:99999;background:#0f172a;color:#f8fafc;padding:14px 22px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.4);font-family:sans-serif;font-size:13px;display:flex;align-items:center;gap:10px;border:1px solid #3b82f6;";
    toast.innerHTML = "<span style='font-size:16px;'>🔄</span><span><b>Autocura ativada:</b> Restaurando conexão...</span>";
    document.body.appendChild(toast);
  } catch {}

  // 🛡️ PRODUÇÃO: NUNCA deletar IndexedDB. Apenas recriar conexão.
  try {
    await recreateDbConnection();
    console.log("[Autocura] Conexão restabelecida sem perda de dados.");
    isHealing = false;
    return; // Sucesso sem reload!
  } catch (err) {
    console.warn("[Autocura] recreateDbConnection falhou, tentando reload como último recurso:", err);
  }

  // Último recurso: reload (só para erros realmente críticos)
  setTimeout(() => {
    isHealing = false;
    window.location.reload();
  }, 1500);
}

/**
 * Resetar contador de autocura quando o app carrega com sucesso.
 * Deve ser chamado pelo App.tsx após inicialização bem-sucedida.
 */
export function resetAutoHealCounter(): void {
  localStorage.removeItem("firestore_auto_heal_count");
  localStorage.removeItem("firestore_auto_heal_time");
}

export function isAssertionError(msg: string): boolean {
  if (!msg) return false;
  const str = String(msg).toLowerCase();
  return (
    str.includes("internal assertion failed") ||
    str.includes("unexpected state") ||
    /\bc050\b/.test(str) ||
    /\be5da\b/.test(str) ||
    /\bb815\b/.test(str) ||
    /\bda08\b/.test(str) ||
    /firestore \(1[012]\.\d+\)/.test(str) ||
    (str.includes("firestore") && str.includes("assertion"))
  );
}

// Intercept unhandled assertion errors
if (typeof window !== "undefined" && !window.sessionStorage.getItem(LISTENER_GUARD_KEY)) {
  window.sessionStorage.setItem(LISTENER_GUARD_KEY, "true");

  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || String(event?.reason || "");
    if (isAssertionError(msg)) {
      event.preventDefault();
      console.warn("[Firebase] Inconsistência do SDK capturada:", msg);
      triggerAutoHeal(msg);
    }
  });

  window.addEventListener("error", (event) => {
    const msg = event?.message || String(event?.error || "");
    if (isAssertionError(msg)) {
      event.preventDefault();
      console.warn("[Firebase] Inconsistência do SDK capturada:", msg);
      triggerAutoHeal(msg);
    }
  });
}

// Configuração do Firebase
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId || "",
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId || "",
  measurementId: firebaseAppletConfig.measurementId || ""
};

const missingFields = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== "measurementId" && !value)
  .map(([key]) => key);

if (missingFields.length > 0) {
  console.error("[Firebase] Configuração incompleta. Campos obrigatórios ausentes:", missingFields.join(", "));
}

const app = getApps().length === 0 
  ? initializeApp(firebaseConfig) 
  : getApp();

const databaseId = firebaseAppletConfig.firestoreDatabaseId || "(default)";

function initDatabase(): Firestore {
  try {
    // Tenta inicializar com cache persistente multi-aba
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, databaseId);
  } catch (err: any) {
    const errCode = err?.code || "";
    const errMsg = err?.message || String(err);

    if (errCode === "failed-precondition" || errMsg.includes("failed-precondition")) {
      console.warn("[Firebase Persistence] Múltiplas abas abertas ou pré-condição falhou. Utilizando suporte secundário.");
    } else if (errCode === "unimplemented" || errMsg.includes("unimplemented")) {
      console.warn("[Firebase Persistence] Navegador não suporta IndexedDB/Persistência offline.");
    } else {
      console.warn("[Firebase Persistence] initializeFirestore já foi chamado ou falhou:", errMsg);
    }

    try {
      return databaseId && databaseId !== "(default)" 
        ? getFirestore(app, databaseId) 
        : getFirestore(app);
    } catch {
      return initializeFirestore(app, {
        localCache: memoryLocalCache()
      }, databaseId);
    }
  }
}

dbInstance = initDatabase();
export const db: Firestore = dbInstance;
export { app };

export function fallbackToDefaultDatabase(): Firestore {
  console.warn("[Firebase] fallbackToDefaultDatabase: retornando database padrão.");
  try {
    return getFirestore(app);
  } catch {
    console.error("[Firebase] Falha ao obter database padrão.");
    throw new Error("Não foi possível conectar ao Firestore.");
  }
}