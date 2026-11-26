/**
 * The instance picker of the login, sign-up and reset boxes (WFE-307): a group
 * of radio choices, one per instance the build lists, each named by its bare
 * host, so the instance is clicked or reached with the keyboard instead of
 * typed from memory. Where the build also lets the visitor type their own
 * (`allowCustom`) a text field follows the choices. The value is the chosen
 * origin or the typed text; resolving it is the caller's business.
 */
import { useId, useState } from 'react';
import type { JSX } from 'react';

import styles from './InstanceChoices.module.css';
import { useT } from '../i18n/I18nProvider';
import { type InstanceChoices as Choices, instanceWord } from '../lib/origin';

/** What the picker shows and reports. */
export type InstanceChoicesProps = Choices & {
  /** The chosen origin, or the text typed into the free field. */
  readonly value: string;
  readonly onChange: (value: string) => void;
};

/** One choice: a radio named by the instance's host. */
function Choice(props: {
  readonly origin: string;
  readonly group: string;
  readonly checked: boolean;
  readonly onPick: () => void;
}): JSX.Element {
  return (
    <label className={styles['choice']}>
      <input
        checked={props.checked}
        className={styles['radio']}
        name={props.group}
        onChange={props.onPick}
        type="radio"
        value={props.origin}
      />
      <span>{instanceWord(props.origin)}</span>
    </label>
  );
}

/** The instances of the build as choices, and a field for another one when the build allows it. */
export function InstanceChoices(props: InstanceChoicesProps): JSX.Element {
  const groupId = useId();
  const [typed, setTyped] = useState('');
  const { onChange } = props;
  const t = useT();
  return (
    <fieldset className={styles['group']}>
      <legend className={styles['legend']}>{t('ui.instance_choices.legend')}</legend>
      {props.origins.map((origin) => (
        <Choice
          checked={props.value === origin}
          group={groupId}
          key={origin}
          onPick={() => {
            setTyped('');
            onChange(origin);
          }}
          origin={origin}
        />
      ))}
      {props.allowCustom ? (
        <label className={styles['label']}>
          <span>{t('ui.instance_choices.other')}</span>
          <input
            autoComplete="url"
            className={styles['input']}
            onChange={(event) => {
              setTyped(event.target.value);
              onChange(event.target.value);
            }}
            spellCheck={false}
            type="text"
            value={typed}
          />
        </label>
      ) : null}
    </fieldset>
  );
}
