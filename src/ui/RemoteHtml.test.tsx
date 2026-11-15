/**
 * Tests for RemoteHtml: hostile markup comes back sanitized (scripts gone,
 * formatting kept), links are forced to open safely, custom emoji render as
 * inline images, and the root element follows the inline flag.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RemoteHtml } from './RemoteHtml';

describe(RemoteHtml, () => {
  it('renders sanitized remote HTML', () => {
    const { container } = render(
      <RemoteHtml html="<p>hi <script>x</script><strong>there</strong></p>" />,
    );

    expect(container.textContent).toBe('hi there');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('strong')).toBeInTheDocument();
  });

  it('renders a div root by default', () => {
    const { container } = render(<RemoteHtml html="hello" />);

    expect(container.firstElementChild?.tagName).toBe('DIV');
  });

  it('renders a span root when inline', () => {
    const { container } = render(<RemoteHtml html="hello" inline />);

    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });

  it('makes links open in a new tab', () => {
    render(<RemoteHtml html='<a href="https://example.org/x">link</a>' />);

    expect(screen.getByRole('link', { name: 'link' })).toHaveAttribute('target', '_blank');
  });

  it('renders known shortcodes as inline images', () => {
    render(
      <RemoteHtml
        html="<p>i :cat: here</p>"
        emojis={[{ shortcode: 'cat', url: 'https://example.org/cat.png' }]}
      />,
    );

    expect(screen.getByRole('img', { name: ':cat:' })).toHaveAttribute(
      'src',
      'https://example.org/cat.png',
    );
  });

  it('leaves shortcodes as text without a status emoji list', () => {
    const { container } = render(<RemoteHtml html="<p>:cat:</p>" />);

    expect(container.textContent).toBe(':cat:');
    expect(container.querySelector('img')).toBeNull();
  });

  it('leaves shortcodes as text on an empty emoji list', () => {
    const { container } = render(<RemoteHtml html="<p>:cat:</p>" emojis={[]} />);

    expect(container.textContent).toBe(':cat:');
    expect(container.querySelector('img')).toBeNull();
  });
});
