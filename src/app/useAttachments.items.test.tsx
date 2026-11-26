/**
 * Tests for the lines of the pending media (WFE-287): a chosen file is an
 * `uploading` line that becomes `ready` with its id (and a thumbnail) or
 * `failed` with the reason, `pending` lists only the ready ids, a line can be
 * described and removed by its key, and showing the tray without one on screen
 * is harmless. The shared fixtures (src/test/attachmentHarness) serve uploads.
 */
import { act, render, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { useEffect } from 'react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { type Attachments, useAttachments } from './useAttachments';
import { AppStateProvider } from '../state/StateContext';
import { stateAfter } from '../test/appSessions';
import {
  ACCOUNT,
  choose,
  fileInput,
  ORIGIN,
  picture,
  servingUploads,
} from '../test/attachmentHarness';
import { server } from '../test/server';

/** Renders the hook's file input and reports what the hook returned on every render. */
function Harness(props: { readonly report: (next: Attachments) => void }): JSX.Element {
  const attachments = useAttachments();
  const { report } = props;
  useEffect(() => {
    report(attachments);
  });
  return attachments.input;
}

/** The mounted hook: where the input is and what the last render returned. */
function mount(): { readonly container: HTMLElement; readonly current: () => Attachments } {
  let captured: Attachments | null = null;
  const initial = stateAfter([{ type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key }]);
  const { container } = render(
    <AppStateProvider initial={initial}>
      <Harness
        report={(next) => {
          captured = next;
        }}
      />
    </AppStateProvider>,
  );
  return {
    container,
    current(): Attachments {
      if (captured === null) {
        throw new Error('the harness never rendered');
      }
      return captured;
    },
  };
}

describe('the pending media lines', () => {
  it('shows the file as an uploading line that turns ready with its id', async () => {
    servingUploads();
    const mounted = mount();

    choose(fileInput(mounted.container), [picture('pixel.png')]);

    expect(mounted.current().items).toMatchObject([
      { name: 'pixel.png', status: 'uploading', mediaId: null },
    ]);
    expect(mounted.current().pending).toStrictEqual([]);

    await waitFor(() => {
      expect(mounted.current().pending).toStrictEqual(['1']);
    });

    expect(mounted.current().items).toMatchObject([
      { name: 'pixel.png', status: 'ready', mediaId: '1' },
    ]);
  });

  it('shows a failed upload with its reason and leaves it out of pending', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () =>
        HttpResponse.json({ error: 'Too big' }, { status: 422 }),
      ),
    );
    const mounted = mount();

    choose(fileInput(mounted.container), [picture('pixel.png')]);

    await waitFor(() => {
      expect(mounted.current().items[0]?.status).toBe('failed');
    });

    expect(mounted.current().items[0]?.error).toMatch(/422/u);
    expect(mounted.current().pending).toStrictEqual([]);
  });

  it('describes and removes a line by its key, and empties on clear', async () => {
    servingUploads();
    const mounted = mount();
    choose(fileInput(mounted.container), [picture('pixel.png')]);
    await waitFor(() => {
      expect(mounted.current().pending).toHaveLength(1);
    });
    const key = mounted.current().items[0]?.key ?? '';

    act(() => {
      mounted.current().describe(key, 'a wall at night');
    });

    expect(mounted.current().items[0]?.description).toBe('a wall at night');

    act(() => {
      mounted.current().remove(key);
    });

    expect(mounted.current().items).toStrictEqual([]);

    act(() => {
      mounted.current().add(picture('pasted.png'));
    });
    await waitFor(() => {
      expect(mounted.current().pending).toHaveLength(1);
    });
    act(() => {
      mounted.current().clear();
    });

    expect(mounted.current().items).toStrictEqual([]);
  });

  it('focuses nothing when the tray is not on screen', () => {
    const mounted = mount();

    expect(() => {
      mounted.current().showMedia();
    }).not.toThrow();
  });
});
