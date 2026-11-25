/**
 * The `dm` window kind (AGENTS.md "Windows, like IRC buffers", WFE-108): one
 * private conversation, the buffer `/query` opens. ./DmWindow shows it — the
 * stored thread ./useDirect fills once, with an input box docked under it
 * (WFE-207); the topic line says plainly who the window is private with —
 * `private conversation with @<handle>` — and the log region carries the
 * window's title (`dm/<handle>`, the way /query opened it). Plain text typed
 * at the command line keeps the conversation going the way the box does: see
 * ./directDraft for what a post here says. A status sent here while a `/dm`
 * ran is echoed into this same window by src/commands/defs/dm.
 */

import { mentionOf, postDirect } from './directDraft';
import { DmWindow } from './DmWindow';
import type { WindowKindDefinition } from '../../state/windowKind';

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'dm',
  topic: (window) => {
    const mention = mentionOf(window.ref.target);
    return mention === '' ? 'dm' : `private conversation with ${mention}`;
  },
  Component: DmWindow,
  onPost: postDirect,
};
