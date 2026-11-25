/**
 * The `⋯` menu at the end of a post card's action bar (WFE-209): the less
 * frequent commands on one post — quote, copy link, open in browser, thread —
 * and, depending on whose post it is, pin, unpin, edit and delete (your own) or
 * mute and block (someone else's). A row exists only for a command the
 * registry carries a line for, and the menu itself only when it has a row.
 * Choosing a row hands that command's line on.
 */
import type { JSX } from 'react';

import { MenuButton } from './MenuButton';
import type { PostActionLine, PostActionLines } from './postActionTypes';

/** Whose posts a row applies to. */
type Scope = 'any' | 'own' | 'others';

/** One possible row: the command it runs, its words and the posts it is for. */
type Entry = { readonly id: string; readonly label: string; readonly scope: Scope };

/** Every row the menu can have, in the order it shows them. */
const ENTRIES: readonly Entry[] = [
  { id: 'quote', label: 'Quote', scope: 'any' },
  { id: 'copy', label: 'Copy link', scope: 'any' },
  { id: 'open', label: 'Open in browser', scope: 'any' },
  { id: 'thread', label: 'Open thread', scope: 'any' },
  { id: 'pin', label: 'Pin', scope: 'own' },
  { id: 'unpin', label: 'Unpin', scope: 'own' },
  { id: 'edit', label: 'Edit', scope: 'own' },
  { id: 'delete', label: 'Delete', scope: 'own' },
  { id: 'mute', label: 'Mute author', scope: 'others' },
  { id: 'block', label: 'Block author', scope: 'others' },
];

/** A row with the line choosing it runs. */
type Row = Entry & { readonly line: PostActionLine };

/** Props of {@link PostActionsMore}. */
export type PostActionsMoreProps = {
  /** The post's label, for the accessible name. */
  readonly label: string;
  /** Whether the viewer wrote the post. */
  readonly own: boolean;
  /** The line each command runs; a missing one drops its row. */
  readonly lines: PostActionLines;
  /** Called with the line of the chosen row. */
  readonly onAction: (line: PostActionLine) => void;
};

/** The rows that apply to this post and whose command exists, with their lines. */
function rowsFor(lines: PostActionLines, own: boolean): readonly Row[] {
  return ENTRIES.flatMap((entry) => {
    const line = lines[entry.id];
    const applies = entry.scope === 'any' || (entry.scope === 'own') === own;
    return line !== undefined && applies ? [{ ...entry, line }] : [];
  });
}

/** The more-menu, or nothing when no command is left for it. */
export function PostActionsMore(props: PostActionsMoreProps): JSX.Element | null {
  const { label, own, lines, onAction } = props;
  const rows = rowsFor(lines, own);
  if (rows.length === 0) {
    return null;
  }
  return (
    <MenuButton
      glyph="⋯"
      items={rows.map((row) => ({ id: row.id, label: row.label }))}
      label={`More actions for post ${label}`}
      onSelect={(id) => {
        for (const row of rows.filter((candidate) => candidate.id === id)) {
          onAction(row.line);
        }
      }}
    />
  );
}
