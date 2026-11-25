/**
 * Tests for what the composer window refuses to attach (WFE-205): files past
 * the instance's cap say so in the pane's scrollback, failed lines do not count
 * against the cap, a file that is not media is turned down, and an upload the
 * instance refused, or one for an account that is not signed in, shows why on
 * its own line.
 */
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { WIRED, openedComposer } from './composerSession';
import { acceptingUploads, cappedAt, choose, picture, showComposer } from './mediaHarness';
import { appReducer } from '../../state/reducer';
import { server } from '../../test/server';

describe('refusals in the composer window', () => {
  it('refuses files past the instance’s cap with a message in the pane', async () => {
    server.use(acceptingUploads());
    showComposer(cappedAt(1));

    choose([picture('a.png'), picture('b.png')]);

    await screen.findByText('too many attachments: 1 per post, skipped b.png');
    await screen.findByText('ready');

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('counts only the lines that did not fail against the cap', async () => {
    server.use(
      http.post(
        `${WIRED}/api/v2/media`,
        () => HttpResponse.json({ error: 'no' }, { status: 422 }),
        {
          once: true,
        },
      ),
      acceptingUploads(),
    );
    showComposer(cappedAt(1));
    choose([picture('bad.png')]);
    await screen.findByText(/^failed: /u);

    choose([picture('good.png')]);

    await screen.findByText('ready');

    expect(screen.queryByText(/too many attachments/u)).toBeNull();
  });

  it('refuses a file that is not media with a message in the pane', async () => {
    showComposer();

    choose([new File(['t'], 'notes.txt', { type: 'text/plain' })]);

    await screen.findByText("Can't attach notes.txt: not an image, video or audio file");

    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('shows why an upload failed on its own line', async () => {
    server.use(
      http.post(`${WIRED}/api/v2/media`, () =>
        HttpResponse.json({ error: 'too big' }, { status: 422 }),
      ),
    );
    showComposer();

    choose([picture('huge.png')]);

    const failure = await screen.findByText(/^failed: HTTP 422/u);

    expect(failure).toBeInTheDocument();
    expect(screen.getByText('huge.png')).toBeInTheDocument();
  });

  it('says to log in on the line of a window whose account is not signed in', async () => {
    const state = openedComposer();
    showComposer(
      appReducer(state, {
        type: 'windows',
        action: { type: 'setAccount', id: state.windows.activeId, accountKey: 'ghost' },
      }),
    );

    choose([picture('cat.png')]);

    const failure = await screen.findByText('failed: Not logged in. Type /connect');

    expect(failure).toBeInTheDocument();
  });
});
