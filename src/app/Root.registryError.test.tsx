/**
 * The other load that can fail: when the command definitions cannot be built
 * into a registry, the shell says why in the status window exactly once, on
 * mount, and still renders the window and its command line as it always does.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { AppStateProvider } from '../state/StateContext';

/** The reason the mocked registry fails to build. */
const MESSAGE = './defs/x.ts does not export a command';

vi.mock(import('./registry'), () => ({
  appRegistry: () => ({ ok: false, error: './defs/x.ts does not export a command' }),
}));

describe(Root, () => {
  it('prints the registry error into the status buffer once', async () => {
    render(
      <AppStateProvider>
        <Root />
      </AppStateProvider>,
    );

    const line = await screen.findByText(MESSAGE);
    const log = screen.getByRole('log', { name: 'status' });

    expect(within(log).getAllByText(MESSAGE)).toHaveLength(1);
    expect(line).toBeInTheDocument();
  });
});
