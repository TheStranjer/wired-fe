/**
 * Tests for the media tray and the attach button through the whole shell
 * (WFE-287): `[📎]` at the left of the command line opens the same file input
 * `/attach` does; the tray over the command line lists the pending media —
 * hidden while there are none — with a description input and `[x]` per row, a
 * failed upload shows its reason and can be removed, `[+N media]` focuses the
 * first description, and /detach empties the tray. Startup is mocked.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { choose, fileInput, ORIGIN, picture } from '../test/attachmentHarness';
import { server } from '../test/server';
import { attachOne, renderShell, serveInstance, submit } from '../test/trayHarness';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Render the whole shell over the harness's session. */
function renderRoot(): HTMLElement {
  return renderShell(<Root />);
}

describe('the media tray in the shell', () => {
  beforeEach(() => {
    serveInstance(200);
  });

  it('opens the file input from the attach button at the command line', () => {
    const container = renderRoot();
    const click = vi.spyOn(fileInput(container), 'click').mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('shows no tray while nothing waits', () => {
    renderRoot();

    expect(screen.queryByRole('list', { name: 'Pending media' })).toBeNull();
  });

  it('lists a chosen file with its thumbnail and state, and removes it', async () => {
    const tray = await attachOne(renderRoot());

    expect(within(tray).getByText('pixel.png')).toBeInTheDocument();
    expect(within(tray).getByText('ready')).toBeInTheDocument();
    expect(tray.querySelector('img')).toHaveAttribute('src', `${ORIGIN}/media/12-small.png`);

    fireEvent.click(within(tray).getByRole('button', { name: 'Remove pixel.png' }));

    expect(screen.queryByRole('list', { name: 'Pending media' })).toBeNull();
    expect(screen.queryByText('[+1 media]')).toBeNull();
  });

  it('shows a failed upload with its reason, and it can be removed', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () =>
        HttpResponse.json({ error: 'Too big' }, { status: 422 }),
      ),
    );
    choose(fileInput(renderRoot()), [picture('pixel.png')]);

    const tray = await screen.findByRole('list', { name: 'Pending media' });
    await within(tray).findByText(/^failed: /u);

    expect(screen.queryByText('[+1 media]')).toBeNull();

    fireEvent.click(within(tray).getByRole('button', { name: 'Remove pixel.png' }));

    expect(screen.queryByRole('list', { name: 'Pending media' })).toBeNull();
  });

  it('focuses the first description from the waiting-media button', async () => {
    await attachOne(renderRoot());

    fireEvent.click(screen.getByRole('button', { name: '1 media waiting, show' }));

    expect(screen.getByRole('textbox', { name: 'Description for pixel.png' })).toHaveFocus();
  });

  it('empties the tray on /detach', async () => {
    await attachOne(renderRoot());

    submit('/detach');

    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Pending media' })).toBeNull();
    });
  });
});
