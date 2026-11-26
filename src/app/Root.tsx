/**
 * The shell wired to real state (AGENTS.md "Windows, like IRC buffers"): every
 * region is drawn from the app state the AppStateProvider above holds. The
 * header (./AppHeader) names the active account; every pane's title bar
 * carries its window's title, account and topic (./DesktopView); who is in a
 * window is the `people` window kind (src/features/people); the window list, the active
 * account, the clock and the hotkey mode fill the status line; the command
 * line (./CommandLine) hands every typed or chord-bound line to the
 * dispatcher (decision 6), which runs a command or posts through the window's
 * kind. The kinds and the registry load once when this module loads; a failed
 * load prints its reason into the status window on mount, beside the startup
 * run that boots there. The streaming connections (WFE-121) are opened by
 * ../views/useStreams. The ./use* hooks mounted below own every flow past
 * these five regions, WFE-134's tab title (./useDocumentTitle) and the hash
 * routes (./useHashRoute, decision 4) among them.
 */

import { useEffect } from 'react';
import type { JSX } from 'react';

import { AppHeader } from './AppHeader';
import { CommandLine } from './CommandLine';
import { CommandTray } from './CommandTray';
import { deskSource } from './deskSource';
import { DesktopView } from './DesktopView';
import { KINDS } from './loadedKinds';
import { appRegistry } from './registry';
import { Shell } from './Shell';
import { StatusBar } from './StatusBar';
import { appStores } from './stores';
import { useAttachments } from './useAttachments';
import { useCompletionProviders } from './useCompletionProviders';
import { useDeskPersistence } from './useDeskPersistence';
import { useDeskSync } from './useDeskSync';
import { useDocumentTitle } from './useDocumentTitle';
import { useDropAndPaste } from './useDropAndPaste';
import { useHashRoute } from './useHashRoute';
import { useLineRunnerApi } from './useLineRunnerApi';
import { usePostActionsApi } from './usePostActionsApi';
import { useRouteOverlays } from './useRouteOverlays';
import { useSettingsPersistence } from './useSettingsPersistence';
import { useShellModals } from './useShellModals';
import { useStartup } from './useStartup';
import { useTheme } from './useTheme';
import { usePendingKeys } from '../keys/useGlobalKeys';
import type { Result } from '../lib/result';
import { type AppState, printAction } from '../state/appState';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { LineRunnerProvider } from '../views/LineRunnerContext';
import { PostActionsProvider } from '../views/PostActionsContext';
import { useStreams } from '../views/useStreams';
import { STATUS_WINDOW_ID } from '../windows/model';

/** The one load of the command registry every mount shares. */
const REGISTRY = appRegistry();

/** Why {@link loaded} could not be loaded, or null when it could. */
function failure<E>(loaded: Result<unknown, E>): E | null {
  return loaded.ok ? null : loaded.error;
}

/** Mirrors settings and window state out to storage, the theme and the tab title. */
function useStateMirrors(state: AppState, ready: boolean): void {
  useSettingsPersistence(state.settings, appStores().settings);
  // A signed-out desk is never saved: the status-only desk would be restored after login and hide the stream.
  useDeskPersistence(state, deskSource(), ready && state.accounts.length > 0);
  useDeskSync(ready);
  useTheme(state.settings.theme, state.settings.effects);
  useDocumentTitle(state.windows);
}

/** Print why the kinds or the registry could not load into the status window, once on mount. */
function useLoadFailures(): void {
  const dispatch = useAppDispatch();
  useEffect(() => {
    for (const reason of [failure(KINDS), failure(REGISTRY)]) {
      if (reason !== null) {
        dispatch(printAction(STATUS_WINDOW_ID, 'error', reason));
      }
    }
  }, [dispatch]);
}

/** The shell regions, filled from the app state above it. */
export function Root(): JSX.Element {
  const state = useAppState();
  const providers = useCompletionProviders();
  const attachments = useAttachments();
  const drop = useDropAndPaste(attachments);
  const pendingKeys = usePendingKeys(state.mode);
  const ready = useStartup();
  useHashRoute(ready);
  const overlays = useRouteOverlays(ready);
  const modals = useShellModals(overlays.open);
  useStateMirrors(state, ready);
  useStreams();
  const postActions = usePostActionsApi();
  const lineRunner = useLineRunnerApi();

  useLoadFailures();

  return (
    <PostActionsProvider actions={postActions.actions}>
      <LineRunnerProvider runner={lineRunner.runner}>
        <Shell
          header={<AppHeader />}
          scrollback={<DesktopView />}
          scrollbackLabel={`Desktop ${String(state.layout.active + 1)}`}
          statusLine={<StatusBar attachments={attachments} pendingKeys={pendingKeys.prefix} />}
          tray={<CommandTray attachments={attachments} />}
          input={
            <CommandLine
              attachments={attachments}
              pendingKeys={pendingKeys}
              completion={providers}
              registerRunner={postActions.register}
              registerLineRunner={lineRunner.register}
            />
          }
        />
        {overlays.elements}
        {modals}
        {drop}
        {attachments.input}
      </LineRunnerProvider>
    </PostActionsProvider>
  );
}
