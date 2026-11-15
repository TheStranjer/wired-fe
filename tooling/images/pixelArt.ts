/**
 * The pixel-art renderer behind the generated default images (decision 9).
 *
 * Agents cannot create binary files by hand, so the images are defined as
 * character grids and painted up at build time: every grid character stands
 * for one palette colour and is scaled to a square of `scale` pixels. A
 * character the palette does not define is a drawing mistake, so the
 * renderer refuses it instead of shipping a broken image.
 */

/** A colour per grid character: RGB triples. Unknown characters throw. */
export type Palette = Readonly<Record<string, readonly [number, number, number]>>;

/** The palette keyed by code point, so painting does not re-scan it. */
type ColorMap = ReadonlyMap<number, readonly [number, number, number]>;

/** Pixels painted from a grid: RGBA, row-major, `width * height * 4` long. */
export type PixelImage = {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
};

/** The width every row must share; an empty or uneven grid is refused. */
function gridWidth(rows: readonly string[]): number {
  const first = rows[0];
  if (first === undefined || rows.some((row) => row.length !== first.length)) {
    throw new Error('pixel art needs at least one row, and all rows must be equally wide');
  }
  return first.length;
}

/** The palette keyed by the code point of its (single-character) keys. */
function colorMap(palette: Palette): ColorMap {
  return new Map(Object.entries(palette).map(([ch, rgb]) => [ch.codePointAt(0) ?? 0, rgb]));
}

/** One grid row painted out at `scale`, as the pixel line it repeats. */
function paintRow(row: string, colors: ColorMap, scale: number): Uint8Array {
  const line = new Uint8Array(row.length * scale * 4);
  let at = 0;
  for (const ch of row) {
    const rgb = colors.get(ch.codePointAt(0) ?? 0);
    if (rgb === undefined) {
      throw new Error(`pixel art uses character '${ch}' with no colour`);
    }
    const [r, g, b] = rgb;
    for (let i = 0; i < scale; i += 1) {
      line.set([r, g, b, 255], at);
      at += 4;
    }
  }
  return line;
}

/** Paint a character grid into a `scale`-times-larger RGBA image. */
export function renderPixelArt(
  rows: readonly string[],
  palette: Palette,
  scale: number,
): PixelImage {
  const colors = colorMap(palette);
  const width = gridWidth(rows) * scale;
  const height = rows.length * scale;
  const data = new Uint8Array(width * height * 4);
  let at = 0;
  for (const row of rows) {
    const line = paintRow(row, colors, scale);
    for (let i = 0; i < scale; i += 1) {
      data.set(line, at);
      at += line.length;
    }
  }
  return { width, height, data };
}
