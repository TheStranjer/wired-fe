/**
 * Tests for leaving the page: the address given is the one assigned to the
 * location (a fragment, which jsdom can follow without a page load).
 */
import { afterEach, describe, expect, it } from 'vitest';

import { navigateTo } from './navigate';

describe(navigateTo, () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('assigns the address to the location', () => {
    navigateTo('#/arrived');

    expect(window.location.hash).toBe('#/arrived');
  });
});
