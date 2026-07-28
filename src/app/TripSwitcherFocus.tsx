import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface TripSwitcherFocusValue {
  intentTripId: string | null;
  // ESLint's base no-unused-vars rule does not recognize interface method arguments.
  // eslint-disable-next-line no-unused-vars
  requestFocusRestoration: (tripId: string) => void;
  clearFocusRestoration: () => void;
}

const noOp = () => undefined;
const defaultValue: TripSwitcherFocusValue = {
  intentTripId: null,
  requestFocusRestoration: noOp,
  clearFocusRestoration: noOp
};
const TripSwitcherFocusContext = createContext<TripSwitcherFocusValue>(defaultValue);

export function TripSwitcherFocusProvider({ children }: { children: ReactNode }) {
  const [intentTripId, setIntentTripId] = useState<string | null>(null);
  const requestFocusRestoration = useCallback((tripId: string) => setIntentTripId(tripId), []);
  const clearFocusRestoration = useCallback(() => setIntentTripId(null), []);
  const value = useMemo(
    () => ({ intentTripId, requestFocusRestoration, clearFocusRestoration }),
    [clearFocusRestoration, intentTripId, requestFocusRestoration]
  );

  return <TripSwitcherFocusContext value={value}>{children}</TripSwitcherFocusContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTripSwitcherFocus(): TripSwitcherFocusValue {
  return useContext(TripSwitcherFocusContext);
}
