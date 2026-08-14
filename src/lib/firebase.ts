/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { Firestore, initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, setLogLevel } from "firebase/firestore";
import firebaseAppletConfig from "../../firebase-applet-config.json";

// Configure Firestore SDK log level to suppress connection warnings during offline/intermittent network mode
setLogLevel("silent");

let isHealing = false;

/**
 * Autocura (Self-Healing) System:
 * Detects internal Firestore SDK state corruption or IndexedDB lock conflicts,
 * automatically purges corrupted local storage/IndexedDB databases,
 * and cleanly reloads the application state without requiring manual user action.
 */
export async function triggerAutoHeal(reason?: string): Promise<void> {
  if (typeof window === "undefined" || isHealing) return;

  const lastHeal = Number(sessionStorage.getItem("firestore_auto_heal_time") || "0");
  const now = Date.now();
  if (now - lastHeal < 12000) {
    console.warn("[Autocura] Executada recentemente há menos de 12s. Evitando loops de recarga.");
    return;
  }

  isHealing = true;
  sessionStorage.setItem("firestore_auto_heal_time", String(now));
  console.warn(`[Autocura Firestore] 🚨 Iniciar autocura automática. Motivo: ${reason || "Erro de estado/Cache"}`);

  try {
    const toast = document.createElement("div");
    toast.id = "autocura-toast";
    toast.style.cssText = "position:fixed;bottom:24px;right:24px;z-index:99999;background:#0f172a;color:#f8fafc;padding:14px 22px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,0.4);font-family:sans-serif;font-size:13px;display:flex;align-items:center;gap:10px;border:1px solid #3b82f6;";
    toast.innerHTML = "<span style='font-size:16px;'>🔄</span><span><b>Autocura ativada:</b> Restaurando banco de dados e corrigindo estado...</span>";
    document.body.appendChild(toast);
  } catch {}

  try {
    if ("indexedDB" in window && window.indexedDB.databases) {
      const dbs = await window.indexedDB.databases();
      for (const d of dbs) {
        if (d.name && (d.name.toLowerCase().includes("firestore") || d.name.toLowerCase().includes("firebase"))) {
          console.log(`[Autocura] Excluindo banco de dados local corrompido: ${d.name}`);
          window.indexedDB.deleteDatabase(d.name);
        }
      }
    } else if ("indexedDB" in window) {
      window.indexedDB.deleteDatabase("firestore/[DEFAULT]/[instance]/main");
      if (firebaseAppletConfig.projectId) {
        window.indexedDB.deleteDatabase(`firestore/${firebaseAppletConfig.projectId}/main`);
      }
    }
  } catch (err) {
    console.warn("[Autocura] Falha ao limpar IndexedDB:", err);
  }

  setTimeout(() => {
    window.location.reload();
  }, 800);
}

export function isAssertionError(msg: string): boolean {
  if (!msg) return false;
  const str = String(msg).toLowerCase();
  return (
    str.includes("internal assertion failed") ||
    str.includes("unexpected state") ||
    str.includes("e5da") ||
    str.includes("b815") ||
    str.includes("da08") ||
    str.includes("firestore (12.") ||
    str.includes("firestore (11.") ||
    str.includes("firestore (10.") ||
    (str.includes("firestore") && str.includes("assertion"))
  );
}

// Intercept unhandled assertion errors in global handlers to run autocura automatically
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || String(event?.reason || "");
    if (isAssertionError(msg)) {
      event.preventDefault();
      console.warn("[Firebase] Inconsistência do SDK capturada em rejection. Ativando autocura:", msg);
      triggerAutoHeal(msg);
    }
  });

  window.addEventListener("error", (event) => {
    const msg = event?.message || String(event?.error || "");
    if (isAssertionError(msg)) {
      event.preventDefault();
      console.warn("[Firebase] Inconsistência do SDK capturada em error event. Ativando autocura:", msg);
      triggerAutoHeal(msg);
    }
  });
}

// Configuração do Firebase carregada dinamicamente das configurações da plataforma
const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId,
  measurementId: firebaseAppletConfig.measurementId || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const databaseId = firebaseAppletConfig.firestoreDatabaseId || "(default)";

function initDatabase(): Firestore {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }, databaseId);
  } catch (err1) {
    console.warn("[Firebase] initializeFirestore with persistentLocalCache failed, trying memoryLocalCache:", err1);
    try {
      return initializeFirestore(app, {
        localCache: memoryLocalCache()
      }, databaseId);
    } catch (err2) {
      console.warn("[Firebase] initializeFirestore failed, falling back to getFirestore:", err2);
      return databaseId && databaseId !== "(default)" 
        ? getFirestore(app, databaseId) 
        : getFirestore(app);
    }
  }
}

export const db: Firestore = initDatabase();

export function fallbackToDefaultDatabase() {
  console.log("[Firebase] fallbackToDefaultDatabase called (no-op to preserve single database instance).");
}

