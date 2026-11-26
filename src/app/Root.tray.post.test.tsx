/**
 * Tests for posting with the tray's media through the whole shell (WFE-287):
 * the description typed in the tray is put to the instance before the post goes
 * out and the tray is empty after it, a description the file already went up
 * with is not put again, and a refused description blocks the post, prints the
 * error and keeps the media and the text typed. Startup is mocked.
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Root } from './Root';
import { choose, fileInput, picture } from '../test/attachmentHarness';
import { attachOne, renderShell, seen, serveInstance, submit } from '../test/trayHarness';

vi.mock(import('./startup'), () => ({ runStartup: vi.fn() }));

/** Render the whole shell over the harness's session. */
function renderRoot(): HTMLElement {
  return renderShell(<Root />);
}

/** Type {@link text} into the description input of the pending file. */
function describePending(text: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Description for pixel.png' }), {
    target: { value: text },
  });
}

describe('posting with the media tray', () => {
  beforeEach(() => {
    serveInstance(200);
  });

  it('puts the typed description before the post and empties the tray after it', async () => {
    await attachOne(renderRoot());
    describePending('a wall at night');

    submit('look at this');

    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Pending media' })).toBeNull();
    });

    expect(seen()).toStrictEqual(['put 12 a wall at night', 'post']);
  });

  it('does not put a description again that the file went up with', async () => {
    const container = renderRoot();
    vi.spyOn(fileInput(container), 'click').mockImplementation(() => undefined);
    submit('/attach a wall at night');
    choose(fileInput(container), [picture('pixel.png')]);
    await screen.findByText('attached pixel.png (1/4)');

    submit('look at this');

    await waitFor(() => {
      expect(seen()).toStrictEqual(['post']);
    });
  });

  it('blocks the post and keeps the media when the description is refused', async () => {
    serveInstance(500);
    await attachOne(renderRoot());
    describePending('a wall at night');

    submit('look at this');

    const alert = await screen.findByRole('alertdialog');

    expect(within(alert).getByText(/HTTP 500/u)).toBeInTheDocument();
    expect(seen()).toStrictEqual(['put 12 a wall at night']);
    expect(screen.getByRole('textbox', { name: 'Description for pixel.png' })).toHaveValue(
      'a wall at night',
    );
  });
});
