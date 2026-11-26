/**
 * The `⋯` menu at the end of a post card's action bar (WFE-209): the less
 * frequent commands on one post — quote, copy link, open in browser, thread —
 * and, depending on whose post it is, pin, unpin, edit and delete (your own) or
 * mute and block (someone else's). A row exists only for a command the
 * registry carries a line for, and the menu itself only when it has a row.
 * Choosing a row hands that command's line on; a line marked `confirm`
 * (Delete, Block author, Mute author; WFE-266, WFE-267) is for the caller to
 * ask about in a dialog before it runs, since this menu is presentational and
 * holds no such state.
 */
import type { JSX } from 'react';

import { MenuButton } from './MenuButton';
import type { PostActionLine, PostActionLines } from './postActionTypes';
import { useT } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages';

/** Whose posts a row applies to. */
type Scope = 'any' | 'own' | 'others';

/** One possible row: the command it runs, the key of its words and the posts it is for. */
type Entry = { readonly id: string; readonly text: MessageKey; readonly scope: Scope };

/** Every row the menu can have, in the order it shows them. */
const ENTRIES: readonly Entry[] = [
  { id: 'quote', text: 'ui.post_actions_more.quote', scope: 'any' },
  { id: 'copy', text: 'ui.post_actions_more.copy', scope: 'any' },
  { id: 'open', text: 'ui.post_actions_more.open', scope: 'any' },
  { id: 'thread', text: 'ui.post_actions_more.thread', scope: 'any' },
  { id: 'pin', text: 'ui.post_actions_more.pin', scope: 'own' },
  { id: 'unpin', text: 'ui.post_actions_more.unpin', scope: 'own' },
  { id: 'edit', text: 'ui.post_actions_more.edit', scope: 'own' },
  { id: 'delete', text: 'ui.post_actions_more.delete', scope: 'own' },
  { id: 'mute', text: 'ui.post_actions_more.mute', scope: 'others' },
  { id: 'block', text: 'ui.post_actions_more.block', scope: 'others' },
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
  const t = useT();
  const rows = rowsFor(lines, own);
  if (rows.length === 0) {
    return null;
  }
  return (
    <MenuButton
      glyph="⋯"
      items={rows.map((row) => ({ id: row.id, label: t(row.text) }))}
      label={t('ui.post_actions_more.menu', { label })}
      onSelect={(id) => {
        for (const row of rows.filter((candidate) => candidate.id === id)) {
          onAction(row.line);
        }
      }}
    />
  );
}
