/**
 * What a card's `☺` button needs to open the emoji picker (WFE-265): the emoji
 * to offer and what a choice does. The custom emoji are those of the instance
 * of the post's own account (the window's `accountKey`, not just the active
 * one) that show in a picker, as their still pictures; the Unicode ones come
 * from ./useUnicodeEmojis. Neither is fetched until the picker first opens. A
 * choice runs `/react <label> <emoji>`, or `/unreact` when it takes the
 * viewer's own reaction back, through the one line runner (decision 6), so the
 * command line is never touched.
 */
import { useCallback, useMemo, useState } from 'react';

import { useCustomEmojis } from './useCustomEmojis';
import { useUnicodeEmojis } from './useUnicodeEmojis';
import type { CustomEmoji } from '../api/schemas/customEmoji';
import type { PickerCustomEmoji } from '../ui/emojiPickerModel';
import type { PostActionLine, ReactPicker } from '../ui/postActionTypes';

/** The emoji a picker lists, in the picker's own names. */
function inPicker(emojis: readonly CustomEmoji[]): readonly PickerCustomEmoji[] {
  return emojis
    .filter((emoji) => emoji.visible_in_picker)
    .map((emoji) => ({
      shortcode: emoji.shortcode,
      url: emoji.static_url,
      category: emoji.category,
    }));
}

/** The line choosing {@link emoji} runs on the post labelled {@link label}. */
function choiceLine(label: string, emoji: string, remove: boolean): PostActionLine {
  return { line: `/${remove ? 'unreact' : 'react'} ${label} ${emoji}`, prefill: false };
}

/**
 * The picker of the post labelled {@link label}, read through the account
 * {@link accountKey}; {@link run} runs the line a choice makes.
 */
export function usePostPicker(
  accountKey: string | null,
  label: string,
  run: (line: PostActionLine) => void,
): ReactPicker {
  const [wanted, setWanted] = useState(false);
  const custom = useCustomEmojis(wanted ? accountKey : null);
  const unicode = useUnicodeEmojis(wanted);
  const data = useMemo(() => ({ custom: inPicker(custom), unicode }), [custom, unicode]);
  const onOpen = useCallback(() => {
    setWanted(true);
  }, []);
  return {
    data,
    onOpen,
    onChoose: (emoji, remove) => {
      run(choiceLine(label, emoji, remove));
    },
  };
}
