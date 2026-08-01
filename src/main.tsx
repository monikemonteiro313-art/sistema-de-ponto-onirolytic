import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { initIndexedDB } from './lib/indexedDbService.ts';
import './index.css';

// Initialize IndexedDB for instant local storage
initIndexedDB().catch(err => console.warn("[AppInit] IndexedDB init warning:", err));

// Register Service Worker for PWA interface caching
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      console.log('[SW] ServiceWorker registered successfully:', reg.scope);
    }).catch((err) => {
      console.warn('[SW] ServiceWorker registration failed:', err);
    });
  });
} else if ('serviceWorker' in navigator) {
  // Always register in dev container so PWA caching works immediately
  navigator.serviceWorker.register('/sw.js').then((reg) => {
    console.log('[SW] ServiceWorker registered in dev:', reg.scope);
  }).catch((err) => {
    console.warn('[SW] ServiceWorker dev registration failed:', err);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
