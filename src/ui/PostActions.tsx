/**
 * The action bar at the bottom of a post card (WFE-209): `↩ 2` reply, `⟳ 1`
 * boost, `★ 5` favourite, `☺` react, `🔖` bookmark and a `⋯` menu for the rest.
 * Each button is a click target of the command registry (decision 6): it hands
 * on the very line its command runs, which the caller got from the registry, so
 * a click, a hotkey and the typed command are one path. The counts the bar
 * carries are the post's own tallies. Boost, favourite and bookmark are toggles:
 * `aria-pressed` and an inverted glyph show the viewer's own mark, and pressing
 * again hands on the undo command's line. A command the backend cannot do has no
 * line and so no button. The `☺` button is the one click that does not hand its
 * line on (WFE-265): where the registry's react line says so it opens the emoji
 * picker (./ReactButton) over the post's reactions and the emoji the app lends
 * it, and the choice is reported to the app, not run here. Purely
 * presentational: it knows no commands itself.
 */
import type { JSX } from 'react';

import { BoostButton, FavouriteButton, ReplyButton, ToggleButton } from './PostActionButtons';
import styles from './PostActions.module.css';
import { PostActionsMore } from './PostActionsMore';
import type { PostActionLine, PostActionLines, ReactPicker } from './postActionTypes';
import type { PostMetaProps } from './PostMeta';
import { ReactButton } from './ReactButton';

/** Props of {@link PostActions}. */
export type PostActionsProps = Pick<PostMetaProps, 'counts' | 'mine' | 'reactions'> & {
  /** The post's short label, e.g. "a3"; it names every button. */
  readonly label: string;
  /** Whether the viewer wrote the post: it decides the more-menu's rows. */
  readonly own: boolean;
  /** The line each command runs on this post, by command name. */
  readonly lines: PostActionLines;
  /** Called with the line of the button or row that was pressed. */
  readonly onAction: (line: PostActionLine) => void;
  /** The react button's picker: its emoji, and what choosing one does. */
  readonly picker: ReactPicker;
};

/** The action bar of one post card. */
export function PostActions(props: PostActionsProps): JSX.Element {
  const { label, counts, mine, own, lines, onAction } = props;
  return (
    <div aria-label={`Actions for post ${label}`} className={styles['bar']} role="group">
      <ReplyButton count={counts.replies} label={label} lines={lines} onAction={onAction} />
      <BoostButton
        count={counts.boosts}
        label={label}
        lines={lines}
        on={mine.boosted}
        onAction={onAction}
      />
      <FavouriteButton
        count={counts.favourites}
        label={label}
        lines={lines}
        on={mine.favourited}
        onAction={onAction}
      />
      <ReactButton
        label={label}
        line={lines['react']}
        onAction={onAction}
        picker={props.picker}
        reactions={props.reactions}
      />
      <ToggleButton
        commands={['bookmark', 'unbookmark']}
        glyph="🔖"
        lines={lines}
        name={`Bookmark post ${label}`}
        on={mine.bookmarked}
        onAction={onAction}
      />
      <PostActionsMore label={label} lines={lines} onAction={onAction} own={own} />
    </div>
  );
}
