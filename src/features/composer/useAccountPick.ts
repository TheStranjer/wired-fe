/**
 * The "Post as" picker's action for one composer window (decision 13, WFE-205):
 * the window moves to the picked account, so the limit and the audiences offered
 * follow it. An audience that account's instance does not serve (`local` on
 * Mastodon) falls back to the reader's default, an open poll is fitted to the
 * new instance's limits (WFE-206), and the attachments, which
 * belong to the account that uploaded them, come off the draft with a warning
 * in the window.
 */

import { t } from '../../i18n/translate';
import { printAction } from '../../state/appState';
import { composerFields, composerLimits } from '../../state/composerActions';
import { fitPoll } from '../../state/pollEditor';
import { useAppDispatch, useAppState } from '../../state/StateContext';

/** The picker's callback for window {@link windowId}: {@link hasMedia} says whether attachments wait. */
export function useAccountPick(windowId: string, hasMedia: boolean): (key: string) => void {
  const state = useAppState();
  const dispatch = useAppDispatch();
  return (key) => {
    const next = composerLimits(state, key);
    dispatch({ type: 'windows', action: { type: 'setAccount', id: windowId, accountKey: key } });
    const { poll, visibility } = composerFields(state, windowId);
    if (poll !== undefined) {
      dispatch({
        type: 'composerEdit',
        windowId,
        patch: { poll: fitPoll(poll, next.pollLimits) },
      });
    }
    if (visibility === 'local' && !next.allowLocal) {
      dispatch({
        type: 'composerEdit',
        windowId,
        patch: { visibility: state.settings.defaultVisibility },
      });
    }
    if (hasMedia) {
      dispatch({ type: 'composerMediaClear', windowId });
      dispatch(printAction(windowId, 'warn', t('features.composer.attachments_removed')));
    }
  };
}
