/**
 * The bordered frame every pane and float is drawn in (WFE-184): a title bar
 * with the window's title, the account it acts as and its topic, an actions
 * slot at the right end, and a content area that scrolls on its own while the
 * title bar stays put. Focus shows as a brighter, thicker border and a leading
 * `[*]`, never colour alone (decision 16). Presentational only: which window
 * is focused, what the actions do and what the content is belong to the
 * desktop renderer.
 */
import type { JSX, PointerEventHandler, ReactNode } from 'react';

import styles from './PaneFrame.module.css';

/** The only pass-through the title bar takes: floats drag by it. */
type PaneFrameTitleBarProps = {
  /** Pointer-down on the title bar, after the frame has asked for focus. */
  readonly onPointerDown?: PointerEventHandler<HTMLElement> | undefined;
};

/** What the frame shows and how it reports being clicked. */
export type PaneFrameProps = {
  /** The window's name, e.g. `#home`. */
  readonly title: string;
  /** The account the window acts as, e.g. `@lain@wired.example`. */
  readonly subtitle: string | null;
  /** A one-line description of what the window is showing. */
  readonly topic: string | null;
  /** Whether this is the focused window. */
  readonly focused: boolean;
  /** Controls at the title bar's right end. */
  readonly actions: ReactNode;
  /** The window's contents; they scroll inside the frame. */
  readonly children: ReactNode;
  /** Called on pointer-down anywhere in the frame, content included. */
  readonly onFocusRequest: () => void;
  /** Optional handlers for the title bar element. */
  readonly titleBarProps?: PaneFrameTitleBarProps | undefined;
};

/** A bordered, titled frame around one window's content. */
export function PaneFrame(props: PaneFrameProps): JSX.Element {
  const label = props.subtitle === null ? props.title : `${props.title} ${props.subtitle}`;
  return (
    <section
      aria-current={props.focused ? 'true' : undefined}
      aria-label={label}
      className={props.focused ? styles['focused'] : styles['frame']}
      onPointerDownCapture={props.onFocusRequest}
    >
      <header className={styles['titleBar']} {...props.titleBarProps}>
        <span className={styles['title']}>
          {props.focused ? '[*] ' : ''}
          {props.title}
          {props.subtitle === null ? '' : ` ${props.subtitle}`}
          {props.topic === null ? '' : ` — ${props.topic}`}
        </span>
        <span className={styles['actions']}>{props.actions}</span>
      </header>
      <div className={styles['content']}>{props.children}</div>
    </section>
  );
}
