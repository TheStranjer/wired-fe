/**
 * Tests for what the streaming hook says and does as a connection comes and
 * goes: the live line once, the unavailable line and the polling fallback on a
 * failed stream, the restored line and the end of the fallback when it opens
 * again, a status reported before `connect` returns, and the cleanup on unmount.
 */
import { act } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import type { StreamDeps } from './streamEntry';
import { useStreams } from './useStreams';
import { manualScheduler } from '../test/manualScheduler';
import { fakeClient, mount, statusLines } from '../test/streamHarness';
import { offscreen } from '../test/streamWindows';

const LIVE = 'info: Streaming live for @lain@wired.example';
const DOWN = 'warn: Streaming unavailable for @lain@wired.example; polling every minute';
const RESTORED = 'info: Streaming restored for @lain@wired.example';

/** The component that calls the hook under test. */
function Streams(props: { readonly deps: StreamDeps }): JSX.Element | null {
  useStreams(props.deps);

  return null;
}

describe(useStreams, () => {
  it('prints that the stream is live, once, in the status window', () => {
    const client = fakeClient();
    const deps = { connect: client.connect, schedule: manualScheduler().schedule };
    const { live } = mount(offscreen(), <Streams deps={deps} />);
    act(() => {
      client.connections[0]?.listener.onStatus('open');
      client.connections[0]?.listener.onStatus('open');
    });

    expect(statusLines(live.state)).toStrictEqual([LIVE]);
  });

  it('polls on a failed stream, once, and stops when it opens again', () => {
    const client = fakeClient();
    const clock = manualScheduler();
    const deps = { connect: client.connect, schedule: clock.schedule };
    const { live } = mount(offscreen(), <Streams deps={deps} />);
    const listener = client.connections[0]?.listener;
    act(() => {
      listener?.onStatus('open');
      listener?.onStatus('failed');
      listener?.onStatus('failed');
    });

    expect(clock.intervals).toStrictEqual([60_000]);
    expect(clock.stop).not.toHaveBeenCalled();

    act(() => {
      listener?.onStatus('open');
    });

    expect(clock.stop).toHaveBeenCalledTimes(1);
    expect(statusLines(live.state)).toStrictEqual([LIVE, DOWN, RESTORED]);
  });

  it('polls again when a restored stream fails again', () => {
    const client = fakeClient();
    const clock = manualScheduler();
    const deps = { connect: client.connect, schedule: clock.schedule };
    mount(offscreen(), <Streams deps={deps} />);
    const listener = client.connections[0]?.listener;
    act(() => {
      listener?.onStatus('failed');
      listener?.onStatus('open');
      listener?.onStatus('failed');
    });

    expect(clock.intervals).toStrictEqual([60_000, 60_000]);
  });

  it('handles a status reported while the connection is still being made', () => {
    const client = fakeClient((listener) => {
      listener.onStatus('open');
    });
    const deps = { connect: client.connect, schedule: manualScheduler().schedule };
    const { live } = mount(offscreen(), <Streams deps={deps} />);

    expect(statusLines(live.state)).toContain(LIVE);
  });

  it('closes every connection and stops every poll on unmount', () => {
    const client = fakeClient();
    const clock = manualScheduler();
    const deps = { connect: client.connect, schedule: clock.schedule };
    const { unmount } = mount(offscreen(), <Streams deps={deps} />);
    act(() => {
      client.connections[0]?.listener.onStatus('failed');
    });
    unmount();

    expect(clock.stop).toHaveBeenCalledTimes(1);
    expect(client.connections[0]?.close).toHaveBeenCalledTimes(1);
    expect(client.connections[1]?.close).toHaveBeenCalledTimes(1);
  });
});
