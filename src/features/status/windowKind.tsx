/**
 * The `status` window kind (AGENTS.md "Windows, like IRC buffers"): window 1,
 * the client-message buffer every session starts at (src/windows/model.ts).
 * It shows the status window's own scrollback through the shared BufferView;
 * plain text typed into it posts nowhere, so the definition carries no
 * `onPost` — posting is not possible in this window.
 */
import type { JSX } from 'react';

import { buildConfig } from '../../config/config';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';

/**
 * Render window 1: the status buffer's lines, oldest first. The label is the
 * accessible name of the log region BufferView opens.
 */
function StatusWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  return <BufferView windowId={windowId} label="status" />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'status',
  topic: () => `${buildConfig.appName} — Present day. Present time.`,
  Component: StatusWindow,
};
