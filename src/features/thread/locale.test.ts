/**
 * Tests that the thread slice's text follows the language in use (decision
 * 19): the refusal of a reply with nothing to answer is read from the
 * catalog.
 */
import { describe, expect, it, vi } from 'vitest';

import { postReply } from './threadReply';
import type { PostContext } from '../../state/windowKind';
import { TEST_DATE } from '../../test/fixtures';
import { installFakeLocale } from '../../test/i18n';
import { THREAD_ACCOUNT, threadState } from '../../test/threadWindow';
import type { WindowState } from '../../windows/model';

describe('the thread slice in another language', () => {
  it('words the refusal from the catalog', async () => {
    installFakeLocale({ features: { thread: { nothing_to_answer: 'XX nothing' } } });
    const win: WindowState = {
      id: 'thread-untargeted',
      ref: { kind: 'thread', accountKey: THREAD_ACCOUNT.key, target: null },
      title: 'thread/-',
      unread: 0,
      highlight: false,
      display: {},
    };
    const context: PostContext = {
      state: threadState(),
      dispatch: vi.fn(),
      now: () => new Date(TEST_DATE),
    };

    await expect(postReply({ text: 'hello' }, win, context)).resolves.toBe('XX nothing');
  });
});
