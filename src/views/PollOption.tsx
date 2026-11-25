/**
 * One option row of the composer's poll editor (WFE-206): the text input named
 * "Option n", its `n/max` counter, the `[x]` that removes it and, under it,
 * what is wrong with it. The counter reads error-coloured past the limit, the
 * way the post's own does.
 */
import type { ChangeEvent, JSX } from 'react';

import styles from './PollEditor.module.css';

/** What one option row shows and the two things it can do. */
type PollOptionProps = {
  /** The option's place in the poll, from 0. */
  readonly index: number;
  readonly text: string;
  /** The longest an option may be on the posting instance. */
  readonly maxCharacters: number;
  /** What is wrong with this option; null when nothing is. */
  readonly problem: string | null;
  /** Whether the poll can lose this option (it keeps at least two). */
  readonly removable: boolean;
  readonly onChange: (text: string) => void;
  readonly onRemove: () => void;
};

/** One option of the poll: input, counter, remove button and problem. */
export function PollOption(props: PollOptionProps): JSX.Element {
  const number = String(props.index + 1);
  const over = props.text.length > props.maxCharacters;
  return (
    <li className={styles['option']}>
      <div className={styles['optionRow']}>
        <input
          aria-label={`Option ${number}`}
          className={styles['input']}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            props.onChange(event.target.value);
          }}
          type="text"
          value={props.text}
        />
        <span className={over ? styles['countOver'] : styles['count']}>
          {`${String(props.text.length)}/${String(props.maxCharacters)}`}
        </span>
        <button
          aria-label={`Remove option ${number}`}
          className={styles['button']}
          disabled={!props.removable}
          onClick={props.onRemove}
          type="button"
        >
          [x]
        </button>
      </div>
      {props.problem === null ? null : <p className={styles['problem']}>{props.problem}</p>}
    </li>
  );
}
