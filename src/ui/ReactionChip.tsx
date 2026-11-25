/**
 * The body of one reaction chip in a post's metadata suffix: a custom emoji as
 * the inline picture the post body would show for it, a Unicode emoji as its
 * glyph, then the tally set off from it. The whole chip is one image to
 * assistive technology, named "wiredcat, 2 reactions", so neither the glyph,
 * the picture's alt text nor a count glued to a domain is read out piecemeal.
 */
import type { JSX } from 'react';

import { isHttps } from './emojify';
import styles from './ReactionChip.module.css';

/** One emoji reaction on a post and its tally. */
export type PostReaction = {
  readonly name: string;
  readonly count: number;
  readonly me: boolean;
  /** The picture of a custom emoji; null for a Unicode emoji. */
  readonly url: string | null;
};

/** The shortcode of a reaction name: a remote one is `name@domain`. */
function shortcodeOf(name: string): string {
  const at = name.indexOf('@');
  return at > 0 ? name.slice(0, at) : name;
}

/** What assistive technology reads for the whole chip. */
function spokenLabel(reaction: PostReaction): string {
  const noun = reaction.count === 1 ? 'reaction' : 'reactions';
  return `${reaction.name}, ${String(reaction.count)} ${noun}`;
}

/** The emoji itself: its picture when it has an https one, else its name. */
function Emoji(props: { readonly reaction: PostReaction }): JSX.Element {
  const { name, url } = props.reaction;
  if (url === null || !isHttps(url)) {
    return <>{name}</>;
  }
  return (
    <img
      alt={`:${shortcodeOf(name)}:`}
      className={styles['emoji']}
      draggable={false}
      src={url}
      title={name}
    />
  );
}

/** One reaction: its emoji, then how many accounts sent it. */
export function ReactionChip(props: { readonly reaction: PostReaction }): JSX.Element {
  const { reaction } = props;
  return (
    <span aria-label={spokenLabel(reaction)} role="img">
      <Emoji reaction={reaction} />
      <span className={styles['count']}>{String(reaction.count)}</span>
    </span>
  );
}
