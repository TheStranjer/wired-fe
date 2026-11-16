/**
 * Tests for the profile window's open transition: the ref targets the
 * account's id under the asking window's account, the title is `@<acct>`,
 * and the same account opened twice resolves to the same window id, which is
 * what lets the window reducer activate the one already showing it.
 */
import { describe, expect, it } from 'vitest';

import { profileWindowOpen } from './profileWindow';
import { windowId } from '../windows/model';

const ACCOUNT = { id: '9', acct: 'nine@pleroma.example' };

describe(profileWindowOpen, () => {
  it("opens the profile window of the account's id, titled @<acct>", () => {
    expect(profileWindowOpen(ACCOUNT, 'https://wired.example#1')).toStrictEqual({
      type: 'open',
      ref: { kind: 'profile', accountKey: 'https://wired.example#1', target: '9' },
      title: '@nine@pleroma.example',
    });
  });

  it("names the same account's window the same, whoever asks", () => {
    const mine = profileWindowOpen(ACCOUNT, 'https://wired.example#1');
    const again = profileWindowOpen(ACCOUNT, 'https://wired.example#1');

    expect(windowId(mine.ref)).toBe(windowId(again.ref));
  });

  it('opens a window owned by nobody when no account asks', () => {
    expect(profileWindowOpen(ACCOUNT, null).ref.accountKey).toBeNull();
  });
});
