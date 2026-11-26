/**
 * Tests for the React side: `useT` follows the language in use and re-renders
 * when it changes, `<html lang>` follows it too, and a component without a
 * provider reads English.
 */
import { act, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { I18nProvider, useT } from './I18nProvider';
import { FAKE_LOCALE, installFakeLocale, resetFakeLocale } from '../test/i18n';

/** A line of the refusal, as a component shows it. */
function Refusal(): JSX.Element {
  const t = useT();
  return <p>{t('commands.not_signed_in_as', { handle: 'zzz', count: 0, accounts: '' })}</p>;
}

/** The English sentence for no account signed in. */
const ENGLISH =
  "You aren't signed in as zzz. No account is signed in. Type /connect to add an account.";

/** Show the refusal under the provider. */
function renderRefusal(): void {
  render(
    <I18nProvider>
      <Refusal />
    </I18nProvider>,
  );
}

/** Switch to a fake language whose refusal reads `XX zzz nobody`. */
function switchToFake(): void {
  act(() => {
    installFakeLocale({
      commands: {
        not_signed_in_as: 'XX {handle} {count, plural, =0 {nobody} other {{accounts}}}',
      },
    });
  });
}

describe(I18nProvider, () => {
  it('shows English on <html lang="en"> to begin with', () => {
    renderRefusal();

    expect(screen.getByText(ENGLISH)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('re-renders its tree when the language changes and puts it on <html lang>', () => {
    renderRefusal();

    switchToFake();

    expect(screen.getByText('XX zzz nobody')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe(FAKE_LOCALE);
  });

  it('goes back to English with the language', () => {
    renderRefusal();
    switchToFake();

    act(() => {
      resetFakeLocale();
    });

    expect(screen.getByText(ENGLISH)).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('gives a component without a provider the English text', () => {
    render(<Refusal />);

    expect(screen.getByText(ENGLISH)).toBeInTheDocument();
  });
});
