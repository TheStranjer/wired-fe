/**
 * Tests for the quote half of postView (WFE-99): a quoted status mapped onto
 * the label the window gave it, its author's handle forms and a plain-text
 * excerpt; the `[CW: …]` notice standing in for the words behind a warning;
 * the 120-character trim; and the original's quote showing on a boost, never
 * the boost wrapper's own.
 */

import { describe, expect, it } from 'vitest';

import { postView } from './postView';
import type { Viewer } from './postView';
import type { Status } from '../api/schemas/status';
import { status } from '../test/fixtures';

const SIGNED_OUT: Viewer = { origin: 'https://wired.example', accountId: null };

/** The post every test quotes, with its words overridable. */
function quoted(extras: Record<string, unknown> = {}): Status {
  return status('q1', { content: '<p>present day, present time</p>', ...extras });
}

describe('postView quote mapping', () => {
  it('leaves an unquoted post without a quote', () => {
    expect(postView(status('plain'), SIGNED_OUT).quote).toBeNull();
  });

  it('maps a quoted post onto its label, author and excerpt', () => {
    const view = postView(status('outer', { quote: quoted() }), SIGNED_OUT, (id) =>
      id === 'q1' ? 'a4' : null,
    );

    expect(view.quote).toStrictEqual({
      label: 'a4',
      author: { handle: 'lain@wired.example', fullHandle: '@lain@wired.example' },
      excerpt: 'present day, present time',
    });
  });

  it('labels nothing when the window gave the quote no label', () => {
    const view = postView(status('outer', { quote: quoted() }), SIGNED_OUT);

    expect(view.quote?.label).toBeNull();
  });

  it('shows the warning instead of the words for a quoted post behind a CW', () => {
    const view = postView(
      status('outer', { quote: quoted({ spoiler_text: 'lain spoilers' }) }),
      SIGNED_OUT,
    );

    expect(view.quote?.excerpt).toBe('[CW: lain spoilers]');
  });

  it('trims a long excerpt to 120 characters with an ellipsis', () => {
    const view = postView(
      status('outer', { quote: quoted({ content: `<p>${'x'.repeat(150)}</p>` }) }),
      SIGNED_OUT,
    );

    expect(view.quote?.excerpt).toBe(`${'x'.repeat(120)}…`);
    expect(view.quote?.excerpt).toHaveLength(121);
  });

  it('keeps a not-quite-long excerpt whole', () => {
    const exact = 'y'.repeat(120);
    const view = postView(
      status('outer', { quote: quoted({ content: `<p>${exact}</p>` }) }),
      SIGNED_OUT,
    );

    expect(view.quote?.excerpt).toBe(exact);
  });

  it('flattens remote markup to one plain line and drops forbidden text', () => {
    const view = postView(
      status('outer', {
        quote: quoted({
          content: '<p>  close\n\tthe world </p><p>open the   nExt</p><script>steal()</script>',
        }),
      }),
      SIGNED_OUT,
    );

    expect(view.quote?.excerpt).toBe('close the world open the nExt');
  });

  it('shows the quote of the original, not the boost', () => {
    const boost = status('boost-1', {
      quote: quoted({ id: 'outer-q', content: '<p>boosting words</p>' }),
      reblog: status('orig', {
        quote: quoted({ id: 'inner-q', content: '<p>original quote</p>' }),
      }),
    });

    expect(postView(boost, SIGNED_OUT).quote?.excerpt).toBe('original quote');
  });
});
