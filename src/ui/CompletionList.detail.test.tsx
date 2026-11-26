/**
 * Tests for the detail of a suggestion row (WFE-311): a row with a detail has
 * it as its tooltip, the highlighted row's detail shows in a strip below the
 * rows that the option points at with `aria-describedby`, no strip shows when
 * the highlighted row has none or nothing is highlighted, and hovering a row
 * does not move the strip.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CompletionList, type CompletionRow } from './CompletionList';

/** Two rows with a detail each, and a third with none. */
const ROWS: readonly CompletionRow[] = [
  {
    label: '/float',
    description: 'Float a window',
    detail: '/float [view]\n  Float',
    pick: vi.fn(),
  },
  { label: '/flip', description: 'Flip a pane', detail: '/flip\n  Flip', pick: vi.fn() },
  { label: '/flop', description: 'Flop', pick: vi.fn() },
];

/** The list over {@link rows} with the row at {@link active} highlighted. */
function listAt(active: number, rows: readonly CompletionRow[] = ROWS): JSX.Element {
  return <CompletionList active={active} id="list" label="Suggestions" rows={rows} />;
}

describe('CompletionList detail', () => {
  it('gives a row with a detail the detail as its tooltip', () => {
    render(listAt(-1));

    expect(screen.getByRole('option', { name: /float/u })).toHaveAttribute(
      'title',
      '/float [view]\n  Float',
    );
    expect(screen.getByRole('option', { name: /flop/u })).not.toHaveAttribute('title');
  });

  it('shows the detail of the highlighted row in a strip the option points at', () => {
    render(listAt(1));

    const option = screen.getByRole('option', { name: /flip/u });
    const strip = document.getElementById('list-detail');

    expect(strip).toHaveTextContent('/flip Flip');
    expect(option).toHaveAccessibleDescription('/flip Flip');
    expect(option).toHaveAttribute('aria-describedby', 'list-detail');
    expect(screen.getByRole('option', { name: /float/u })).not.toHaveAttribute('aria-describedby');
  });

  it('shows no strip while nothing is highlighted', () => {
    render(listAt(-1));

    expect(document.getElementById('list-detail')).toBeNull();
  });

  it('shows no strip when the highlighted row has no detail', () => {
    render(listAt(2));

    expect(document.getElementById('list-detail')).toBeNull();
    expect(screen.getByRole('option', { name: /flop/u })).not.toHaveAttribute('aria-describedby');
  });

  it('shows no strip for rows from a provider without details', () => {
    render(listAt(0, [{ label: '#zen', description: '', pick: vi.fn() }]));

    expect(document.getElementById('list-detail')).toBeNull();
  });

  it('follows the highlighted row, not the pointer', () => {
    const { rerender } = render(listAt(0));

    fireEvent.mouseOver(screen.getByRole('option', { name: /flip/u }));
    fireEvent.mouseEnter(screen.getByRole('option', { name: /flip/u }));

    expect(document.getElementById('list-detail')).toHaveTextContent('/float [view] Float');

    rerender(listAt(1));

    expect(document.getElementById('list-detail')).toHaveTextContent('/flip Flip');
  });
});
