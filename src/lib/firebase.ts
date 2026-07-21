/// <reference types="vite/client" />
import { initializeApp } from "firebase/app";
import { Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import firebaseAppletConfig from "../../firebase-applet-config.json";

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

// Offline-first cache settings for Firestore
const cacheSettings = {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
};

const databaseId = firebaseAppletConfig.firestoreDatabaseId || "(default)";

// Initialize Firestore with custom database ID and offline persistent cache
let currentDb: Firestore;
try {
  currentDb = initializeFirestore(
    app,
    cacheSettings,
    databaseId
  );
} catch (err) {
  console.error("[Firebase] Initial firestore creation failed, trying default initialization", err);
  currentDb = initializeFirestore(app, cacheSettings);
}

let fallbackExecuted = false;

export function fallbackToDefaultDatabase() {
  if (fallbackExecuted) {
    console.log("[Firebase] Fallback already executed. Skipping redundant call.");
    return;
  }
  fallbackExecuted = true;
  console.log("[Firebase] Falling back to (default) Firestore database...");
  try {
    currentDb = initializeFirestore(app, cacheSettings);
  } catch (err) {
    console.error("[Firebase] Error during initializeFirestore fallback:", err);
  }
}

export const db: Firestore = new Proxy(currentDb, {
  get(target, prop, receiver) {
    const value = Reflect.get(currentDb, prop);
    if (typeof value === "function") {
      return value.bind(currentDb);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    return Reflect.set(currentDb, prop, value);
  }
});
