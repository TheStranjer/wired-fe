/**
 * Tests for the row click routing's edge: an event whose target is not an
 * element (a text node, which React never reports but the DOM can) counts as
 * the bare row, so a click selects it and a double-click pops it.
 */
import type { MouseEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { postArticleProps } from './rowClick';
import { t } from '../i18n/translate';

/** A mouse event whose target is a text node, which is no element. */
function textEvent(): MouseEvent<HTMLElement> {
  return { target: document.createTextNode('present day') } as unknown as MouseEvent<HTMLElement>;
}

/** The article props over fresh spies, and the spies. */
function build(): {
  readonly props: ReturnType<typeof postArticleProps>;
  readonly onSelect: () => void;
  readonly onPop: () => void;
} {
  const onSelect = vi.fn<() => void>();
  const onPop = vi.fn<() => void>();
  const props = postArticleProps({
    label: 'a3',
    fullHandle: '@alice@m.example',
    selected: false,
    onSelect,
    onPop,
    onContentLink: () => false,
    t,
  });
  return { props, onSelect, onPop };
}

describe(postArticleProps, () => {
  it('selects the row for a click whose target is no element', () => {
    const { props, onSelect, onPop } = build();

    props.onClickCapture(textEvent());

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onPop).not.toHaveBeenCalled();
  });

  it('pops the row for a double-click whose target is no element', () => {
    const { props, onSelect, onPop } = build();

    props.onDoubleClickCapture(textEvent());

    expect(onPop).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });
});
