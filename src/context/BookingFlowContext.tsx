import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FlightDTO } from '../shared';
import type { PassengerDraft } from '../lib/passengers';
import { sameCriteria, type SearchCriteria } from '../lib/search';

export interface FlowState {
  criteria: SearchCriteria | null;
  outbound: FlightDTO | null;
  returnFlight: FlightDTO | null;
  passengers: PassengerDraft[] | null;
  /** Sent with Confirm Booking so that repeated submissions are recognised as one booking. */
  idempotencyKey: string | null;
}

interface FlowApi extends FlowState {
  startSearch: (criteria: SearchCriteria) => void;
  selectOutbound: (flight: FlightDTO) => void;
  clearOutbound: () => void;
  selectReturn: (flight: FlightDTO) => void;
  savePassengers: (list: PassengerDraft[]) => void;
  setIdempotencyKey: (key: string) => void;
  reset: () => void;
}

const STORAGE_KEY = 'skyroute.bookingFlow';
const EMPTY: FlowState = { criteria: null, outbound: null, returnFlight: null, passengers: null, idempotencyKey: null };

function load(): FlowState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<FlowState>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

const FlowContext = createContext<FlowApi | null>(null);

export function BookingFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable - the flow still works in memory */
    }
  }, [state]);

  const startSearch = useCallback((criteria: SearchCriteria) => {
    setState((s) =>
      sameCriteria(s.criteria, criteria)
        ? s
        : { ...s, criteria, outbound: null, returnFlight: null, idempotencyKey: null },
    );
  }, []);

  const selectOutbound = useCallback((flight: FlightDTO) => {
    setState((s) => ({ ...s, outbound: flight, returnFlight: null, idempotencyKey: null }));
  }, []);

  const clearOutbound = useCallback(() => {
    setState((s) => ({ ...s, outbound: null, returnFlight: null, idempotencyKey: null }));
  }, []);

  const selectReturn = useCallback((flight: FlightDTO) => {
    setState((s) => ({ ...s, returnFlight: flight, idempotencyKey: null }));
  }, []);

  const savePassengers = useCallback((list: PassengerDraft[]) => {
    setState((s) => ({ ...s, passengers: list, idempotencyKey: null }));
  }, []);

  const setIdempotencyKey = useCallback((key: string) => {
    setState((s) => (s.idempotencyKey === key ? s : { ...s, idempotencyKey: key }));
  }, []);

  const reset = useCallback(() => setState(EMPTY), []);

  const value = useMemo<FlowApi>(
    () => ({ ...state, startSearch, selectOutbound, clearOutbound, selectReturn, savePassengers, setIdempotencyKey, reset }),
    [state, startSearch, selectOutbound, clearOutbound, selectReturn, savePassengers, setIdempotencyKey, reset],
  );

  return <FlowContext.Provider value={value}>{children}</FlowContext.Provider>;
}

export function useBookingFlow(): FlowApi {
  const ctx = useContext(FlowContext);
  if (!ctx) throw new Error('useBookingFlow must be used inside BookingFlowProvider');
  return ctx;
}
