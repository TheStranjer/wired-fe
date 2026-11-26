/**
 * The modal box that asks which account to use (WFE-282): a title, a line on
 * the current state, a radio group of the signed-in accounts (the digits 1-9
 * choose the nth), a second radio group saying how far the choice reaches,
 * and `Cancel` and `OK`. Focus opens on the chosen account's radio, Enter on
 * a radio submits the formRef, Escape cancels. Presentational: where the choices
 * come from and what submitting does belong to the caller, which also closes
 * the box afterwards.
 */
import { useId, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';

import styles from './AccountPickerDialog.module.css';
import { Overlay } from './Overlay';
import { type RadioOption, RadioFieldset } from './RadioFieldset';
import { useChosenFocus, useDigitSelect } from './useDigitSelect';

/** What the dialog shows and reports. */
export type AccountPickerDialogProps = {
  /** The dialog's accessible name and its visible heading, e.g. `Post as`. */
  readonly title: string;
  /** The current state in a line, e.g. `~main posts as @a@x (feed default)`. */
  readonly description: string;
  /** The accounts to choose from, in the order shown: a key and the words after its number. */
  readonly accounts: readonly { readonly key: string; readonly label: string }[];
  /** The key of the account chosen as the box opens. */
  readonly selected: string;
  /** How far the choice reaches, in the order shown. */
  readonly scopes: readonly RadioOption[];
  /** The value of the scope chosen as the box opens. */
  readonly scope: string;
  /** Called with the chosen account's key and scope value by `OK` and by Enter. */
  readonly onSubmit: (key: string, scope: string) => void;
  /** Called by `Cancel` and by Escape. */
  readonly onCancel: () => void;
};

/** The accounts as radio options, each label led by the digit that chooses it. */
function numbered(accounts: AccountPickerDialogProps['accounts']): readonly RadioOption[] {
  return accounts.map((account, index) => ({
    value: account.key,
    label: `${String(index + 1)}. ${account.label}`,
  }));
}

/** `Cancel`, which never submits, then `OK`, which does. */
function PickerButtons(props: { readonly onCancel: () => void }): JSX.Element {
  return (
    <div className={styles['buttons']}>
      <button className={styles['button']} onClick={props.onCancel} type="button">
        Cancel
      </button>
      <button className={styles['button']} type="submit">
        OK
      </button>
    </div>
  );
}

/** The dialog asking which account to use. */
export function AccountPickerDialog(props: AccountPickerDialogProps): JSX.Element {
  const { title, description, accounts, scopes, onSubmit, onCancel } = props;
  const [key, setKey] = useState(props.selected);
  const [scope, setScope] = useState(props.scope);
  const formRef = useRef<HTMLFormElement | null>(null);
  const keys = useMemo(() => accounts.map((account) => account.key), [accounts]);
  const descriptionId = useId();
  useDigitSelect(formRef, keys, setKey);
  useChosenFocus(formRef);

  return (
    <Overlay describedBy={descriptionId} label={title} onClose={onCancel}>
      <form
        className={styles['form']}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(key, scope);
        }}
        ref={formRef}
      >
        <h2 className={styles['title']}>{title}</h2>
        <p className={styles['description']} id={descriptionId}>
          {description}
        </p>
        <RadioFieldset
          legend="Accounts"
          name="account"
          onChange={setKey}
          options={numbered(accounts)}
          value={key}
        />
        <RadioFieldset
          legend="Remember"
          name="scope"
          onChange={setScope}
          options={scopes}
          value={scope}
        />
        <PickerButtons onCancel={onCancel} />
      </form>
    </Overlay>
  );
}
