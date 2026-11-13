/**
 * Tests for the quote extractor: Wired's top-level status object, the Pleroma
 * block's `pleroma.quote` mirror, Mastodon's wrapper (full, null and shallow),
 * the precedence between the carriers and every fall-through to null.
 */
import { describe, expect, it } from 'vitest';

import { rawQuote } from './statusQuote';

describe(rawQuote, () => {
  it('returns the Wired top-level status object unchanged', () => {
    const status = { id: '1', uri: 'https://wired.example/posts/1' };

    expect(rawQuote({ quote: status })).toBe(status);
  });

  it('unwraps the Mastodon wrapper to its quoted status', () => {
    const status = { id: '2' };

    expect(rawQuote({ quote: { state: 'accepted', quoted_status: status } })).toBe(status);
  });

  it('unwraps a Mastodon wrapper whose quoted status is null', () => {
    expect(rawQuote({ quote: { state: 'accepted', quoted_status: null } })).toBeNull();
  });

  it('keeps the shallow wrapper, which later fails the status parse', () => {
    const shallow = { state: 'rejected', quoted_status_id: '9' };

    expect(rawQuote({ quote: shallow })).toBe(shallow);
  });

  it('reads the quote out of the pleroma block', () => {
    const status = { id: '3' };

    expect(rawQuote({ pleroma: { quote: status } })).toBe(status);
  });

  it('prefers the top-level quote over the pleroma mirror', () => {
    const top = { id: '4' };

    expect(rawQuote({ quote: top, pleroma: { quote: { id: '5' } } })).toBe(top);
  });

  it('falls back to the pleroma block when the top-level quote is null', () => {
    const mirrored = { id: '6' };

    expect(rawQuote({ quote: null, pleroma: { quote: mirrored } })).toBe(mirrored);
  });

  it('falls back to the pleroma block when the top-level quote is not an object', () => {
    const status = { id: '7' };

    expect(rawQuote({ quote: 'AhZQnotarealstatus', pleroma: { quote: status } })).toBe(status);
  });

  it.each([
    ['nothing carries one', {}],
    ['the top level is null', { quote: null }],
    ['the top level is not an object', { quote: 42 }],
    ['the block quote is null', { pleroma: { quote: null } }],
    ['the block has no quote key', { pleroma: {} }],
    ['there is no block', { pleroma: null }],
  ] as const)('returns null when %s', (_name, input) => {
    expect(rawQuote(input)).toBeNull();
  });
});
