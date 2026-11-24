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

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { CommandLine } from './CommandLine';
import { appRegistry } from './registry';
import { Shell } from './Shell';
import { SidePane } from './SidePane';
import { StatusBar, accountLabel } from './StatusBar';
import { appStores } from './stores';
import { useAttachments } from './useAttachments';
import { useComposerOverlay } from './useComposerOverlay';
import { useDocumentTitle } from './useDocumentTitle';
import { useDropAndPaste } from './useDropAndPaste';
import { useHashRoute } from './useHashRoute';
import { useRouteOverlays } from './useRouteOverlays';
import { useSettingsPersistence } from './useSettingsPersistence';
import { useStartup } from './useStartup';
import { useTheme } from './useTheme';
import { loadWindowKinds } from './windowKinds';
import { type Provider, commandProvider } from '../commands/complete';
import type { Result } from '../lib/result';
import type { ClockFormat } from '../lib/time';
import { type AppState, printAction } from '../state/appState';
import { useAppDispatch, useAppState } from '../state/StateContext';
import type { WindowKindDefinition } from '../state/windowKind';
import { Scrollback } from '../ui/Scrollback';
import { SystemLine } from '../ui/SystemLine';
import { TopicBar } from '../ui/TopicBar';
import { emojiProvider, handleProvider, tagProvider } from '../views/completionProviders';
import { useCustomEmojis } from '../views/useCustomEmojis';
import { useStreams } from '../views/useStreams';
import { STATUS_WINDOW_ID, activeWindow } from '../windows/model';
import type { WindowKind, WindowState } from '../windows/model';

/** The one loads every mount shares: the window kinds and the command registry. */
const KINDS = loadWindowKinds();
const REGISTRY = appRegistry();

/** The kind map the shell draws from; empty when the load failed. */
const WINDOW_KINDS: ReadonlyMap<WindowKind, WindowKindDefinition> = KINDS.ok
  ? KINDS.value
  : new Map();

/** What the scrollback says when the window's kind has no component. */
const NO_VIEW = 'No view for this window';

/** Props of the two regions that draw the active window, and all of state. */
type RegionProps = {
  readonly win: WindowState;
  readonly state: AppState;
};

/** Why {@link loaded} could not be loaded, or null when it could. */
function failure<E>(loaded: Result<unknown, E>): E | null {
  return loaded.ok ? null : loaded.error;
}

/** The active account's instance's custom emoji list, as ./useCustomEmojis answers it. */
type EmojiList = ReturnType<typeof useCustomEmojis>;

/**
 * The words Tab may complete to (decision 6, WFE-124): commands from the one
 * registry first, then what the buffers have seen and what the account's
 * instance serves; without a loadable registry there are no commands to
 * offer, and the rest stands on its own.
 */
function completionProviders(state: AppState, emojis: EmojiList): readonly Provider[] {
  const seen = [handleProvider(state), tagProvider(state), emojiProvider(emojis)];
  return REGISTRY.ok ? [commandProvider(REGISTRY.value), ...seen] : seen;
}

/** The topic bar: the window's title, its account and its kind's topic. */
function Topic(props: RegionProps): JSX.Element {
  const { win, state } = props;
  const kind = WINDOW_KINDS.get(win.ref.kind);
  return (
    <TopicBar
      windowTitle={win.title}
      accountLabel={accountLabel(state, win.ref.accountKey)}
      topic={kind === undefined ? '' : kind.topic(win, state)}
    />
  );
}

/** The stand-in scrollback for a window whose kind never loaded. */
function NoView(props: { readonly title: string; readonly clockFormat: ClockFormat }): JSX.Element {
  const [date] = useState(() => new Date());
  return (
    <Scrollback label={props.title}>
      <SystemLine clockFormat={props.clockFormat} date={date} level="error" text={NO_VIEW} />
    </Scrollback>
  );
}

/** The scrollback: the active window kind's own component, or a notice. */
function WindowBody(props: RegionProps): JSX.Element {
  const { win, state } = props;
  const kind = WINDOW_KINDS.get(win.ref.kind);
  if (kind === undefined) {
    return <NoView clockFormat={state.settings.clockFormat} title={win.title} />;
  }
  const Body = kind.Component;
  return <Body windowId={win.id} />;
}

/** Mirrors settings and window state out to storage, the theme and the tab title. */
function useStateMirrors(state: AppState): void {
  useSettingsPersistence(state.settings, appStores().settings);
  useTheme(state.settings.theme, state.settings.effects);
  useDocumentTitle(state.windows);
}

/** The five shell regions, filled from the app state above it. */
export function Root(): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const active = activeWindow(state.windows);
  const emojis = useCustomEmojis(state.activeAccountKey);
  const attachments = useAttachments();
  const drop = useDropAndPaste(attachments);
  const composer = useComposerOverlay(attachments);
  const ready = useStartup();
  useHashRoute(ready);
  const overlays = useRouteOverlays(ready);
  useStateMirrors(state);
  useStreams();

  useEffect(() => {
    for (const reason of [failure(KINDS), failure(REGISTRY)]) {
      if (reason !== null) {
        dispatch(printAction(STATUS_WINDOW_ID, 'error', reason));
      }
    }
  }, [dispatch]);

  return (
    <>
      <Shell
        topic={<Topic win={active} state={state} />}
        scrollback={<WindowBody win={active} state={state} />}
        sidePane={<SidePane win={active} />}
        statusLine={<StatusBar pendingMedia={attachments.pending.length} />}
        input={
          <CommandLine
            attachments={attachments}
            completion={completionProviders(state, emojis)}
            openComposer={composer.openComposer}
          />
        }
      />
      {composer.overlay}
      {overlays}
      {drop}
      {attachments.input}
    </>
  );
}
