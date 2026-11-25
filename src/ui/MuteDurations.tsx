/**
 * The single-choice group of mute durations in the mute dialog (WFE-267):
 * radio buttons for forever, 30 minutes, 1 hour, 6 hours, 1 day, 3 days and
 * 7 days. A choice is the duration word `/mute` parses (`30m`, `1h`, `1d`, …),
 * or the empty string for forever. Only the selected radio is a tab stop; the
 * arrow keys move the selection and focus through the group, wrapping. The
 * choice itself lives with the caller. Presentational.
 */
import type { JSX, KeyboardEvent } from 'react';

import styles from './MuteDurations.module.css';

/** One choice: the word `/mute` takes (empty for forever) and what the reader sees. */
type Choice = { readonly word: string; readonly label: string };

/** Every duration the dialog offers, in the order it shows them. */
const CHOICES: readonly Choice[] = [
  { word: '', label: 'Forever' },
  { word: '30m', label: '30 minutes' },
  { word: '1h', label: '1 hour' },
  { word: '6h', label: '6 hours' },
  { word: '1d', label: '1 day' },
  { word: '3d', label: '3 days' },
  { word: '7d', label: '7 days' },
];

/** The step an arrow key takes through the group, or 0 for any other key. */
function stepOf(key: string): number {
  if (key === 'ArrowDown' || key === 'ArrowRight') {
    return 1;
  }
  return key === 'ArrowUp' || key === 'ArrowLeft' ? -1 : 0;
}

/** Props of {@link MuteDurations}. */
export type MuteDurationsProps = {
  /** The chosen duration word; empty is forever. */
  readonly value: string;
  /** Called with the word of the newly chosen duration. */
  readonly onChange: (word: string) => void;
};

/** The radio group of mute durations. */
export function MuteDurations(props: MuteDurationsProps): JSX.Element {
  const { value, onChange } = props;
  const choose = (event: KeyboardEvent<HTMLInputElement>, index: number): void => {
    const step = stepOf(event.key);
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const target = (index + step + CHOICES.length) % CHOICES.length;
    for (const { word } of CHOICES.slice(target, target + 1)) {
      const radios = event.currentTarget.ownerDocument.querySelectorAll<HTMLInputElement>(
        `[role="radiogroup"] input[value="${word}"]`,
      );
      for (const radio of radios) {
        radio.focus();
      }
      onChange(word);
    }
  };
  return (
    <div aria-label="Mute for" className={styles['group']} role="radiogroup">
      {CHOICES.map((choice, index) => (
        <label className={styles['choice']} key={choice.word}>
          <input
            checked={choice.word === value}
            onChange={() => {
              onChange(choice.word);
            }}
            onKeyDown={(event) => {
              choose(event, index);
            }}
            tabIndex={choice.word === value ? 0 : -1}
            type="radio"
            value={choice.word}
          />
          {choice.label}
        </label>
      ))}
    </div>
  );
}
