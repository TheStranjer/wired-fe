/**
 * Tests for the posting-account entry of the status line (WFE-285): `→@handle`
 * or `→?` as a button with its accessible name, absent without the prop, and
 * a click that calls `onPick`.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { StatusLine, type StatusLineProps } from './StatusLine';

const NOOP = (): undefined => undefined;

/** Renders the status line with {@link postingAs} and the rest idle. */
function renderLine(extra: Partial<StatusLineProps>): HTMLElement {
  const { container } = render(
    <StatusLine
      clock="23:07"
      accountLabel="@lain@wired.example"
      desktops={[{ number: 1, unread: 0, highlight: false, active: true }]}
      windows={[]}
      mode="insert"
      pendingKeys={null}
      {...extra}
      onSelectDesktop={NOOP}
      onCloseDesktop={NOOP}
      onSelectWindow={NOOP}
      onShowMedia={NOOP}
    />,
  );
  return container;
}

describe('the status line posting-account entry', () => {
  it('shows the resolved account as a button after the active account', () => {
    const line = renderLine({ postingAs: { label: '@alice@x.example', onPick: NOOP } });

    expect(
      screen.getByRole('button', { name: 'Posting as @alice@x.example, change' }),
    ).toHaveTextContent('→@alice@x.example');
    expect(line.textContent).toBe('[23:07] [@lain@wired.example] →@alice@x.example [1*] [INS]');
  });

  it('shows →? and asks to choose when nothing resolves', () => {
    renderLine({ postingAs: { label: '?', onPick: NOOP } });

    expect(screen.getByRole('button', { name: 'No posting account, choose' })).toHaveTextContent(
      '→?',
    );
  });

  it.each([null, 'absent' as const])('shows nothing when postingAs is %s', (postingAs) => {
    renderLine(postingAs === 'absent' ? {} : { postingAs });

    expect(screen.queryByRole('button', { name: /posting/iu })).not.toBeInTheDocument();
  });

  it('calls onPick when clicked', () => {
    const onPick = vi.fn<() => void>();
    renderLine({ postingAs: { label: '@alice@x.example', onPick } });

    fireEvent.click(screen.getByRole('button', { name: 'Posting as @alice@x.example, change' }));

    expect(onPick).toHaveBeenCalledExactlyOnceWith();
  });
});
