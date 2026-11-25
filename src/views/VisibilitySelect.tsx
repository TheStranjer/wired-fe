/**
 * The composer's audience select: who may see the post, one select over the
 * audiences the instance serves, `local` last when it is one. An edit cannot
 * change the audience of the post it rewrites (WFE-268: Mastodon refuses it),
 * so there the select is disabled and offers just the post's own.
 */

import type { ChangeEvent, JSX } from 'react';

import styles from './Composer.module.css';
import type { Visibility } from '../api/schemas/status';
import type { ComposerFields } from '../state/draft';

/** The audiences the select offers, in order; `local` last, when served. */
const BASE_VISIBILITIES: readonly Visibility[] = ['public', 'unlisted', 'private', 'direct'];

/** The visibility choices for one instance. */
function choices(allowLocal: boolean): readonly Visibility[] {
  return allowLocal ? [...BASE_VISIBILITIES, 'local'] : BASE_VISIBILITIES;
}

/** What the select shows and the callback it drives. */
type VisibilitySelectProps = {
  readonly fields: ComposerFields;
  /** Whether the instance serves local-only posts (decision 5). */
  readonly allowLocal: boolean;
  readonly onChange: (patch: Partial<ComposerFields>) => void;
};

/** Who may see the post, one select; a change it cannot name changes nothing. */
export function VisibilitySelect(props: VisibilitySelectProps): JSX.Element {
  const locked = props.fields.editing !== undefined;
  const offered = locked ? [props.fields.visibility] : choices(props.allowLocal);
  return (
    <select
      aria-label="Visibility"
      className={styles['select']}
      disabled={locked}
      onChange={(event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        const chosen = choices(props.allowLocal).find((name) => name === value);
        if (chosen !== undefined) {
          props.onChange({ visibility: chosen });
        }
      }}
      value={props.fields.visibility}
    >
      {offered.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
