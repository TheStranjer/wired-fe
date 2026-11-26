/**
 * The metadata suffix of one post row: everything that follows the body, in
 * ` ✉  ↩2 ⟳1 ★5 🔥2 (edited)`. Purely presentational (AGENTS.md "Layout"): it
 * holds no state, asks the backend for nothing, and says nothing at all about
 * a plain public post nobody has answered, boosted, favourited or reacted to.
 * Which pieces exist is views/postView's reading of the status; here each one
 * only picks its glyph, its words and its colour — the viewer's own marks come
 * out in the accent colour, so each also carries the words colour alone cannot
 * tell assistive technology.
 */
import { Fragment } from 'react';
import type { JSX, ReactNode } from 'react';

import styles from './PostMeta.module.css';
import { ReactionChip } from './ReactionChip';
import type { PostReaction } from './ReactionChip';
import { formatNumber } from '../i18n/format';
import { useLocale } from '../i18n/I18nProvider';

/** The audiences a post can have: the ui twin of api's Visibility, which this
 * layer may not import (AGENTS.md "Layout"). */
type PostVisibility = 'public' | 'unlisted' | 'private' | 'direct' | 'local';

/** What the backend counted on a post. */
type PostCounts = {
  readonly replies: number;
  readonly boosts: number;
  readonly favourites: number;
};

/** What the viewer has already done to a post themselves. */
type PostMine = {
  readonly boosted: boolean;
  readonly favourited: boolean;
  readonly bookmarked: boolean;
};

/** Props of {@link PostMeta}: everything the row knows about a post after its
 * body. {@link PostRowProps} takes the whole set, so it is the one exported
 * type here. */
export type PostMetaProps = {
  /** Who could see the post; the public audience shows no glyph at all. */
  readonly visibility: PostVisibility;
  /** The three tallies; each shows only above zero. */
  readonly counts: PostCounts;
  /** The viewer's own marks, which light the boost, favourite and bookmark up. */
  readonly mine: PostMine;
  /** The reactions, in the order the backend sent them. */
  readonly reactions: readonly PostReaction[];
  /** Whether the author edited the post after posting it. */
  readonly edited: boolean;
};

/** One piece of the suffix: what it shows, and whether the viewer's own mark
 * lights it up, in which case the words colour alone cannot carry come with it. */
type Token = {
  readonly key: string;
  readonly text: ReactNode;
  readonly own: boolean;
  readonly title: string | null;
};

/** How an audience shows: its glyph, and the words the title and the hidden
 * text give. Public is not in this map: it shows nothing. */
type Audience = {
  readonly glyph: string;
  readonly label: string;
};

/** The glyph and the words of each audience that is not the whole wired. */
const AUDIENCE: Record<Exclude<PostVisibility, 'public'>, Audience> = {
  unlisted: { glyph: '~', label: 'unlisted' },
  private: { glyph: '🔒', label: 'followers only' },
  direct: { glyph: '✉', label: 'direct' },
  local: { glyph: '◌', label: 'local only' },
};

/** One tally piece that says nothing about the viewer. */
function plain(key: string, text: ReactNode): Token {
  return { key, text, own: false, title: null };
}

/** One tally piece the viewer's own mark lights up, naming itself to them. */
function own(key: string, text: ReactNode, title: string): Token {
  return { key, text, own: true, title };
}

/** The counters, each only above zero, and the viewer's bookmark. */
function tallyTokens(counts: PostCounts, mine: PostMine, locale: string): readonly Token[] {
  const tokens: Token[] = [];
  if (counts.replies > 0) {
    tokens.push(plain('replies', `↩${formatNumber(locale, counts.replies)}`));
  }
  if (counts.boosts > 0) {
    const boosts = `⟳${formatNumber(locale, counts.boosts)}`;
    tokens.push(mine.boosted ? own('boosts', boosts, 'you boosted this') : plain('boosts', boosts));
  }
  if (counts.favourites > 0) {
    const favourites = `★${formatNumber(locale, counts.favourites)}`;
    tokens.push(
      mine.favourited
        ? own('favourites', favourites, 'you favourited this')
        : plain('favourites', favourites),
    );
  }
  if (mine.bookmarked) {
    tokens.push(own('bookmark', '🔖', 'you bookmarked this'));
  }
  return tokens;
}

/** One reaction as its emoji followed by how many sent it. */
function reactionToken(reaction: PostReaction): Token {
  const key = `reaction:${reaction.name}`;
  const text = <ReactionChip reaction={reaction} />;
  return reaction.me ? own(key, text, `you reacted with ${reaction.name}`) : plain(key, text);
}

/** Every piece after the audience in reading order: tallies, reactions, edit. */
function allTokens(props: PostMetaProps, locale: string): readonly Token[] {
  const { counts, mine, reactions, edited } = props;
  const tokens = [...tallyTokens(counts, mine, locale), ...reactions.map(reactionToken)];
  return edited ? [...tokens, plain('edited', '(edited)')] : tokens;
}

/** The audience glyph, with the plain word as its title and its hidden text. */
function AudienceGlyph(props: { readonly audience: Audience }): JSX.Element {
  const { audience } = props;
  return (
    <span className={styles['visibility']} title={audience.label}>
      <span className={styles['visuallyHidden']}>{audience.label}</span>
      <span aria-hidden="true">{audience.glyph}</span>
    </span>
  );
}

/** One tally piece, the viewer's own marks in the accent colour. */
function TallyToken(props: { readonly token: Token }): JSX.Element {
  const { token } = props;
  return (
    <span className={token.own ? styles['own'] : undefined} title={token.title ?? undefined}>
      {token.text}
    </span>
  );
}

/** Everything that follows a post's body: the audience, then the tallies. */
export function PostMeta(props: PostMetaProps): JSX.Element {
  const { visibility } = props;
  const locale = useLocale();
  const tokens = allTokens(props, locale);

  return (
    <>
      {visibility === 'public' ? undefined : (
        <>
          {' '}
          <AudienceGlyph audience={AUDIENCE[visibility]} />
        </>
      )}
      {tokens.length === 0 ? undefined : (
        <span className={styles['tally']}>
          {'  '}
          {tokens.map((token, index) => (
            <Fragment key={token.key}>
              {index === 0 ? undefined : ' '}
              <TallyToken token={token} />
            </Fragment>
          ))}
        </span>
      )}
    </>
  );
}
