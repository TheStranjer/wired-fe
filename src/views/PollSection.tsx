/**
 * The composer's poll section (WFE-206): the `[ ☰ poll ]` toggle that shows or
 * hides the poll editor (`aria-pressed`). A poll and media exclude each other
 * on Mastodon and Pleroma, and no instance document says otherwise, so while
 * the draft carries media the toggle stays off and says why; one already open
 * keeps its toggle so it can be closed. Turning it on starts a fresh poll
 * within the instance's limits (src/state/pollEditor); turning it off drops it.
 */
import type { JSX } from 'react';

import { PollEditor } from './PollEditor';
import styles from './PollEditor.module.css';
import type { PollLimits } from '../api/schemas/pollLimits';
import { useT } from '../i18n/I18nProvider';
import { type DraftPoll, newPoll } from '../state/pollEditor';

/** What the poll section shows and how it reports a change. */
export type PollSectionProps = {
  /** The poll being edited; undefined while the editor is off. */
  readonly poll: DraftPoll | undefined;
  readonly limits: PollLimits;
  /** How many media the draft carries. */
  readonly mediaCount: number;
  /** The new poll, or undefined when the editor was turned off. */
  readonly onChange: (poll: DraftPoll | undefined) => void;
};

/** The toggle, the reason it is off or in the way, and the editor when on. */
export function PollSection(props: PollSectionProps): JSX.Element {
  const t = useT();
  const { poll, limits, mediaCount, onChange } = props;
  const blocked = mediaCount > 0;
  return (
    <div className={styles['section']}>
      <button
        aria-pressed={poll !== undefined}
        className={styles['button']}
        disabled={blocked && poll === undefined}
        onClick={() => {
          onChange(poll === undefined ? newPoll(limits) : undefined);
        }}
        type="button"
      >
        {t('views.poll.toggle')}
      </button>
      {blocked ? <p className={styles['problem']}>{t('views.poll.media_conflict')}</p> : null}
      {poll === undefined ? null : <PollEditor limits={limits} onChange={onChange} poll={poll} />}
    </div>
  );
}
