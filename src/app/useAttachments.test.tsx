/**
 * Tests for the pending media behind /attach: the picker opens the hidden file
 * input, a chosen file uploads as the active account and prints its
 * `uploading…` and `attached <name> (n/max)` lines, chosen files upload one
 * after another, and files past the instance's limit are refused with a
 * warning before anything is uploaded. A refused upload and a missing account
 * print their reasons and attach nothing; an undetected instance counts
 * against the default cap; clear empties the list and add uploads without the
 * dialog. The shared fixtures (src/test/attachmentHarness) serve the uploads.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { useEffect } from 'react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { type Attachments, useAttachments } from './useAttachments';
import {
  DEFAULT_POLL_LIMITS,
  type Capabilities,
  type FeatureFlag,
} from '../capabilities/capabilities';
import type { AppState } from '../state/appState';
import type { AppAction } from '../state/reducer';
import { AppStateProvider, useAppState } from '../state/StateContext';
import { stateAfter } from '../test/appSessions';
import {
  ACCOUNT,
  choose,
  fileInput,
  lines,
  ORIGIN,
  picture,
  servingUploads,
} from '../test/attachmentHarness';
import { server } from '../test/server';

/** A signed-in, detected session whose instance allows `max` attachments. */
function signedIn(max: number): readonly AppAction[] {
  const capabilities: Capabilities = {
    backend: 'wired',
    maxCharacters: 500,
    maxMediaAttachments: max,
    pollLimits: DEFAULT_POLL_LIMITS,
    features: new Set<FeatureFlag>([]),
  };
  return [
    { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
    { type: 'profile', profile: { origin: ORIGIN, title: 'wired.example', capabilities } },
  ];
}

/** The hook and the state behind it, as the last render handed them over. */
type Snapshot = { readonly attachments: Attachments; readonly state: AppState };

/** The hook's input and its count of the list, beside a report of every render. */
function Harness(props: { readonly report: (next: Snapshot) => void }): JSX.Element {
  const attachments = useAttachments();
  const state = useAppState();
  const { report } = props;
  useEffect(() => {
    report({ attachments, state });
  });
  return (
    <>
      {attachments.input}
      <span>{`pending:${String(attachments.pending.length)}`}</span>
    </>
  );
}

/** The mounted hook: where the input is and what the last render held. */
type Mounted = {
  readonly container: HTMLElement;
  readonly current: () => Snapshot;
};

/** Mount the harness over a session moved along by {@link actions}. */
function mount(actions: readonly AppAction[]): Mounted {
  let captured: Snapshot | null = null;
  const report = (next: Snapshot): void => {
    captured = next;
  };
  const { container } = render(
    <AppStateProvider initial={stateAfter(actions)}>
      <Harness report={report} />
    </AppStateProvider>,
  );
  return {
    container,
    current(): Snapshot {
      if (captured === null) {
        throw new Error('the harness never rendered');
      }
      return captured;
    },
  };
}

describe(useAttachments, () => {
  it('opens the hidden file input when asked to pick', () => {
    const mounted = mount(signedIn(4));
    const input = fileInput(mounted.container);
    const click = vi.spyOn(input, 'click').mockImplementation(() => undefined);

    act(() => {
      mounted.current().attachments.pick('a wall at night');
    });

    expect(click).toHaveBeenCalledTimes(1);
  });

  it('uploads a chosen file and adds it to the pending list', async () => {
    const uploads = servingUploads();
    const mounted = mount(signedIn(4));

    choose(fileInput(mounted.container), [picture('pixel.png')]);

    const pending = await screen.findByText('pending:1');

    expect(pending).toBeInTheDocument();
    expect(uploads.requests()).toBe(1);

    await waitFor(() => {
      expect(lines(mounted.current().state)).toStrictEqual([
        'uploading pixel.png…',
        'attached pixel.png (1/4)',
      ]);
    });
  });

  it('uploads every chosen file, one after another, all counted', async () => {
    const uploads = servingUploads();
    const mounted = mount(signedIn(4));
    const input = fileInput(mounted.container);

    act(() => {
      mounted.current().attachments.pick('a wall at night');
    });
    choose(input, [picture('pixel.png'), picture('second.png')]);

    const pending = await screen.findByText('pending:2');

    expect(pending).toBeInTheDocument();
    expect(uploads.requests()).toBe(2);

    await waitFor(() => {
      expect(lines(mounted.current().state)).toStrictEqual([
        'uploading pixel.png…',
        'attached pixel.png (1/4)',
        'uploading second.png…',
        'attached second.png (2/4)',
      ]);
    });
  });

  it('refuses files past the instance limit and uploads nothing for them', async () => {
    const uploads = servingUploads();
    const mounted = mount(signedIn(1));

    choose(fileInput(mounted.container), [picture('first.png'), picture('second.png')]);

    await waitFor(() => {
      expect(lines(mounted.current().state)).toStrictEqual([
        'uploading first.png…',
        'attached first.png (1/1)',
        'too many attachments: 1 per post, skipped second.png',
      ]);
    });

    expect(uploads.requests()).toBe(1);

    const pending = await screen.findByText('pending:1');

    expect(pending).toBeInTheDocument();
  });

  it('prints a failed upload and attaches nothing', async () => {
    server.use(
      http.post(`${ORIGIN}/api/v2/media`, () => {
        return HttpResponse.json({ error: 'Too big' }, { status: 422 });
      }),
    );
    const mounted = mount(signedIn(4));

    choose(fileInput(mounted.container), [picture('pixel.png')]);

    await waitFor(() => {
      expect(lines(mounted.current().state)[1]).toMatch(/422/u);
    });

    expect(lines(mounted.current().state)[0]).toBe('uploading pixel.png…');
    expect(screen.getByText('pending:0')).toBeInTheDocument();
  });

  it('says so when nobody is signed in', async () => {
    const mounted = mount([]);

    choose(fileInput(mounted.container), [picture('pixel.png')]);

    await waitFor(() => {
      expect(lines(mounted.current().state)).toStrictEqual([
        'uploading pixel.png…',
        'Not logged in. Type /connect',
      ]);
    });

    expect(screen.getByText('pending:0')).toBeInTheDocument();
  });

  it('counts against the default limit while the instance is undetected', async () => {
    servingUploads();
    const mounted = mount([{ type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key }]);

    choose(fileInput(mounted.container), [picture('pixel.png')]);

    await waitFor(() => {
      expect(lines(mounted.current().state)).toContain('attached pixel.png (1/4)');
    });
  });

  it('empties the list when cleared', async () => {
    servingUploads();
    const mounted = mount(signedIn(4));

    choose(fileInput(mounted.container), [picture('pixel.png')]);
    await screen.findByText('pending:1');

    act(() => {
      mounted.current().attachments.clear();
    });

    expect(screen.getByText('pending:0')).toBeInTheDocument();
    expect(mounted.current().attachments.pending).toStrictEqual([]);
  });

  it('uploads one given file without the dialog', async () => {
    servingUploads();
    const mounted = mount(signedIn(4));

    act(() => {
      mounted.current().attachments.add(picture('pasted.png'));
    });

    const pending = await screen.findByText('pending:1');

    expect(pending).toBeInTheDocument();

    await waitFor(() => {
      expect(lines(mounted.current().state)).toStrictEqual([
        'uploading pasted.png…',
        'attached pasted.png (1/4)',
      ]);
    });
  });
});
