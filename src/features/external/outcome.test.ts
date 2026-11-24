/**
 * Tests for what the external-login boxes show after an answer: http(s)
 * addresses are navigated to, anything else is refused without navigating,
 * pending registrations say what they wait for, and a refusal's own message
 * beats the shared description.
 */
import { describe, expect, it, vi } from 'vitest';

import { describeExternalError, settleRedirect, settleRegistration } from './outcome';

describe(settleRedirect, () => {
  it('navigates to an http(s) address', () => {
    const navigate = vi.fn();

    const settled = settleRedirect('https://cool.example/cb?code=1', navigate);

    expect(settled).toStrictEqual({ kind: 'finished', message: 'Continuing…' });
    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?code=1');
  });

  it.each(['javascript:alert(1)', 'data:text/html,hi', '/relative', ''])(
    'refuses %j without navigating',
    (uri) => {
      const navigate = vi.fn();

      expect(settleRedirect(uri, navigate)).toMatchObject({ kind: 'error' });
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});

describe(settleRegistration, () => {
  it('navigates for a redirect', () => {
    const navigate = vi.fn();

    settleRegistration({ kind: 'redirect', uri: 'https://wired.example/' }, navigate);

    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://wired.example/');
  });

  it.each([
    ['approval', /awaiting approval/u],
    ['confirmation', /confirm your address/u],
  ] as const)('says what a pending %s waits for', (reason, text) => {
    const navigate = vi.fn();

    const settled = settleRegistration({ kind: 'pending', reason }, navigate);

    expect(settled.kind).toBe('finished');
    expect(settled.message).toMatch(text);
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe(describeExternalError, () => {
  it('uses the message of a refusal as it is', () => {
    expect(describeExternalError({ kind: 'http', status: 422, message: 'Nickname taken' })).toBe(
      'Nickname taken',
    );
  });

  it('describes any other failure', () => {
    expect(describeExternalError({ kind: 'network', message: 'offline' })).toBe(
      'Network error: offline',
    );
  });
});
