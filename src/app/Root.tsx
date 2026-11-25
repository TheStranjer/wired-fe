/**
 * The shell wired to real state (AGENTS.md "Windows, like IRC buffers"): every
 * region is drawn from the app state the AppStateProvider above holds. The
 * active window's kind decides its topic, its scrollback and its side pane of
 * who is in the window (./SidePane, WFE-133); the window list, the active
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

import { CommandLine } from './CommandLine';
import { DesktopView } from './DesktopView';
import { KINDS } from './loadedKinds';
import { appRegistry } from './registry';
import { Shell } from './Shell';
import { SidePane } from './SidePane';
import { StatusBar, accountLabel } from './StatusBar';
import { appStores } from './stores';
import { useAttachments } from './useAttachments';
import { useCompletionProviders } from './useCompletionProviders';
import { useComposerOverlay } from './useComposerOverlay';
import { useDocumentTitle } from './useDocumentTitle';
import { useDropAndPaste } from './useDropAndPaste';
import { useHashRoute } from './useHashRoute';
import { usePostActionsApi } from './usePostActionsApi';
import { useRouteOverlays } from './useRouteOverlays';
import { useSettingsPersistence } from './useSettingsPersistence';
import { useStartup } from './useStartup';
import { useTheme } from './useTheme';
import { windowTopic } from './WindowBody';
import { usePendingKeys } from '../keys/useGlobalKeys';
import type { Result } from '../lib/result';
import { type AppState, printAction } from '../state/appState';
import { useAppDispatch, useAppState } from '../state/StateContext';
import { TopicBar } from '../ui/TopicBar';
import { PostActionsProvider } from '../views/PostActionsContext';
import { useStreams } from '../views/useStreams';
import { STATUS_WINDOW_ID, activeWindow } from '../windows/model';
import type { WindowState } from '../windows/model';

/** The one load of the command registry every mount shares. */
const REGISTRY = appRegistry();

/** Props of the topic bar: the active window, and all of state. */
type RegionProps = {
  readonly win: WindowState;
  readonly state: AppState;
};

/** Why {@link loaded} could not be loaded, or null when it could. */
function failure<E>(loaded: Result<unknown, E>): E | null {
  return loaded.ok ? null : loaded.error;
}

/** The topic bar: the window's title, its account and its kind's topic. */
function Topic(props: RegionProps): JSX.Element {
  const { win, state } = props;
  return (
    <TopicBar
      windowTitle={win.title}
      accountLabel={accountLabel(state, win.ref.accountKey)}
      topic={windowTopic(win, state)}
    />
  );
}

/** Mirrors settings and window state out to storage, the theme and the tab title. */
function useStateMirrors(state: AppState): void {
  useSettingsPersistence(state.settings, appStores().settings);
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

/** The five shell regions, filled from the app state above it. */
export function Root(): JSX.Element {
  const state = useAppState();
  const active = activeWindow(state.windows);
  const providers = useCompletionProviders();
  const attachments = useAttachments();
  const drop = useDropAndPaste(attachments);
  const composer = useComposerOverlay(attachments);
  const pendingKeys = usePendingKeys(state.mode);
  const ready = useStartup();
  useHashRoute(ready);
  const overlays = useRouteOverlays(ready);
  useStateMirrors(state);
  useStreams();
  const postActions = usePostActionsApi();

  useLoadFailures();

  return (
    <PostActionsProvider actions={postActions.actions}>
      <Shell
        topic={<Topic win={active} state={state} />}
        scrollback={<DesktopView />}
        scrollbackLabel={`Desktop ${String(state.layout.active + 1)}`}
        sidePane={<SidePane win={active} />}
        statusLine={
          <StatusBar pendingMedia={attachments.pending.length} pendingKeys={pendingKeys.prefix} />
        }
        input={
          <CommandLine
            attachments={attachments}
            pendingKeys={pendingKeys}
            completion={providers}
            openComposer={composer.openComposer}
            registerRunner={postActions.register}
          />
        }
      />
      {composer.overlay}
      {overlays}
      {drop}
      {attachments.input}
    </PostActionsProvider>
  );
}
