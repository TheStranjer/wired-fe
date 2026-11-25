/**
 * Tests for sending a composer window's media (WFE-205): the alt text typed on
 * a line is put to its attachment just before the post, which carries the ids
 * of the attachments that are ready; a line still uploading holds the send, a
 * failed line is left out, a refused description stops the post and shows why,
 * and a sent post — or another account picked — takes the attachments off the
 * draft.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { BOB, WIRED, openedComposer } from './composerSession';
import { ComposerWindow } from './ComposerWindow';
import { acceptingUploads, attachment, choose, picture } from './mediaHarness';
import { AppStateProvider } from '../../state/StateContext';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';

/** What the instance saw, in order. */
type Calls = string[];

/** Handlers for the alt-text put and the create that record themselves into {@link calls}. */
function recording(calls: Calls, bodies: unknown[]): void {
  server.use(
    http.put(`${WIRED}/api/v1/media/:id`, async ({ params, request }) => {
      calls.push(`put ${String(params['id'])}`);
      bodies.push(await request.json());

      return HttpResponse.json(attachment(String(params['id'])));
    }),
    http.post(`${WIRED}/api/v1/statuses`, async ({ request }) => {
      calls.push('post');
      bodies.push(await request.json());

      return HttpResponse.json(status('9'));
    }),
  );
}

/** Show the first composer window of {@link openedComposer}. */
function show(): void {
  const state = openedComposer();
  render(
    <AppStateProvider initial={state}>
      <ComposerWindow windowId={state.windows.activeId} />
    </AppStateProvider>,
  );
}

/** Type {@link text} into the post textarea and press `[ send ]`. */
function write(text: string): void {
  fireEvent.change(screen.getByRole('textbox', { name: 'Post text' }), { target: { value: text } });
}

/** Press `[ send ]`. */
function send(): void {
  fireEvent.click(screen.getByRole('button', { name: '[ send ]' }));
}

describe('sending media from the composer window', () => {
  it('describes the attachment, then posts with its id, and clears the line', async () => {
    const calls: Calls = [];
    const bodies: unknown[] = [];
    server.use(acceptingUploads());
    recording(calls, bodies);
    show();
    choose([picture('cat.png')]);
    await screen.findByText('ready');
    fireEvent.change(screen.getByRole('textbox', { name: 'Description for cat.png' }), {
      target: { value: '  a grey cat  ' },
    });
    write('look');

    send();

    await screen.findByText(/Posted as/u);

    expect(calls).toStrictEqual(['put m1', 'post']);
    expect(bodies).toStrictEqual([
      { description: 'a grey cat' },
      { status: 'look', visibility: 'public', media_ids: ['m1'] },
    ]);
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('sends no description request for an attachment left undescribed', async () => {
    const calls: Calls = [];
    server.use(acceptingUploads());
    recording(calls, []);
    show();
    choose([picture('cat.png')]);
    await screen.findByText('ready');
    write('look');

    send();

    await screen.findByText(/Posted as/u);

    expect(calls).toStrictEqual(['post']);
  });

  it('holds the send while a file is still uploading', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${WIRED}/api/v2/media`, async () => {
        await gate;

        return HttpResponse.json(attachment('m1'));
      }),
    );
    show();
    write('look');
    choose([picture('cat.png')]);

    expect(screen.getByRole('button', { name: '[ send ]' })).toBeDisabled();

    release();
    await screen.findByText('ready');

    expect(screen.getByRole('button', { name: '[ send ]' })).toBeEnabled();
  });

  it('leaves a failed upload out of the post', async () => {
    const bodies: unknown[] = [];
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
    recording([], bodies);
    show();
    choose([picture('bad.png')]);
    await screen.findByText(/^failed: /u);
    choose([picture('good.png')]);
    await screen.findByText('ready');
    write('look');

    send();

    await screen.findByText(/Posted as/u);

    expect(bodies).toStrictEqual([{ status: 'look', visibility: 'public', media_ids: ['m1'] }]);
  });

  it('stops at a refused description, shows why and keeps the draft and the line', async () => {
    const calls: Calls = [];
    server.use(acceptingUploads());
    recording(calls, []);
    server.use(
      http.put(`${WIRED}/api/v1/media/:id`, () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 }),
      ),
    );
    show();
    choose([picture('cat.png')]);
    await screen.findByText('ready');
    fireEvent.change(screen.getByRole('textbox', { name: 'Description for cat.png' }), {
      target: { value: 'a cat' },
    });
    write('look');

    send();

    await screen.findByText(/HTTP 500/u);

    expect(calls).toStrictEqual([]);
    expect(screen.getByRole('textbox', { name: 'Post text' })).toHaveValue('look');
    expect(screen.getByText('cat.png')).toBeInTheDocument();
  });

  it('takes the attachments off the draft when another account is picked', async () => {
    server.use(acceptingUploads());
    show();
    choose([picture('cat.png')]);
    await screen.findByText('ready');

    fireEvent.change(screen.getByRole('combobox', { name: 'Post as' }), {
      target: { value: BOB.key },
    });

    expect(screen.queryByText('cat.png')).toBeNull();
    expect(
      screen.getByText('attachments removed: they belong to the old account'),
    ).toBeInTheDocument();
  });
});
