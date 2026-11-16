/**
 * The `search` window kind (AGENTS.md "Windows, like IRC buffers", WFE-109):
 * the answer to one query, the buffer `/search` opens. ./useSearch fills it
 * once — the accounts and tags it found printed as sections, the matching
 * posts as post lines — and the log region carries the window's title
 * (`search/<query>`, the way /search opened it) while the topic line says
 * plainly what is being searched. A search is something you look at, not
 * something you say into: the definition carries no `onPost`, the way the
 * profile window does.
 */

import type { JSX } from 'react';

import { useSearch } from './useSearch';
import { useAppState } from '../../state/StateContext';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';

/** What the topic line says about the window's query; 'search' without one. */
function searchTopic(target: string | null): string {
  return target === null ? 'search' : `search: ${target}`;
}

/** The search window: its buffer's lines, filled once by ./useSearch. */
function SearchWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  useSearch(windowId);
  const win = useAppState().windows.windows.find((candidate) => candidate.id === windowId);
  return <BufferView windowId={windowId} label={win?.title ?? 'search'} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'search',
  topic: (window) => searchTopic(window.ref.target),
  Component: SearchWindow,
};
