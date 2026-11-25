/**
 * Shared helpers for the media grid tests: attachment builders and a render
 * function with the grid closed to nothing but its defaults.
 */
import { render } from '@testing-library/react';

import { MediaGrid } from './MediaGrid';
import type { MediaGridProps } from './MediaGrid';
import type { MediaItem } from './MediaList';

/** The full-size file of the default attachment. */
export const FULL_URL = 'https://m.example/media/full.png';

/** The preview of the default attachment. */
export const PREVIEW_URL = 'https://m.example/media/small.png';

/** One described image attachment, overridden by {@link overrides}. */
export function item(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: 'm1',
    type: 'image',
    url: FULL_URL,
    previewUrl: PREVIEW_URL,
    description: 'a wall',
    ...overrides,
  };
}

/** {@link count} described images with distinct ids, `image 1` and on. */
export function images(count: number): readonly MediaItem[] {
  return Array.from({ length: count }, (_unused, index) =>
    item({ id: `m${String(index)}`, description: `image ${String(index + 1)}` }),
  );
}

/** Render the grid over {@link items}: not sensitive, warned or auto-expanded. */
export function renderGrid(
  items: readonly MediaItem[],
  overrides: Partial<MediaGridProps> = {},
): ReturnType<typeof render> {
  return render(
    <MediaGrid autoExpand={false} items={items} sensitive={false} warned={false} {...overrides} />,
  );
}
