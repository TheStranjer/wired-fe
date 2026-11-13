import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TopicBar } from './TopicBar';
import type { TopicBarProps } from './TopicBar';

const props: TopicBarProps = {
  windowTitle: '#home',
  accountLabel: '@lain@wired.example',
  topic: 'home timeline',
};

describe(TopicBar, () => {
  it('renders title, account and topic on one line', () => {
    const { container } = render(<TopicBar {...props} />);

    expect(container.textContent).toBe('#home @lain@wired.example ── home timeline');
    expect(container.querySelectorAll('span')).toHaveLength(4);
  });

  it('omits the account span when the label is null', () => {
    const { container } = render(
      <TopicBar {...props} accountLabel={null} windowTitle="status" topic="client messages" />,
    );

    expect(container.textContent).toBe('status ── client messages');
    expect(container.querySelectorAll('span')).toHaveLength(3);
  });

  it('hides the separator from assistive technology', () => {
    render(<TopicBar {...props} />);

    expect(screen.getByText('──')).toHaveAttribute('aria-hidden', 'true');
  });
});
