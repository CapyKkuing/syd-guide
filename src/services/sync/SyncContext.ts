import { createContext, useContext } from "react";
import type { SyncMutationRequest } from "../../shared/mutations";

export interface SyncStatus {
  online: boolean;
  queued: number;
  conflicts: number;
  lastSync: string | null;
  syncing: boolean;
  pendingMutations: SyncMutationRequest[];
  syncNow: () => Promise<void>;
}

export const SyncContext = createContext<SyncStatus | null>(null);

export function useSyncStatus(): SyncStatus | null {
  return useContext(SyncContext);
}
