/**
 * The upload loop behind the command line's pending media (WFE-126, WFE-287):
 * every file goes up in order as the active account, as a line of the command
 * line's own media (src/state/uploadLine), with `uploading …` printed before
 * it and `attached <name> (n/max)` or the reason it failed after. The cap is
 * the active account's instance's (decision 5), and files past it are refused
 * with a warning before anything is uploaded for them.
 */

import type { PrintLevel } from '../commands/types';
import { t } from '../i18n/translate';
import { type AppState, printAction } from '../state/appState';
import { COMMAND_LINE_MEDIA, composerMediaOf, heldCount, maxMedia } from '../state/composerMedia';
import type { Dispatch } from '../state/StateContext';
import { uploadLine } from '../state/uploadLine';

/** The session a list of files is uploaded into, and the alt text it was asked for. */
export type UploadSession = {
  readonly state: AppState;
  readonly dispatch: Dispatch;
  /** The alt text the picker was asked for; empty means none. */
  readonly description: string;
};

/** One client message into the active window, the way commands print. */
function printer(dispatch: Dispatch): (text: string, level: PrintLevel) => void {
  return (text, level) => {
    dispatch(printAction(null, level, text));
  };
}

/** Announce and upload one file; whether the instance accepted it (a refusal is printed). */
async function uploadOne(
  file: File,
  session: UploadSession,
  print: ReturnType<typeof printer>,
): Promise<boolean> {
  const { state, dispatch, description } = session;
  print(t('app.attach_uploading', { file: file.name }), 'info');
  const env = {
    state,
    dispatch,
    windowId: COMMAND_LINE_MEDIA,
    accountKey: state.activeAccountKey,
  };
  const outcome = await uploadLine(env, file, description);
  if (!outcome.ok) {
    print(outcome.error, 'error');
  }
  return outcome.ok;
}

/**
 * Upload {@link files} one after another, so the printed lines and the counts
 * stay in order: each is refused with a warning once the instance's cap is
 * reached, announced while it goes up, and — when the instance answers —
 * counted as `attached`. A failure prints what the instance said (its line in
 * the tray shows it too) and the loop moves on to the rest.
 */
export async function uploadFiles(files: readonly File[], session: UploadSession): Promise<void> {
  const { state, dispatch } = session;
  const print = printer(dispatch);
  const max = maxMedia(state, state.activeAccountKey);
  let attached = heldCount(composerMediaOf(state, COMMAND_LINE_MEDIA));
  for (const file of files) {
    if (attached >= max) {
      print(t('app.attach_too_many', { max, file: file.name }), 'warn');
    } else if (await uploadOne(file, session, print)) {
      attached += 1;
      print(t('app.attached', { file: file.name, attached, max }), 'info');
    }
  }
}
