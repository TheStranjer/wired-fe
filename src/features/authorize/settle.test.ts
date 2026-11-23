/**
 * Tests for what follows a decision: an http(s) redirect is navigated to, a
 * code is shown, the out-of-band URN has nowhere to go, and any other address
 * is refused without navigating.
 */
import { describe, expect, it, vi } from 'vitest';

import { settle } from './settle';

describe(settle, () => {
  it('navigates to an http(s) redirect', () => {
    const navigate = vi.fn();

    const settled = settle({ kind: 'redirect', uri: 'https://cool.example/cb?code=1' }, navigate);

    expect(navigate).toHaveBeenCalledExactlyOnceWith('https://cool.example/cb?code=1');
    expect(settled.kind).toBe('finished');
  });

  it('shows a code without navigating', () => {
    const navigate = vi.fn();

    expect(settle({ kind: 'code', code: 'abc' }, navigate)).toStrictEqual({
      kind: 'code',
      code: 'abc',
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it('has nowhere to go for the out-of-band URN', () => {
    const navigate = vi.fn();

    const settled = settle({ kind: 'redirect', uri: 'urn:ietf:wg:oauth:2.0:oob' }, navigate);

    expect(settled.kind).toBe('finished');
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'myapp://cb'])('refuses %j', (uri) => {
    const navigate = vi.fn();

    const settled = settle({ kind: 'redirect', uri }, navigate);

    expect(settled.kind).toBe('error');
    expect(navigate).not.toHaveBeenCalled();
  });
});
