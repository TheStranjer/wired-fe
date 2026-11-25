/**
 * The composer overlay for long posts (WFE-125): the shared form
 * (./ComposerForm) over local state. Ctrl+Enter or the `[ send ]` button hands
 * the draft to `onSubmit`; an error string comes back shown inside the box, and
 * success closes it. Posting itself, the capabilities behind the limit and the
 * local audience, and what closing means all belong to the app layer that
 * renders it. The composer window kind keeps its fields in the app state
 * instead (src/features/composer), but draws the same form.
 */
import { useState } from 'react';
import type { JSX } from 'react';

import { ComposerForm } from './ComposerForm';
import type { Visibility } from '../api/schemas/status';
import { type ComposerFields, type Draft, fieldsToDraft } from '../state/draft';

/** What the composer shows and the callbacks it drives. */
export type ComposerProps = {
  /** The text the box opens with (the command line's, or `/compose`'s argument). */
  readonly initialText: string;
  /** The active account's post length; the counter turns red past it. */
  readonly maxCharacters: number;
  /** Whether the instance serves local-only posts (decision 5). */
  readonly allowLocal: boolean;
  /** The audience a send names while the user changes nothing. */
  readonly defaultVisibility: Visibility;
  /** Post the draft; resolves to an error message to show, or null to close. */
  readonly onSubmit: (draft: Draft) => Promise<string | null>;
  /** Close the box without sending (Escape, and success). */
  readonly onClose: () => void;
};

/** What a send answered: its error string, a throw's message, or null for success. */
async function submitted(submit: ComposerProps['onSubmit'], draft: Draft): Promise<string | null> {
  try {
    return await submit(draft);
  } catch (thrown: unknown) {
    return thrown instanceof Error ? thrown.message : String(thrown);
  }
}

/** The long-post box: the shared form over its own fields. */
export function Composer(props: ComposerProps): JSX.Element {
  const [fields, setFields] = useState<ComposerFields>({
    text: props.initialText,
    spoiler: '',
    visibility: props.defaultVisibility,
  });
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /** Hand the draft over: close on success, keep the text and show the failure. */
  async function send(): Promise<void> {
    setSending(true);
    const failure = await submitted(props.onSubmit, fieldsToDraft(fields));
    if (failure === null) {
      props.onClose();
      return;
    }
    setSending(false);
    setError(failure);
  }

  return (
    <ComposerForm
      allowLocal={props.allowLocal}
      error={error}
      fields={fields}
      maxCharacters={props.maxCharacters}
      onChange={(patch) => {
        setFields({ ...fields, ...patch });
      }}
      onSend={() => {
        void send();
      }}
      sending={sending}
    />
  );
}
