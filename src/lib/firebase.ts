/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { Firestore, initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, setLogLevel } from "firebase/firestore";
import firebaseAppletConfig from "../../firebase-applet-config.json";

// Configure Firestore SDK log level to suppress connection warnings during offline/intermittent network mode
setLogLevel("silent");

// Suppress unhandled INTERNAL ASSERTION FAILED errors in window error handlers to prevent app crash overlays
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const msg = event?.reason?.message || String(event?.reason || "");
    if (msg.includes("INTERNAL ASSERTION FAILED") || msg.includes("Unexpected state") || msg.includes("da08")) {
      event.preventDefault();
      console.warn("[Firebase] Internal SDK assertion caught and suppressed:", msg);
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

