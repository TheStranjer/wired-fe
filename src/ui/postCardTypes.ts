/**
 * The props of {@link PostCard} (decision 15), kept apart from the component so
 * the card's parts can name them without importing it back.
 */
import type { EmojiRef } from './emojify';
import type { PostActionLine, PostActionLines } from './postActionTypes';
import type { PostRowProps } from './PostRow';

/** An account's picture URLs: the (maybe animated) image and its still. */
type AvatarUrls = { readonly src: string; readonly staticSrc: string };

/** Props of {@link PostCard}: the row's props, with the author and the booster
 * carrying their pictures, the author a display name, switches for avatars and
 * images and the action bar's command lines. */
export type PostCardProps = Omit<PostRowProps, 'author' | 'boostedBy'> & {
  /** The author: the row's nick data, their picture and their display name. */
  readonly author: PostRowProps['author'] & {
    readonly avatar: AvatarUrls;
    /** The name as plain text; may hold `:shortcode:` custom emoji. */
    readonly displayName: string;
    /** The custom emoji the display name may use. */
    readonly displayNameEmojis: readonly EmojiRef[];
  };
  /** Who boosted the post, with their picture; null when nothing boosted it. */
  readonly boostedBy:
    (NonNullable<PostRowProps['boostedBy']> & { readonly avatar: AvatarUrls }) | null;
  /** Whether avatars show; false leaves the card text-only. */
  readonly showAvatar: boolean;
  /** Whether media draws as a grid; false leaves the IRC placeholder lines. */
  readonly showImages: boolean;
  /** The line each action-bar command runs on this post, by command name
   * (from the registry); a command the backend cannot do has none. */
  readonly actionLines: PostActionLines;
  /** Called with the line of the action-bar button or menu row that was pressed. */
  readonly onAction: (line: PostActionLine) => void;
};
