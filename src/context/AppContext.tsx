import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ClientConfig } from '../shared';
import { RefreshCw } from 'lucide-react';
import { Logo } from '../common/Logo';
import { Spinner } from '../common/ui';
import { api } from '../api';

interface AppContextValue {
  config: ClientConfig;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClientConfig | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setConfig(await api.config());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
        <Logo />
        <div>
          <h1 className="text-xl font-semibold">We're having trouble connecting</h1>
          <p className="mt-1 text-sm text-ink-muted">SkyRoute could not reach its servers. Please try again in a moment.</p>
        </div>
        <button type="button" className="btn-primary" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Try again
        </button>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <Logo />
        <Spinner className="h-6 w-6 text-brand-600" />
      </div>
    );
  }

  return <AppContext.Provider value={{ config }}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
