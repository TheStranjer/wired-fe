/**
 * The IRC-style topic line at the top of the screen: the active window's
 * name, its account and a free-text topic. Purely presentational; the window
 * and account stores live in higher layers.
 */
import type { JSX } from 'react';

import styles from './TopicBar.module.css';

/** The three pieces of text the topic bar names the active window with. */
export type TopicBarProps = {
  /** Window name, e.g. "#home". */
  readonly windowTitle: string;
  /** Account this window belongs to, e.g. "@lain@wired.example"; null for the status window. */
  readonly accountLabel: string | null;
  /** The window's topic, e.g. "home timeline". */
  readonly topic: string;
};

/** Box-drawing separator between the account (or title) and the topic. */
const SEPARATOR = ' ── ';

/** A single-line bar naming the active window, its account and its topic. */
export function TopicBar(props: TopicBarProps): JSX.Element {
  const { windowTitle, accountLabel, topic } = props;

  return (
    <div className={styles['bar']}>
      <span className={styles['title']}>{windowTitle}</span>
      {accountLabel === null ? null : (
        <>
          {' '}
          <span className={styles['account']}>{accountLabel}</span>
        </>
      )}
      <span aria-hidden="true" className={styles['separator']}>
        {SEPARATOR}
      </span>
      <span className={styles['topic']}>{topic}</span>
    </div>
  );
}
