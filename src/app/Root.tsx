/**
 * The shell wired to real state (AGENTS.md "Windows, like IRC buffers"):
 * every region is drawn from the app state the AppStateProvider above holds.
 * The active window's kind decides its topic and scrollback; the window list,
 * the active account, the clock and the hotkey mode fill the status line; the
 * command line (./CommandLine) is the shell's input region, handing every line
 * — typed or bound to a chord — to the dispatcher (decision 6), which runs a
 * command or posts the text through the active window's kind. The window kinds
 * and the command registry are each collected once, when this module loads; a
 * load that failed prints its reason into the status window once, on mount,
 * beside the one startup run (the greeting, the restored accounts and their
 * instances) that boots there. Root is also where Tab's completion providers
 * meet (WFE-124): the registry's commands, the handles and tags the buffers
 * have shown, and the active account's instance's custom emoji; the composer
 * overlay for long posts (WFE-125) opens above it all through ./useComposerOverlay,
 * and ./useAttachments holds the media waiting for the next post (WFE-126).
 */

import { useEffect, useState } from 'react';
import type { JSX } from 'react';

import { CommandLine } from './CommandLine';
import { appRegistry } from './registry';
import { Shell } from './Shell';
import { useAttachments } from './useAttachments';
import { useClock } from './useClock';
import { useComposerOverlay } from './useComposerOverlay';
import { useStartup } from './useStartup';
import { loadWindowKinds } from './windowKinds';
import { type Provider, commandProvider } from '../commands/complete';
import type { Result } from '../lib/result';
import type { ClockFormat } from '../lib/time';
import type { AppState } from '../state/appState';
import { accountByKey } from '../state/selectors';
import { useAppDispatch, useAppState } from '../state/StateContext';
import type { WindowKindDefinition } from '../state/windowKind';
import { Scrollback } from '../ui/Scrollback';
import { StatusLine } from '../ui/StatusLine';
import type { StatusLineWindow } from '../ui/StatusLine';
import { SystemLine } from '../ui/SystemLine';
import { TopicBar } from '../ui/TopicBar';
import { emojiProvider, handleProvider, tagProvider } from '../views/completionProviders';
import { useCustomEmojis } from '../views/useCustomEmojis';
import { STATUS_WINDOW_ID, activeWindow } from '../windows/model';
import type { WindowKind, WindowState } from '../windows/model';

/** The one load of the self-registered kinds, shared by every mount. */
const KINDS = loadWindowKinds();

/** The one command registry, shared by every mount. */
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

/** The account behind {@link key}, named the way the bars show it; null if none. */
function accountLabel(state: AppState, key: string | null): string | null {
  const account = accountByKey(state, key);
  return account === null ? null : `@${account.handle}`;
}

/** The status line's entries: every window, numbered in display order. */
function statusWindows(state: AppState): readonly StatusLineWindow[] {
  const active = activeWindow(state.windows);
  return state.windows.windows.map((win, index) => ({
    number: index + 1,
    title: win.title,
    unread: win.unread,
    highlight: win.highlight,
    active: win.id === active.id,
  }));
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

/** The status line: clock, active account, numbered windows, pending media and hotkey mode. */
function StatusBar(props: { readonly pendingMedia: number }): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const clock = useClock(state.settings.clockFormat);
  return (
    <StatusLine
      clock={clock}
      accountLabel={accountLabel(state, state.activeAccountKey)}
      windows={statusWindows(state)}
      mode={state.mode}
      pendingMedia={props.pendingMedia}
      onSelectWindow={(number: number) => {
        dispatch({ type: 'windows', action: { type: 'activateNumber', number } });
      }}
    />
  );
}

/** The five shell regions, filled from the app state above it. */
export function Root(): JSX.Element {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const active = activeWindow(state.windows);
  const emojis = useCustomEmojis(state.activeAccountKey);
  const attachments = useAttachments();
  const composer = useComposerOverlay(attachments);
  useStartup();

  useEffect(() => {
    for (const reason of [failure(KINDS), failure(REGISTRY)]) {
      if (reason !== null) {
        dispatch({
          type: 'print',
          windowId: STATUS_WINDOW_ID,
          date: new Date(),
          level: 'error',
          text: reason,
        });
      }
    }
  }, [dispatch]);

  return (
    <>
      <Shell
        topic={<Topic win={active} state={state} />}
        scrollback={<WindowBody win={active} state={state} />}
        sidePane={null}
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
      {attachments.input}
    </>
  );
}
