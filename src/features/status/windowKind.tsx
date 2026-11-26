/**
 * The `status` window kind (AGENTS.md "Windows, like IRC buffers"): window 1,
 * the client-message buffer every session starts at (src/windows/model.ts).
 * It shows the status window's own scrollback through the shared BufferView;
 * it belongs to no account, so plain text typed into it posts as the posting
 * account (src/state/postAccountless), or asks which one (WFE-284).
 */
import type { JSX } from 'react';

import { buildConfig } from '../../config/config';
import { useT } from '../../i18n/I18nProvider';
import { t } from '../../i18n/translate';
import { postAccountless } from '../../state/postAccountless';
import type { WindowKindDefinition } from '../../state/windowKind';
import { BufferView } from '../../views/BufferView';

/**
 * Render window 1: the status buffer's lines, oldest first. The label is the
 * accessible name of the log region BufferView opens.
 */
function StatusWindow({ windowId }: { readonly windowId: string }): JSX.Element {
  const label = useT()('features.status.log_label');
  return <BufferView windowId={windowId} label={label} />;
}

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'status',
  topic: () => t('features.status.topic', { appName: buildConfig.appName }),
  Component: StatusWindow,
  onPost: postAccountless,
};
