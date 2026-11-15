/**
 * Shape test for the command context (decision 6): the shared stub builder
 * compiles only while CommandContext is exactly what src/test/commandContext
 * assembles — print, the registry and the windows widened with the app state,
 * the one dispatch, posting, the command line, navigation, the page, the
 * config and the stores — and these assertions pin what the builder leaves in
 * every field by default, so widening or renaming one shows up here too.
 */
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';

import type { CommandContext, PrintLevel } from './types';
import { fakeCommandContext } from '../test/commandContext';
import { TEST_DATE } from '../test/fixtures';

/** The schema settings values could be read back with. */
const NUMBER = v.number();

describe('CommandContext', () => {
  it('is print, the registry and the windows, which start at the status window', () => {
    const context: CommandContext = fakeCommandContext();

    expect(context.registry.commands).toStrictEqual([]);
    expect(context.windows.activeId).toBe('status');
    expect(context.state.mode).toBe('insert');
  });

  it('carries the app state its windows came from and a dispatch stub', () => {
    const context: CommandContext = fakeCommandContext();

    expect(context.windows).toBe(context.state.windows);

    context.dispatch({ type: 'mode', mode: 'navigation' });

    expect(context.dispatch).toHaveBeenCalledWith({ type: 'mode', mode: 'navigation' });
    expect(context.state.mode).toBe('insert');
  });

  it('posts through the active window reporting no error by default', async () => {
    const context: CommandContext = fakeCommandContext();

    await expect(context.post({ text: 'hello' })).resolves.toBeNull();
    expect(context.post).toHaveBeenCalledWith({ text: 'hello' });
  });

  it('has the example config, page and now the builder documents', () => {
    const context: CommandContext = fakeCommandContext();

    expect(context.config).toStrictEqual({
      appName: 'WIRED',
      instances: { mode: 'same-origin' },
    });
    expect(context.page).toStrictEqual({ origin: 'https://wired.example', pathname: '/' });
    expect(context.now().toISOString()).toBe(TEST_DATE);
  });

  it('reaches four independent stores that never touch anything real', () => {
    const context: CommandContext = fakeCommandContext();

    expect(context.stores.accounts.list()).toStrictEqual([]);
    expect(context.stores.settings.get('missing', NUMBER)).toBeUndefined();

    context.stores.settings.set('stored', 7);

    expect(context.stores.settings.get('stored', NUMBER)).toBe(7);
    expect(context.stores.login.get('stored', NUMBER)).toBeUndefined();
  });

  it('lets overrides replace single fields', () => {
    const print: (text: string, level?: PrintLevel) => void = () => undefined;
    const context: CommandContext = fakeCommandContext({ print });

    expect(context.print).toBe(print);
    expect(context.registry.commands).toStrictEqual([]);
    expect(context.windows.activeId).toBe('status');
  });
});
