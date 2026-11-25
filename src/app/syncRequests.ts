/**
 * How a command asks the desk sync for something (decision 17): `/sync now`
 * and a change of the primary account cannot reach the engine that lives in
 * the shell's hooks, so they post a {@link SyncRequest} here and the engine,
 * while mounted, listens.
 */
import type { SyncRequest } from '../state/syncStatus';

/** Whoever wants to hear requests. */
type Listener = (request: SyncRequest) => void;

/** The listeners of this page: the one engine, while its shell is mounted. */
const LISTENERS = new Set<Listener>();

/** Calls {@link listener} with every request from now on; the answer stops it. */
export function onSyncRequest(listener: Listener): () => void {
  LISTENERS.add(listener);
  return () => {
    LISTENERS.delete(listener);
  };
}

/** Asks whoever listens to do {@link request}. */
export function requestSync(request: SyncRequest): void {
  for (const listener of LISTENERS) {
    listener(request);
  }
}
