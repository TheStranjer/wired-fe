/**
 * The modal alert an error line raises (WFE-271): the message, a dim `(×3)`
 * when the same one came several times in a row, and one button, OK. It sits
 * on the {@link Overlay}, which focuses the button as it opens, keeps the
 * keyboard inside and calls `onDismiss` on Escape. Enter and Space press the
 * button on their keydown, so only a key that goes down after the alert is
 * open can dismiss it, and a repeating keydown never does: the Enter that
 * submitted a failing command, still held, cannot dismiss the alert it caused.
 * The browser's own press-on-keyup is suppressed so one key press dismisses
 * once. Presentational: the queue lives in src/state.
 */
import { useId } from 'react';
import type { JSX, KeyboardEvent } from 'react';

import styles from './ErrorAlert.module.css';
import { Overlay } from './Overlay';
import { useT } from '../i18n/I18nProvider';

/** What the alert says and what OK does. */
export type ErrorAlertProps = {
  /** The error line's text. */
  readonly text: string;
  /** How many times in a row this text was raised; shown only above one. */
  readonly count: number;
  /** OK, Enter, Space and Escape all ask for this. */
  readonly onDismiss: () => void;
};

/** Whether {@link event} is a key that presses a button. */
function pressesButton(event: KeyboardEvent<HTMLButtonElement>): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

/** The error alert, over everything else on the page. */
export function ErrorAlert(props: ErrorAlertProps): JSX.Element {
  const messageId = useId();
  const { onDismiss } = props;
  const t = useT();
  return (
    <Overlay
      describedBy={messageId}
      label={t('ui.error_alert.label')}
      onClose={onDismiss}
      role="alertdialog"
    >
      <p className={styles['message']}>
        <span id={messageId}>{props.text}</span>
        {props.count > 1 ? (
          <span className={styles['count']}>
            {` ${t('ui.error_alert.count', { count: props.count })}`}
          </span>
        ) : null}
      </p>
      <button
        className={styles['ok']}
        onClick={onDismiss}
        onKeyDown={(event) => {
          if (pressesButton(event)) {
            event.preventDefault();
            if (!event.repeat) {
              onDismiss();
            }
          }
        }}
        onKeyUp={(event) => {
          if (pressesButton(event)) {
            event.preventDefault();
          }
        }}
        type="button"
      >
        {t('ui.error_alert.ok')}
      </button>
    </Overlay>
  );
}
