/**
 * Tests for the `/connect` hint a build with no accounts prints: same-origin
 * and fixed builds know their backend and say `to log in`, a list build
 * names the origins it offers, and an open build gives an example
 * (decision 3).
 */
import { describe, expect, it } from 'vitest';

import { connectHint } from './connectHint';

describe(connectHint, () => {
  it('says to log in on a same-origin build', () => {
    expect(connectHint({ mode: 'same-origin' })).toBe('Not connected. Type /connect to log in.');
  });

  it('says to log in on a fixed build', () => {
    expect(connectHint({ mode: 'fixed', origin: 'https://wired.example' })).toBe(
      'Not connected. Type /connect to log in.',
    );
  });

  it('names the available origins on a list build', () => {
    const origins = ['https://a.example', 'https://b.example'];

    expect(connectHint({ mode: 'list', origins })).toBe(
      'Not connected. Type /connect <instance>. Available: https://a.example, https://b.example',
    );
  });

  it('gives an example origin on an open build', () => {
    expect(connectHint({ mode: 'open' })).toBe(
      'Not connected. Type /connect <instance>, e.g. /connect wired.example',
    );
  });
});
