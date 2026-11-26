/**
 * Tests that the lines the streaming hook prints follow the language
 * (decision 19, WFE-321): live, unavailable and restored read the fake
 * language, with the handle in each.
 */
import { act } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import type { StreamDeps } from './streamEntry';
import { useStreams } from './useStreams';
import { installFakeLocale } from '../test/i18n';
import { manualScheduler } from '../test/manualScheduler';
import { fakeClient, mount, statusLines } from '../test/streamHarness';
import { offscreen } from '../test/streamWindows';

/** The component that calls the hook under test. */
function Streams(props: { readonly deps: StreamDeps }): JSX.Element | null {
  useStreams(props.deps);

  return null;
}

describe('the streaming lines in another language', () => {
  it('words live, unavailable and restored in it', () => {
    installFakeLocale({
      views: {
        stream: {
          live: 'LIVE {handle}',
          restored: 'BACK {handle}',
          unavailable: 'DOWN {handle}',
        },
      },
    });
    const client = fakeClient();
    const deps = { connect: client.connect, schedule: manualScheduler().schedule };
    const { live } = mount(offscreen(), <Streams deps={deps} />);
    const listener = client.connections[0]?.listener;
    act(() => {
      listener?.onStatus('open');
      listener?.onStatus('failed');
      listener?.onStatus('open');
    });

    expect(statusLines(live.state)).toStrictEqual([
      'info: LIVE lain@wired.example',
      'warn: DOWN lain@wired.example',
      'info: BACK lain@wired.example',
    ]);
  });
});
