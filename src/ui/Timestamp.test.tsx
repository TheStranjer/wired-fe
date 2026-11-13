import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Timestamp } from './Timestamp';
import type { TimestampProps } from './Timestamp';

const props: TimestampProps = { date: new Date(2026, 0, 2, 23, 4), format: '24h' };

describe(Timestamp, () => {
  it('renders the formatted clock time as text', () => {
    render(<Timestamp date={props.date} format={props.format} />);

    expect(screen.getByText('23:04')).toBeInTheDocument();
  });

  it('sets datetime to the ISO string of the date', () => {
    render(<Timestamp date={props.date} format="12h" />);

    expect(screen.getByText('11:04pm')).toHaveAttribute('datetime', props.date.toISOString());
  });
});
