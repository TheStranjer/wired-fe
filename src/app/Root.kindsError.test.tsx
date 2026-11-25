/**
 * The failure path the real features folder cannot show: when collecting the
 * window kinds fails, the shell prints the reason into the status window
 * exactly once, on mount. A test-local reader of the active buffer makes the
 * printed line visible, since no window kind can render it while the load
 * itself has failed.
 */
import { render, screen, within } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { activeBuffer } from '../state/selectors';
import { AppStateProvider, useAppState } from '../state/StateContext';

vi.mock(import('./windowKinds'), () => ({
  loadWindowKinds: () => ({ ok: false, error: 'boom: no windowKind' }),
}));

/** Startup has its own tests; the shell tests do not boot the session. */
vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Shows every system line of the active window's buffer as text. */
function BufferReader(): JSX.Element {
  const { lines } = activeBuffer(useAppState());
  const texts = lines.map((line) => (line.kind === 'system' ? line.text : line.key));
  return <output aria-label="buffer">{texts.join('\n')}</output>;
}

describe(Root, () => {
  it('prints the window-kind load error into the status buffer once', () => {
    render(
      <AppStateProvider>
        <Root />
        <BufferReader />
      </AppStateProvider>,
    );

    const buffer = screen.getByRole('status', { name: 'buffer' });

    expect(within(buffer).getAllByText('boom: no windowKind')).toHaveLength(1);
    expect(screen.getByRole('alertdialog', { name: 'Error' })).toHaveAccessibleDescription(
      'boom: no windowKind',
    );
  });
});
