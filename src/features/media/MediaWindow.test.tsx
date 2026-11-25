/**
 * Tests for the media window (WFE-263): it loads its post as the window's
 * account (MSW stands in for the instance) and shows the attachment's full
 * `url` — not its preview — with its alt text, description and `n/N`; the
 * step buttons move to a sibling, retitle the window and disable at the ends;
 * Open original runs `/open <url>` through the line runner; a sensitive post
 * waits behind its cover; and a failed load, a signed-out window and a window
 * with nothing to show say so. The window is rendered the way the shell does:
 * the app state in its real provider, the window the state has active, and a
 * recording post-actions seam.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MediaWindow } from './MediaWindow';
import type { AppState } from '../../state/appState';
import { AppStateProvider, useAppState } from '../../state/StateContext';
import { attachment, mediaPost, mediaState, serveMediaStatus } from '../../test/mediaWindow';
import { type PostActions, PostActionsProvider } from '../../views/PostActionsContext';
import { activeWindow } from '../../windows/model';

const TWO = [
  attachment('m1', 'image', { description: 'a wall' }),
  attachment('m2', 'image', { description: 'a door' }),
];

/** The active window's title, then the window itself, so stepping moves what is drawn. */
function Active(): JSX.Element {
  const win = activeWindow(useAppState().windows);
  return (
    <>
      <p>{`title: ${win.title}`}</p>
      <MediaWindow windowId={win.id} />
    </>
  );
}

/** Render the active window of {@link state}; the recorded `run` of the post actions comes back. */
function renderMedia(state: AppState): {
  readonly run: ReturnType<typeof vi.fn<PostActions['run']>>;
} {
  const run = vi.fn<PostActions['run']>();
  render(
    <AppStateProvider initial={state}>
      <PostActionsProvider actions={{ linesFor: () => ({}), run }}>
        <Active />
      </PostActionsProvider>
    </AppStateProvider>,
  );
  return { run };
}

describe('the media window', () => {
  it('says loading… until the post arrives', async () => {
    serveMediaStatus(mediaPost(TWO));
    renderMedia(mediaState(1, 2));

    expect(screen.getByText('loading…')).toBeInTheDocument();

    await screen.findByRole('img', { name: 'a wall' });

    expect(screen.queryByText('loading…')).not.toBeInTheDocument();
  });

  it('shows the full-size image, not its preview, with no referrer', async () => {
    serveMediaStatus(mediaPost(TWO));
    renderMedia(mediaState(1, 2));

    const image = await screen.findByRole('img', { name: 'a wall' });

    expect(image).toHaveAttribute('src', 'https://media.example/full/m1');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('shows the description and the place under the image, and the title', async () => {
    serveMediaStatus(mediaPost(TWO));
    renderMedia(mediaState(1, 2));
    await screen.findByRole('img');

    expect(screen.getAllByText('a wall')).toHaveLength(1);
    expect(screen.getByText('1/2')).toBeInTheDocument();
    expect(screen.getByText('title: media [a0] 1/2')).toBeInTheDocument();
  });

  it('says an image has no description when its author wrote none', async () => {
    serveMediaStatus(mediaPost([attachment('m1')]));
    renderMedia(mediaState(1, 1));

    await screen.findByRole('img', { name: 'Image without description' });

    expect(screen.getByText('Image without description', { selector: 'p' })).toBeInTheDocument();
  });

  it('steps to the next attachment, retitles, and disables › at the end', async () => {
    serveMediaStatus(mediaPost(TWO));
    renderMedia(mediaState(1, 2));
    await screen.findByRole('img', { name: 'a wall' });

    expect(screen.getByRole('button', { name: 'Previous attachment' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next attachment' }));

    const image = await screen.findByRole('img', { name: 'a door' });

    expect(image).toHaveAttribute('src', 'https://media.example/full/m2');
    expect(screen.getByText('2/2')).toBeInTheDocument();
    expect(screen.getByText('title: media [a0] 2/2')).toBeInTheDocument();
  });

  it('disables › at the last attachment and enables ‹', async () => {
    serveMediaStatus(mediaPost(TWO));
    renderMedia(mediaState(2, 2));
    await screen.findByRole('img', { name: 'a door' });

    expect(screen.getByRole('button', { name: 'Next attachment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous attachment' })).toBeEnabled();
  });

  it('steps back to the previous attachment', async () => {
    serveMediaStatus(mediaPost(TWO));
    renderMedia(mediaState(2, 2));
    await screen.findByRole('img', { name: 'a door' });

    fireEvent.click(screen.getByRole('button', { name: 'Previous attachment' }));

    await screen.findByRole('img', { name: 'a wall' });

    expect(screen.getByText('title: media [a0] 1/2')).toBeInTheDocument();
  });

  it('has no step buttons for a post with one attachment', async () => {
    serveMediaStatus(mediaPost([attachment('m1')]));
    renderMedia(mediaState(1, 1));
    await screen.findByRole('img');

    expect(screen.queryByRole('button', { name: 'Previous attachment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next attachment' })).not.toBeInTheDocument();
  });

  it('runs /open with the file’s url from Open original', async () => {
    serveMediaStatus(mediaPost(TWO));
    const { run } = renderMedia(mediaState(2, 2));
    await screen.findByRole('img');

    fireEvent.click(screen.getByRole('button', { name: 'Open original ↗' }));

    expect(run).toHaveBeenCalledWith({
      line: '/open https://media.example/full/m2',
      prefill: false,
    });
  });

  it('offers no Open original for a file with no usable link', async () => {
    serveMediaStatus(mediaPost([attachment('m1', 'image', { url: 'javascript:alert(1)' })]));
    renderMedia(mediaState(1, 1));

    await screen.findByText('[no usable link]');

    expect(screen.queryByRole('button', { name: 'Open original ↗' })).not.toBeInTheDocument();
  });

  it('keeps a sensitive post behind its cover until it is opened', async () => {
    serveMediaStatus(mediaPost(TWO, { sensitive: true }));
    renderMedia(mediaState(1, 2));

    fireEvent.click(await screen.findByRole('button', { name: '[ SENSITIVE — show ]' }));

    expect(screen.queryByRole('button', { name: '[ SENSITIVE — show ]' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'a wall' })).toBeInTheDocument();
  });

  it('draws no image behind the cover', async () => {
    serveMediaStatus(mediaPost(TWO, { sensitive: true }));
    renderMedia(mediaState(1, 2));
    await screen.findByRole('button', { name: '[ SENSITIVE — show ]' });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('says so when the post has no such attachment any more', async () => {
    serveMediaStatus(mediaPost([attachment('m1')]));
    renderMedia(mediaState(3, 3));

    const notice = await screen.findByText('This post has no attachment 3');

    expect(notice).toBeInTheDocument();
  });

  it('prints why the post could not be loaded', async () => {
    serveMediaStatus(null);
    renderMedia(mediaState(1, 2));

    const failure = await screen.findByText('HTTP 404: Record not found');

    expect(failure).toBeInTheDocument();
  });

  it('is refused while nobody is signed in, and asks for nothing', () => {
    renderMedia(mediaState(1, 2, false));

    expect(screen.getByText('Not logged in. Type /connect')).toBeInTheDocument();
  });
});
