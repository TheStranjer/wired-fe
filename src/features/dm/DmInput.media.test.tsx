/**
 * Tests for the media of the DM window's docked box (WFE-289): `[📎]` opens
 * the box's own file input and the chosen file becomes a row that turns ready;
 * a send describes the edited alt text first, carries the ready ids and empties
 * the rows; a refused description or a failed post keeps them; `[x]` removes a
 * row; and the command line's pending media are never touched.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DmInput } from './DmInput';
import { COMMAND_LINE_MEDIA, composerMediaOf } from '../../state/composerMedia';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { choose, fileInput, picture, ready, servingUploads } from '../../test/attachmentHarness';
import { ALICE_THREAD, ORIGIN, dmState, showing } from '../../test/dmWindow';
import { status } from '../../test/fixtures';
import { server } from '../../test/server';
import { activeWindow } from '../../windows/model';

/** What the instance saw, in order, and the bodies it was sent. */
type Seen = { readonly calls: string[]; readonly bodies: unknown[] };

/** Shows how many lines the command line's own media holds. */
function PendingProbe(): JSX.Element {
  return (
    <output>{`pending:${String(composerMediaOf(useAppState(), COMMAND_LINE_MEDIA).length)}`}</output>
  );
}

/** The DM window's box over the conversation, next to the command line's media count. */
function renderBox(): HTMLElement {
  const state = showing(dmState(), ALICE_THREAD.toReversed());
  return render(
    <AppStateProvider initial={state}>
      <DmInput win={activeWindow(state.windows)} />
      <PendingProbe />
    </AppStateProvider>,
  ).container;
}

/** What the instance refuses: nothing, the create, or the alt-text put. */
type Refusing = 'nothing' | 'post' | 'describe';

/** Answer the alt-text put and the create, recording what arrived, refusing {@link refusing}. */
function recording(refusing: Refusing = 'nothing'): Seen {
  const seen: Seen = { calls: [], bodies: [] };
  server.use(
    http.put(`${ORIGIN}/api/v1/media/:id`, async ({ params, request }) => {
      seen.calls.push(`put ${String(params['id'])}`);
      seen.bodies.push(await request.json());
      return refusing === 'describe'
        ? HttpResponse.json({ error: 'refused' }, { status: 422 })
        : HttpResponse.json(ready(String(params['id'])));
    }),
    http.post(`${ORIGIN}/api/v1/statuses`, async ({ request }) => {
      seen.calls.push('post');
      seen.bodies.push(await request.json());
      return refusing === 'post'
        ? HttpResponse.json({ error: 'boom' }, { status: 500 })
        : HttpResponse.json(status('42', { visibility: 'direct' }));
    }),
  );
  return seen;
}

/** Attach cat.png through the box's file input and wait for its row to be ready. */
async function attached(container: HTMLElement): Promise<void> {
  choose(fileInput(container), [picture('cat.png')]);
  await screen.findByText('ready');
}

/** Write {@link text} in the box and press Enter. */
function say(text: string): void {
  const box = screen.getByRole('textbox', { name: 'Post text' });
  fireEvent.change(box, { target: { value: text } });
  fireEvent.keyDown(box, { key: 'Enter' });
}

describe('the media of the DM box', () => {
  it('opens its file input from [📎] and shows the chosen file as a row that turns ready', async () => {
    servingUploads();
    const container = renderBox();
    const click = vi.spyOn(fileInput(container), 'click').mockImplementation(() => undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Attach media' }));
    await attached(container);

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('cat.png');
    expect(screen.getByText('pending:0')).toBeInTheDocument();
  });

  it('describes the edited alt text, posts with the ids, and empties the rows', async () => {
    servingUploads();
    const seen = recording();
    const container = renderBox();
    await attached(container);
    fireEvent.change(screen.getByRole('textbox', { name: 'Description for cat.png' }), {
      target: { value: ' a grey cat ' },
    });

    say('look');
    await screen.findByText('0/500');

    expect(seen.calls).toStrictEqual(['put 1', 'post']);
    expect(seen.bodies[0]).toStrictEqual({ description: 'a grey cat' });
    expect(seen.bodies[1]).toMatchObject({ status: '@alice@other.example look', media_ids: ['1'] });
    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });

  it('keeps the rows and the text when the post fails', async () => {
    servingUploads();
    recording('post');
    const container = renderBox();
    await attached(container);

    say('look');
    await screen.findByText(/HTTP 500/u);

    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('cat.png');
    expect(screen.getByRole('textbox', { name: 'Post text' })).toHaveValue('look');
  });

  it('posts nothing and keeps the rows when the description is refused', async () => {
    servingUploads();
    const seen = recording('describe');
    const container = renderBox();
    await attached(container);
    fireEvent.change(screen.getByRole('textbox', { name: 'Description for cat.png' }), {
      target: { value: 'a grey cat' },
    });

    say('look');
    await screen.findByText(/HTTP 422/u);

    expect(seen.calls).toStrictEqual(['put 1']);
    expect(screen.getByRole('list', { name: 'Attachments' })).toHaveTextContent('cat.png');
  });

  it('removes a row with its [x]', async () => {
    servingUploads();
    const container = renderBox();
    await attached(container);

    fireEvent.click(screen.getByRole('button', { name: 'Remove cat.png' }));

    expect(screen.queryByRole('list', { name: 'Attachments' })).toBeNull();
  });
});
