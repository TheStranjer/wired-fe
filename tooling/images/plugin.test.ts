import { decode } from 'jpeg-js';
import { PNG } from 'pngjs';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { DEFAULT_IMAGES } from './definitions';
import type { DefaultImage } from './definitions';
import {
  defaultImagesPlugin,
  encodeImage,
  emitDefaultImages,
  imageFileName,
  serveDefaultImage,
} from './plugin';
import type { ImageResponse } from './plugin';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const JPEG_SIGNATURE = [0xff, 0xd8];

/** Milliseconds the pure-JS encoders get: seconds on a fully loaded suite run. */
const LONG = 20000;

/** The pixel size each file name is fixed to by the contract (decision 9). */
const SIZES: Readonly<Record<string, readonly [number, number]>> = {
  'avi.png': [400, 400],
  'banner.png': [1500, 500],
  'thumbnail.jpg': [1200, 630],
  'mascot.png': [256, 256],
};

/** The fixed bundle paths, in contract order: where dist/ finds them. */
const IMAGE_FILE_NAMES = [
  'images/avi.png',
  'images/banner.png',
  'images/thumbnail.jpg',
  'images/mascot.png',
];

function imageNamed(name: DefaultImage['name']): DefaultImage {
  const definition = DEFAULT_IMAGES.find((candidate) => candidate.name === name);
  if (definition === undefined) {
    throw new Error(`decision 9 fixes ${name} in the definitions`);
  }
  return definition;
}

function decodedPngSize(bytes: Uint8Array): readonly [number, number] {
  const png = PNG.sync.read(Buffer.from(bytes));
  return [png.width, png.height];
}

function decodedJpegSize(bytes: Uint8Array): readonly [number, number] {
  const jpeg = decode(bytes, { useTArray: true });
  return [jpeg.width, jpeg.height];
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

/** The one argument a recorded mock call was made with. */
function soleArgument<T>(calls: readonly (readonly [T])[]): T {
  const first = calls[0];
  if (first === undefined) {
    throw new Error('the mock was never called');
  }
  return first[0];
}

function recordingResponse(): {
  response: ImageResponse;
  writeHead: Mock<(status: number, headers: Record<string, string>) => void>;
  end: Mock<(body: Uint8Array) => void>;
} {
  const writeHead = vi.fn<(status: number, headers: Record<string, string>) => void>();
  const end = vi.fn<(body: Uint8Array) => void>();
  return { response: { writeHead, end }, writeHead, end };
}

describe(encodeImage, () => {
  it(
    'writes a PNG signature into every .png definition',
    () => {
      const pngs = DEFAULT_IMAGES.filter((image) => image.name.endsWith('.png'));

      for (const definition of pngs) {
        expect(startsWith(encodeImage(definition), PNG_SIGNATURE)).toBe(true);
      }
    },
    LONG,
  );

  it(
    'writes a JPEG signature into the thumbnail',
    () => {
      expect(startsWith(encodeImage(imageNamed('thumbnail.jpg')), JPEG_SIGNATURE)).toBe(true);
    },
    LONG,
  );

  it(
    'paints every image at its contract size',
    () => {
      for (const definition of DEFAULT_IMAGES) {
        const bytes = encodeImage(definition);
        const [width, height] = SIZES[definition.name] ?? [0, 0];
        const size = definition.name.endsWith('.jpg')
          ? decodedJpegSize(bytes)
          : decodedPngSize(bytes);

        expect(size).toStrictEqual([width, height]);
      }
    },
    LONG,
  );
});

describe(imageFileName, () => {
  it('places every definition under the fixed images directory', () => {
    expect(DEFAULT_IMAGES.map(imageFileName)).toStrictEqual(IMAGE_FILE_NAMES);
  });
});

describe(emitDefaultImages, () => {
  it(
    'emits the four fixed files under images/',
    () => {
      const emit = vi.fn<(fileName: string, source: Uint8Array) => void>();
      emitDefaultImages(emit);

      expect(emit.mock.calls.map(([fileName]) => fileName)).toStrictEqual(IMAGE_FILE_NAMES);
    },
    LONG,
  );

  it(
    'emits valid image bytes as each asset source',
    () => {
      const emit = vi.fn<(fileName: string, source: Uint8Array) => void>();
      emitDefaultImages(emit);
      const [avi, banner, thumbnail, mascot] = emit.mock.calls.map(([, source]) => source);

      expect(startsWith(avi ?? new Uint8Array(), PNG_SIGNATURE)).toBe(true);
      expect(startsWith(banner ?? new Uint8Array(), PNG_SIGNATURE)).toBe(true);
      expect(startsWith(thumbnail ?? new Uint8Array(), JPEG_SIGNATURE)).toBe(true);
      expect(startsWith(mascot ?? new Uint8Array(), PNG_SIGNATURE)).toBe(true);
    },
    LONG,
  );
});

describe(serveDefaultImage, () => {
  it(
    'serves an avatar from memory as a PNG',
    () => {
      const { response, writeHead, end } = recordingResponse();

      expect(serveDefaultImage('/images/avi.png', response)).toBe(true);
      expect(writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'image/png' });
      expect(startsWith(soleArgument(end.mock.calls), PNG_SIGNATURE)).toBe(true);
    },
    LONG,
  );

  it(
    'serves the thumbnail as a JPEG',
    () => {
      const { response, writeHead, end } = recordingResponse();

      expect(serveDefaultImage('/images/thumbnail.jpg', response)).toBe(true);
      expect(writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'image/jpeg' });
      expect(startsWith(soleArgument(end.mock.calls), JPEG_SIGNATURE)).toBe(true);
    },
    LONG,
  );

  it(
    'serves a query-stringed URL as the same image',
    () => {
      const { response, writeHead, end } = recordingResponse();

      expect(serveDefaultImage('/images/mascot.png?v=1', response)).toBe(true);
      expect(writeHead).toHaveBeenCalledWith(200, { 'Content-Type': 'image/png' });
      expect(startsWith(soleArgument(end.mock.calls), PNG_SIGNATURE)).toBe(true);
    },
    LONG,
  );

  it('leaves paths it does not own to the server', () => {
    const { response, writeHead, end } = recordingResponse();

    expect(serveDefaultImage('/other/avi.png', response)).toBe(false);
    expect(serveDefaultImage('/images/missing.png', response)).toBe(false);
    expect(writeHead).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });
});

describe(defaultImagesPlugin, () => {
  it('is a named plugin wiring the build and the dev server', () => {
    const plugin = defaultImagesPlugin();

    expect(plugin.name).toBe('wired-default-images');
    expect(plugin.generateBundle).toBeTypeOf('function');
    expect(plugin.configureServer).toBeTypeOf('function');
  });
});
