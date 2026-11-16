/**
 * The `hashtag` window kind (AGENTS.md "Windows, like IRC buffers"): one
 * hashtag's timeline, the view /tag joins (src/commands/defs/tag.ts) and the
 * window carries as its target. Pages come from the tag timeline endpoint
 * through the shared loader and its lines through the shared scrollback
 * (src/views/TimelineWindow); the log region is named after the tag, the way
 * every other window names itself. Plain text typed here is a post too, and
 * like IRC the channel catches what you say in it: the tag is appended when
 * the text does not already carry it case-insensitively, so anything posted
 * from this window lands in this window's timeline. The send itself is what
 * src/state/postStatus does for every postable window.
 */

import type { JSX } from 'react';

import { tagTimeline } from '../../api/endpoints/timelines';
import type { Draft } from '../../state/draft';
import { postStatus } from '../../state/postStatus';
import { useAppState } from '../../state/StateContext';
import type { WindowKindDefinition } from '../../state/windowKind';
import { TimelineWindow } from '../../views/TimelineWindow';
import type { FetchPage } from '../../views/useTimeline';

/** The tag word `#<target>`, or '' for a window with nothing to target. */
function tagWord(target: string | null): string {
  return target === null ? '' : `#${target}`;
}

/** {@link draft}'s text with {@link word} appended, unless it already carries it. */
function withTag(draft: Draft, word: string): Draft {
  if (word === '' || draft.text.toLowerCase().includes(word.toLowerCase())) {
    return draft;
  }
  return { ...draft, text: `${draft.text} ${word}` };
}

/** The hashtag window: it pages the tag its window's target names. */
function HashtagWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  const state = useAppState();
  const win = state.windows.windows.find((candidate) => candidate.id === windowId);
  const target = win?.ref.target ?? '';
  const fetchPage: FetchPage = async (session, page, signal) =>
    await tagTimeline(session, target, page, signal);
  return (
    <TimelineWindow
      fetchPage={fetchPage}
      label={target === '' ? 'hashtag' : `#${target}`}
      windowId={windowId}
    />
  );
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'hashtag',
  topic: (window) => tagWord(window.ref.target),
  Component: HashtagWindow,
  onPost: async (draft, win, context) =>
    await postStatus(context, {
      accountKey: win.ref.accountKey,
      windowId: win.id,
      draft: withTag(draft, tagWord(win.ref.target)),
    }),
};
