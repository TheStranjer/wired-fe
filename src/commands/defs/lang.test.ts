/**
 * Tests for /lang (WFE-310): bare it prints the language in use, where it
 * came from and every language; a code, a native name or an English name sets
 * the setting; `auto` clears it; anything else is refused with the choices;
 * `--pick` opens the list; and the summary and usage follow the language.
 */
import { describe, expect, it, vi, type Mock } from 'vitest';

import { command } from './lang';
import { type AppState, initialAppState } from '../../state/appState';
import { DEFAULT_SETTINGS } from '../../state/settings';
import { fakeCommandContext } from '../../test/commandContext';
import { installFakeLocale } from '../../test/i18n';
import type { CommandContext } from '../types';

/** A context over a session whose language setting is {@link language}, print recorded. */
function contextWith(language: 'de' | null = null): {
  readonly context: CommandContext;
  readonly print: Mock<CommandContext['print']>;
  readonly dispatch: Mock<CommandContext['dispatch']>;
} {
  const state: AppState = initialAppState({ ...DEFAULT_SETTINGS, language });
  const print: Mock<CommandContext['print']> = vi.fn();
  const dispatch: Mock<CommandContext['dispatch']> = vi.fn();
  return { context: fakeCommandContext({ state, print, dispatch }), print, dispatch };
}

/** The lines printed. */
function lines(print: Mock<CommandContext['print']>): readonly string[] {
  return print.mock.calls.map(([text]) => text);
}

/** The listing every language gets. */
const LISTING = [
  'Available languages:',
  '  en — English — English',
  '  es — Español — Spanish',
  '  ru — Русский — Russian',
  '  ja — 日本語 — Japanese',
  '  zh-Hans — 简体中文 — Chinese',
  '  de — Deutsch — German',
];

describe('/lang', () => {
  it('is /lang with the alias /language and a summary and usage in English', () => {
    expect(command.name).toBe('lang');
    expect(command.aliases).toStrictEqual(['language']);
    expect(command.summary).toBe('Show or choose the interface language');
    expect(command.usage).toBe('/lang [code|name|auto]');
  });

  it('reads its summary and usage in the language in use', () => {
    installFakeLocale({
      commands: { defs: { lang: { summary: 'XX summary', usage: 'XX usage' } } },
    });

    expect(command.summary).toBe('XX summary');
    expect(command.usage).toBe('XX usage');
  });

  it('prints the language from the browser and every language when given nothing', async () => {
    const { context, print, dispatch } = contextWith();

    const outcome = await command.run('', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(lines(print)).toStrictEqual(['Language: English (en), from the browser', ...LISTING]);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('says the setting is where the language came from', async () => {
    const { context, print } = contextWith('de');

    await command.run('', context);

    expect(lines(print)[0]).toBe('Language: Deutsch (de), from your setting');
  });

  it('says the fallback when the browser names no supported language', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-CA']);
    const { context, print } = contextWith();

    await command.run('', context);

    expect(lines(print)[0]).toBe('Language: English (en), from the fallback');
  });

  it.each([
    ['de', 'de', 'Deutsch'],
    ['DE', 'de', 'Deutsch'],
    ['de-AT', 'de', 'Deutsch'],
    ['zh', 'zh-Hans', '简体中文'],
    ['zh-CN', 'zh-Hans', '简体中文'],
    ['zh-Hans', 'zh-Hans', '简体中文'],
    ['Deutsch', 'de', 'Deutsch'],
    ['日本語', 'ja', '日本語'],
    ['German', 'de', 'Deutsch'],
    ['german', 'de', 'Deutsch'],
    ['Chinese', 'zh-Hans', '简体中文'],
  ])('sets %s as %s', async (word, code, name) => {
    const { context, print, dispatch } = contextWith();

    const outcome = await command.run(word, context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'settings',
      settings: { language: code },
    });
    expect(lines(print)).toStrictEqual([`Language set to ${name} (${code})`]);
  });

  it('clears the setting for auto, in any case, and says what shows now', async () => {
    const { context, print, dispatch } = contextWith('de');

    const outcome = await command.run('Auto', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledExactlyOnceWith({
      type: 'settings',
      settings: { language: null },
    });
    expect(lines(print)).toStrictEqual([
      'Language setting cleared: now English (en), from the browser',
    ]);
  });

  it('refuses a word that names no language and lists the choices', async () => {
    const { context, print, dispatch } = contextWith();

    const outcome = await command.run('Klingon', context);

    expect(outcome).toStrictEqual({
      ok: false,
      message:
        'No language Klingon. Choose auto or one of: en — English — English; es — Español — Spanish; ru — Русский — Russian; ja — 日本語 — Japanese; zh-Hans — 简体中文 — Chinese; de — Deutsch — German',
    });
    expect(dispatch).not.toHaveBeenCalled();
    expect(print).not.toHaveBeenCalled();
  });

  it('opens the list of languages for --pick, in the place of the start menu', async () => {
    const { context, print, dispatch } = contextWith();

    const outcome = await command.run('--pick', context);

    expect(outcome).toStrictEqual({ ok: true });
    expect(dispatch.mock.calls).toStrictEqual([
      [{ type: 'startMenu', open: false }],
      [{ type: 'languageMenu', open: true }],
    ]);
    expect(print).not.toHaveBeenCalled();
  });

  it('binds Ctrl+b Shift+l in both modes and Shift+l in navigation mode, all to --pick', () => {
    expect(command.bindings).toStrictEqual([
      { mode: 'insert', chord: 'Ctrl+b Shift+l', args: '--pick' },
      { mode: 'navigation', chord: 'Ctrl+b Shift+l', args: '--pick' },
      { mode: 'navigation', chord: 'Shift+l', args: '--pick' },
    ]);
  });
});
