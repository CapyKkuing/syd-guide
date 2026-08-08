import { createContext, useContext } from "react";

export interface SyncStatus {
  online: boolean;
  lastSync: string | null;
  syncing: boolean;
  syncNow: () => Promise<void>;
}

export const SyncContext = createContext<SyncStatus | null>(null);

export function useSyncStatus(): SyncStatus | null {
  return useContext(SyncContext);
}
