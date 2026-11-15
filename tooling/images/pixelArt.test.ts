import { describe, expect, it } from 'vitest';

import { renderPixelArt } from './pixelArt';
import type { PixelImage } from './pixelArt';

const PALETTE = {
  '.': [0, 0, 0],
  '#': [51, 221, 102],
} as const;

/** The RGBA four-tuple of one pixel of an image. */
function pixelAt(image: PixelImage, x: number, y: number): readonly (number | undefined)[] {
  const at = (y * image.width + x) * 4;
  return [image.data[at], image.data[at + 1], image.data[at + 2], image.data[at + 3]];
}

describe(renderPixelArt, () => {
  it('scales the grid to width and height times the scale', () => {
    const image = renderPixelArt(['##.', '##.'], PALETTE, 4);

    expect(image.width).toBe(12);
    expect(image.height).toBe(8);
    expect(image.data).toHaveLength(12 * 8 * 4);
  });

  it('paints each grid cell as one solid block of its colour', () => {
    const image = renderPixelArt(['.#', '..'], PALETTE, 3);

    expect(pixelAt(image, 3, 0)).toStrictEqual([51, 221, 102, 255]);
    expect(pixelAt(image, 5, 0)).toStrictEqual([51, 221, 102, 255]);
    expect(pixelAt(image, 0, 0)).toStrictEqual([0, 0, 0, 255]);
    expect(pixelAt(image, 2, 4)).toStrictEqual([0, 0, 0, 255]);
    expect(pixelAt(image, 3, 2)).toStrictEqual([51, 221, 102, 255]);
  });

  it('keeps every pixel opaque', () => {
    const image = renderPixelArt(['#.', '.#'], PALETTE, 2);
    const alphas = Array.from(
      { length: image.width * image.height },
      (_, i) => image.data[i * 4 + 3],
    );

    expect(alphas).toStrictEqual(Array(16).fill(255));
  });

  it('renders a one-pixel cell at scale one', () => {
    const image = renderPixelArt(['#'], PALETTE, 1);

    expect(image.width).toBe(1);
    expect([...image.data]).toStrictEqual([51, 221, 102, 255]);
  });

  it('refuses rows of different widths', () => {
    expect(() => renderPixelArt(['##', '#'], PALETTE, 2)).toThrow('equally wide');
  });

  it('refuses an empty grid', () => {
    expect(() => renderPixelArt([], PALETTE, 2)).toThrow('at least one row');
  });

  it('refuses a character the palette does not define', () => {
    expect(() => renderPixelArt(['#?'], PALETTE, 2)).toThrow("character '?' with no colour");
  });
});
