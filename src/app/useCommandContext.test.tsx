/**
 * Tests for the context the app builds for one render: printing into the active
 * window at the asked level, the window list and the actions commands ask it
 * for, clearing the active window, refusing to post where no shipped window
 * kind takes posts, the command line's text, and the page, config, registry,
 * stores and clock commands read. The kinds are the real ones: status and home,
 * and only that second one posts. How posting reaches a kind that does
 * answer is in useCommandContext.post.test.tsx.
 */
import { act, renderHook } from '@testing-library/react';
import type { RenderHookResult } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { appRegistry } from './registry';
import { appStores } from './stores';
import { useCommandContext } from './useCommandContext';
import type { CommandContext, Registry } from '../commands/types';
import { buildConfig } from '../config/config';
import type { AppState } from '../state/appState';
import type { SystemLineData } from '../state/buffer';
import type { AppAction } from '../state/reducer';
import { bufferFor } from '../state/selectors';
import { useAppState } from '../state/StateContext';
import { seeded, stateAfter } from '../test/appSessions';
import { fakeAttachments } from '../test/commandContext';
import { STATUS_WINDOW_ID, windowId } from '../windows/model';
import type { WindowKind, WindowRef, WindowState } from '../windows/model';
import type { WindowsAction } from '../windows/reducer';

/** The home window these tests open: src/features/home implements its kind. */
const HOME: WindowRef = { kind: 'home', accountKey: null, target: null };

/**
 * A window whose kind no shipped feature implements, so it takes no posts.
 * Every kind in the union now has a definition, so reaching that branch
 * takes a kind the model could carry tomorrow but no feature answers today.
 */
const NO_KIND: WindowRef = {
  kind: 'phantom' as unknown as WindowKind,
  accountKey: null,
  target: '7',
};

/** The message a window whose kind takes no posts gets back. */
const NO_POST = "You can't post in this window. Try /home";

/** The pending-media stub every context built here carries. */
const NO_MEDIA = fakeAttachments();

/** The hook's two halves: the context under test and the state it dispatches into. */
type Hook = { readonly context: CommandContext; readonly state: AppState };

/** One action for the window list. */
function win(action: WindowsAction): AppAction {
  return { type: 'windows', action };
}

/** The system lines of window {@link id}, oldest first. */
function systemLines(state: AppState, id: string = STATUS_WINDOW_ID): readonly SystemLineData[] {
  return bufferFor(state, id).lines.filter(
    (line): line is SystemLineData => line.kind === 'system',
  );
}

/** The registry the app built; the tests need it to exist. */
function registry(): Registry {
  const built = appRegistry();
  if (!built.ok) {
    throw new Error(built.error);
  }
  return built.value;
}

/** Renders the hook over a session built from {@link actions}. */
function renderContext(
  actions: readonly AppAction[],
  setInput: (text: string) => void,
  line = '',
): RenderHookResult<Hook, unknown> {
  return renderHook(
    () => ({ context: useCommandContext(setInput, NO_MEDIA, line), state: useAppState() }),
    { wrapper: seeded(actions) },
  );
}

describe(useCommandContext, () => {
  it('prints into the active window at info when told no level', () => {
    const { result } = renderContext([], vi.fn());

    act(() => {
      result.current.context.print('hello');
    });

    expect(systemLines(result.current.state)).toStrictEqual([
      expect.objectContaining({ level: 'info', text: 'hello' }),
    ]);
  });

  it('prints at the level it is given, into the window that is active', () => {
    const opened = [win({ type: 'open', ref: HOME, title: 'home' })];
    const { result } = renderContext(opened, vi.fn());

    act(() => {
      result.current.context.print('careful', 'warn');
    });

    expect(systemLines(result.current.state, windowId(HOME))).toStrictEqual([
      expect.objectContaining({ level: 'warn', text: 'careful' }),
    ]);
    expect(systemLines(result.current.state)).toStrictEqual([]);
  });

  it('hands commands the window list as it stands', () => {
    const opened = [win({ type: 'open', ref: HOME, title: 'home' })];
    const { context } = renderContext(opened, vi.fn()).result.current;
    const titles = context.windows.windows.map((entry: WindowState) => entry.title);

    expect(titles).toStrictEqual(['status', 'home']);
  });

  it('asks the window layer for the change a command wants', () => {
    const { result } = renderContext([], vi.fn());

    act(() => {
      result.current.context.dispatchWindows({ type: 'open', ref: HOME, title: 'home' });
    });

    expect(result.current.state.windows.activeId).toBe(windowId(HOME));
  });

  it('clears the scrollback of the active window', () => {
    const line: AppAction = {
      type: 'print',
      windowId: null,
      date: new Date(),
      level: 'info',
      text: 'away it goes',
    };
    const { result } = renderContext([line], vi.fn());

    expect(systemLines(result.current.state)).toHaveLength(1);

    act(() => {
      result.current.context.clearActiveWindow();
    });

    expect(systemLines(result.current.state)).toStrictEqual([]);
  });

  it('refuses to post in the status window', async () => {
    const { context } = renderContext([], vi.fn()).result.current;

    await expect(context.post({ text: 'hello world' })).resolves.toBe(NO_POST);
  });

  it('refuses to post in a window whose kind no feature implements', async () => {
    const opened = [win({ type: 'open', ref: NO_KIND, title: 'phantom' })];
    const { context } = renderContext(opened, vi.fn()).result.current;

    await expect(context.post({ text: 'hello world' })).resolves.toBe(NO_POST);
  });

  it('rewrites the command line through the setter it was handed', () => {
    const setInput = vi.fn();
    const { context } = renderContext([], setInput).result.current;

    context.setInput('/dm @lain@wired.example hi');

    expect(setInput).toHaveBeenCalledWith('/dm @lain@wired.example hi');
  });

  it('carries the text the command line holds', () => {
    const { context } = renderContext([], vi.fn(), 'a long draft').result.current;

    expect(context.line).toBe('a long draft');
  });

  it('navigates by giving the page a new address', () => {
    const { context } = renderContext([], vi.fn()).result.current;
    const before = window.location.hash;

    context.navigate('#/@lain@wired.example');

    expect(window.location.hash).toBe('#/@lain@wired.example');

    window.location.hash = before;
  });

  it('carries the page it is on and the configuration it was built with', () => {
    const { context } = renderContext([], vi.fn()).result.current;

    expect(context.page).toStrictEqual({
      origin: window.location.origin,
      pathname: window.location.pathname,
    });
    expect(context.config).toBe(buildConfig);
  });

  it('carries every command while nobody is signed in, the one stores and a live clock', () => {
    const { context } = renderContext([], vi.fn()).result.current;

    expect(context.registry.commands.map((definition) => definition.name)).toStrictEqual(
      registry().commands.map((definition) => definition.name),
    );
    expect(context.stores).toBe(appStores());
    expect(context.now()).toBeInstanceOf(Date);
    expect(context.state).toStrictEqual(stateAfter([]));
    expect(context.attachments).toBe(NO_MEDIA);
  });
});
