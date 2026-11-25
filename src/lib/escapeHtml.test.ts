import { describe, expect, it } from 'vitest';

import { escapeHtml } from './escapeHtml';

describe(escapeHtml, () => {
  it('turns every markup character into its entity', () => {
    expect(escapeHtml(`<b class="x">Tom & 'Jerry'</b>`)).toBe(
      '&lt;b class=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/b&gt;',
    );
  });

  it('leaves plain text alone', () => {
    expect(escapeHtml('Alice :cat:')).toBe('Alice :cat:');
  });
});
