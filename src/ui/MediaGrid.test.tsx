/**
 * Tests for the media grid's images: nothing without attachments, the tiles of
 * one, two, four and five or more images and the `+N` button that shows the
 * rest, the alt text, the image links to the full file, and the ALT badge that
 * opens the description under the grid. The cover and the players have their
 * own test files.
 */
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FULL_URL, PREVIEW_URL, images, item, renderGrid } from './mediaGridHarness';

describe('MediaGrid images', () => {
  it('renders nothing without attachments', () => {
    const { container } = renderGrid([]);

    expect(container).toBeEmptyDOMElement();
  });

  it('draws one image from its preview, lazy and without a referrer', () => {
    renderGrid([item()]);

    const image = screen.getByRole('img', { name: 'a wall' });

    expect(image).toHaveAttribute('src', PREVIEW_URL);
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
  });

  it('links the image to the full file in a new tab', () => {
    renderGrid([item()]);

    const link = screen.getByRole('link');

    expect(link).toHaveAttribute('href', FULL_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it.each([null, ''])('words an image with description %j as without one', (description) => {
    renderGrid([item({ description })]);

    expect(screen.getByRole('img', { name: 'Image without description' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('falls back to the file itself when there is no preview', () => {
    renderGrid([item({ previewUrl: null })]);

    expect(screen.getByRole('img')).toHaveAttribute('src', FULL_URL);
  });

  it('shows the preview without a link when the file has no usable address', () => {
    renderGrid([item({ url: null })]);

    expect(screen.getByRole('img')).toHaveAttribute('src', PREVIEW_URL);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('says so when an image has no usable address at all', () => {
    renderGrid([item({ url: null, previewUrl: null })]);

    expect(screen.getByText('[no usable link]')).toBeInTheDocument();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it.each([2, 4])('draws %i images, each its own link, with no +N button', (count) => {
    renderGrid(images(count));

    expect(screen.getAllByRole('img')).toHaveLength(count);
    expect(screen.getAllByRole('link')).toHaveLength(count);
    expect(screen.queryByRole('button', { name: /more attachments/u })).toBeNull();
  });

  it('draws the first four of five with a +1 button over the last', () => {
    renderGrid(images(5));

    expect(screen.getAllByRole('img')).toHaveLength(4);
    expect(screen.queryByRole('img', { name: 'image 5' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Show 1 more attachments' })).toHaveTextContent('+1');
  });

  it('counts every hidden attachment and shows them all on a click', () => {
    renderGrid(images(6));

    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more attachments' }));

    expect(screen.getAllByRole('img')).toHaveLength(6);
    expect(screen.queryByRole('button', { name: /more attachments/u })).toBeNull();
  });
});

describe('MediaGrid ALT badge', () => {
  it('opens the description under the grid', () => {
    renderGrid(images(2));
    const badge = screen.getByRole('button', { name: 'ALT: description of attachment 2' });

    expect(badge).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('[ALT 2] image 2')).toBeNull();

    fireEvent.click(badge);

    expect(badge).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('[ALT 2] image 2')).toBeInTheDocument();
    expect(screen.queryByText('[ALT 1] image 1')).toBeNull();
  });

  it('closes the description on a second click', () => {
    renderGrid(images(2));
    const badge = screen.getByRole('button', { name: 'ALT: description of attachment 2' });

    fireEvent.click(badge);
    fireEvent.click(badge);

    expect(screen.queryByText('[ALT 2] image 2')).toBeNull();
  });

  it('gives only described attachments a badge', () => {
    renderGrid([item({ id: 'a', description: null }), item({ id: 'b' })]);

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'ALT: description of attachment 2' })).toBeVisible();
  });
});
