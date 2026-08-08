import {
  useCallback,
  useEffect,
  useState,
  type ReactNode
} from "react";
import type { MutableTravelGuideDataSource } from "../../data/contracts";
import type { SyncMutationRequest } from "../../shared/mutations";
import type { OutboxRecord } from "../offline/database";
import type { OutboxStore } from "../offline/outboxStore";
import { ConflictDialog } from "./ConflictDialog";
import { SyncContext } from "./SyncContext";
import type { SyncEngine } from "./syncEngine";

export interface SyncRuntime {
  engine: Pick<SyncEngine, "flush" | "keepMine" | "useLatest">;
  outbox: Pick<OutboxStore, "counts" | "listForTrip" | "subscribe">;
}

export function SyncProvider({
  children,
  createId = () => crypto.randomUUID(),
  dataSource,
  reload,
  runtime,
  tripId
}: {
  children: ReactNode;
  createId?: () => string;
  dataSource: Pick<MutableTravelGuideDataSource, "invalidateTrip">;
  reload: () => void;
  runtime: SyncRuntime;
  tripId: string;
}) {
  const [online, setOnline] = useState(() => window.navigator.onLine);
  const [queued, setQueued] = useState(0);
  const [conflicts, setConflicts] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [pendingMutations, setPendingMutations] = useState<SyncMutationRequest[]>([]);
  const [resolving, setResolving] = useState(false);
  const [conflict, setConflict] = useState<OutboxRecord | null>(null);

  const refreshStatus = useCallback(async () => {
    const [counts, records] = await Promise.all([
      runtime.outbox.counts(tripId),
      runtime.outbox.listForTrip(tripId)
    ]);
    setQueued(counts.queued);
    setConflicts(counts.conflicts);
    setPendingMutations(records.map((record) => record.mutation));
    setConflict(records.find((record) => record.state === "conflict") ?? null);
  }, [runtime.outbox, tripId]);

  const syncNow = useCallback(async () => {
    if (!window.navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await runtime.engine.flush(tripId);
      await refreshStatus();
      if (result.sent > 0) {
        dataSource.invalidateTrip(tripId, result.syncVersion ?? undefined);
        reload();
        setLastSync(new Date().toISOString());
      }
    } finally {
      setSyncing(false);
    }
  }, [dataSource, refreshStatus, reload, runtime.engine, tripId]);

  useEffect(() => {
    const isReady = () =>
      window.navigator.onLine && document.visibilityState === "visible";
    const goOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const goOffline = () => setOnline(false);
    const syncWhenVisible = () => {
      if (isReady()) void syncNow();
    };

    void Promise.resolve().then(() =>
      isReady() ? syncNow() : refreshStatus()
    );
    const unsubscribe = runtime.outbox.subscribe(() => void refreshStatus());
    const interval = window.setInterval(syncWhenVisible, 15_000);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [refreshStatus, runtime.outbox, syncNow]);

  const useLatest = useCallback(async () => {
    if (!conflict) return;
    setResolving(true);
    try {
      await runtime.engine.useLatest(tripId, conflict.idempotencyKey);
      dataSource.invalidateTrip(tripId);
      await refreshStatus();
      reload();
    } finally {
      setResolving(false);
    }
  }, [conflict, dataSource, refreshStatus, reload, runtime.engine, tripId]);

  const keepMine = useCallback(async () => {
    if (!conflict) return;
    setResolving(true);
    try {
      await runtime.engine.keepMine(conflict.idempotencyKey, createId());
      await refreshStatus();
      await syncNow();
    } finally {
      setResolving(false);
    }
  }, [conflict, createId, refreshStatus, runtime.engine, syncNow]);

  return (
    <SyncContext.Provider value={{
      online,
      queued,
      conflicts,
      lastSync,
      syncing,
      pendingMutations,
      syncNow
    }}>
      {children}
      {conflict ? (
        <ConflictDialog
          onKeepMine={keepMine}
          onUseLatest={useLatest}
          pending={resolving || syncing}
          record={conflict}
        />
      ) : null}
    </SyncContext.Provider>
  );
}
