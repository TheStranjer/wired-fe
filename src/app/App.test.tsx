import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe(App, () => {
  it('shows the banner as the page heading', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('WIRED');
  });

  it('greets with the message of the day', () => {
    render(<App />);

    expect(screen.getByText('Present day. Present time.')).toBeInTheDocument();
  });
});
