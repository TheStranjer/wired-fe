/**
 * A {@link Scheduler} a test ticks by hand (AGENTS.md "Testing": never wait on
 * real time): it records every interval asked for, runs the scheduled task
 * when the test says so, and counts the stops.
 */
import { type Mock, vi } from 'vitest';

/** The scheduler shape the app takes: run a task every `ms`, stop with the returned function. */
type Scheduler = (task: () => void, ms: number) => () => void;

/** The hand-ticked scheduler and what it saw. */
export type ManualScheduler = {
  readonly schedule: Scheduler;
  /** The interval of every task scheduled, in order. */
  readonly intervals: number[];
  /** Called once per cancelled task. */
  readonly stop: Mock<() => void>;
  /** Runs the task scheduled last, as one tick of its interval. */
  readonly tick: () => void;
};

/** A fresh scheduler with nothing scheduled. */
export function manualScheduler(): ManualScheduler {
  const intervals: number[] = [];
  const tasks: (() => void)[] = [];
  const stop = vi.fn<() => void>();
  return {
    intervals,
    stop,
    schedule: (task, ms) => {
      tasks.push(task);
      intervals.push(ms);
      return () => {
        stop();
      };
    },
    tick: () => {
      tasks.at(-1)?.();
    },
  };
}
