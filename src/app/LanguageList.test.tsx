/**
 * Tests for the language list (WFE-310): one row per language with its own
 * name and its English name beside it, whatever the language in use, and a
 * row that clears the choice; a row runs `/lang <code>`; one tab stop, moved
 * with the menu's keys; the labels follow the language in use.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, type Mock } from 'vitest';

import { LanguageList } from './LanguageList';
import { I18nProvider } from '../i18n/I18nProvider';
import { installFakeLocale } from '../test/i18n';
import type { PostActionLine } from '../ui/postActionTypes';

/** Draws the list and answers the spy its rows run through. */
function show(): Mock<(line: PostActionLine) => void> {
  const run = vi.fn<(line: PostActionLine) => void>();
  render(
    <I18nProvider>
      <LanguageList run={run} />
    </I18nProvider>,
  );
  return run;
}

/** The row called `name`. */
function row(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

describe(LanguageList, () => {
  it('lists every language by its own name with the English name beside it, and Automatic', () => {
    show();

    const names = screen.getAllByRole('button').map((one) => one.textContent);

    expect(names).toStrictEqual([
      'English English',
      'Español Spanish',
      'Русский Russian',
      '日本語 Japanese',
      '简体中文 Chinese',
      'Deutsch German',
      'Automatic ',
    ]);
    expect(screen.getByRole('toolbar', { name: 'Choose the interface language' })).toBeVisible();
  });

  it('marks each native name with its own language', () => {
    show();

    expect(screen.getByText('Deutsch')).toHaveAttribute('lang', 'de');
    expect(screen.getByText('简体中文')).toHaveAttribute('lang', 'zh-Hans');
    expect(screen.getByText('Automatic')).not.toHaveAttribute('lang');
  });

  it('runs /lang with the code of a row, and /lang auto for Automatic', () => {
    const run = show();

    fireEvent.click(row('Deutsch German'));
    fireEvent.click(row('简体中文 Chinese'));
    fireEvent.click(row('Automatic'));

    expect(run.mock.calls).toStrictEqual([
      [{ line: '/lang de', prefill: false }],
      [{ line: '/lang zh-Hans', prefill: false }],
      [{ line: '/lang auto', prefill: false }],
    ]);
  });

  it('puts one row in the tab order and moves it with the arrows, wrapping', () => {
    show();
    row('English English').focus();

    fireEvent.keyDown(row('English English'), { key: 'ArrowDown' });

    expect(row('Español Spanish')).toHaveFocus();
    expect(row('Español Spanish')).toHaveAttribute('tabindex', '0');
    expect(row('English English')).toHaveAttribute('tabindex', '-1');

    fireEvent.keyDown(row('Español Spanish'), { key: 'ArrowUp' });
    fireEvent.keyDown(row('English English'), { key: 'ArrowUp' });

    expect(row('Automatic')).toHaveFocus();
  });

  it('jumps to a row by the first letter of its own name, and leaves Enter alone', () => {
    show();
    row('English English').focus();

    fireEvent.keyDown(row('English English'), { key: 'd' });

    expect(row('Deutsch German')).toHaveFocus();

    fireEvent.keyDown(row('Deutsch German'), { key: 'Enter' });

    expect(row('Deutsch German')).toHaveFocus();
  });

  it('keeps the native names in a fake language and translates the rest', () => {
    show();

    act(() => {
      installFakeLocale({ app: { language_auto: 'XX auto', language_list_label: 'XX list' } });
    });

    expect(screen.getByRole('toolbar', { name: 'XX list' })).toBeVisible();
    expect(row('XX auto')).toBeVisible();
    expect(row('Deutsch German')).toBeVisible();
  });
});
