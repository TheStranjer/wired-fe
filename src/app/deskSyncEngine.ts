/**
 * The desk sync engine (decision 17), one per shell: {@link createEngine}
 * wires the steps of ./deskSyncOps to a debounce timer and a queue. `start`
 * takes the desk as it stands as the baseline and pulls; `changed` is told
 * whenever the windows, the desktops or the settings may have changed and,
 * when they did, stamps the desk and waits {@link PUSH_DELAY_MS} for a quiet
 * moment before pushing; `request` is what `/sync now` and a change of the
 * primary account ask for. Nothing is sent when no account can hold the desk.
 */
import { writeStamp } from './deskStamp';
import { type SyncDeps, type SyncIo, enqueue, newSession, target } from './deskSyncKit';
import { pullOnce, pushOnce, syncNow } from './deskSyncOps';
import { deskBody } from '../state/deskSync';
import type { SyncRequest } from '../state/syncStatus';

/** How long the desk must sit still before it is pushed. */
export const PUSH_DELAY_MS = 3000;

/** What the shell does with the engine. */
type Engine = {
  /** Takes the desk as the baseline and pulls from the primary; once the session is ready. */
  readonly start: () => void;
  /** The windows, desktops or settings may have changed. */
  readonly changed: () => void;
  /** Does what a command asked for. */
  readonly request: (request: SyncRequest) => void;
  /** Stops waiting to push. */
  readonly stop: () => void;
};

/** The push timer: {@link fire} runs {@link PUSH_DELAY_MS} after the last `arm`. */
function pushTimer(io: SyncIo, fire: () => void): Pick<SyncDeps, 'arm' | 'cancel' | 'armed'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
  };
  const arm = (): void => {
    const waiting = timer !== undefined;
    cancel();
    timer = setTimeout(() => {
      timer = undefined;
      fire();
    }, PUSH_DELAY_MS);
    if (!waiting) {
      io.dispatch({ type: 'sync', status: { pending: true } });
    }
  };
  return { arm, cancel, armed: () => timer !== undefined };
}

/** An engine over {@link io}. */
export function createEngine(io: SyncIo): Engine {
  const session = newSession();
  const deps: SyncDeps = {
    ...io,
    session,
    ...pushTimer(io, () => {
      enqueue(session, async () => await pushOnce(deps));
    }),
  };
  return {
    start: () => {
      session.baseline.set(deskBody(io.getState()));
      enqueue(session, async () => await pullOnce(deps));
    },
    changed: () => {
      const body = deskBody(io.getState());
      if (body === session.baseline.get()) {
        return;
      }
      session.baseline.set(body);
      writeStamp(io.source, io.now());
      if (target(deps) !== null) {
        deps.arm();
      }
    },
    request: (request) => {
      enqueue(session, async () => {
        if (request === 'now') {
          await syncNow(deps);
        } else {
          await pullOnce(deps);
        }
      });
    },
    stop: deps.cancel,
  };
}
