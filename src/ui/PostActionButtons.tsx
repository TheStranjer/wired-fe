/**
 * The buttons of a post card's action bar (WFE-209): one button per command,
 * handing on the line the registry gave it, and the three that carry a tally
 * (reply, boost, favourite) with their counts in the language in use. Purely
 * presentational; see {@link PostActions} for the bar itself.
 */
import type { JSX } from 'react';

import styles from './PostActions.module.css';
import type { PostActionLine, PostActionLines } from './postActionTypes';
import { formatNumber } from '../i18n/format';
import { useLocale, useT } from '../i18n/I18nProvider';

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
function tally(locale: string, count: number): string | undefined {
  return count > 0 ? formatNumber(locale, count) : undefined;
}

/** "2 boosts" for a tally above zero, nothing for none. */
function noun(
  t: ReturnType<typeof useT>,
  key: 'format.boost_count' | 'format.favourite_count',
  count: number,
): string | undefined {
  return count > 0 ? t(key, { count }) : undefined;
}

/** The reply button's name: "Reply to post a3", with the tally when there is one. */
function replyName(t: ReturnType<typeof useT>, label: string, count: number): string {
  return count > 0
    ? t('format.reply_to_counted', { label, count })
    : t('format.reply_to', { label });
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
export function ToggleButton(
  props: Omit<ButtonProps, 'line' | 'pressed'> & {
    readonly on: boolean;
    readonly lines: PostActionLines;
    readonly commands: readonly [string, string];
  },
): JSX.Element {
  const { on, lines, commands, ...button } = props;
  return <BarButton {...button} line={lines[commands[on ? 1 : 0]]} pressed={on} />;
}

/** What the counted buttons need: the post's label, tally and own mark, and the way to act. */
type CountedProps = {
  readonly label: string;
  readonly count: number;
  readonly on: boolean;
  readonly lines: PostActionLines;
  readonly onAction: (line: PostActionLine) => void;
};

/** The reply button, its name and its tally. */
export function ReplyButton(props: Omit<CountedProps, 'on'>): JSX.Element {
  const { label, count, lines, onAction } = props;
  const locale = useLocale();
  const t = useT();
  return (
    <BarButton
      count={tally(locale, count)}
      glyph="↩"
      line={lines['reply']}
      name={replyName(t, label, count)}
      onAction={onAction}
    />
  );
}

/** The boost toggle, its tally and the plural words of its title. */
export function BoostButton(props: CountedProps): JSX.Element {
  const { label, count, on, lines, onAction } = props;
  const locale = useLocale();
  const t = useT();
  return (
    <ToggleButton
      commands={['boost', 'unboost']}
      count={tally(locale, count)}
      glyph="⟳"
      lines={lines}
      name={`Boost post ${label}`}
      on={on}
      onAction={onAction}
      title={noun(t, 'format.boost_count', count)}
    />
  );
}

/** The favourite toggle, its tally and the plural words of its title. */
export function FavouriteButton(props: CountedProps): JSX.Element {
  const { label, count, on, lines, onAction } = props;
  const locale = useLocale();
  const t = useT();
  return (
    <ToggleButton
      commands={['fav', 'unfav']}
      count={tally(locale, count)}
      glyph="★"
      lines={lines}
      name={`Favourite post ${label}`}
      on={on}
      onAction={onAction}
      title={noun(t, 'format.favourite_count', count)}
    />
  );
}
