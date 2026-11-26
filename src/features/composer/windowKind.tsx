/**
 * The `composer` window kind (decision 13, WFE-198): the composer as a pane
 * view. Its ref is `{ kind: 'composer', accountKey: <posting account>, target:
 * <draft number> }`, titled `compose` or `compose/<n>` (src/state/composerWindow);
 * the form is the shared one (src/views/ComposerForm) with a "Post as"
 * picker (./PostAs). Plain text typed at the command line while it is focused is
 * not a post: it goes into the composer's text, the way the command line is
 * "one way to use" the composer — the form's `[ send ]` is what posts.
 */

import { ComposerWindow } from './ComposerWindow';
import { t } from '../../i18n/translate';
import { accountByKey } from '../../state/selectors';
import type { WindowKindDefinition } from '../../state/windowKind';

/** The self-registered definition src/app/windowKinds.ts collects. */
export const windowKind: WindowKindDefinition = {
  kind: 'composer',
  topic: (window, state) => {
    const handle = accountByKey(state, window.ref.accountKey)?.handle;
    return handle === undefined
      ? t('features.composer.topic')
      : t('features.composer.topic_as', { handle });
  },
  Component: ComposerWindow,
  onPost: async (draft, win, context) => {
    context.dispatch({ type: 'composerAppend', windowId: win.id, text: draft.text });
    return await Promise.resolve(null);
  },
};
