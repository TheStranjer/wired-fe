/**
 * Tests for the shell persisting settings: Root calls ./useSettingsPersistence,
 * so a `/set effects on` typed at the command line reaches the reducer and the
 * new record lands in storage under its namespaced key; a session that changes
 * nothing writes nothing at all. The shell's own stores are the shared ones
 * over `localStorage`, so the assertions read the same namespace back through
 * the storage module. Startup has its own tests; this file stubs it, so only
 * the command line's own settings dispatch is at play.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { initialAppState } from '../state/appState';
import { SettingsSchema } from '../state/settings';
import { AppStateProvider } from '../state/StateContext';
import { createStore } from '../storage/store';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** The settings store the shared app stores carry: the same namespace, read back. */
const settingsStore = createStore('settings');

/** Types {@link text} at the command line and presses Enter. */
function submit(text: string): void {
  const input = screen.getByRole('textbox', { name: 'Command line' });
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: 'Enter' });
}

/** Render the shell over a fresh, undisturbed session. */
function renderShell(): void {
  render(
    <AppStateProvider initial={initialAppState()}>
      <Root />
    </AppStateProvider>,
  );
}

describe('the shell persisting settings', () => {
  beforeEach(() => {
    settingsStore.remove('settings');
  });

  it('writes the new record once /set has turned a knob', async () => {
    renderShell();

    submit('/set effects on');

    const echo = await screen.findByText('effects = on');

    expect(echo).toBeInTheDocument();
    expect(settingsStore.get('settings', SettingsSchema)).toStrictEqual({
      avatars: true,
      clockFormat: '24h',
      defaultVisibility: 'public',
      density: 'cards',
      effects: true,
      expandMedia: false,
      feeds: [],
      images: true,
      keyOverrides: [],
      openIn: 'here',
      openInByKind: {},
      postAs: null,
      replyIn: 'split',
      streamMade: false,
      theme: 'wired',
    });
  });

  it('writes nothing for a session that changes nothing', () => {
    renderShell();

    expect(settingsStore.get('settings', SettingsSchema)).toBeUndefined();
  });
});
