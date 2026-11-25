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

/** One button's look, and the line its press hands on; no line, no button. */
type ButtonProps = {
  readonly glyph: string;
  /** The tally drawn after the glyph by CSS, so the button's text is the glyph alone. */
  readonly count?: string | undefined;
  readonly name: string;
  readonly title?: string | undefined;
  /** Present for a toggle: whether the viewer's mark is on. */
  readonly pressed?: boolean | undefined;
  readonly line: PostActionLine | undefined;
  readonly onAction: (line: PostActionLine) => void;
};

/** The tally as the attribute the stylesheet draws after the glyph, if above zero. */
function tally(count: number): string | undefined {
  return count > 0 ? String(count) : undefined;
}

/** "2 replies" for a tally above zero, nothing for none. */
function noun(count: number, singular: string, plural: string): string | undefined {
  return count > 0 ? `${String(count)} ${count === 1 ? singular : plural}` : undefined;
}

/** The reply button's name: "Reply to post a3", with the tally when there is one. */
function replyName(label: string, count: number): string {
  const replies = noun(count, 'reply', 'replies');
  return `Reply to post ${label}${replies === undefined ? '' : ` (${replies})`}`;
}

/** One bar button, or nothing while its command has no line. */
function BarButton(props: ButtonProps): JSX.Element | null {
  const { glyph, count, name, title, pressed, line, onAction } = props;
  if (line === undefined) {
    return null;
  }
  return (
    <button
      aria-label={name}
      aria-pressed={pressed}
      className={[styles['button'], pressed === true ? styles['on'] : undefined].join(' ')}
      data-count={count}
      onClick={() => {
        onAction(line);
      }}
      title={title}
      type="button"
    >
      {glyph}
    </button>
  );
}

/** A toggle button: its own mark decides between the command and its undo. */
function ToggleButton(
  props: Omit<ButtonProps, 'line' | 'pressed'> & {
    readonly on: boolean;
    readonly lines: PostActionLines;
    readonly commands: readonly [string, string];
  },
): JSX.Element {
  const { on, lines, commands, ...button } = props;
  return <BarButton {...button} line={lines[commands[on ? 1 : 0]]} pressed={on} />;
}

/** The action bar of one post card. */
export function PostActions(props: PostActionsProps): JSX.Element {
  const { label, counts, mine, own, lines, onAction } = props;
  return (
    <div aria-label={`Actions for post ${label}`} className={styles['bar']} role="group">
      <BarButton
        count={tally(counts.replies)}
        glyph="↩"
        line={lines['reply']}
        name={replyName(label, counts.replies)}
        onAction={onAction}
      />
      <ToggleButton
        commands={['boost', 'unboost']}
        count={tally(counts.boosts)}
        glyph="⟳"
        lines={lines}
        name={`Boost post ${label}`}
        on={mine.boosted}
        onAction={onAction}
        title={noun(counts.boosts, 'boost', 'boosts')}
      />
      <ToggleButton
        commands={['fav', 'unfav']}
        count={tally(counts.favourites)}
        glyph="★"
        lines={lines}
        name={`Favourite post ${label}`}
        on={mine.favourited}
        onAction={onAction}
        title={noun(counts.favourites, 'favourite', 'favourites')}
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
