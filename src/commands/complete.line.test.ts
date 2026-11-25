/**
 * Tests that the completion engine hands a provider the whole line (WFE-172),
 * so a provider can decline a word by the command it sits in.
 */
import { describe, expect, it, vi } from 'vitest';

import { type Provider, startCompletion } from './complete';

describe(startCompletion, () => {
  it('asks the provider about the whole line, not only the word', () => {
    const accepts = vi.fn<Provider['accepts']>().mockReturnValue(false);
    const provider: Provider = { accepts, candidates: () => [] };

    startCompletion('/react a1 :la', 13, [provider]);

    expect(accepts).toHaveBeenCalledWith(':la', false, '/react a1 :la');
  });
});
