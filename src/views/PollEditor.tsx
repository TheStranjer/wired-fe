/**
 * The composer's poll editor (WFE-206): the options of the poll `/poll` posts,
 * with `[+ option]` up to the instance's maximum, the run as a select over the
 * durations its limits allow, and the "multiple choice" and "hide totals"
 * switches. It edits a {@link DraftPoll} and hands every change back whole; the
 * limits come from the posting account's capabilities (decision 5).
 */
import type { ChangeEvent, JSX } from 'react';

import styles from './PollEditor.module.css';
import { PollOption } from './PollOption';
import type { PollLimits } from '../api/schemas/pollLimits';
import {
  type DraftPoll,
  MIN_POLL_OPTIONS,
  addOption,
  checkOptions,
  durationChoices,
  removeOption,
  setOption,
} from '../state/pollEditor';

/** What the editor shows and how it reports a change. */
export type PollEditorProps = {
  readonly poll: DraftPoll;
  readonly limits: PollLimits;
  readonly onChange: (poll: DraftPoll) => void;
};

/** The run, "multiple choice" and "hide totals" controls. */
function PollSettings({ poll, limits, onChange }: PollEditorProps): JSX.Element {
  return (
    <div className={styles['settings']}>
      <label className={styles['setting']}>
        <span>Duration</span>
        <select
          className={styles['select']}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => {
            onChange({ ...poll, expiresIn: Number(event.target.value) });
          }}
          value={poll.expiresIn}
        >
          {durationChoices(limits).map((choice) => (
            <option key={choice.seconds} value={choice.seconds}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles['setting']}>
        <input
          checked={poll.multiple}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange({ ...poll, multiple: event.target.checked });
          }}
          type="checkbox"
        />
        <span>Multiple choice</span>
      </label>
      <label className={styles['setting']}>
        <input
          checked={poll.hideTotals === true}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            onChange({ ...poll, hideTotals: event.target.checked });
          }}
          type="checkbox"
        />
        <span>Hide totals</span>
      </label>
    </div>
  );
}

/** The poll's options, the add button and the settings. */
export function PollEditor(props: PollEditorProps): JSX.Element {
  const { poll, limits, onChange } = props;
  return (
    <div className={styles['editor']}>
      <ul className={styles['options']}>
        {checkOptions(poll, limits).map(({ text, problem }, index) => (
          <PollOption
            index={index}
            key={`option-${String(index)}`}
            maxCharacters={limits.maxCharactersPerOption}
            onChange={(next) => {
              onChange(setOption(poll, index, next));
            }}
            onRemove={() => {
              onChange(removeOption(poll, index));
            }}
            problem={problem}
            removable={poll.options.length > MIN_POLL_OPTIONS}
            text={text}
          />
        ))}
      </ul>
      <button
        className={styles['button']}
        disabled={poll.options.length >= limits.maxOptions}
        onClick={() => {
          onChange(addOption(poll));
        }}
        type="button"
      >
        [+ option]
      </button>
      <PollSettings {...props} />
    </div>
  );
}
