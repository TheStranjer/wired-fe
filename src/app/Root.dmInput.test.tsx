/**
 * Tests for the DM window's docked input in the running shell (WFE-207):
 * Escape pressed in the box enters navigation mode and leaves the box, typing
 * in it afterwards starts insert mode again, and the command line still posts
 * into the DM window as before. Startup is mocked; the box itself is tested in
 * src/features/dm.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { AppStateProvider } from '../state/StateContext';
import { ALICE_REPLY, ORIGIN, dmState, serveDirect } from '../test/dmWindow';
import { status } from '../test/fixtures';
import { server } from '../test/server';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Render Root over alice's DM window, loaded, and wait for her thread. */
async function renderDm(): Promise<void> {
  serveDirect();
  server.use(
    http.get(`${ORIGIN}/api/v1/custom_emojis`, () => {
      return HttpResponse.json([]);
    }),
  );
  render(
    <AppStateProvider initial={dmState()}>
      <Root />
    </AppStateProvider>,
  );
  await screen.findByText('present time');
}

/** The box docked in the DM window. */
function box(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Post text' });
}

describe('the DM window’s input box in the shell', () => {
  it('Escape in the box enters navigation mode and leaves the box', async () => {
    await renderDm();
    act(() => {
      box().focus();
    });

    fireEvent.keyDown(box(), { key: 'Escape' });

    expect(screen.getByText('[NAV]')).toBeInTheDocument();
    expect(box()).not.toHaveFocus();
  });

  it('focusing the box in navigation mode types in insert mode again', async () => {
    await renderDm();
    fireEvent.keyDown(window, { key: 'Escape' });

    act(() => {
      box().focus();
    });

    expect(screen.getByText('[INS]')).toBeInTheDocument();
  });

  it('keeps posting the command line’s plain text into the conversation', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
        bodies.push(await request.json());

        return HttpResponse.json(
          status('42', { visibility: 'direct', content: '<p>from the line</p>' }),
        );
      }),
    );
    await renderDm();
    const line = screen.getByRole('combobox', { name: 'Command line' });

    fireEvent.change(line, { target: { value: 'from the line' } });
    fireEvent.keyDown(line, { key: 'Enter' });

    await screen.findByText('from the line');

    expect(bodies).toStrictEqual([
      {
        status: '@alice@other.example from the line',
        visibility: 'direct',
        in_reply_to_id: ALICE_REPLY.id,
      },
    ]);
  });
});
