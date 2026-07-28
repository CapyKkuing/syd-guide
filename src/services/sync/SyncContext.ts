import { createContext, useContext } from "react";

export interface SyncStatus {
  online: boolean;
  queued: number;
  conflicts: number;
  lastSync: string | null;
  syncing: boolean;
  syncNow: () => Promise<void>;
}

export const SyncContext = createContext<SyncStatus | null>(null);

export function useSyncStatus(): SyncStatus | null {
  return useContext(SyncContext);
}
