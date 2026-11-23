/**
 * The box a third-party app's authorization request opens (WFE-168): who is
 * asking (name, and website as plain text when it is an http(s) address),
 * every permission it wants in plain words, and Authorize / Deny. After a
 * decision it shows a code to copy (out-of-band apps), a note that the
 * browser is on its way, or why nothing happened, always with a way out.
 * Fetching and posting belong to ./useAuthorize.
 */
import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

import styles from './AuthorizeBox.module.css';
import { CodeView } from './CodeView';
import { webUrl } from './redirectTarget';
import { describeScope } from './scopeWords';
import { type AuthorizeSetup, type Phase, useAuthorize } from './useAuthorize';
import type { AuthorizeInfo } from '../../api/endpoints/authorize';

/** What the box shows and the one callback it drives. */
export type AuthorizeBoxProps = AuthorizeSetup & {
  /** The signed-in account the app would act through, as `lain@wired.example`. */
  readonly handle: string;
  /** Close the box. */
  readonly onClose: () => void;
};

/** A plain text button. */
function TextButton(props: {
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <button
      className={styles['button']}
      disabled={props.disabled ?? false}
      onClick={props.onClick}
      type="button"
    >
      {props.label}
    </button>
  );
}

/** Who is asking and for what. */
function Summary(props: { readonly info: AuthorizeInfo; readonly handle: string }): JSX.Element {
  const { info } = props;
  const website = info.app.website === null ? null : webUrl(info.app.website);
  return (
    <>
      <h2 className={styles['title']}>Authorize {info.app.name}?</h2>
      {website === null ? null : <p className={styles['line']}>Website: {website}</p>}
      <p className={styles['line']}>As @{props.handle}, this app will be able to:</p>
      <ul className={styles['scopes']}>
        {info.scopes.map((scope) => (
          <li key={scope}>{describeScope(scope)}</li>
        ))}
      </ul>
    </>
  );
}

/** The request and the two choices; neither answers while one is in flight. */
function Ask(props: {
  readonly info: AuthorizeInfo;
  readonly sending: boolean;
  readonly handle: string;
  readonly decide: (approve: boolean) => Promise<void>;
}): JSX.Element {
  const { decide } = props;
  return (
    <>
      <Summary handle={props.handle} info={props.info} />
      <div className={styles['actions']}>
        <TextButton
          disabled={props.sending}
          label="[ authorize ]"
          onClick={() => {
            void decide(true);
          }}
        />
        <TextButton
          disabled={props.sending}
          label="[ deny ]"
          onClick={() => {
            void decide(false);
          }}
        />
      </div>
    </>
  );
}

/** A line of text with the way out under it. */
function Closing(props: {
  readonly role: 'status' | 'alert';
  readonly text: string;
  readonly label?: string;
  readonly onClose: () => void;
}): JSX.Element {
  return (
    <>
      <p className={props.role === 'alert' ? styles['error'] : styles['line']} role={props.role}>
        {props.text}
      </p>
      <TextButton
        label={props.label ?? '[ close ]'}
        onClick={() => {
          props.onClose();
        }}
      />
    </>
  );
}

/** What the box shows for {@link props}.phase. */
function Body(props: {
  readonly phase: Phase;
  readonly handle: string;
  readonly decide: (approve: boolean) => Promise<void>;
  readonly onClose: () => void;
}): JSX.Element {
  const { phase, onClose } = props;
  switch (phase.kind) {
    case 'loading':
      return (
        <Closing label="[ cancel ]" onClose={onClose} role="status" text="Loading the request…" />
      );
    case 'ask':
      return (
        <Ask
          decide={props.decide}
          handle={props.handle}
          info={phase.info}
          sending={phase.sending}
        />
      );
    case 'code':
      return <CodeView code={phase.code} onClose={onClose} />;
    case 'finished':
      return <Closing onClose={onClose} role="status" text={phase.message} />;
    case 'error':
      return <Closing onClose={onClose} role="alert" text={phase.message} />;
  }
}

/** The authorization box for one request, as one account. */
export function AuthorizeBox(props: AuthorizeBoxProps): JSX.Element {
  const { phase, decide } = useAuthorize(props);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Each phase swaps the buttons; hand focus to the new first one so the
  // keyboard (Escape included) stays inside the dialog.
  useEffect(() => {
    boxRef.current?.querySelector('button')?.focus();
  }, [phase.kind]);

  return (
    <div className={styles['box']} ref={boxRef}>
      <Body decide={decide} handle={props.handle} onClose={props.onClose} phase={phase} />
    </div>
  );
}
