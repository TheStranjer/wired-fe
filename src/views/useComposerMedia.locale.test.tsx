/**
 * Tests that the composer's media refusals follow the language (decision 19,
 * WFE-321): a file that is no media, and a file past the instance's limit,
 * print the fake language's sentences into the window.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useComposerMedia } from './useComposerMedia';
import {
  DEFAULT_POLL_LIMITS,
  NO_ANONYMOUS_READS,
  type Capabilities,
  type FeatureFlag,
} from '../capabilities/capabilities';
import { useAppState } from '../state/StateContext';
import { seeded } from '../test/appSessions';
import { ACCOUNT, lines, ORIGIN, picture } from '../test/attachmentHarness';
import { installFakeLocale } from '../test/i18n';
import { STATUS_WINDOW_ID } from '../windows/model';

/** An instance that takes no attachment at all. */
const CAPABILITIES: Capabilities = {
  backend: 'wired',
  maxCharacters: 500,
  maxMediaAttachments: 0,
  pollLimits: DEFAULT_POLL_LIMITS,
  features: new Set<FeatureFlag>([]),
  anonymousReads: NO_ANONYMOUS_READS,
};

/** The hook and the state it prints into, signed in on {@link CAPABILITIES}. */
function mount() {
  return renderHook(
    () => ({
      media: useComposerMedia(STATUS_WINDOW_ID, ACCOUNT.key),
      state: useAppState(),
    }),
    {
      wrapper: seeded([
        { type: 'accounts', accounts: [ACCOUNT], activeKey: ACCOUNT.key },
        {
          type: 'profile',
          profile: { origin: ORIGIN, title: 'wired.example', capabilities: CAPABILITIES },
        },
      ]),
    },
  );
}

describe(useComposerMedia, () => {
  it('refuses a file that is no media in the language in use', () => {
    installFakeLocale({ views: { media: { not_media: 'NOPE {name}' } } });
    const { result } = mount();

    act(() => {
      result.current.media.add([new File(['x'], 'notes.txt', { type: 'text/plain' })]);
    });

    expect(lines(result.current.state)).toStrictEqual(['NOPE notes.txt']);
  });

  it('refuses a file past the limit in the language in use', () => {
    installFakeLocale({ views: { media: { too_many: 'MAX {max} SKIPPED {name}' } } });
    const { result } = mount();

    act(() => {
      result.current.media.add([picture('late.png')]);
    });

    expect(lines(result.current.state)).toStrictEqual(['MAX 0 SKIPPED late.png']);
  });
});
