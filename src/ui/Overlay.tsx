/**
 * The modal box (WFE-125): a dialog that owns the keyboard while it is open.
 * Mounting moves focus to its first field, Tab cycles between the first and
 * the last, Escape calls `onClose`, and closing hands focus back to whatever
 * on the page held it before. Presentational only: what the box contains and
 * what closing means belong to higher layers. The strict jsx-a11y gate
 * forbids a keydown listener on a `role="dialog"` div in JSX, so — like
 * src/keys/useGlobalKeys — the listener is attached to the box itself here,
 * with the latest `onClose` kept in a ref.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { JSX, ReactNode } from 'react';

import styles from './Overlay.module.css';

/** What the box shows and when it closes. */
export type OverlayProps = {
  /** Accessible name of the dialog, e.g. `Compose`. */
  readonly label: string;
  /** What Escape asks for; the box itself never decides what closing means. */
  readonly onClose: () => void;
  /** `alertdialog` for a box that interrupts with a message (WFE-271); `dialog` when not given. */
  readonly role?: 'dialog' | 'alertdialog';
  /** The id of the element that describes the box, for assistive technology. */
  readonly describedBy?: string;
  /** The box's contents; its fields are where the trapped focus lives. */
  readonly children: ReactNode;
};

/** The elements Tab can land on, as the browser's own tab order counts them. */
const FOCUSABLE = ['a[href]', 'button', 'input', 'textarea', 'select', '[tabindex]']
  .map((selector) => `${selector}:not([tabindex="-1"])`)
  .join(', ');

/** The fields {@link box} can give focus to, in DOM order. */
function fieldsOf(box: HTMLElement): HTMLElement[] {
  return [...box.querySelectorAll<HTMLElement>(FOCUSABLE)];
}

/**
 * Keep Tab inside {@link box}: at the first field Shift+Tab wraps to the last
 * and at the last Tab wraps to the first; anywhere else the browser's own
 * order stands, and a box with no fields traps nothing.
 */
function trapTab(box: HTMLElement, event: KeyboardEvent): void {
  const fields = fieldsOf(box);
  const first = fields.at(0);
  const last = fields.at(-1);
  if (first === undefined || last === undefined) {
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey ? active === first : active === last) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
}

/**
 * Own {@link box} while mounted: focus its first field, answer Escape (through
 * the live {@link onCloseRef}) and Tab at the box's edges, and give focus back
 * to the element held before on the way out.
 */
function trapKeysIn(box: HTMLElement, onCloseRef: { readonly current: () => void }): () => void {
  const previous = document.activeElement;
  (fieldsOf(box).at(0) ?? box).focus();

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCloseRef.current();
      return;
    }
    if (event.key === 'Tab') {
      trapTab(box, event);
    }
  }

  box.addEventListener('keydown', onKeyDown);
  return (): void => {
    box.removeEventListener('keydown', onKeyDown);
    if (previous instanceof HTMLElement) {
      previous.focus();
    }
  };
}

/** A modal dialog over everything else on the page. */
export function Overlay(props: OverlayProps): JSX.Element {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(props.onClose);

  useEffect(() => {
    onCloseRef.current = props.onClose;
  }, [props.onClose]);

  // A layout effect, not a passive one: the box owns focus and Escape in the
  // same commit that puts it on the page, so a key pressed the moment it
  // appears can never land behind it.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box === null) {
      return;
    }
    return trapKeysIn(box, onCloseRef);
  }, []);

  const role = props.role ?? 'dialog';
  return (
    <div className={styles['backdrop']}>
      <div
        aria-describedby={props.describedBy}
        aria-label={props.label}
        aria-modal="true"
        className={[styles['box'], role === 'alertdialog' ? styles['alert'] : ''].join(' ')}
        ref={boxRef}
        role={role}
      >
        {props.children}
      </div>
    </div>
  );
}
