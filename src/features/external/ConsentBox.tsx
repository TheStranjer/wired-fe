/**
 * The box an external login's consent link opens (WFE-169): which app asks
 * (its name, and its website as plain text when it is an http(s) address), the
 * permissions it wants, and Authorize / Deny, each answered by a POST whose
 * returned address the browser is sent to. A bad state or token shows why,
 * with a way out. Needs no signed-in account. Fetching and posting belong to
 * ./useConsent.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';

import styles from './External.module.css';
import { Focused, Message, TextButton } from './Parts';
import { type Phase, useConsent } from './useConsent';
import type { ConsentInfo } from '../../api/endpoints/external';
import { webUrl } from '../../lib/webUrl';

/** What the box needs: the instance, the login's tokens, and how to leave. */
export type ConsentBoxProps = {
  /** The instance origin the login happened on. */
  readonly origin: string;
  readonly state: string;
  readonly confirmToken: string;
  readonly navigate: (url: string) => void;
  /** Close the box. */
  readonly onClose: () => void;
};

/** The request and the two choices; neither answers while one is in flight. */
function Ask(props: {
  readonly info: ConsentInfo;
  readonly sending: boolean;
  readonly decide: (approve: boolean) => Promise<void>;
}): JSX.Element {
  const { info, decide } = props;
  const website = info.app.website === null ? null : webUrl(info.app.website);
  return (
    <div className={styles['box']}>
      <h2 className={styles['title']}>Authorize {info.app.name}?</h2>
      {website === null ? null : <p className={styles['line']}>Website: {website}</p>}
      <p className={styles['line']}>This app asks for:</p>
      <ul className={styles['scopes']}>
        {info.scopes.map((scope) => (
          <li key={scope}>{scope}</li>
        ))}
      </ul>
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
    </div>
  );
}

/** What the box shows for {@link props}.phase. */
function Body(props: {
  readonly phase: Phase;
  readonly decide: (approve: boolean) => Promise<void>;
  readonly onClose: () => void;
}): JSX.Element {
  const { phase, onClose } = props;
  switch (phase.kind) {
    case 'loading':
      return (
        <Message label="[ cancel ]" onClose={onClose} role="status" text="Loading the request…" />
      );
    case 'ask':
      return <Ask decide={props.decide} info={phase.info} sending={phase.sending} />;
    case 'finished':
      return <Message onClose={onClose} role="status" text={phase.message} />;
    case 'error':
      return <Message onClose={onClose} role="alert" text={phase.message} />;
  }
}

/** The consent box for one external login. */
export function ConsentBox(props: ConsentBoxProps): JSX.Element {
  const { origin, state, confirmToken, navigate } = props;
  const session = useMemo(() => ({ origin, token: null }), [origin]);
  const { phase, decide } = useConsent({ session, state, confirmToken, navigate });
  return (
    <Focused step={phase.kind}>
      <Body decide={decide} onClose={props.onClose} phase={phase} />
    </Focused>
  );
}
