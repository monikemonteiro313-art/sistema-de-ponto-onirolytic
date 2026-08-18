import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initIndexedDB } from './lib/indexedDbService.ts';
import './index.css';

// Initialize IndexedDB for instant local storage
initIndexedDB().catch(err => console.warn("[AppInit] IndexedDB init warning:", err));

// Register Service Worker in production only; unregister in development to avoid stale Vite bundle caching
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[SW] ServiceWorker registered successfully:', reg.scope);
    }).catch((err) => {
      console.warn('[SW] ServiceWorker registration failed:', err);
    });
  });
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
