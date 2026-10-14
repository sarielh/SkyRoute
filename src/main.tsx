import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/plus-jakarta-sans';
import './common/styles.css';
import { App } from './App';
import { startMockApi } from './mock-api/browser';
import { clearAppStorage } from './mock-api/store';

const root = createRoot(document.getElementById('root')!);

function renderStartupError() {
  root.render(
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">SkyRoute could not start</h1>
      <p className="max-w-md text-sm text-ink-muted">
        This website needs a browser with Service Worker support. Please use an up-to-date version of Chrome, Edge, Firefox or Safari
        outside private browsing mode, then reload the page.
      </p>
    </div>,
  );
}

if (import.meta.env.DEV) {
  // Development helper: reset all local test data from the browser console.
  (window as unknown as Record<string, unknown>).skyrouteResetTestData = () => {
    clearAppStorage();
    window.location.reload();
  };
}

startMockApi().then(
  () =>
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    ),
  (err) => {
    console.error(err);
    renderStartupError();
  },
);
