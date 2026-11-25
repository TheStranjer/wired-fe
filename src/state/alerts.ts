/**
 * The queue of modal alerts (WFE-271): every error line the app prints also
 * queues one alert, which the shell shows until the reader dismisses it. Pure
 * and ordered: the head is the alert on screen, a repeat of the last queued
 * text only counts up, and the queue is capped so a runaway error cannot grow
 * it without bound.
 */

/** One alert waiting to be read. */
export type Alert = {
  /** Unique within the session; the print counter's value when it was queued. */
  readonly id: number;
  /** The same text the error line printed. */
  readonly text: string;
  /** How many times in a row this text was raised. */
  readonly count: number;
};

/** The most alerts held at once; older ones are dropped beyond it. */
export const MAX_ALERTS = 20;

/**
 * {@link alerts} with {@link text} queued under {@link id}: a repeat of the
 * last alert's text counts up that alert instead, and the oldest alerts fall
 * off the front past {@link MAX_ALERTS}.
 */
export function queueAlert(alerts: readonly Alert[], id: number, text: string): readonly Alert[] {
  const last = alerts.at(-1);
  if (last?.text === text) {
    return [...alerts.slice(0, -1), { ...last, count: last.count + 1 }];
  }
  return [...alerts, { id, text, count: 1 }].slice(-MAX_ALERTS);
}

/** {@link alerts} without the head, the alert that was on screen. */
function dismissHead(alerts: readonly Alert[]): readonly Alert[] {
  return alerts.slice(1);
}

/** The action that dismisses the alert on screen (OK, Enter, Space or Escape). */
export type AlertAction = { readonly type: 'dismissAlert' };

/** The state with its head alert dismissed; the same state when none is queued. */
export function withAlertDismissed<S extends { readonly alerts: readonly Alert[] }>(state: S): S {
  return state.alerts.length === 0 ? state : { ...state, alerts: dismissHead(state.alerts) };
}
